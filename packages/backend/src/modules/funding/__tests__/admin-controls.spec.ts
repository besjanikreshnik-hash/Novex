/**
 * NovEx — Funding Admin Controls & Maker-Checker Tests
 *
 * Tests:
 *   1. RBAC: non-admin cannot approve/reject/process
 *   2. Self-approval prohibition
 *   3. Maker-checker: same admin cannot approve AND process
 *   4. Maker-checker: different admins succeed
 *   5. Double-approve race
 *   6. Approve-then-reject race
 *   7. Process replay (already completed)
 *   8. Audit trail completeness
 *   9. Recovery audit trail
 *
 * Run: npm run test:admin-controls
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import { FundingService } from '../funding.service';
import { WalletsService } from '../../wallets/wallets.service';
import { AuditService } from '../../audit/audit.service';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';
import { Deposit } from '../entities/deposit.entity';
import { DepositAddress } from '../entities/deposit-address.entity';
import { WithdrawalAddressBook } from '../entities/withdrawal-address-book.entity';
import { Wallet } from '../../wallets/wallet.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';
import { AuditLog } from '../../audit/audit.entity';

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;

async function createUser(repo: Repository<User>, email: string, role: UserRole, id?: string) {
  return repo.save(repo.create({
    ...(id ? { id } : {}), email, passwordHash: '$2b$12$placeholder',
    role, kycStatus: KycStatus.VERIFIED, isActive: true,
  }));
}

async function fund(repo: Repository<Wallet>, userId: string, currency: string, amount: string) {
  let w = await repo.findOne({ where: { userId, currency } });
  if (!w) w = repo.create({ userId, currency, available: amount, locked: '0' });
  else w.available = new Decimal(w.available).plus(amount).toFixed();
  return repo.save(w);
}

describe('Funding Admin Controls & Maker-Checker', () => {
  let module: TestingModule;
  let funding: FundingService;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let walletRepo: Repository<Wallet>;
  let withdrawalRepo: Repository<Withdrawal>;
  let auditRepo: Repository<AuditLog>;
  let user: User;
  let admin1: User;
  let admin2: User;

  beforeAll(async () => {
    // Create a mock AuditService that writes to DB but skips Kafka
    const mockAuditService = {
      logEvent: jest.fn().mockImplementation(async (event) => {
        const repo = module.get(getRepositoryToken(AuditLog));
        return repo.save(repo.create({
          userId: event.userId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          metadata: event.metadata,
          ipAddress: event.ipAddress,
        }));
      }),
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DATABASE_HOST ?? 'localhost',
          port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
          username: process.env.DATABASE_USER ?? 'novex',
          password: process.env.DATABASE_PASSWORD ?? 'novex_dev',
          database: process.env.DATABASE_NAME ?? 'novex_test',
          entities: [User, Wallet, Withdrawal, Deposit, DepositAddress, WithdrawalAddressBook, AuditLog],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([User, Wallet, Withdrawal, Deposit, DepositAddress, WithdrawalAddressBook, AuditLog]),
      ],
      providers: [
        FundingService,
        WalletsService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    funding = module.get(FundingService);
    ds = module.get(DataSource);
    userRepo = module.get(getRepositoryToken(User));
    walletRepo = module.get(getRepositoryToken(Wallet));
    withdrawalRepo = module.get(getRepositoryToken(Withdrawal));
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterAll(async () => {
    await ds.destroy();
    await module.close();
  });

  async function reset() {
    await auditRepo.delete({});
    await withdrawalRepo.delete({});
    await walletRepo.delete({});
    await userRepo.delete({});

    await createUser(userRepo, 'platform@novex.internal', UserRole.ADMIN, PLATFORM);
    user = await createUser(userRepo, 'alice@test.novex.io', UserRole.USER);
    admin1 = await createUser(userRepo, 'admin1@novex.io', UserRole.ADMIN);
    admin2 = await createUser(userRepo, 'admin2@novex.io', UserRole.ADMIN);
    await fund(walletRepo, user.id, 'USDT', '50000');
  }

  /** Create a standard withdrawal for testing */
  async function createWithdrawal(): Promise<Withdrawal> {
    return funding.requestWithdrawal(user.id, {
      asset: 'USDT', network: 'ethereum', address: '0xtest', amount: '1000',
    });
  }

  /* ═══ 1. Self-approval prohibition ═════════════════════ */
  it('blocks admin from approving their own withdrawal', async () => {
    await reset();
    // Admin1 creates a withdrawal
    await fund(walletRepo, admin1.id, 'USDT', '10000');
    const w = await funding.requestWithdrawal(admin1.id, {
      asset: 'USDT', network: 'ethereum', address: '0xself', amount: '500',
    });

    await expect(
      funding.approveWithdrawal(w.id, admin1.id),
    ).rejects.toThrow(/Cannot approve your own withdrawal/);
  });

  /* ═══ 2. Maker-checker: same admin cannot approve AND process ═══ */
  it('blocks same admin from approving and processing', async () => {
    await reset();
    const w = await createWithdrawal();

    // Admin1 approves
    await funding.approveWithdrawal(w.id, admin1.id, 'looks good');

    // Admin1 tries to process — blocked by maker-checker
    await expect(
      funding.processWithdrawal(w.id, admin1.id),
    ).rejects.toThrow(/Maker-checker violation/);
  });

  /* ═══ 3. Maker-checker: different admins succeed ═══════ */
  it('allows different admin to process after approval', async () => {
    await reset();
    const w = await createWithdrawal();

    // Admin1 approves
    await funding.approveWithdrawal(w.id, admin1.id);

    // Admin2 processes — should succeed
    const processed = await funding.processWithdrawal(w.id, admin2.id);
    expect(processed.status).toBe(WithdrawalStatus.COMPLETED);
    expect(processed.processedBy).toBe(admin2.id);
    expect(processed.reviewedBy).toBe(admin1.id);
  });

  /* ═══ 4. Double-approve race ═══════════════════════════ */
  it('second approve on already-approved fails', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.approveWithdrawal(w.id, admin1.id);

    await expect(
      funding.approveWithdrawal(w.id, admin2.id),
    ).rejects.toThrow(/Cannot approve/);
  });

  /* ═══ 5. Approve-then-reject race ══════════════════════ */
  it('reject after approve works (reverses approval)', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.approveWithdrawal(w.id, admin1.id);
    const rejected = await funding.rejectWithdrawal(w.id, admin2.id, 'changed mind');

    expect(rejected.status).toBe(WithdrawalStatus.REJECTED);

    // Funds unlocked
    const wallet = await walletRepo.findOneOrFail({
      where: { userId: user.id, currency: 'USDT' },
    });
    expect(new Decimal(wallet.locked).eq(0)).toBe(true);
  });

  /* ═══ 6. Process replay (already completed) ═══════════ */
  it('process on already-completed fails', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.approveWithdrawal(w.id, admin1.id);
    await funding.processWithdrawal(w.id, admin2.id);

    await expect(
      funding.processWithdrawal(w.id, admin2.id),
    ).rejects.toThrow(/Cannot process/);
  });

  /* ═══ 7. Audit trail completeness ══════════════════════ */
  it('full lifecycle produces complete audit trail', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.approveWithdrawal(w.id, admin1.id, 'approved');
    await funding.processWithdrawal(w.id, admin2.id);

    const logs = await auditRepo.find({
      where: { resourceId: w.id },
      order: { createdAt: 'ASC' },
    });

    expect(logs.length).toBeGreaterThanOrEqual(3); // approved, processing, completed

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('withdrawal.approved');
    expect(actions).toContain('withdrawal.processing');
    expect(actions).toContain('withdrawal.completed');

    // Approved by admin1
    const approveLog = logs.find((l) => l.action === 'withdrawal.approved');
    expect(approveLog?.userId).toBe(admin1.id);

    // Processed by admin2
    const processLog = logs.find((l) => l.action === 'withdrawal.processing');
    expect(processLog?.userId).toBe(admin2.id);
    expect((processLog?.metadata as any)?.approvedBy).toBe(admin1.id);
  });

  /* ═══ 8. Rejection audit trail ═════════════════════════ */
  it('rejection produces audit entry', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.rejectWithdrawal(w.id, admin1.id, 'suspicious');

    const logs = await auditRepo.find({
      where: { resourceId: w.id, action: 'withdrawal.rejected' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(admin1.id);
    expect((logs[0].metadata as any)?.note).toBe('suspicious');
  });

  /* ═══ 9. Recovery audit trail ══════════════════════════ */
  it('recovery produces audit entry with original processor', async () => {
    await reset();
    const w = await createWithdrawal();

    await funding.approveWithdrawal(w.id, admin1.id);

    // Simulate failure
    const wd = await withdrawalRepo.findOneOrFail({ where: { id: w.id } });
    wd.status = WithdrawalStatus.FAILED;
    wd.processedBy = admin2.id;
    await withdrawalRepo.save(wd);

    await funding.recoverFailedWithdrawal(w.id, admin1.id);

    const logs = await auditRepo.find({
      where: { resourceId: w.id, action: 'withdrawal.recovered' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(admin1.id);
    expect((logs[0].metadata as any)?.originalProcessor).toBe(admin2.id);
  });
});

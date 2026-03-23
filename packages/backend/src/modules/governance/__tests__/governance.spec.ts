/**
 * NovEx — Governance & Maker-Checker Integration Tests
 *
 * Tests:
 *   1. Propose → approve by different admin → executed
 *   2. Self-approval blocked (maker-checker)
 *   3. Double-approve on already-approved blocked
 *   4. Reject works, prevents execution
 *   5. Expired request cannot be approved
 *   6. Emergency execute bypasses maker-checker
 *   7. Pair halt/unhalt execution verified
 *   8. Fee change execution verified
 *   9. KYC override execution verified
 *  10. Previous state captured for rollback
 *  11. Audit trail completeness
 *
 * Run: npm run test:governance
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Repository, DataSource } from 'typeorm';

import { GovernanceService } from '../governance.service';
import { ChangeRequest, ChangeRequestType, ChangeRequestStatus } from '../entities/change-request.entity';
import { TradingPair } from '../../trading/entities/trading-pair.entity';
import { User, UserRole, KycStatus } from '../../users/user.entity';
import { AuditLog } from '../../audit/audit.entity';
import { AuditService } from '../../audit/audit.service';

describe('Governance & Maker-Checker', () => {
  let module: TestingModule;
  let gov: GovernanceService;
  let ds: DataSource;
  let crRepo: Repository<ChangeRequest>;
  let pairRepo: Repository<TradingPair>;
  let userRepo: Repository<User>;
  let auditRepo: Repository<AuditLog>;
  let admin1: User;
  let admin2: User;
  let opsUser: User;

  beforeAll(async () => {
    const mockAudit = {
      logEvent: jest.fn().mockImplementation(async (event) => {
        const repo = module.get(getRepositoryToken(AuditLog));
        return repo.save(repo.create({
          userId: event.userId, action: event.action,
          resourceType: event.resourceType, resourceId: event.resourceId,
          metadata: event.metadata,
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
          entities: [ChangeRequest, TradingPair, User, AuditLog],
          synchronize: true, dropSchema: true,
        }),
        TypeOrmModule.forFeature([ChangeRequest, TradingPair, User, AuditLog]),
      ],
      providers: [
        GovernanceService,
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    gov = module.get(GovernanceService);
    ds = module.get(DataSource);
    crRepo = module.get(getRepositoryToken(ChangeRequest));
    pairRepo = module.get(getRepositoryToken(TradingPair));
    userRepo = module.get(getRepositoryToken(User));
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterAll(async () => { await ds.destroy(); await module.close(); });

  async function reset() {
    await auditRepo.delete({});
    await crRepo.delete({});
    await pairRepo.delete({});
    await userRepo.delete({});

    admin1 = await userRepo.save(userRepo.create({
      email: 'admin1@novex.io', passwordHash: 'x', role: UserRole.ADMIN, isActive: true,
    }));
    admin2 = await userRepo.save(userRepo.create({
      email: 'admin2@novex.io', passwordHash: 'x', role: UserRole.ADMIN, isActive: true,
    }));
    opsUser = await userRepo.save(userRepo.create({
      email: 'ops@novex.io', passwordHash: 'x', role: UserRole.OPS, isActive: true,
    }));

    await pairRepo.save(pairRepo.create({
      symbol: 'BTC_USDT', baseCurrency: 'BTC', quoteCurrency: 'USDT',
      makerFee: '0.001', takerFee: '0.002', isActive: true,
      stpMode: 'cancel_taker', maxQuantity: '0', minQuantity: '0.00001', minNotional: '10',
    }));
  }

  /* ═══ 1. Happy path: propose → approve → executed ══════ */
  it('propose → approve by different admin → executed', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Maintenance', { symbol: 'BTC_USDT' });
    expect(cr.status).toBe(ChangeRequestStatus.PENDING);

    const approved = await gov.approve(cr.id, admin2.id, 'Confirmed');
    expect(approved.status).toBe(ChangeRequestStatus.EXECUTED);
    expect(approved.approvedBy).toBe(admin2.id);

    // Pair should be halted
    const pair = await pairRepo.findOneOrFail({ where: { symbol: 'BTC_USDT' } });
    expect(pair.isActive).toBe(false);
  });

  /* ═══ 2. Self-approval blocked ═════════════════════════ */
  it('proposer cannot approve their own request', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Test', { symbol: 'BTC_USDT' });

    await expect(
      gov.approve(cr.id, admin1.id),
    ).rejects.toThrow(/proposer cannot approve/);
  });

  /* ═══ 3. Double-approve blocked ════════════════════════ */
  it('cannot approve already-approved request', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Test', { symbol: 'BTC_USDT' });
    await gov.approve(cr.id, admin2.id);

    await expect(
      gov.approve(cr.id, admin2.id),
    ).rejects.toThrow(/Cannot approve/);
  });

  /* ═══ 4. Reject prevents execution ════════════════════ */
  it('rejected request cannot be approved', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.FEE_CHANGE, 'Bad idea', { symbol: 'BTC_USDT', makerFee: '0' });
    await gov.reject(cr.id, admin2.id, 'Not appropriate');

    await expect(
      gov.approve(cr.id, admin2.id),
    ).rejects.toThrow(/Cannot approve/);
  });

  /* ═══ 5. Expired request ══════════════════════════════ */
  it('expired request cannot be approved', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Old', { symbol: 'BTC_USDT' });

    // Manually expire
    cr.expiresAt = new Date(Date.now() - 1000);
    await crRepo.save(cr);

    await expect(
      gov.approve(cr.id, admin2.id),
    ).rejects.toThrow(/expired/);
  });

  /* ═══ 6. Emergency execute ═════════════════════════════ */
  it('emergency execute bypasses maker-checker', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Critical', { symbol: 'BTC_USDT' });

    // Same admin can emergency-execute their own proposal
    const result = await gov.emergencyExecute(cr.id, admin1.id, 'Active exploit detected');
    expect(result.status).toBe(ChangeRequestStatus.EXECUTED);
    expect(result.isEmergency).toBe(true);
  });

  /* ═══ 7. Pair halt/unhalt verified ═════════════════════ */
  it('pair halt → unhalt roundtrip', async () => {
    await reset();

    // Halt
    const halt = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Halt', { symbol: 'BTC_USDT' });
    await gov.approve(halt.id, admin2.id);
    let pair = await pairRepo.findOneOrFail({ where: { symbol: 'BTC_USDT' } });
    expect(pair.isActive).toBe(false);

    // Unhalt
    const unhalt = await gov.propose(admin2.id, ChangeRequestType.PAIR_UNHALT, 'Unhalt', { symbol: 'BTC_USDT' });
    await gov.approve(unhalt.id, admin1.id);
    pair = await pairRepo.findOneOrFail({ where: { symbol: 'BTC_USDT' } });
    expect(pair.isActive).toBe(true);
  });

  /* ═══ 8. Fee change verified ═══════════════════════════ */
  it('fee change applies correctly', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.FEE_CHANGE, 'Reduce fees', {
      symbol: 'BTC_USDT', makerFee: '0.0005', takerFee: '0.001',
    });
    await gov.approve(cr.id, admin2.id);

    const pair = await pairRepo.findOneOrFail({ where: { symbol: 'BTC_USDT' } });
    expect(pair.makerFee).toBe('0.000500000000000000');
    expect(pair.takerFee).toBe('0.001000000000000000');
  });

  /* ═══ 9. KYC override verified ═════════════════════════ */
  it('KYC manual override changes user status', async () => {
    await reset();
    const target = await userRepo.save(userRepo.create({
      email: 'target@test.io', passwordHash: 'x', role: UserRole.USER, isActive: true,
      kycStatus: KycStatus.REJECTED,
    }));

    const cr = await gov.propose(admin1.id, ChangeRequestType.KYC_MANUAL_OVERRIDE, 'Manual approval', {
      userId: target.id, newStatus: KycStatus.VERIFIED,
    });
    await gov.approve(cr.id, admin2.id);

    const updated = await userRepo.findOneOrFail({ where: { id: target.id } });
    expect(updated.kycStatus).toBe(KycStatus.VERIFIED);
  });

  /* ═══ 10. Previous state captured ══════════════════════ */
  it('captures previous state for rollback reference', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.FEE_CHANGE, 'Change', {
      symbol: 'BTC_USDT', makerFee: '0.01',
    });

    expect(cr.previousState).toBeDefined();
    expect((cr.previousState as any).makerFee).toBeDefined();
    expect((cr.previousState as any).isActive).toBe(true);
  });

  /* ═══ 11. Audit trail completeness ═════════════════════ */
  it('full lifecycle has complete audit trail', async () => {
    await reset();
    const cr = await gov.propose(admin1.id, ChangeRequestType.PAIR_HALT, 'Audit test', { symbol: 'BTC_USDT' });
    await gov.approve(cr.id, admin2.id);

    const logs = await auditRepo.find({
      where: { resourceId: cr.id },
      order: { createdAt: 'ASC' },
    });

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('governance.proposed.pair_halt');
    expect(actions).toContain('governance.approved.pair_halt');
    expect(actions).toContain('governance.executed.pair_halt');
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });
});

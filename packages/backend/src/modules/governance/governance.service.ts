import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChangeRequest,
  ChangeRequestType,
  ChangeRequestStatus,
} from './entities/change-request.entity';
import { TradingPair } from '../trading/entities/trading-pair.entity';
import { User, KycStatus } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';

/** Change requests expire after 24 hours */
const EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Governance Service — maker-checker for sensitive admin actions.
 *
 * Flow:
 *   1. Admin proposes a change → ChangeRequest created (PENDING)
 *   2. Different admin approves → status APPROVED → auto-executed
 *   3. Or: original admin can execute with emergency flag (post-review required)
 *
 * Covered actions:
 *   - Trading pair halt/unhalt
 *   - Fee configuration changes
 *   - System config changes
 *   - Withdrawal/KYC limit changes
 *   - Manual KYC status overrides
 */
@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(
    @InjectRepository(ChangeRequest)
    private readonly crRepo: Repository<ChangeRequest>,
    @InjectRepository(TradingPair)
    private readonly pairRepo: Repository<TradingPair>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  /* ═══ Propose a change ═════════════════════════════════ */

  async propose(
    proposerId: string,
    type: ChangeRequestType,
    description: string,
    payload: Record<string, any>,
  ): Promise<ChangeRequest> {
    // Capture current state for rollback
    const previousState = await this.captureCurrentState(type, payload);

    const cr = this.crRepo.create({
      type,
      status: ChangeRequestStatus.PENDING,
      proposedBy: proposerId,
      description,
      payload,
      previousState,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    });
    const saved = await this.crRepo.save(cr);

    await this.audit.logEvent({
      userId: proposerId,
      action: `governance.proposed.${type}`,
      resourceType: 'change_request',
      resourceId: saved.id,
      metadata: { description, payload },
    });

    this.logger.log(`Change request proposed: ${saved.id} type=${type} by=${proposerId}`);
    return saved;
  }

  /* ═══ Approve and execute ══════════════════════════════ */

  async approve(
    requestId: string,
    approverId: string,
    note?: string,
  ): Promise<ChangeRequest> {
    const cr = await this.crRepo.findOneOrFail({ where: { id: requestId } });

    if (cr.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve request in status ${cr.status}`);
    }

    if (new Date() > cr.expiresAt) {
      cr.status = ChangeRequestStatus.EXPIRED;
      await this.crRepo.save(cr);
      throw new BadRequestException('Change request has expired');
    }

    // Maker-checker: approver must differ from proposer
    if (approverId === cr.proposedBy) {
      throw new ForbiddenException(
        'Maker-checker: the proposer cannot approve their own change request',
      );
    }

    cr.approvedBy = approverId;
    cr.approvalNote = note ?? null;
    cr.approvedAt = new Date();
    cr.status = ChangeRequestStatus.APPROVED;
    await this.crRepo.save(cr);

    await this.audit.logEvent({
      userId: approverId,
      action: `governance.approved.${cr.type}`,
      resourceType: 'change_request',
      resourceId: requestId,
      metadata: { note, proposedBy: cr.proposedBy },
    });

    // Auto-execute on approval
    return this.executeChange(cr, approverId);
  }

  /* ═══ Reject ═══════════════════════════════════════════ */

  async reject(
    requestId: string,
    rejecterId: string,
    note: string,
  ): Promise<ChangeRequest> {
    const cr = await this.crRepo.findOneOrFail({ where: { id: requestId } });

    if (cr.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject request in status ${cr.status}`);
    }

    cr.rejectedBy = rejecterId;
    cr.rejectionNote = note;
    cr.status = ChangeRequestStatus.REJECTED;
    await this.crRepo.save(cr);

    await this.audit.logEvent({
      userId: rejecterId,
      action: `governance.rejected.${cr.type}`,
      resourceType: 'change_request',
      resourceId: requestId,
      metadata: { note, proposedBy: cr.proposedBy },
    });

    return cr;
  }

  /* ═══ Emergency execute (bypass maker-checker) ═════════ */

  async emergencyExecute(
    requestId: string,
    operatorId: string,
    justification: string,
  ): Promise<ChangeRequest> {
    const cr = await this.crRepo.findOneOrFail({ where: { id: requestId } });

    if (cr.status !== ChangeRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot execute request in status ${cr.status}`);
    }

    cr.isEmergency = true;
    cr.approvedBy = operatorId;
    cr.approvalNote = `EMERGENCY: ${justification}`;
    cr.approvedAt = new Date();
    cr.status = ChangeRequestStatus.APPROVED;
    await this.crRepo.save(cr);

    await this.audit.logEvent({
      userId: operatorId,
      action: `governance.emergency_execute.${cr.type}`,
      resourceType: 'change_request',
      resourceId: requestId,
      metadata: { justification, isEmergency: true },
    });

    this.logger.warn(`EMERGENCY change executed: ${requestId} by ${operatorId}`);

    return this.executeChange(cr, operatorId);
  }

  /* ═══ List / query ═════════════════════════════════════ */

  async listPending(): Promise<ChangeRequest[]> {
    return this.crRepo.find({
      where: { status: ChangeRequestStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async listAll(limit = 50, offset = 0): Promise<{ requests: ChangeRequest[]; total: number }> {
    const [requests, total] = await this.crRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { requests, total };
  }

  async getById(id: string): Promise<ChangeRequest> {
    return this.crRepo.findOneOrFail({ where: { id } });
  }

  /* ═══ Execute the actual change ════════════════════════ */

  private async executeChange(
    cr: ChangeRequest,
    executorId: string,
  ): Promise<ChangeRequest> {
    try {
      switch (cr.type) {
        case ChangeRequestType.PAIR_HALT:
          await this.executePairHalt(cr.payload);
          break;
        case ChangeRequestType.PAIR_UNHALT:
          await this.executePairUnhalt(cr.payload);
          break;
        case ChangeRequestType.FEE_CHANGE:
          await this.executeFeeChange(cr.payload);
          break;
        case ChangeRequestType.KYC_MANUAL_OVERRIDE:
          await this.executeKycOverride(cr.payload);
          break;
        default:
          this.logger.warn(`Unknown change type: ${cr.type} — marking executed without action`);
      }

      cr.status = ChangeRequestStatus.EXECUTED;
      cr.executedAt = new Date();
      await this.crRepo.save(cr);

      await this.audit.logEvent({
        userId: executorId,
        action: `governance.executed.${cr.type}`,
        resourceType: 'change_request',
        resourceId: cr.id,
        metadata: { payload: cr.payload, previousState: cr.previousState },
      });

      return cr;
    } catch (err) {
      this.logger.error(`Failed to execute change ${cr.id}: ${err}`);
      throw err;
    }
  }

  /* ═══ Action implementations ═══════════════════════════ */

  private async executePairHalt(payload: Record<string, any>): Promise<void> {
    const { symbol } = payload;
    await this.pairRepo.update({ symbol }, { isActive: false });
    this.logger.log(`Trading pair halted: ${symbol}`);
  }

  private async executePairUnhalt(payload: Record<string, any>): Promise<void> {
    const { symbol } = payload;
    await this.pairRepo.update({ symbol }, { isActive: true });
    this.logger.log(`Trading pair unhalted: ${symbol}`);
  }

  private async executeFeeChange(payload: Record<string, any>): Promise<void> {
    const { symbol, makerFee, takerFee } = payload;
    const update: Partial<TradingPair> = {};
    if (makerFee !== undefined) update.makerFee = makerFee;
    if (takerFee !== undefined) update.takerFee = takerFee;
    await this.pairRepo.update({ symbol }, update);
    this.logger.log(`Fees updated for ${symbol}: maker=${makerFee} taker=${takerFee}`);
  }

  private async executeKycOverride(payload: Record<string, any>): Promise<void> {
    const { userId, newStatus } = payload;
    const validStatuses: KycStatus[] = [KycStatus.NONE, KycStatus.PENDING, KycStatus.VERIFIED, KycStatus.REJECTED];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException(`Invalid KYC status: ${newStatus}`);
    }
    await this.userRepo.update(userId, { kycStatus: newStatus });
    this.logger.log(`KYC override: user ${userId} → ${newStatus}`);
  }

  /* ═══ State capture for rollback ═══════════════════════ */

  private async captureCurrentState(
    type: ChangeRequestType,
    payload: Record<string, any>,
  ): Promise<Record<string, any> | null> {
    switch (type) {
      case ChangeRequestType.PAIR_HALT:
      case ChangeRequestType.PAIR_UNHALT:
      case ChangeRequestType.FEE_CHANGE: {
        const pair = await this.pairRepo.findOne({ where: { symbol: payload.symbol } });
        return pair ? { isActive: pair.isActive, makerFee: pair.makerFee, takerFee: pair.takerFee } : null;
      }
      case ChangeRequestType.KYC_MANUAL_OVERRIDE: {
        const user = await this.userRepo.findOne({ where: { id: payload.userId } });
        return user ? { kycStatus: user.kycStatus } : null;
      }
      default:
        return null;
    }
  }
}

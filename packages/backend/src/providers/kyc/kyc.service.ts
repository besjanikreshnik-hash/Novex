import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KYC_PROVIDER, KycProvider, KycVerificationStatus, KycWebhookPayload } from './kyc-provider.interface';
import { User, KycStatus } from '../../modules/users/user.entity';
import { MetricsService } from '../../common/metrics/metrics.service';

/**
 * KYC Service — orchestrates verification flow between NovEx and the KYC vendor.
 *
 * Flow:
 *   1. User submits KYC → createSession() → vendor creates applicant → returns URL
 *   2. User completes verification in vendor widget
 *   3. Vendor sends webhook → handleWebhook() → update user.kycStatus
 *   4. Or: admin triggers poll → pollStatus() → update user.kycStatus
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  /** Maps vendor externalId → NovEx userId for webhook lookups */
  private readonly externalIdMap = new Map<string, string>();

  constructor(
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly events: EventEmitter2,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Create a verification session for a user.
   * Returns the vendor URL to embed/redirect.
   */
  async createSession(userId: string): Promise<{ verificationUrl: string; externalId: string }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('Already verified');
    }

    const applicant = await this.provider.createApplicant(userId, user.email, 1);
    this.externalIdMap.set(applicant.externalId, userId);

    // Update user to pending
    user.kycStatus = KycStatus.PENDING;
    await this.userRepo.save(user);

    this.logger.log(`KYC session created for user ${userId}: ${applicant.externalId}`);

    return {
      verificationUrl: applicant.verificationUrl,
      externalId: applicant.externalId,
    };
  }

  /**
   * Poll vendor for current status and update NovEx accordingly.
   */
  async pollStatus(externalId: string): Promise<void> {
    const status = await this.provider.getStatus(externalId);
    const userId = this.externalIdMap.get(externalId);
    if (!userId) {
      this.logger.warn(`Unknown externalId: ${externalId}`);
      return;
    }

    await this.applyStatus(userId, status.status, status.tier, status.riskFlags);
  }

  /**
   * Process an incoming webhook from the KYC vendor.
   */
  async handleWebhook(payload: KycWebhookPayload): Promise<void> {
    // Verify signature
    if (!this.provider.verifyWebhookSignature(payload)) {
      this.logger.warn('KYC webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const result = await this.provider.handleWebhook(payload);

    await this.applyStatus(
      result.userId,
      result.status.status,
      result.status.tier,
      result.status.riskFlags,
    );
  }

  /**
   * Apply a verification status to a user.
   */
  private async applyStatus(
    userId: string,
    vendorStatus: KycVerificationStatus,
    tier: 0 | 1 | 2,
    riskFlags: string[],
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User not found for KYC update: ${userId}`);
      return;
    }

    const previousStatus = user.kycStatus;
    let newStatus: KycStatus;

    switch (vendorStatus) {
      case KycVerificationStatus.APPROVED:
        newStatus = KycStatus.VERIFIED;
        break;
      case KycVerificationStatus.REJECTED:
        newStatus = KycStatus.REJECTED;
        break;
      case KycVerificationStatus.PENDING:
      case KycVerificationStatus.IN_REVIEW:
      case KycVerificationStatus.RETRY:
        newStatus = KycStatus.PENDING;
        break;
      default:
        newStatus = KycStatus.NONE;
    }

    if (newStatus !== previousStatus) {
      user.kycStatus = newStatus;
      await this.userRepo.save(user);

      this.events.emit('kyc.status_changed', {
        userId,
        previousStatus,
        newStatus,
        riskFlags,
      });

      this.logger.log(
        `KYC status updated: user=${userId} ${previousStatus}→${newStatus} flags=[${riskFlags.join(',')}]`,
      );
    }
  }
}

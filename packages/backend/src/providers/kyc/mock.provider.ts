import { Injectable, Logger } from '@nestjs/common';
import {
  KycProvider,
  KycApplicant,
  KycStatusResult,
  KycVerificationStatus,
  KycWebhookPayload,
  KycWebhookResult,
} from './kyc-provider.interface';

/**
 * Mock KYC Provider — for development and testing.
 *
 * Behavior controlled by email patterns:
 *   - *@approved.test  → instant approval (tier 1)
 *   - *@rejected.test  → instant rejection
 *   - *@pending.test   → stays pending
 *   - *@retry.test     → retry state
 *   - anything else    → pending (update via webhook)
 */
@Injectable()
export class MockKycProvider implements KycProvider {
  private readonly logger = new Logger(MockKycProvider.name);
  private readonly store = new Map<string, { userId: string; email: string; status: KycStatusResult }>();

  async createApplicant(userId: string, email: string, tier: number): Promise<KycApplicant> {
    const externalId = `mock-kyc-${userId}-${Date.now()}`;

    const status = this.deriveStatusFromEmail(email, externalId);
    this.store.set(externalId, { userId, email, status });

    this.logger.log(`Mock KYC applicant created: ${externalId} (${email}) → ${status.status}`);

    return {
      externalId,
      userId,
      verificationUrl: `https://mock-kyc.novex.local/verify/${externalId}`,
    };
  }

  async getStatus(externalId: string): Promise<KycStatusResult> {
    const entry = this.store.get(externalId);
    if (!entry) {
      return {
        externalId,
        status: KycVerificationStatus.ERROR,
        tier: 0,
        riskFlags: [],
        rejectionReason: 'Applicant not found',
      };
    }
    return entry.status;
  }

  async handleWebhook(payload: KycWebhookPayload): Promise<KycWebhookResult> {
    const { externalId, userId, status: newStatus } = payload.body;
    const entry = this.store.get(externalId);

    const status: KycStatusResult = {
      externalId,
      status: newStatus ?? KycVerificationStatus.APPROVED,
      tier: newStatus === KycVerificationStatus.APPROVED ? 1 : 0,
      riskFlags: [],
      rawResponse: payload.body,
    };

    if (entry) {
      entry.status = status;
    }

    return { userId: userId ?? entry?.userId ?? '', status };
  }

  verifyWebhookSignature(_payload: any): boolean {
    return true; // mock always trusts
  }

  /** Force a status change for testing */
  setStatus(externalId: string, status: KycVerificationStatus, tier: 0 | 1 | 2 = 0): void {
    const entry = this.store.get(externalId);
    if (entry) {
      entry.status = { ...entry.status, status, tier };
    }
  }

  private deriveStatusFromEmail(email: string, externalId: string): KycStatusResult {
    const base = { externalId, riskFlags: [] as string[] };

    if (email.endsWith('@approved.test')) {
      return { ...base, status: KycVerificationStatus.APPROVED, tier: 1 };
    }
    if (email.endsWith('@rejected.test')) {
      return { ...base, status: KycVerificationStatus.REJECTED, tier: 0, rejectionReason: 'Mock rejection' };
    }
    if (email.endsWith('@retry.test')) {
      return { ...base, status: KycVerificationStatus.RETRY, tier: 0 };
    }
    return { ...base, status: KycVerificationStatus.PENDING, tier: 0 };
  }
}

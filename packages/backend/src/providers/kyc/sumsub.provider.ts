import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  KycProvider,
  KycApplicant,
  KycStatusResult,
  KycVerificationStatus,
  KycWebhookPayload,
  KycWebhookResult,
} from './kyc-provider.interface';

/**
 * Sumsub KYC Provider — Sandbox Implementation
 *
 * Uses the Sumsub REST API (https://docs.sumsub.com/).
 * In sandbox mode, test applicants can be approved/rejected via the Sumsub dashboard.
 *
 * Required env vars:
 *   SUMSUB_APP_TOKEN    — API app token
 *   SUMSUB_SECRET_KEY   — API secret for HMAC signing
 *   SUMSUB_BASE_URL     — https://api.sumsub.com (production) or https://test-api.sumsub.com (sandbox)
 *   SUMSUB_WEBHOOK_SECRET — Secret for webhook signature verification
 *   SUMSUB_LEVEL_NAME   — Verification level name (e.g., 'basic-kyc-level')
 */
@Injectable()
export class SumsubProvider implements KycProvider {
  private readonly logger = new Logger(SumsubProvider.name);
  private readonly appToken: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private readonly levelName: string;

  constructor(private readonly config: ConfigService) {
    this.appToken = config.get<string>('SUMSUB_APP_TOKEN', '');
    this.secretKey = config.get<string>('SUMSUB_SECRET_KEY', '');
    this.baseUrl = config.get<string>('SUMSUB_BASE_URL', 'https://test-api.sumsub.com');
    this.webhookSecret = config.get<string>('SUMSUB_WEBHOOK_SECRET', '');
    this.levelName = config.get<string>('SUMSUB_LEVEL_NAME', 'basic-kyc-level');
  }

  async createApplicant(userId: string, email: string, tier: number): Promise<KycApplicant> {
    const path = '/resources/applicants?levelName=' + encodeURIComponent(this.levelName);
    const body = JSON.stringify({
      externalUserId: userId,
      email,
      fixedInfo: {},
    });

    const response = await this.signedRequest('POST', path, body);

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Sumsub createApplicant failed: ${response.status} ${err}`);
      throw new Error(`KYC provider error: ${response.status}`);
    }

    const data = await response.json();
    const applicantId = data.id;

    // Generate access token for the WebSDK
    const tokenPath = `/resources/accessTokens?userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(this.levelName)}`;
    const tokenResponse = await this.signedRequest('POST', tokenPath);

    let verificationUrl = `https://websdk.sumsub.com/?applicantId=${applicantId}`;
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      verificationUrl = `https://websdk.sumsub.com/?accessToken=${tokenData.token}`;
    }

    this.logger.log(`Sumsub applicant created: ${applicantId} for user ${userId}`);

    return {
      externalId: applicantId,
      userId,
      verificationUrl,
    };
  }

  async getStatus(externalId: string): Promise<KycStatusResult> {
    const path = `/resources/applicants/${externalId}/requiredIdDocsStatus`;
    const response = await this.signedRequest('GET', path);

    if (!response.ok) {
      return {
        externalId,
        status: KycVerificationStatus.ERROR,
        tier: 0,
        riskFlags: [],
        rejectionReason: `Provider error: ${response.status}`,
      };
    }

    // Also get the applicant review status
    const reviewPath = `/resources/applicants/${externalId}/status`;
    const reviewResponse = await this.signedRequest('GET', reviewPath);
    const reviewData = reviewResponse.ok ? await reviewResponse.json() : null;

    return this.mapSumsubStatus(externalId, reviewData);
  }

  handleWebhook(payload: KycWebhookPayload): Promise<KycWebhookResult> {
    const body = payload.body;
    const externalUserId = body.externalUserId;
    const applicantId = body.applicantId;
    const reviewStatus = body.reviewStatus;
    const reviewResult = body.reviewResult;

    const status = this.mapReviewStatus(reviewStatus, reviewResult);

    this.logger.log(
      `Sumsub webhook: user=${externalUserId} applicant=${applicantId} status=${status.status}`,
    );

    return Promise.resolve({
      userId: externalUserId,
      status: {
        externalId: applicantId,
        ...status,
        rawResponse: body,
      },
    });
  }

  verifyWebhookSignature(payload: KycWebhookPayload): boolean {
    if (!this.webhookSecret) return true; // skip in dev
    const signature = payload.headers['x-payload-digest'] || payload.headers['x-sumsub-signature'];
    if (!signature) return false;

    const computed = createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload.body))
      .digest('hex');

    return computed === signature;
  }

  /* ─── Sumsub status mapping ────────────────────────── */

  private mapSumsubStatus(externalId: string, reviewData: any): KycStatusResult {
    if (!reviewData) {
      return { externalId, status: KycVerificationStatus.PENDING, tier: 0, riskFlags: [] };
    }
    return { externalId, ...this.mapReviewStatus(reviewData.reviewStatus, reviewData.reviewResult) };
  }

  private mapReviewStatus(
    reviewStatus: string,
    reviewResult?: any,
  ): Omit<KycStatusResult, 'externalId' | 'rawResponse'> {
    const riskFlags: string[] = [];

    if (reviewResult?.moderationComment) {
      riskFlags.push(reviewResult.moderationComment);
    }
    if (reviewResult?.clientComment) {
      riskFlags.push(reviewResult.clientComment);
    }

    switch (reviewStatus) {
      case 'init':
      case 'pending':
      case 'queued':
      case 'onHold':
        return { status: KycVerificationStatus.PENDING, tier: 0, riskFlags };
      case 'prechecked':
        return { status: KycVerificationStatus.IN_REVIEW, tier: 0, riskFlags };
      case 'completed':
        if (reviewResult?.reviewAnswer === 'GREEN') {
          return { status: KycVerificationStatus.APPROVED, tier: 1, riskFlags };
        }
        if (reviewResult?.reviewAnswer === 'RED') {
          return {
            status: KycVerificationStatus.REJECTED,
            tier: 0,
            riskFlags,
            rejectionReason: reviewResult?.rejectLabels?.join(', ') || 'Verification failed',
          };
        }
        return { status: KycVerificationStatus.RETRY, tier: 0, riskFlags };
      default:
        return { status: KycVerificationStatus.PENDING, tier: 0, riskFlags };
    }
  }

  /* ─── Sumsub API signing ───────────────────────────── */

  private async signedRequest(method: string, path: string, body?: string): Promise<Response> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sigPayload = ts + method.toUpperCase() + path + (body || '');
    const signature = createHmac('sha256', this.secretKey)
      .update(sigPayload)
      .digest('hex');

    const headers: Record<string, string> = {
      'X-App-Token': this.appToken,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts,
      'Content-Type': 'application/json',
    };

    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body || undefined,
    });
  }
}

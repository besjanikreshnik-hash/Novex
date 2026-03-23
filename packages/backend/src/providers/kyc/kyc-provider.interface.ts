/**
 * NovEx KYC Provider Interface
 *
 * Abstracts KYC vendor APIs behind a consistent interface.
 * Implementations: SumsubProvider, MockProvider.
 */

export interface KycApplicant {
  /** Vendor-specific applicant/session ID */
  externalId: string;
  /** Our internal user ID */
  userId: string;
  /** URL or token for the verification flow (shown in frontend iframe/redirect) */
  verificationUrl: string;
}

export enum KycVerificationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETRY = 'retry',       // user can re-submit
  ERROR = 'error',       // provider error
}

export interface KycStatusResult {
  externalId: string;
  status: KycVerificationStatus;
  /** Mapped NovEx tier: 0=none, 1=basic, 2=enhanced */
  tier: 0 | 1 | 2;
  /** Risk flags from the vendor (sanctions, PEP, adverse media) */
  riskFlags: string[];
  /** Human-readable rejection reason (if rejected) */
  rejectionReason?: string;
  /** Raw vendor response for audit logging */
  rawResponse?: Record<string, any>;
}

export interface KycWebhookPayload {
  /** The raw HTTP body from the vendor */
  body: any;
  /** HTTP headers (for signature verification) */
  headers: Record<string, string>;
}

export interface KycWebhookResult {
  /** Our internal user ID (resolved from the webhook payload) */
  userId: string;
  status: KycStatusResult;
}

export const KYC_PROVIDER = 'KYC_PROVIDER';

export interface KycProvider {
  /** Create a new applicant/session for a user */
  createApplicant(userId: string, email: string, tier: number): Promise<KycApplicant>;

  /** Poll the vendor for current verification status */
  getStatus(externalId: string): Promise<KycStatusResult>;

  /** Process an incoming webhook from the vendor */
  handleWebhook(payload: KycWebhookPayload): Promise<KycWebhookResult>;

  /** Verify webhook signature authenticity */
  verifyWebhookSignature(payload: KycWebhookPayload): boolean;
}

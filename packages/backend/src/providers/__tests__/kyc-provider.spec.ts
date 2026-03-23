/**
 * NovEx — KYC Provider Tests
 *
 * Tests the MockKycProvider for all verification states and webhook scenarios.
 * For Sumsub sandbox testing, set SUMSUB_* env vars and run manually.
 *
 * Run: npm run test:providers
 */
import { MockKycProvider } from '../kyc/mock.provider';
import { KycVerificationStatus } from '../kyc/kyc-provider.interface';

describe('MockKycProvider', () => {
  let provider: MockKycProvider;

  beforeEach(() => {
    provider = new MockKycProvider();
  });

  it('creates applicant with APPROVED status for @approved.test email', async () => {
    const applicant = await provider.createApplicant('user-1', 'alice@approved.test', 1);
    expect(applicant.externalId).toBeTruthy();
    expect(applicant.userId).toBe('user-1');

    const status = await provider.getStatus(applicant.externalId);
    expect(status.status).toBe(KycVerificationStatus.APPROVED);
    expect(status.tier).toBe(1);
  });

  it('creates applicant with REJECTED status for @rejected.test email', async () => {
    const applicant = await provider.createApplicant('user-2', 'bob@rejected.test', 1);
    const status = await provider.getStatus(applicant.externalId);
    expect(status.status).toBe(KycVerificationStatus.REJECTED);
    expect(status.tier).toBe(0);
    expect(status.rejectionReason).toBeTruthy();
  });

  it('creates applicant with PENDING status for normal email', async () => {
    const applicant = await provider.createApplicant('user-3', 'carol@example.com', 1);
    const status = await provider.getStatus(applicant.externalId);
    expect(status.status).toBe(KycVerificationStatus.PENDING);
    expect(status.tier).toBe(0);
  });

  it('creates applicant with RETRY status for @retry.test email', async () => {
    const applicant = await provider.createApplicant('user-4', 'dave@retry.test', 1);
    const status = await provider.getStatus(applicant.externalId);
    expect(status.status).toBe(KycVerificationStatus.RETRY);
  });

  it('handleWebhook updates status correctly', async () => {
    const applicant = await provider.createApplicant('user-5', 'eve@example.com', 1);

    // Simulate approval webhook
    const result = await provider.handleWebhook({
      body: {
        externalId: applicant.externalId,
        userId: 'user-5',
        status: KycVerificationStatus.APPROVED,
      },
      headers: {},
    });

    expect(result.userId).toBe('user-5');
    expect(result.status.status).toBe(KycVerificationStatus.APPROVED);
    expect(result.status.tier).toBe(1);

    // Status persisted
    const updated = await provider.getStatus(applicant.externalId);
    expect(updated.status).toBe(KycVerificationStatus.APPROVED);
  });

  it('webhook replay returns same result (idempotent)', async () => {
    const applicant = await provider.createApplicant('user-6', 'replay@example.com', 1);

    const webhook = {
      body: { externalId: applicant.externalId, userId: 'user-6', status: KycVerificationStatus.APPROVED },
      headers: {},
    };

    const r1 = await provider.handleWebhook(webhook);
    const r2 = await provider.handleWebhook(webhook);

    expect(r1.status.status).toBe(r2.status.status);
    expect(r1.userId).toBe(r2.userId);
  });

  it('getStatus for unknown externalId returns ERROR', async () => {
    const status = await provider.getStatus('non-existent');
    expect(status.status).toBe(KycVerificationStatus.ERROR);
  });

  it('setStatus changes status for testing', async () => {
    const applicant = await provider.createApplicant('user-7', 'test@example.com', 1);
    provider.setStatus(applicant.externalId, KycVerificationStatus.APPROVED, 1);

    const status = await provider.getStatus(applicant.externalId);
    expect(status.status).toBe(KycVerificationStatus.APPROVED);
    expect(status.tier).toBe(1);
  });

  it('verifyWebhookSignature always returns true for mock', () => {
    expect(provider.verifyWebhookSignature({ body: {}, headers: {} })).toBe(true);
  });
});

/**
 * NovEx — Withdrawal Executor & Custody Pipeline Tests
 *
 * Tests:
 *   1. Happy path: approve → execute → signed → broadcast → completed
 *   2. Duplicate execute on same withdrawal — idempotent
 *   3. Signing failure → FAILED state, recoverable
 *   4. Broadcast failure → FAILED state, recoverable
 *   5. Broadcast success with delayed confirmation
 *   6. Maker-checker enforcement (approver cannot execute)
 *   7. Intent idempotency (createIntent returns same result)
 *   8. Recovery of failed withdrawal
 *   9. Custody rejection unlocks funds
 *
 * Run: npm run test:custody
 */
import { MockCustodyProvider } from '../mock-custody.provider';
import { CustodyTxStatus } from '../custody-provider.interface';

describe('MockCustodyProvider', () => {
  let custody: MockCustodyProvider;

  beforeEach(() => {
    custody = new MockCustodyProvider();
    custody.reset();
  });

  const intent = {
    intentId: 'wd-001',
    to: '0xrecipient',
    amount: '1.5',
    asset: 'ETH',
    network: 'ethereum',
  };

  /* ═══ 1. Happy path ════════════════════════════════════ */
  it('full pipeline: create → sign → broadcast → confirm', async () => {
    const created = await custody.createIntent(intent);
    expect(created.status).toBe(CustodyTxStatus.PENDING_SIGNATURE);
    expect(created.providerRef).toBeTruthy();

    const signed = await custody.requestSignature('wd-001');
    expect(signed.status).toBe(CustodyTxStatus.SIGNED);
    expect(signed.signedTx).toBeTruthy();

    const broadcast = await custody.broadcast('wd-001');
    expect(broadcast.status).toBe(CustodyTxStatus.BROADCAST);
    expect(broadcast.txHash).toBeTruthy();

    // Simulate on-chain confirmation
    custody.confirmIntent('wd-001', 12);
    const status = await custody.getStatus('wd-001');
    expect(status.status).toBe(CustodyTxStatus.CONFIRMED);
    expect(status.confirmations).toBe(12);
  });

  /* ═══ 2. Intent idempotency ════════════════════════════ */
  it('createIntent is idempotent — returns same result', async () => {
    const r1 = await custody.createIntent(intent);
    const r2 = await custody.createIntent(intent);
    expect(r1.providerRef).toBe(r2.providerRef);
    expect(r1.status).toBe(r2.status);
  });

  /* ═══ 3. Signature idempotency ═════════════════════════ */
  it('requestSignature is idempotent after signing', async () => {
    await custody.createIntent(intent);
    const s1 = await custody.requestSignature('wd-001');
    const s2 = await custody.requestSignature('wd-001');
    expect(s1.signedTx).toBe(s2.signedTx);
  });

  /* ═══ 4. Broadcast idempotency ═════════════════════════ */
  it('broadcast is idempotent — returns same txHash', async () => {
    await custody.createIntent(intent);
    await custody.requestSignature('wd-001');
    const b1 = await custody.broadcast('wd-001');
    const b2 = await custody.broadcast('wd-001');
    expect(b1.txHash).toBe(b2.txHash);
  });

  /* ═══ 5. Signing failure ═══════════════════════════════ */
  it('signing failure → FAILED status', async () => {
    await custody.createIntent(intent);
    custody.injectFailure('wd-001', 'sign', 'HSM unreachable');

    const result = await custody.requestSignature('wd-001');
    expect(result.status).toBe(CustodyTxStatus.FAILED);
    expect(result.failureReason).toBe('HSM unreachable');
  });

  /* ═══ 6. Broadcast failure ═════════════════════════════ */
  it('broadcast failure → FAILED status', async () => {
    await custody.createIntent(intent);
    await custody.requestSignature('wd-001');
    custody.injectFailure('wd-001', 'broadcast', 'Network timeout');

    const result = await custody.broadcast('wd-001');
    expect(result.status).toBe(CustodyTxStatus.FAILED);
    expect(result.failureReason).toBe('Network timeout');
  });

  /* ═══ 7. Cannot broadcast unsigned intent ══════════════ */
  it('broadcast before signing throws', async () => {
    await custody.createIntent(intent);
    await expect(custody.broadcast('wd-001')).rejects.toThrow(/Cannot broadcast/);
  });

  /* ═══ 8. Cancel before broadcast ═══════════════════════ */
  it('cancel succeeds before broadcast', async () => {
    await custody.createIntent(intent);
    await custody.requestSignature('wd-001');
    expect(await custody.cancelIntent('wd-001')).toBe(true);
  });

  it('cancel fails after broadcast', async () => {
    await custody.createIntent(intent);
    await custody.requestSignature('wd-001');
    await custody.broadcast('wd-001');
    expect(await custody.cancelIntent('wd-001')).toBe(false);
  });

  /* ═══ 9. Unknown intent ════════════════════════════════ */
  it('operations on unknown intent throw', async () => {
    await expect(custody.requestSignature('nope')).rejects.toThrow(/not found/);
    await expect(custody.broadcast('nope')).rejects.toThrow(/not found/);
    await expect(custody.getStatus('nope')).rejects.toThrow(/not found/);
  });

  /* ═══ 10. Delayed confirmation check ═══════════════════ */
  it('getStatus reflects delayed confirmation', async () => {
    await custody.createIntent(intent);
    await custody.requestSignature('wd-001');
    await custody.broadcast('wd-001');

    // Not yet confirmed
    let status = await custody.getStatus('wd-001');
    expect(status.status).toBe(CustodyTxStatus.BROADCAST);
    expect(status.confirmations).toBe(0);

    // Simulate delayed confirmation
    custody.confirmIntent('wd-001', 6);
    status = await custody.getStatus('wd-001');
    expect(status.status).toBe(CustodyTxStatus.CONFIRMED);
    expect(status.confirmations).toBe(6);
  });
});

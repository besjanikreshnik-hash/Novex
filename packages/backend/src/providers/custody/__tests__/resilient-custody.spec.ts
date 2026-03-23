/**
 * NovEx — Resilient Custody Base + Provider Tests
 *
 * Tests:
 *   1. Idempotency cache: double createIntent returns same result
 *   2. Timeout: slow provider operation is terminated
 *   3. Retry: transient failure retried and succeeds
 *   4. Retry exhaustion: permanent failure throws after max retries
 *   5. Broadcast idempotency via cache
 *   6. Cancel after broadcast returns false (via cache)
 *   7. KMS provider sandbox signing flow
 *   8. KMS provider sandbox broadcast flow
 *
 * Run: npm run test:custody
 */
import {
  WithdrawalIntent,
  CustodyIntentResult,
  CustodySignResult,
  CustodyBroadcastResult,
  CustodyStatusResult,
  CustodyTxStatus,
} from '../custody-provider.interface';
import { ResilientCustodyBase, CustodyTimeouts } from '../resilient-custody.base';
import { KmsSignerProvider } from '../kms-signer.provider';

/* ─── Test harness: controllable custody provider ────── */

class ControllableCustody extends ResilientCustodyBase {
  public callCount = { create: 0, sign: 0, broadcast: 0, status: 0, cancel: 0 };
  public shouldFail: { sign?: boolean; broadcast?: boolean } = {};
  public delay: { sign?: number; broadcast?: number } = {};

  constructor(timeouts?: Partial<CustodyTimeouts>, maxRetries = 1) {
    super('TestCustody', timeouts, maxRetries);
  }

  protected async _doCreateIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult> {
    this.callCount.create++;
    return {
      intentId: intent.intentId,
      providerRef: `test-ref-${intent.intentId}`,
      status: CustodyTxStatus.PENDING_SIGNATURE,
    };
  }

  protected async _doRequestSignature(intentId: string): Promise<CustodySignResult> {
    this.callCount.sign++;
    if (this.delay.sign) await new Promise((r) => setTimeout(r, this.delay.sign));
    if (this.shouldFail.sign) throw new Error('Signing service unavailable');
    return {
      intentId,
      status: CustodyTxStatus.SIGNED,
      signedTx: `0xsigned_${intentId}`,
    };
  }

  protected async _doBroadcast(intentId: string): Promise<CustodyBroadcastResult> {
    this.callCount.broadcast++;
    if (this.delay.broadcast) await new Promise((r) => setTimeout(r, this.delay.broadcast));
    if (this.shouldFail.broadcast) throw new Error('Network unreachable');
    return {
      intentId,
      status: CustodyTxStatus.BROADCAST,
      txHash: `0xtx_${intentId}`,
    };
  }

  protected async _doGetStatus(intentId: string): Promise<CustodyStatusResult> {
    this.callCount.status++;
    return { intentId, status: CustodyTxStatus.BROADCAST, confirmations: 3 };
  }

  protected async _doCancelIntent(intentId: string): Promise<boolean> {
    this.callCount.cancel++;
    return true;
  }
}

const intent: WithdrawalIntent = {
  intentId: 'test-001',
  to: '0xrecipient',
  amount: '1.5',
  asset: 'ETH',
  network: 'ethereum',
};

describe('ResilientCustodyBase', () => {

  it('1. idempotency: double createIntent returns cached, no second API call', async () => {
    const custody = new ControllableCustody();
    const r1 = await custody.createIntent(intent);
    const r2 = await custody.createIntent(intent);

    expect(r1.providerRef).toBe(r2.providerRef);
    expect(custody.callCount.create).toBe(1); // only one actual call
  });

  it('2. timeout: slow operation is terminated', async () => {
    const custody = new ControllableCustody({ signatureMs: 100 });
    custody.delay.sign = 500; // slower than timeout

    await custody.createIntent(intent);
    await expect(custody.requestSignature('test-001')).rejects.toThrow(/timeout/);
  });

  it('3. retry: transient failure retried and succeeds', async () => {
    const custody = new ControllableCustody(undefined, 2); // 2 retries
    let attempts = 0;

    // Override to fail first, succeed second
    (custody as any)._doRequestSignature = async (id: string) => {
      attempts++;
      if (attempts === 1) throw new Error('Transient failure');
      return { intentId: id, status: CustodyTxStatus.SIGNED, signedTx: '0xsigned' };
    };

    await custody.createIntent(intent);
    const result = await custody.requestSignature('test-001');

    expect(result.status).toBe(CustodyTxStatus.SIGNED);
    expect(attempts).toBe(2);
  });

  it('4. retry exhaustion: permanent failure throws', async () => {
    const custody = new ControllableCustody({ signatureMs: 30_000 }, 1); // 1 retry
    custody.shouldFail.sign = true;

    await custody.createIntent(intent);
    await expect(custody.requestSignature('test-001')).rejects.toThrow(/Signing service unavailable/);
    expect(custody.callCount.sign).toBe(2); // initial + 1 retry
  });

  it('5. broadcast idempotency: second call returns cached txHash', async () => {
    const custody = new ControllableCustody();
    await custody.createIntent(intent);
    await custody.requestSignature('test-001');

    const b1 = await custody.broadcast('test-001');
    const b2 = await custody.broadcast('test-001');

    expect(b1.txHash).toBe(b2.txHash);
    expect(custody.callCount.broadcast).toBe(1); // only one actual call
  });

  it('6. cancel after broadcast returns false via cache', async () => {
    const custody = new ControllableCustody();
    await custody.createIntent(intent);
    await custody.requestSignature('test-001');
    await custody.broadcast('test-001');

    expect(await custody.cancelIntent('test-001')).toBe(false);
    expect(custody.callCount.cancel).toBe(0); // short-circuited by cache
  });

  it('7. signature cached after first successful sign', async () => {
    const custody = new ControllableCustody();
    await custody.createIntent(intent);

    const s1 = await custody.requestSignature('test-001');
    const s2 = await custody.requestSignature('test-001');

    expect(s1.signedTx).toBe(s2.signedTx);
    expect(custody.callCount.sign).toBe(1); // cache hit on second
  });
});

describe('KmsSignerProvider (sandbox)', () => {
  let kms: KmsSignerProvider;

  beforeEach(() => {
    // Create with empty config (sandbox mode — no real KMS or RPC)
    const mockConfig = {
      get: (key: string, defaultVal?: string) => defaultVal ?? '',
    } as any;
    kms = new KmsSignerProvider(mockConfig);
  });

  it('8. full sandbox flow: create → sign → broadcast', async () => {
    const result = await kms.createIntent(intent);
    expect(result.status).toBe(CustodyTxStatus.PENDING_SIGNATURE);

    const signed = await kms.requestSignature('test-001');
    expect(signed.status).toBe(CustodyTxStatus.SIGNED);
    expect(signed.signedTx).toBeTruthy();

    const broadcast = await kms.broadcast('test-001');
    expect(broadcast.status).toBe(CustodyTxStatus.BROADCAST);
    expect(broadcast.txHash).toBeTruthy();
  });

  it('9. idempotent create', async () => {
    const r1 = await kms.createIntent(intent);
    const r2 = await kms.createIntent(intent);
    expect(r1.providerRef).toBe(r2.providerRef);
  });

  it('10. broadcast before sign throws', async () => {
    await kms.createIntent(intent);
    await expect(kms.broadcast('test-001')).rejects.toThrow(/not yet signed/);
  });

  it('11. cancel before broadcast succeeds', async () => {
    await kms.createIntent(intent);
    expect(await kms.cancelIntent('test-001')).toBe(true);
  });

  it('12. cancel after broadcast fails', async () => {
    await kms.createIntent(intent);
    await kms.requestSignature('test-001');
    await kms.broadcast('test-001');
    expect(await kms.cancelIntent('test-001')).toBe(false);
  });
});

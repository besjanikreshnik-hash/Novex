/**
 * NovEx — Idempotency key generation and tracker unit tests.
 *
 * Tests the client-side duplicate submit prevention logic.
 *
 * Run: npx jest src/lib/__tests__/idempotency.test.ts
 */

// Inline the tracker for isolated testing
class TestTracker {
  private readonly inflight = new Set<string>();
  private readonly completed = new Map<string, { response: any; timestamp: number }>();
  private readonly maxAge = 5 * 60 * 1000;

  acquire(key: string): { allowed: boolean; cached?: any } {
    if (this.inflight.has(key)) return { allowed: false };
    const entry = this.completed.get(key);
    if (entry && Date.now() - entry.timestamp < this.maxAge) {
      return { allowed: false, cached: entry.response };
    }
    this.inflight.add(key);
    return { allowed: true };
  }

  complete(key: string, response: any): void {
    this.inflight.delete(key);
    this.completed.set(key, { response, timestamp: Date.now() });
  }

  release(key: string): void {
    this.inflight.delete(key);
  }

  isInflight(key: string): boolean {
    return this.inflight.has(key);
  }
}

describe('IdempotencyTracker', () => {
  let tracker: TestTracker;

  beforeEach(() => {
    tracker = new TestTracker();
  });

  it('allows first acquire for a key', () => {
    const result = tracker.acquire('key-1');
    expect(result.allowed).toBe(true);
    expect(result.cached).toBeUndefined();
  });

  it('blocks second acquire while first is in flight (double-click)', () => {
    tracker.acquire('key-1');

    const result = tracker.acquire('key-1');
    expect(result.allowed).toBe(false);
    expect(result.cached).toBeUndefined();
  });

  it('returns cached response after completion (safe retry)', () => {
    tracker.acquire('key-1');
    tracker.complete('key-1', { orderId: 'abc', status: 'open' });

    const result = tracker.acquire('key-1');
    expect(result.allowed).toBe(false);
    expect(result.cached).toEqual({ orderId: 'abc', status: 'open' });
  });

  it('allows re-acquire after release (failure retry)', () => {
    tracker.acquire('key-1');
    tracker.release('key-1');

    const result = tracker.acquire('key-1');
    expect(result.allowed).toBe(true);
  });

  it('tracks inflight state correctly', () => {
    expect(tracker.isInflight('key-1')).toBe(false);
    tracker.acquire('key-1');
    expect(tracker.isInflight('key-1')).toBe(true);
    tracker.complete('key-1', {});
    expect(tracker.isInflight('key-1')).toBe(false);
  });

  it('independent keys do not interfere', () => {
    tracker.acquire('key-1');
    const r2 = tracker.acquire('key-2');
    expect(r2.allowed).toBe(true);

    tracker.complete('key-1', { id: 1 });
    const r1again = tracker.acquire('key-1');
    expect(r1again.allowed).toBe(false);
    expect(r1again.cached).toEqual({ id: 1 });

    // key-2 still in flight
    expect(tracker.isInflight('key-2')).toBe(true);
  });

  it('simulates rapid double-click: only first goes through', () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(tracker.acquire('click-key'));
    }

    // Only first should be allowed
    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(false);
    expect(results[2].allowed).toBe(false);
    expect(results[3].allowed).toBe(false);
    expect(results[4].allowed).toBe(false);
  });

  it('simulates retry after failure: same key works', () => {
    // First attempt
    tracker.acquire('retry-key');
    // Simulate failure
    tracker.release('retry-key');

    // Retry with same key
    const retry = tracker.acquire('retry-key');
    expect(retry.allowed).toBe(true);

    // Complete on retry
    tracker.complete('retry-key', { orderId: 'success' });

    // Third attempt returns cached
    const third = tracker.acquire('retry-key');
    expect(third.allowed).toBe(false);
    expect(third.cached).toEqual({ orderId: 'success' });
  });

  it('simulates network retry: completed key returns cached result', () => {
    // Client sends request
    tracker.acquire('net-key');
    // Server processes successfully, but client gets timeout
    tracker.complete('net-key', { orderId: 'x', status: 'filled' });

    // Client retries with same key
    const retry = tracker.acquire('net-key');
    expect(retry.allowed).toBe(false);
    expect(retry.cached?.orderId).toBe('x');
  });

  it('cancel flow: blocks concurrent cancel of same order', () => {
    const cancelKey1 = 'cancel-order-123';
    const cancelKey2 = 'cancel-order-123'; // same ID

    const r1 = tracker.acquire(cancelKey1);
    expect(r1.allowed).toBe(true);

    const r2 = tracker.acquire(cancelKey2);
    expect(r2.allowed).toBe(false);
  });
});

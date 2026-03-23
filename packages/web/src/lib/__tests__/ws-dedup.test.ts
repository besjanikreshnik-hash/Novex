/**
 * NovEx — WebSocket event dedup and sequencing unit tests.
 *
 * Tests the shouldApply() logic that prevents duplicate event application
 * on reconnect/replay scenarios.
 *
 * Run from packages/web: npx jest src/lib/__tests__/ws-dedup.test.ts
 */

// Inline the dedup logic for unit testing (avoids socket.io import issues in test env)
class SeqTracker {
  private readonly lastSeq = new Map<string, number>();

  shouldApply(room: string, seq: number): boolean {
    const last = this.lastSeq.get(room) ?? 0;
    if (seq <= last) return false;
    this.lastSeq.set(room, seq);
    return true;
  }

  resetSeq(roomPrefix?: string): void {
    if (roomPrefix) {
      for (const key of this.lastSeq.keys()) {
        if (key.startsWith(roomPrefix)) this.lastSeq.delete(key);
      }
    } else {
      this.lastSeq.clear();
    }
  }

  getLastSeq(room: string): number {
    return this.lastSeq.get(room) ?? 0;
  }
}

describe('WebSocket Event Dedup (SeqTracker)', () => {
  let tracker: SeqTracker;

  beforeEach(() => {
    tracker = new SeqTracker();
  });

  it('accepts first event for a room', () => {
    expect(tracker.shouldApply('BTC_USDT:ticker', 1)).toBe(true);
    expect(tracker.getLastSeq('BTC_USDT:ticker')).toBe(1);
  });

  it('accepts events with increasing seq', () => {
    expect(tracker.shouldApply('BTC_USDT:ticker', 1)).toBe(true);
    expect(tracker.shouldApply('BTC_USDT:ticker', 2)).toBe(true);
    expect(tracker.shouldApply('BTC_USDT:ticker', 3)).toBe(true);
    expect(tracker.getLastSeq('BTC_USDT:ticker')).toBe(3);
  });

  it('rejects duplicate seq (replay on reconnect)', () => {
    tracker.shouldApply('BTC_USDT:trades', 5);
    expect(tracker.shouldApply('BTC_USDT:trades', 5)).toBe(false);
  });

  it('rejects stale seq (older event arriving late)', () => {
    tracker.shouldApply('BTC_USDT:trades', 10);
    expect(tracker.shouldApply('BTC_USDT:trades', 7)).toBe(false);
    expect(tracker.shouldApply('BTC_USDT:trades', 9)).toBe(false);
  });

  it('accepts seq that jumps (gap — events arrive out of order)', () => {
    tracker.shouldApply('BTC_USDT:orderbook', 1);
    // seq 2 is missing — seq 3 arrives
    expect(tracker.shouldApply('BTC_USDT:orderbook', 3)).toBe(true);
    // seq 2 arrives late — rejected
    expect(tracker.shouldApply('BTC_USDT:orderbook', 2)).toBe(false);
  });

  it('tracks rooms independently', () => {
    tracker.shouldApply('BTC_USDT:ticker', 10);
    tracker.shouldApply('ETH_USDT:ticker', 5);

    expect(tracker.shouldApply('BTC_USDT:ticker', 8)).toBe(false);
    expect(tracker.shouldApply('ETH_USDT:ticker', 6)).toBe(true);
  });

  it('resetSeq with prefix clears matching rooms only', () => {
    tracker.shouldApply('BTC_USDT:ticker', 10);
    tracker.shouldApply('BTC_USDT:trades', 20);
    tracker.shouldApply('ETH_USDT:ticker', 5);

    tracker.resetSeq('BTC_USDT');

    // BTC rooms reset — accept from 1 again
    expect(tracker.shouldApply('BTC_USDT:ticker', 1)).toBe(true);
    expect(tracker.shouldApply('BTC_USDT:trades', 1)).toBe(true);

    // ETH room untouched
    expect(tracker.shouldApply('ETH_USDT:ticker', 3)).toBe(false);
    expect(tracker.shouldApply('ETH_USDT:ticker', 6)).toBe(true);
  });

  it('resetSeq without prefix clears everything', () => {
    tracker.shouldApply('BTC_USDT:ticker', 100);
    tracker.shouldApply('account:order', 50);

    tracker.resetSeq();

    expect(tracker.shouldApply('BTC_USDT:ticker', 1)).toBe(true);
    expect(tracker.shouldApply('account:order', 1)).toBe(true);
  });

  it('simulates reconnect scenario: snapshot resets, then deltas accepted', () => {
    // Before disconnect: seq was at 50
    tracker.shouldApply('BTC_USDT:orderbook', 50);

    // On reconnect: server sends fresh snapshot with seq=1 (new counter)
    tracker.resetSeq('BTC_USDT:orderbook');
    expect(tracker.shouldApply('BTC_USDT:orderbook', 1)).toBe(true);

    // Subsequent deltas accepted normally
    expect(tracker.shouldApply('BTC_USDT:orderbook', 2)).toBe(true);
    expect(tracker.shouldApply('BTC_USDT:orderbook', 3)).toBe(true);
  });

  it('handles private account events independently from public', () => {
    tracker.shouldApply('BTC_USDT:trades', 10);
    tracker.shouldApply('account:order', 5);
    tracker.shouldApply('account:fill', 3);
    tracker.shouldApply('account:balance', 7);

    // Each room independent
    expect(tracker.shouldApply('account:order', 4)).toBe(false);
    expect(tracker.shouldApply('account:order', 6)).toBe(true);
    expect(tracker.shouldApply('account:balance', 8)).toBe(true);
  });
});

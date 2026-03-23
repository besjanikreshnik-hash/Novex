/**
 * NovEx Load Test — Track C: WebSocket Load
 *
 * Tests the WsRateLimiter and sequence dedup logic under load.
 * Note: These test the in-process logic, not actual socket connections
 * (which require a running server). For socket-level load testing,
 * use a tool like artillery or k6.
 *
 * Scenarios:
 *   C1. WS rate limiter: many connections per IP
 *   C2. WS rate limiter: message burst exceeding limit
 *   C3. Sequence dedup: rapid events with gaps
 *   C4. Sequence dedup: reconnect reset behavior
 *
 * Run: npm run test:load
 */
import { WsRateLimiter } from '../../src/common/rate-limit/ws-rate-limit';

jest.setTimeout(30_000);

describe('Track C: WebSocket Load', () => {

  /* ═══ C1: Connection limits per IP ═════════════════════ */
  it('C1: only 5 connections allowed per IP', () => {
    const limiter = new WsRateLimiter();

    // First 5 connections succeed
    for (let i = 0; i < 5; i++) {
      expect(limiter.onConnect(`client-${i}`, '192.168.1.1')).toBe(true);
    }

    // 6th connection rejected
    expect(limiter.onConnect('client-5', '192.168.1.1')).toBe(false);

    // Different IP can still connect
    expect(limiter.onConnect('client-6', '192.168.1.2')).toBe(true);

    // After disconnect, slot freed
    limiter.onDisconnect('client-0');
    expect(limiter.onConnect('client-7', '192.168.1.1')).toBe(true);
  });

  /* ═══ C2: Message rate limiting ════════════════════════ */
  it('C2: message burst exceeding 100/min triggers rejection', () => {
    const limiter = new WsRateLimiter();
    limiter.onConnect('burst-client', '10.0.0.1');

    // First 100 messages succeed
    let allowed = 0;
    for (let i = 0; i < 120; i++) {
      if (limiter.onMessage('burst-client')) allowed++;
    }

    expect(allowed).toBe(100);
    // 101st+ rejected
    expect(limiter.onMessage('burst-client')).toBe(false);
  });

  /* ═══ C3: Subscribe rate limiting ══════════════════════ */
  it('C3: subscribe burst exceeding 50/min triggers rejection', () => {
    const limiter = new WsRateLimiter();
    limiter.onConnect('sub-client', '10.0.0.2');

    let allowed = 0;
    for (let i = 0; i < 60; i++) {
      if (limiter.onSubscribe('sub-client')) allowed++;
    }

    expect(allowed).toBe(50);
    expect(limiter.onSubscribe('sub-client')).toBe(false);
  });

  /* ═══ C4: Sequence dedup under rapid events ════════════ */
  it('C4: sequence tracker handles gaps and duplicates correctly', () => {
    // Inline the dedup logic for testing
    const lastSeq = new Map<string, number>();

    function shouldApply(room: string, seq: number): boolean {
      const last = lastSeq.get(room) ?? 0;
      if (seq <= last) return false;
      lastSeq.set(room, seq);
      return true;
    }

    // Simulate 1000 rapid events with some duplicates and gaps
    let accepted = 0;
    let rejected = 0;

    // Normal sequence: 1..500
    for (let i = 1; i <= 500; i++) {
      if (shouldApply('BTC:trades', i)) accepted++;
      else rejected++;
    }
    expect(accepted).toBe(500);
    expect(rejected).toBe(0);

    // Replay seq 200..300 (duplicates after reconnect)
    for (let i = 200; i <= 300; i++) {
      if (shouldApply('BTC:trades', i)) accepted++;
      else rejected++;
    }
    expect(rejected).toBe(101); // all rejected

    // New events continue from 501
    for (let i = 501; i <= 600; i++) {
      if (shouldApply('BTC:trades', i)) accepted++;
    }
    expect(accepted).toBe(600);

    // Gap: jump from 600 to 650
    expect(shouldApply('BTC:trades', 650)).toBe(true);
    // Late arrival: 625 (rejected — already past 650)
    expect(shouldApply('BTC:trades', 625)).toBe(false);
  });

  /* ═══ C5: Multiple rooms independent ═══════════════════ */
  it('C5: 100 independent rooms with 50 events each — no cross-contamination', () => {
    const lastSeq = new Map<string, number>();

    function shouldApply(room: string, seq: number): boolean {
      const last = lastSeq.get(room) ?? 0;
      if (seq <= last) return false;
      lastSeq.set(room, seq);
      return true;
    }

    for (let room = 0; room < 100; room++) {
      for (let seq = 1; seq <= 50; seq++) {
        expect(shouldApply(`room-${room}`, seq)).toBe(true);
      }
    }

    // All rooms independent — replaying room-0 doesn't affect room-1
    expect(shouldApply('room-0', 1)).toBe(false);
    expect(shouldApply('room-1', 51)).toBe(true);
  });
});

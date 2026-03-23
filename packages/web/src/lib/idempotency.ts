/**
 * Idempotency key generation and tracking for NovEx web client.
 *
 * Each user action (place order, cancel order) gets a unique key.
 * The key is sent as X-Idempotency-Key header. On network retry,
 * the same key is reused so the backend returns the cached result
 * instead of executing twice.
 */

/** Generate a crypto-random idempotency key (UUID v4 format). */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * In-flight key tracker. Prevents the same action from being submitted
 * concurrently (double-click protection) while allowing retry with
 * the same key after failure.
 */
class IdempotencyTracker {
  /** Keys currently in flight (not yet resolved) */
  private readonly inflight = new Set<string>();
  /** Keys that completed successfully — maps key → response for instant replay */
  private readonly completed = new Map<string, { response: any; timestamp: number }>();
  /** Max age for completed entries (5 minutes) */
  private readonly maxAge = 5 * 60 * 1000;

  /**
   * Attempt to claim a key for submission.
   * Returns false if the key is already in flight (double-click).
   * Returns the cached response if the key was already completed.
   */
  acquire(key: string): { allowed: boolean; cached?: any } {
    // Already in flight — block
    if (this.inflight.has(key)) {
      return { allowed: false };
    }

    // Already completed — return cached response
    const entry = this.completed.get(key);
    if (entry && Date.now() - entry.timestamp < this.maxAge) {
      return { allowed: false, cached: entry.response };
    }

    this.inflight.add(key);
    return { allowed: true };
  }

  /** Mark a key as successfully completed. */
  complete(key: string, response: any): void {
    this.inflight.delete(key);
    this.completed.set(key, { response, timestamp: Date.now() });
    this.cleanup();
  }

  /** Release a key after failure (allows retry with same key). */
  release(key: string): void {
    this.inflight.delete(key);
  }

  /** Check if a key is currently in flight. */
  isInflight(key: string): boolean {
    return this.inflight.has(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.completed) {
      if (now - entry.timestamp > this.maxAge) {
        this.completed.delete(key);
      }
    }
  }
}

export const idempotencyTracker = new IdempotencyTracker();

import { Logger } from '@nestjs/common';

interface ClientEntry {
  ip: string;
  /** Timestamps (ms) of messages in the current sliding window. */
  messageTimes: number[];
  /** Timestamps (ms) of subscribe events in the current sliding window. */
  subscribeTimes: number[];
}

interface ViolationError {
  code: string;
  message: string;
}

/**
 * In-memory WebSocket rate limiter for the NovEx market gateway.
 *
 * Limits enforced:
 *   - Max 5 concurrent connections per IP address.
 *   - Max 50 subscribe events per minute per connection.
 *   - Max 100 messages per minute per connection.
 *
 * On any violation the caller should disconnect the client after
 * emitting the structured error returned by the check method.
 */
export class WsRateLimiter {
  private readonly logger = new Logger(WsRateLimiter.name);

  /** clientId -> connection metadata */
  private readonly clients = new Map<string, ClientEntry>();

  /** ip -> Set of connected clientIds */
  private readonly ipConnections = new Map<string, Set<string>>();

  /* ── Tunables ─────────────────────────────────────────── */
  private readonly MAX_CONNECTIONS_PER_IP = 5;
  private readonly MAX_SUBSCRIBES_PER_MINUTE = 50;
  private readonly MAX_MESSAGES_PER_MINUTE = 100;
  private readonly WINDOW_MS = 60_000;

  /* ── Public API ───────────────────────────────────────── */

  /**
   * Register a new WebSocket connection.
   *
   * @returns `true` if the connection is allowed, `false` if the
   *          per-IP connection limit has been exceeded.
   */
  onConnect(clientId: string, ip: string): boolean {
    // Check per-IP connection count
    const existing = this.ipConnections.get(ip);
    if (existing && existing.size >= this.MAX_CONNECTIONS_PER_IP) {
      this.logger.warn(
        `Connection rejected for IP ${ip}: limit of ${this.MAX_CONNECTIONS_PER_IP} concurrent connections exceeded`,
      );
      return false;
    }

    // Track the connection
    if (!existing) {
      this.ipConnections.set(ip, new Set([clientId]));
    } else {
      existing.add(clientId);
    }

    this.clients.set(clientId, {
      ip,
      messageTimes: [],
      subscribeTimes: [],
    });

    return true;
  }

  /**
   * Clean up tracking state when a client disconnects.
   */
  onDisconnect(clientId: string): void {
    const entry = this.clients.get(clientId);
    if (!entry) return;

    const ipSet = this.ipConnections.get(entry.ip);
    if (ipSet) {
      ipSet.delete(clientId);
      if (ipSet.size === 0) {
        this.ipConnections.delete(entry.ip);
      }
    }

    this.clients.delete(clientId);
  }

  /**
   * Record an incoming message from a client.
   *
   * @returns `true` if within limits, `false` if the message rate
   *          limit has been exceeded (caller should disconnect).
   */
  onMessage(clientId: string): boolean {
    const entry = this.clients.get(clientId);
    if (!entry) return false;

    const now = Date.now();
    this.pruneWindow(entry.messageTimes, now);
    entry.messageTimes.push(now);

    if (entry.messageTimes.length > this.MAX_MESSAGES_PER_MINUTE) {
      this.logger.warn(
        `Client ${clientId} exceeded message rate limit (${this.MAX_MESSAGES_PER_MINUTE}/min)`,
      );
      return false;
    }

    return true;
  }

  /**
   * Record a subscribe event from a client.
   *
   * @returns `true` if within limits, `false` if the subscribe rate
   *          limit has been exceeded (caller should disconnect).
   */
  onSubscribe(clientId: string): boolean {
    const entry = this.clients.get(clientId);
    if (!entry) return false;

    const now = Date.now();
    this.pruneWindow(entry.subscribeTimes, now);
    entry.subscribeTimes.push(now);

    if (entry.subscribeTimes.length > this.MAX_SUBSCRIBES_PER_MINUTE) {
      this.logger.warn(
        `Client ${clientId} exceeded subscribe rate limit (${this.MAX_SUBSCRIBES_PER_MINUTE}/min)`,
      );
      return false;
    }

    return true;
  }

  /* ── Helpers ──────────────────────────────────────────── */

  /**
   * Build a structured error payload suitable for emitting to the
   * client before disconnecting.
   */
  static connectionLimitError(): ViolationError {
    return {
      code: 'CONNECTION_LIMIT_EXCEEDED',
      message:
        'Too many concurrent connections from your IP address. Please close unused connections and try again.',
    };
  }

  static messageLimitError(): ViolationError {
    return {
      code: 'MESSAGE_RATE_EXCEEDED',
      message:
        'Message rate limit exceeded (100 messages per minute). You have been disconnected.',
    };
  }

  static subscribeLimitError(): ViolationError {
    return {
      code: 'SUBSCRIBE_RATE_EXCEEDED',
      message:
        'Subscribe rate limit exceeded (50 subscribes per minute). You have been disconnected.',
    };
  }

  /**
   * Remove timestamps older than the sliding window from the array
   * (mutates in place for efficiency).
   */
  private pruneWindow(times: number[], now: number): void {
    const cutoff = now - this.WINDOW_MS;
    let i = 0;
    while (i < times.length && times[i] < cutoff) {
      i++;
    }
    if (i > 0) {
      times.splice(0, i);
    }
  }
}

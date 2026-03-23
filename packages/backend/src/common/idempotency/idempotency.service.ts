import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { IdempotencyKey } from './idempotency-key.entity';

/** 24 hours in ms */
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyResult {
  /** true if this key was already completed — caller should return cachedResponse */
  alreadyCompleted: boolean;
  cachedResponse?: { status: number; body: Record<string, any> };
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  /**
   * Compute a stable SHA-256 hash of a request payload.
   * Keys in the object are sorted to ensure deterministic hashing.
   */
  static hashPayload(payload: Record<string, any>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Acquire an idempotency key. Returns whether the operation was already completed.
   *
   * If the key doesn't exist: creates it with status='processing'.
   * If the key exists and status='completed' and hash matches: returns cached response.
   * If the key exists and status='completed' but hash differs: throws 422 (payload mismatch).
   * If the key exists and status='processing': throws 409 (concurrent duplicate).
   */
  async acquire(
    key: string,
    userId: string,
    operation: string,
    requestHash: string,
  ): Promise<IdempotencyResult> {
    const existing = await this.repo.findOne({ where: { key } });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Idempotency key belongs to a different user');
      }

      if (existing.status === 'completed') {
        // Verify payload hash matches
        if (existing.requestHash !== requestHash) {
          throw new UnprocessableEntityException(
            'Idempotency key was already used with a different request payload',
          );
        }

        if (existing.responseBody) {
          this.logger.log(
            `Idempotency hit: key=${key} op=${operation} returning cached response`,
          );
          return {
            alreadyCompleted: true,
            cachedResponse: {
              status: existing.responseStatus ?? 200,
              body: existing.responseBody,
            },
          };
        }
      }

      if (existing.status === 'processing') {
        throw new ConflictException(
          'Request with this idempotency key is already being processed',
        );
      }
    }

    // Create new key
    const entry = this.repo.create({
      key,
      userId,
      operation,
      requestHash,
      status: 'processing',
      expiresAt: new Date(Date.now() + KEY_TTL_MS),
    });

    try {
      await this.repo.save(entry);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException(
          'Request with this idempotency key is already being processed',
        );
      }
      throw err;
    }

    return { alreadyCompleted: false };
  }

  /**
   * Mark an idempotency key as completed and cache the response.
   */
  async complete(
    key: string,
    responseStatus: number,
    responseBody: Record<string, any>,
  ): Promise<void> {
    await this.repo.update(
      { key },
      {
        status: 'completed',
        responseStatus,
        responseBody,
      },
    );
  }

  /**
   * Release a key if the operation failed (allows retry with same key).
   */
  async release(key: string): Promise<void> {
    await this.repo.delete({ key });
  }
}

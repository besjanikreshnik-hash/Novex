import { Logger } from '@nestjs/common';
import { OptimisticLockVersionMismatchError } from 'typeorm';

const logger = new Logger('RetryHelper');

export interface RetryOutcome {
  attempts: number;
  succeeded: boolean;
  lastError?: string;
}

/**
 * Retry a function on optimistic lock conflicts.
 *
 * TypeORM's @VersionColumn throws OptimisticLockVersionMismatchError when
 * a concurrent write has incremented the version. This helper retries the
 * entire operation (re-reading the row) up to `maxRetries` times.
 *
 * The caller MUST pass a function that re-reads the entity from the DB
 * (not a closure over a stale entity).
 */
export async function withOptimisticRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = 'operation',
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.log(
          JSON.stringify({
            event: 'optimistic_retry_succeeded',
            label,
            attempts: attempt + 1,
          }),
        );
      }
      return result;
    } catch (err) {
      const isOptimisticLock =
        err instanceof OptimisticLockVersionMismatchError ||
        (err instanceof Error && err.message.includes('optimistic lock'));

      if (!isOptimisticLock || attempt >= maxRetries) {
        if (isOptimisticLock) {
          logger.error(
            JSON.stringify({
              event: 'optimistic_retry_exhausted',
              label,
              attempts: attempt + 1,
              maxRetries,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
        throw err;
      }

      attempt++;
      logger.warn(
        JSON.stringify({
          event: 'optimistic_retry_attempt',
          label,
          attempt,
          maxRetries,
        }),
      );

      // Brief jittered backoff to reduce contention
      const jitter = Math.random() * 10 * attempt;
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
}

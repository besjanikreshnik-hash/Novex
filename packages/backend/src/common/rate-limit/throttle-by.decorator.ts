import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Throttle decorators scoped to specific NovEx operations.
 *
 * Each decorator activates the corresponding *named* throttler
 * that is registered in `ThrottlerModule.forRoot()` inside
 * `app.module.ts`.  The `limit` and `ttl` values here override
 * the module-level defaults for the named throttler so that
 * controller authors have an authoritative, self-documenting
 * annotation next to each handler.
 *
 * Named throttlers that are NOT listed in a `@Throttle()` call
 * are implicitly *skipped* for that route, meaning only the
 * specified throttler applies.
 */

/**
 * 10 order placements per 10 seconds, per user.
 */
export function ThrottleOrderPlacement() {
  return applyDecorators(
    Throttle({
      'order-placement': { limit: 10, ttl: 10000 },
    }),
  );
}

/**
 * 20 order cancellations per 10 seconds, per user.
 */
export function ThrottleOrderCancel() {
  return applyDecorators(
    Throttle({
      'order-cancel': { limit: 20, ttl: 10000 },
    }),
  );
}

/**
 * 5 authentication attempts per 60 seconds, per IP.
 */
export function ThrottleAuth() {
  return applyDecorators(
    Throttle({
      auth: { limit: 5, ttl: 60000 },
    }),
  );
}

/**
 * 3 registrations per hour (3600 seconds), per IP.
 */
export function ThrottleRegistration() {
  return applyDecorators(
    Throttle({
      registration: { limit: 3, ttl: 3600000 },
    }),
  );
}

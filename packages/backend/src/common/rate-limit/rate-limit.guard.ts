import {
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: string };
}

/**
 * Custom throttler guard for NovEx exchange.
 *
 * - Uses the authenticated user's ID as the tracking key for
 *   per-user rate limits on protected routes.
 * - Falls back to the client IP address for unauthenticated routes
 *   (login, registration, public endpoints).
 * - Returns a structured 429 response with a machine-readable
 *   `retryAfter` field and sets the `Retry-After` header.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Provide a tracking key: user ID when authenticated, IP otherwise.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const request = req as AuthenticatedRequest;
    if (request.user?.id) {
      return request.user.id;
    }
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Override to attach the Express request and response objects so
   * the base guard can set headers and read metadata correctly.
   */
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    const http = context.switchToHttp();
    return {
      req: http.getRequest<Request>(),
      res: http.getResponse<Response>(),
    };
  }

  /**
   * Build the storage key from the tracker, throttler name, and context.
   * Format: `rate-limit:{tracker}:{controllerName}-{handlerName}:{throttlerName}`
   */
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    return `rate-limit:${suffix}:${controller}-${handler}:${name}`;
  }

  /**
   * Intercept the ThrottlerException thrown by the base guard and
   * replace it with a structured 429 response that includes the
   * `Retry-After` header and a JSON body.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();

    const ttlSeconds = Math.ceil(
      (throttlerLimitDetail.ttl ?? throttlerLimitDetail.timeToExpire ?? 60000) /
        1000,
    );

    res.header('Retry-After', String(ttlSeconds));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${ttlSeconds} seconds.`,
        retryAfter: ttlSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

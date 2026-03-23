import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

function statusBucket(code: number): string {
  if (code === 429) return '429';
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  return '2xx';
}

/**
 * Global HTTP interceptor: records request latency, status counts,
 * and specific trading endpoint metrics using Prometheus counters/histograms.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, httpCtx.getResponse<Response>(), start),
        error: () => this.record(req, httpCtx.getResponse<Response>(), start),
      }),
    );
  }

  private record(req: Request, res: Response, start: number): void {
    const latencyMs = performance.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const route = this.normalizeRoute(req);
    const bucket = statusBucket(status);

    // ── All requests ──────────────────────────────────
    this.metrics.httpRequestTotal.inc({ method, route, status_bucket: bucket });
    this.metrics.httpRequestDuration.observe({ method, route, status_bucket: bucket }, latencyMs);

    // ── 5xx errors ────────────────────────────────────
    if (status >= 500) {
      this.metrics.http5xxTotal.inc({ method, route });
    }

    // ── 429 rate limits ───────────────────────────────
    if (status === 429) {
      this.metrics.http429Total.inc({ method, route });
    }

    // ── Order placement ───────────────────────────────
    if (method === 'POST' && /\/orders\/?$/.test(req.originalUrl)) {
      this.metrics.orderPlacementDuration.observe({ type: 'all' }, latencyMs);
    }
  }

  /** Normalize route to low-cardinality path (replace UUIDs with :id). */
  private normalizeRoute(req: Request): string {
    const route = req.route?.path;
    if (route) return route;
    // Fallback: replace UUID segments
    return req.path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );
  }
}

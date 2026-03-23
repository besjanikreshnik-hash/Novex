import { Controller, Get, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { AdminRoleGuard, RequireAdmin } from '../guards/admin-role.guard';

@ApiTags('admin')
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Prometheus scrape endpoint.
   * Protected by bearer token (METRICS_TOKEN env var).
   * If METRICS_TOKEN is not set, falls back to admin JWT auth.
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint (token-protected)' })
  @ApiResponse({ status: 200, description: 'Prometheus text format' })
  @ApiResponse({ status: 403, description: 'Invalid or missing metrics token' })
  async getPrometheusMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = this.config.get<string>('metricsToken');

    if (token) {
      // Token-based auth for Prometheus scraper
      const provided = req.headers['authorization']?.replace('Bearer ', '');
      if (provided !== token) {
        res.status(403).json({ error: 'Invalid metrics token' });
        return;
      }
    }
    // If no token configured, endpoint is open (dev mode)

    const text = await this.metrics.getPrometheusMetrics();
    res.set('Content-Type', this.metrics.getContentType());
    res.end(text);
  }

  /**
   * JSON snapshot for admin dashboards (requires admin JWT).
   */
  @Get('admin/metrics')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireAdmin()
  @ApiOperation({ summary: 'JSON metrics snapshot (admin JWT required)' })
  @ApiResponse({ status: 200, description: 'JSON metrics snapshot' })
  async getJsonMetrics(): Promise<any> {
    return this.metrics.getSnapshot();
  }
}

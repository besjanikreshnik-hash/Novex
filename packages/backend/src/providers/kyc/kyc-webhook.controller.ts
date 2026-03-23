import { Controller, Post, Body, Headers, Req, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { KycService } from './kyc.service';

/**
 * KYC Webhook Controller — receives callbacks from KYC vendors.
 *
 * No JWT auth — secured by webhook signature verification.
 * Configure vendor to POST to: /api/v1/webhooks/kyc
 */
@ApiTags('webhooks')
@Controller('webhooks/kyc')
export class KycWebhookController {
  private readonly logger = new Logger(KycWebhookController.name);

  constructor(private readonly kycService: KycService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'KYC vendor webhook endpoint' })
  async handleWebhook(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    this.logger.log(`KYC webhook received: ${JSON.stringify(body).slice(0, 200)}`);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }

    try {
      await this.kycService.handleWebhook({ body, headers });
      return { received: true };
    } catch (err) {
      this.logger.error(`KYC webhook processing error: ${err}`);
      // Return 200 to prevent vendor retries on our errors
      // (log the error and investigate manually)
      return { received: true };
    }
  }
}

import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFactorService, TwoFactorSetupResult } from './two-factor.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('auth / 2FA')
@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Generate TOTP secret and QR code for 2FA setup' })
  @ApiResponse({ status: 201, description: 'Secret generated' })
  @ApiResponse({ status: 400, description: '2FA already enabled' })
  async setup(@Req() req: AuthenticatedRequest): Promise<TwoFactorSetupResult> {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async verify(
    @Req() req: AuthenticatedRequest,
    @Body('token') token: string,
  ): Promise<{ enabled: boolean }> {
    await this.twoFactorService.verifyAndEnable(req.user.id, token);
    return { enabled: true };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate TOTP code (e.g. for sensitive actions)' })
  @ApiResponse({ status: 200, description: 'Code is valid' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async validate(
    @Req() req: AuthenticatedRequest,
    @Body('token') token: string,
  ): Promise<{ valid: boolean }> {
    await this.twoFactorService.verify(req.user.id, token);
    return { valid: true };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA (requires valid TOTP code)' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async disable(
    @Req() req: AuthenticatedRequest,
    @Body('token') token: string,
  ): Promise<{ disabled: boolean }> {
    await this.twoFactorService.disable(req.user.id, token);
    return { disabled: true };
  }
}

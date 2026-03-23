import {
  Controller,
  Post,
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
import { AuthService, AuthResponse, TokenPair, LoginResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import {
  ThrottleAuth,
  ThrottleRegistration,
} from '../../common/rate-limit/throttle-by.decorator';
import { Request } from 'express';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/activity.entity';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @ThrottleRegistration()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiResponse({ status: 200, description: 'Login successful or 2FA required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    const result = await this.authService.login(dto);
    // Log login activity if full auth (non-2FA) — for 2FA, log after verification
    if ('user' in result) {
      this.activityService.logActivity(result.user.id, ActivityAction.LOGIN, req).catch(() => {});
    }
    return result;
  }

  @Post('2fa/login')
  @UseGuards(RateLimitGuard)
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with 2FA code' })
  @ApiResponse({ status: 200, description: '2FA verified, tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid code or expired token' })
  async complete2FALogin(
    @Body('tempToken') tempToken: string,
    @Body('code') code: string,
  ): Promise<AuthResponse> {
    return this.authService.complete2FALogin(tempToken, code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Refresh access + refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenPair> {
    return this.authService.refresh(req.user.id, refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    await this.authService.logout(req.user.id);
    this.activityService.logActivity(req.user.id, ActivityAction.LOGOUT, req).catch(() => {});
    return { message: 'Logged out successfully' };
  }
}

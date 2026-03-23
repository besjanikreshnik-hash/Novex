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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { PushService } from './push.service';
import { PushPlatform } from './push-token.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

class RegisterPushDto {
  token: string;
  platform: PushPlatform;
  deviceName?: string;
}

class UnregisterPushDto {
  token: string;
}

@ApiTags('push')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a device push token' })
  @ApiBody({ type: RegisterPushDto })
  @ApiResponse({ status: 201, description: 'Token registered' })
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() body: RegisterPushDto,
  ) {
    const pushToken = await this.pushService.registerToken(
      req.user.id,
      body.token,
      body.platform,
      body.deviceName ?? '',
    );
    return { success: true, id: pushToken.id };
  }

  @Delete('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device push token' })
  @ApiBody({ type: UnregisterPushDto })
  @ApiResponse({ status: 200, description: 'Token unregistered' })
  async unregister(
    @Req() req: AuthenticatedRequest,
    @Body() body: UnregisterPushDto,
  ) {
    await this.pushService.removeToken(req.user.id, body.token);
    return { success: true };
  }
}

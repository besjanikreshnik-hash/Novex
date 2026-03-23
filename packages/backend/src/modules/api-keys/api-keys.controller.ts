import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyPermissions } from './api-key.entity';

class CreateApiKeyDto {
  label: string;
  permissions: ApiKeyPermissions;
  expiresInDays?: number;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async generateKey(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.generateKey(
      req.user.id,
      dto.label,
      dto.permissions,
      dto.expiresInDays,
    );
  }

  @Get()
  async listKeys(@Request() req: any) {
    return this.apiKeysService.listKeys(req.user.id);
  }

  @Delete(':id')
  async revokeKey(@Request() req: any, @Param('id') id: string) {
    await this.apiKeysService.revokeKey(req.user.id, id);
    return { message: 'API key revoked' };
  }
}

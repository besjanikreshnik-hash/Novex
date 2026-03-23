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
import { AlertsService } from './alerts.service';
import { AlertDirection } from './alert.entity';

class CreateAlertDto {
  symbol: string;
  targetPrice: string;
  direction: AlertDirection;
}

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async createAlert(@Request() req: any, @Body() dto: CreateAlertDto) {
    return this.alertsService.createAlert(
      req.user.id,
      dto.symbol,
      dto.targetPrice,
      dto.direction,
    );
  }

  @Get()
  async getAlerts(@Request() req: any) {
    return this.alertsService.getUserAlerts(req.user.id);
  }

  @Delete(':id')
  async cancelAlert(@Request() req: any, @Param('id') id: string) {
    await this.alertsService.cancelAlert(req.user.id, id);
    return { message: 'Alert cancelled' };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotsService, GridBotDto, CreateGridBotDto } from './bots.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('bots')
@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post('grid')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new grid bot' })
  @ApiResponse({ status: 201, description: 'Grid bot created' })
  async createGridBot(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateGridBotDto,
  ): Promise<GridBotDto> {
    return this.botsService.createGridBot(req.user.id, body);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List my bots' })
  @ApiResponse({ status: 200, description: 'List of bots' })
  async getBots(
    @Req() req: AuthenticatedRequest,
  ): Promise<GridBotDto[]> {
    return this.botsService.getBots(req.user.id);
  }

  @Patch(':id/stop')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stop a running bot' })
  @ApiResponse({ status: 200, description: 'Bot stopped' })
  async stopBot(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<GridBotDto> {
    return this.botsService.stopBot(req.user.id, id);
  }

  @Patch(':id/pause')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pause a running bot' })
  @ApiResponse({ status: 200, description: 'Bot paused' })
  async pauseBot(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<GridBotDto> {
    return this.botsService.pauseBot(req.user.id, id);
  }

  @Patch(':id/resume')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resume a paused bot' })
  @ApiResponse({ status: 200, description: 'Bot resumed' })
  async resumeBot(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<GridBotDto> {
    return this.botsService.resumeBot(req.user.id, id);
  }
}

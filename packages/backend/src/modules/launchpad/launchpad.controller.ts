import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  LaunchpadService,
  LaunchpadProjectDto,
  LaunchpadContributionDto,
} from './launchpad.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('launchpad')
@Controller('launchpad')
export class LaunchpadController {
  constructor(private readonly launchpadService: LaunchpadService) {}

  @Get('projects')
  @ApiOperation({ summary: 'List launchpad projects' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of launchpad projects' })
  async getProjects(
    @Query('status') status?: string,
  ): Promise<LaunchpadProjectDto[]> {
    return this.launchpadService.getProjects(status);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get a single launchpad project' })
  @ApiResponse({ status: 200, description: 'Project details' })
  async getProject(
    @Param('id') id: string,
  ): Promise<LaunchpadProjectDto> {
    return this.launchpadService.getProject(id);
  }

  @Post('contribute')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Contribute USDT to a launchpad project' })
  @ApiResponse({ status: 201, description: 'Contribution recorded' })
  async contribute(
    @Req() req: AuthenticatedRequest,
    @Body() body: { projectId: string; amount: string },
  ): Promise<LaunchpadContributionDto> {
    return this.launchpadService.contribute(
      req.user.id,
      body.projectId,
      body.amount,
    );
  }

  @Post('claim/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Claim tokens for a completed contribution' })
  @ApiResponse({ status: 200, description: 'Tokens claimed' })
  async claimTokens(
    @Req() req: AuthenticatedRequest,
    @Param('id') contributionId: string,
  ): Promise<LaunchpadContributionDto> {
    return this.launchpadService.claimTokens(
      req.user.id,
      contributionId,
    );
  }

  @Post('refund/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Request refund for a contribution' })
  @ApiResponse({ status: 200, description: 'Contribution refunded' })
  async refund(
    @Req() req: AuthenticatedRequest,
    @Param('id') contributionId: string,
  ): Promise<LaunchpadContributionDto> {
    return this.launchpadService.refund(req.user.id, contributionId);
  }

  @Get('my-contributions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List current user contributions' })
  @ApiResponse({ status: 200, description: 'User contributions' })
  async getMyContributions(
    @Req() req: AuthenticatedRequest,
  ): Promise<LaunchpadContributionDto[]> {
    return this.launchpadService.getUserContributions(req.user.id);
  }
}

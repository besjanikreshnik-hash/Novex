import {
  Controller,
  Get,
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
import { ActivityService } from './activity.service';
import { ActivityAction } from './activity.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('account')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('account')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('activity')
  @ApiOperation({ summary: 'List account activity log (paginated)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, enum: ActivityAction })
  @ApiResponse({ status: 200, description: 'Activity log returned' })
  async getActivity(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('action') action?: ActivityAction,
  ) {
    return this.activityService.getUserActivity(req.user.id, {
      limit: limit ?? 20,
      offset: offset ?? 0,
      action,
    });
  }
}

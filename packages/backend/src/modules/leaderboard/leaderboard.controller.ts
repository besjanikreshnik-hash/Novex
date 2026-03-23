import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  private readonly logger = new Logger(LeaderboardController.name);

  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get top traders leaderboard' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['24h', '7d', '30d', 'all'],
    description: 'Time period for leaderboard',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of entries to return (max 100)',
  })
  @ApiResponse({ status: 200, description: 'Leaderboard entries' })
  async getLeaderboard(
    @Query('period') period?: '24h' | '7d' | '30d' | 'all',
    @Query('limit') limit?: string,
  ): Promise<{ entries: Omit<LeaderboardEntry, 'userId'>[] }> {
    const validPeriods = ['24h', '7d', '30d', 'all'] as const;
    const safePeriod = validPeriods.includes(period as any)
      ? (period as '24h' | '7d' | '30d' | 'all')
      : '24h';

    const safeLimit = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 100);

    const entries = await this.leaderboardService.getLeaderboard(safePeriod, safeLimit);

    // Strip userId from response
    return {
      entries: entries.map(({ userId, ...rest }) => rest),
    };
  }
}

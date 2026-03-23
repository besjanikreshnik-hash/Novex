import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade } from '../trading/entities/trade.entity';
import { User } from '../users/user.entity';

export interface LeaderboardEntry {
  rank: number;
  maskedEmail: string;
  totalVolume: string;
  tradeCount: number;
  topPair: string;
  userId?: string; // only included for internal matching; stripped before response
}

interface CacheEntry {
  data: LeaderboardEntry[];
  expiresAt: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Masks an email: show first 2 + "***" + last 2 chars before @, then @domain.
   * e.g. "johndoe@example.com" → "jo***oe@example.com"
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '****@****';
    if (local.length <= 4) {
      return `${local[0]}***@${domain}`;
    }
    return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
  }

  async getLeaderboard(
    period: '24h' | '7d' | '30d' | 'all' = '24h',
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `${period}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const result = await this.queryLeaderboard(period, limit);
    this.cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + LeaderboardService.CACHE_TTL_MS,
    });
    return result;
  }

  private async queryLeaderboard(
    period: '24h' | '7d' | '30d' | 'all',
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    try {
      // Build the date filter
      let dateFilter = '';
      const params: any[] = [];

      if (period !== 'all') {
        const intervalMap: Record<string, string> = {
          '24h': '1 day',
          '7d': '7 days',
          '30d': '30 days',
        };
        dateFilter = `AND t."created_at" >= NOW() - INTERVAL '${intervalMap[period]}'`;
      }

      // Aggregate volume per user (both buyer and seller participate in volume)
      // Each trade has a buyer_user_id and seller_user_id; we count volume for both sides
      const query = `
        WITH user_trades AS (
          SELECT user_id, symbol, SUM(volume) as total_volume, COUNT(*) as trade_count
          FROM (
            SELECT
              t."buyer_user_id" AS user_id,
              t."symbol",
              CAST(t."gross_quote" AS DECIMAL(36,18)) AS volume
            FROM trades t
            WHERE 1=1 ${dateFilter}
            UNION ALL
            SELECT
              t."seller_user_id" AS user_id,
              t."symbol",
              CAST(t."gross_quote" AS DECIMAL(36,18)) AS volume
            FROM trades t
            WHERE 1=1 ${dateFilter}
          ) combined
          GROUP BY user_id, symbol
        ),
        user_totals AS (
          SELECT
            user_id,
            SUM(total_volume) AS total_volume,
            SUM(trade_count) AS trade_count
          FROM user_trades
          GROUP BY user_id
          ORDER BY total_volume DESC
          LIMIT $1
        ),
        user_top_pair AS (
          SELECT DISTINCT ON (ut.user_id)
            ut.user_id,
            utr.symbol AS top_pair,
            utr.total_volume AS pair_volume
          FROM user_totals ut
          JOIN user_trades utr ON utr.user_id = ut.user_id
          ORDER BY ut.user_id, utr.total_volume DESC
        )
        SELECT
          ut.user_id,
          ut.total_volume,
          ut.trade_count,
          COALESCE(utp.top_pair, 'N/A') AS top_pair
        FROM user_totals ut
        LEFT JOIN user_top_pair utp ON utp.user_id = ut.user_id
        ORDER BY ut.total_volume DESC
      `;

      params.push(limit);

      const rows: {
        user_id: string;
        total_volume: string;
        trade_count: string;
        top_pair: string;
      }[] = await this.tradeRepo.query(query, params);

      if (!rows.length) return [];

      // Fetch emails for the user IDs
      const userIds = rows.map((r) => r.user_id);
      const users = await this.userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.email'])
        .where('u.id IN (:...ids)', { ids: userIds })
        .getMany();

      const emailMap = new Map(users.map((u) => [u.id, u.email]));

      return rows.map((row, idx) => ({
        rank: idx + 1,
        maskedEmail: this.maskEmail(emailMap.get(row.user_id) || 'unknown@user'),
        totalVolume: parseFloat(row.total_volume).toFixed(2),
        tradeCount: parseInt(row.trade_count, 10),
        topPair: row.top_pair.replace('_', '/'),
        userId: row.user_id,
      }));
    } catch (error) {
      this.logger.error('Failed to query leaderboard', error);
      return [];
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AccountActivity, ActivityAction } from './activity.entity';

export interface GetActivityOptions {
  limit?: number;
  offset?: number;
  action?: ActivityAction;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(AccountActivity)
    private readonly activityRepo: Repository<AccountActivity>,
  ) {}

  /**
   * Log a user activity, extracting IP and user-agent from the request.
   */
  async logActivity(
    userId: string,
    action: ActivityAction,
    req?: Request,
    metadata?: Record<string, unknown>,
  ): Promise<AccountActivity> {
    const ipAddress = req
      ? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        null
      : null;
    const userAgent = req
      ? (req.headers['user-agent'] as string) || null
      : null;

    const activity = this.activityRepo.create({
      userId,
      action,
      ipAddress,
      userAgent: userAgent ? userAgent.substring(0, 512) : null,
      metadata: metadata ?? null,
    });

    const saved = await this.activityRepo.save(activity);
    this.logger.debug(`Activity logged: ${action} for user ${userId}`);
    return saved;
  }

  /**
   * Get paginated activity log for a user, optionally filtered by action type.
   */
  async getUserActivity(
    userId: string,
    options: GetActivityOptions = {},
  ): Promise<{ activities: AccountActivity[]; total: number }> {
    const { limit = 20, offset = 0, action } = options;

    const qb = this.activityRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .orderBy('a.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (action) {
      qb.andWhere('a.action = :action', { action });
    }

    const [activities, total] = await qb.getManyAndCount();
    return { activities, total };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { EmailService } from '../../common/email/email.service';
import { UsersService } from '../users/users.service';

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Create a new notification for a user.
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId,
      type,
      title,
      message,
      metadata: metadata ?? null,
      read: false,
    });

    const saved = await this.notificationRepo.save(notification);
    this.logger.debug(`Notification created: ${type} for user ${userId}`);

    // ── Send email notification for trade fills ──────────
    if (type === NotificationType.TRADE_FILL && metadata) {
      this.sendTradeEmail(userId, metadata).catch((err) =>
        this.logger.warn(`Failed to send trade email: ${err}`),
      );
    }

    return saved;
  }

  /**
   * Resolve user email and send trade notification email.
   */
  private async sendTradeEmail(
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.email) return;

    await this.emailService.sendTradeNotification(user.email, {
      symbol: String(metadata.symbol ?? ''),
      side: String(metadata.side ?? ''),
      type: 'fill',
      quantity: String(metadata.quantity ?? ''),
      price: metadata.price ? String(metadata.price) : undefined,
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    });
  }

  /**
   * Get notifications for a user with optional filters.
   */
  async getUserNotifications(
    userId: string,
    options: GetNotificationsOptions = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (unreadOnly) {
      qb.andWhere('n.read = :read', { read: false });
    }

    const [notifications, total] = await qb.getManyAndCount();
    return { notifications, total };
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { read: true },
    );
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, read: false },
      { read: true },
    );
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, read: false },
    });
  }
}

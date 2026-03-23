import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { PriceAlert, AlertDirection } from './alert.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(PriceAlert)
    private readonly alertRepo: Repository<PriceAlert>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new price alert for a user.
   */
  async createAlert(
    userId: string,
    symbol: string,
    targetPrice: string,
    direction: AlertDirection,
  ): Promise<PriceAlert> {
    const alert = this.alertRepo.create({
      userId,
      symbol: symbol.toUpperCase(),
      targetPrice,
      direction,
      status: 'active',
      triggeredAt: null,
    });

    const saved = await this.alertRepo.save(alert);
    this.logger.debug(
      `Alert created: ${direction} ${targetPrice} for ${symbol} by user ${userId}`,
    );
    return saved;
  }

  /**
   * Get all alerts for a user (active + recently triggered).
   */
  async getUserAlerts(userId: string): Promise<PriceAlert[]> {
    return this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cancel an alert.
   */
  async cancelAlert(userId: string, alertId: string): Promise<void> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.status = 'cancelled';
    await this.alertRepo.save(alert);
  }

  /**
   * Check all active alerts for a symbol against the current price.
   * Triggers matching alerts and creates notifications.
   */
  async checkAlerts(symbol: string, currentPrice: Decimal): Promise<void> {
    const activeAlerts = await this.alertRepo.find({
      where: { symbol: symbol.toUpperCase(), status: 'active' },
    });

    if (activeAlerts.length === 0) return;

    const triggeredAlerts: PriceAlert[] = [];

    for (const alert of activeAlerts) {
      const target = new Decimal(alert.targetPrice);
      const shouldTrigger =
        (alert.direction === 'above' && currentPrice.gte(target)) ||
        (alert.direction === 'below' && currentPrice.lte(target));

      if (shouldTrigger) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        triggeredAlerts.push(alert);
      }
    }

    if (triggeredAlerts.length === 0) return;

    await this.alertRepo.save(triggeredAlerts);

    // Create notifications for each triggered alert
    for (const alert of triggeredAlerts) {
      const dirLabel = alert.direction === 'above' ? 'risen above' : 'fallen below';
      await this.notificationsService.createNotification(
        alert.userId,
        NotificationType.SYSTEM,
        `Price Alert: ${alert.symbol}`,
        `${alert.symbol} has ${dirLabel} your target of ${alert.targetPrice}. Current price: ${currentPrice.toFixed()}`,
        {
          alertId: alert.id,
          symbol: alert.symbol,
          targetPrice: alert.targetPrice,
          direction: alert.direction,
          currentPrice: currentPrice.toFixed(),
        },
      );
    }

    this.logger.log(
      `Triggered ${triggeredAlerts.length} alert(s) for ${symbol} at price ${currentPrice.toFixed()}`,
    );
  }
}

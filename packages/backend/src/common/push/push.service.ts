import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushToken, PushPlatform } from './push-token.entity';

/**
 * Push notification service.
 *
 * Currently logs push payloads to the console. When ready for production,
 * replace the `dispatchPush` method with a real Firebase Cloud Messaging
 * (FCM) or APNs integration.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
  ) {}

  // ── Token Management ──────────────────────────────────────

  /**
   * Register (or re-activate) a device push token for a user.
   */
  async registerToken(
    userId: string,
    token: string,
    platform: PushPlatform,
    deviceName: string,
  ): Promise<PushToken> {
    const existing = await this.pushTokenRepo.findOne({
      where: { userId, token },
    });

    if (existing) {
      existing.platform = platform;
      existing.deviceName = deviceName;
      existing.isActive = true;
      return this.pushTokenRepo.save(existing);
    }

    const pushToken = this.pushTokenRepo.create({
      userId,
      token,
      platform,
      deviceName,
      isActive: true,
    });

    return this.pushTokenRepo.save(pushToken);
  }

  /**
   * Remove (deactivate) a device push token.
   */
  async removeToken(userId: string, token: string): Promise<void> {
    await this.pushTokenRepo.update(
      { userId, token },
      { isActive: false },
    );
    this.logger.debug(`Push token deactivated for user ${userId}`);
  }

  // ── Sending ───────────────────────────────────────────────

  /**
   * Send a push notification to all active devices for a specific user.
   */
  async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const tokens = await this.pushTokenRepo.find({
      where: { userId, isActive: true },
    });

    if (tokens.length === 0) {
      this.logger.debug(`No active push tokens for user ${userId}, skipping push`);
      return;
    }

    for (const t of tokens) {
      await this.dispatchPush(t.token, t.platform, title, body, data);
    }
  }

  /**
   * Broadcast a push notification to ALL users with active tokens.
   */
  async sendPushToAll(
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const tokens = await this.pushTokenRepo.find({
      where: { isActive: true },
    });

    this.logger.log(`Broadcasting push to ${tokens.length} device(s)`);

    for (const t of tokens) {
      await this.dispatchPush(t.token, t.platform, title, body, data);
    }
  }

  // ── FCM Placeholder ───────────────────────────────────────

  /**
   * Dispatch a single push notification to one device token.
   *
   * TODO: Replace this placeholder with a real FCM / APNs integration:
   *
   * ```ts
   * import * as admin from 'firebase-admin';
   *
   * private async dispatchPush(...) {
   *   await admin.messaging().send({
   *     token: deviceToken,
   *     notification: { title, body },
   *     data: data ? Object.fromEntries(
   *       Object.entries(data).map(([k, v]) => [k, String(v)])
   *     ) : undefined,
   *   });
   * }
   * ```
   */
  private async dispatchPush(
    deviceToken: string,
    platform: PushPlatform,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(
      `[PUSH] platform=${platform} token=${deviceToken.slice(0, 12)}... | ${title}: ${body}` +
        (data ? ` | data=${JSON.stringify(data)}` : ''),
    );
  }
}

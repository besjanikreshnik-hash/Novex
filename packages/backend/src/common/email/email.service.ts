import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { loginAlertTemplate } from './templates/login-alert';
import {
  tradeNotificationTemplate,
  TradeEmailData,
} from './templates/trade-notification';
import {
  withdrawalConfirmationTemplate,
  WithdrawalEmailData,
} from './templates/withdrawal-confirmation';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly smtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') || 'noreply@novex.io';

    this.smtpConfigured = !!(host && port);

    if (this.smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth:
          user && pass
            ? { user, pass }
            : undefined,
      });
      this.logger.log(`Email transport configured: ${host}:${port}`);
    } else {
      this.logger.warn(
        'SMTP not configured — emails will be logged to console (dev mode)',
      );
    }
  }

  /**
   * Send a raw email. Falls back to console logging if SMTP is not configured.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          html,
        });
        this.logger.debug(`Email sent to ${to}: ${subject}`);
      } catch (err) {
        this.logger.error(`Failed to send email to ${to}: ${err}`);
      }
    } else {
      // Dev fallback: log to console
      this.logger.log(
        `[DEV EMAIL] To: ${to} | Subject: ${subject}\n--- HTML preview omitted (${html.length} chars) ---`,
      );
    }
  }

  /**
   * Send a login alert email.
   */
  async sendLoginAlert(email: string, ip: string): Promise<void> {
    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const html = loginAlertTemplate(ip, timestamp);
    await this.sendEmail(email, 'NovEx: New Login Detected', html);
  }

  /**
   * Send a trade execution notification email.
   */
  async sendTradeNotification(
    email: string,
    trade: TradeEmailData,
  ): Promise<void> {
    const html = tradeNotificationTemplate(trade);
    await this.sendEmail(
      email,
      `NovEx: ${trade.side.toUpperCase()} ${trade.symbol} Order Executed`,
      html,
    );
  }

  /**
   * Send a withdrawal confirmation email.
   */
  async sendWithdrawalConfirmation(
    email: string,
    withdrawal: WithdrawalEmailData,
  ): Promise<void> {
    const html = withdrawalConfirmationTemplate(withdrawal);
    await this.sendEmail(
      email,
      `NovEx: ${withdrawal.asset} Withdrawal Confirmed`,
      html,
    );
  }
}

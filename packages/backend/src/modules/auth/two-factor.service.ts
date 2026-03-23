import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import { User } from '../users/user.entity';

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string; // data URI for QR code
}

@Injectable()
export class TwoFactorService {
  private readonly issuer = 'NovEx';

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Generate a TOTP secret for the user. Stores the secret on the user
   * record (but does NOT enable 2FA yet — that requires verification).
   */
  async generateSecret(userId: string): Promise<TwoFactorSetupResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled. Disable it first to reconfigure.',
      );
    }

    const secret = authenticator.generateSecret();

    const otpauthUrl = authenticator.keyuri(
      user.email,
      this.issuer,
      secret,
    );

    // Store the secret (not yet enabled)
    await this.userRepo.update(userId, { twoFactorSecret: secret });

    // Build a QR code data URI using a Google Charts API URL
    // (lightweight — no extra dependency needed)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

    return { secret, otpauthUrl, qrCodeUrl };
  }

  /**
   * Verify a TOTP token and enable 2FA for the user.
   * The user must have already called generateSecret.
   */
  async verifyAndEnable(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'No two-factor secret found. Please call setup first.',
      );
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.userRepo.update(userId, { twoFactorEnabled: true });
    return true;
  }

  /**
   * Verify a TOTP token (for login validation).
   */
  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    return true;
  }

  /**
   * Disable 2FA — requires a valid TOTP token for security.
   */
  async disable(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    await this.userRepo.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    return true;
  }
}

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: { id: string; email: string; role: string };
  tokens: TokenPair;
}

export interface TwoFactorPendingResponse {
  requires2FA: true;
  tempToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorPendingResponse;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /* ───────── Register ──────────────────────────────── */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );

    const tokens = await this.generateTokens(user);
    await this.storeRefreshHash(user.id, tokens.refreshToken);
    await this.usersService.updateLastLogin(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      tokens,
    };
  }

  /* ───────── Login ─────────────────────────────────── */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.usersService.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    // If 2FA is enabled, return a short-lived temp token instead of full auth
    if (user.twoFactorEnabled) {
      const tempToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: '2fa_pending',
        },
        { expiresIn: '5m' },
      );

      return { requires2FA: true, tempToken };
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshHash(user.id, tokens.refreshToken);
    await this.usersService.updateLastLogin(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      tokens,
    };
  }

  /* ───────── Complete 2FA Login ──────────────────────── */
  async complete2FALogin(
    tempToken: string,
    totpCode: string,
  ): Promise<AuthResponse> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('Expired or invalid temporary token. Please login again.');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication is not configured');
    }

    // Verify the TOTP code — import authenticator inline to avoid circular deps
    const { authenticator } = await import('otplib');
    const isValid = authenticator.verify({
      token: totpCode,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshHash(user.id, tokens.refreshToken);
    await this.usersService.updateLastLogin(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      tokens,
    };
  }

  /* ───────── Refresh ───────────────────────────────── */
  async refresh(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      // Potential token reuse — revoke all sessions
      await this.usersService.setRefreshToken(user.id, null);
      throw new UnauthorizedException('Refresh token invalid — all sessions revoked');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshHash(user.id, tokens.refreshToken);
    return tokens;
  }

  /* ───────── Logout ────────────────────────────────── */
  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshToken(userId, null);
  }

  /* ───────── Helpers ───────────────────────────────── */
  private async generateTokens(user: User): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          expiresIn: this.configService.get<string>('jwt.accessExpiry', '15m'),
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          expiresIn: this.configService.get<string>('jwt.refreshExpiry', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setRefreshToken(userId, hash);
  }
}

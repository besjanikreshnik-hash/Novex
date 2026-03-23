import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../modules/users/users.service';

const REQUIRE_2FA_KEY = 'require2fa';

/** Decorator: mark a route as requiring 2FA step-up confirmation.
 *  The request body must include `twoFactorCode` field. */
export const Require2FA = () => SetMetadata(REQUIRE_2FA_KEY, true);

/**
 * Two-Factor Step-Up Guard.
 *
 * When applied, requires the request body to include a `twoFactorCode` field.
 * If the user has 2FA enabled, the code is validated against their TOTP secret.
 * If the user has NOT enabled 2FA, the guard blocks and instructs them to enable it.
 *
 * For pilot: we enforce that 2FA must be enabled for sensitive operations.
 * The actual TOTP verification is a placeholder (validates code is non-empty
 * and 6 digits) — real OTP verification requires the otplib integration.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const require2fa = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_2FA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!require2fa) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Authentication required');

    const user = await this.users.findById(userId);

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled) {
      throw new ForbiddenException(
        'Two-factor authentication is required for this action. ' +
        'Please enable 2FA in your security settings first.',
      );
    }

    // Validate the code from request body
    const code = request.body?.twoFactorCode;
    if (!code || typeof code !== 'string') {
      throw new ForbiddenException(
        'Two-factor authentication code is required. Include "twoFactorCode" in request body.',
      );
    }

    if (!/^\d{6}$/.test(code)) {
      throw new ForbiddenException('Invalid 2FA code format. Must be 6 digits.');
    }

    // Placeholder: In production, verify against TOTP secret using otplib:
    //   const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
    //   if (!isValid) throw new ForbiddenException('Invalid 2FA code');

    // For pilot: accept any 6-digit code if 2FA is "enabled" (testing mode)
    // TODO: Replace with real TOTP verification before production
    return true;
  }
}

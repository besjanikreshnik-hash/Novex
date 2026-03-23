import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';

/**
 * Blocks requests from frozen/suspended/banned accounts.
 * Apply to all mutation endpoints (trading, funding, etc.).
 */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) return true; // let auth guard handle missing user

    const user = await this.users.findById(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been suspended. Please contact support.',
      );
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/user.entity';

const ROLES_KEY = 'requiredRoles';

/**
 * Role hierarchy — higher roles inherit all permissions of lower roles.
 * ADMIN > TREASURY > OPS > COMPLIANCE > SUPPORT > USER
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.USER]: 0,
  [UserRole.SUPPORT]: 1,
  [UserRole.COMPLIANCE]: 2,
  [UserRole.OPS]: 3,
  [UserRole.TREASURY]: 4,
  [UserRole.ADMIN]: 5,
};

/** Check if a user's role satisfies a required role (via hierarchy) */
function roleHierarchySatisfies(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

/** Decorator: require one of the specified roles (or higher in hierarchy) */
export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

/** Shorthand decorators for common role requirements */
export const RequireAdmin = () => RequireRoles(UserRole.ADMIN);
export const RequireOps = () => RequireRoles(UserRole.OPS);
export const RequireTreasury = () => RequireRoles(UserRole.TREASURY);
export const RequireCompliance = () => RequireRoles(UserRole.COMPLIANCE);
export const RequireSupport = () => RequireRoles(UserRole.SUPPORT);

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as UserRole;

    if (!userRole) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user's role satisfies ANY of the required roles (via hierarchy)
    const satisfied = requiredRoles.some((req) => roleHierarchySatisfies(userRole, req));

    if (!satisfied) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}. Your role: ${userRole}`,
      );
    }

    return true;
  }
}

export { ROLE_HIERARCHY, roleHierarchySatisfies };

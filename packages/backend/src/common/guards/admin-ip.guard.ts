import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Admin IP Allowlist Guard.
 *
 * Restricts admin endpoints to a configurable list of IP addresses/CIDRs.
 * When ADMIN_IP_ALLOWLIST is empty (dev mode), all IPs are allowed.
 *
 * Env: ADMIN_IP_ALLOWLIST=10.0.0.0/8,192.168.1.0/24,1.2.3.4
 */
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly allowedIps: string[];

  constructor(private readonly config: ConfigService) {
    this.allowedIps = (config.get<string>('ADMIN_IP_ALLOWLIST', '') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.allowedIps.length === 0) {
      return true; // disabled — allow all (dev mode)
    }

    const request = context.switchToHttp().getRequest();
    const clientIp = this.extractIp(request);

    if (!clientIp) {
      throw new ForbiddenException('Cannot determine client IP');
    }

    const allowed = this.allowedIps.some((entry) => {
      if (entry.includes('/')) {
        return this.isIpInCidr(clientIp, entry);
      }
      return clientIp === entry;
    });

    if (!allowed) {
      throw new ForbiddenException(
        'Admin access denied: your IP is not in the allowlist',
      );
    }

    return true;
  }

  private extractIp(req: any): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? req.connection?.remoteAddress ?? null;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [cidrIp, bits] = cidr.split('/');
    const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1);
    const ipNum = this.ipToNum(ip);
    const cidrNum = this.ipToNum(cidrIp);
    return (ipNum & mask) === (cidrNum & mask);
  }

  private ipToNum(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}

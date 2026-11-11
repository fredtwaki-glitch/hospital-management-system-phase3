import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantRequest } from '../middleware/tenant-resolver.middleware';

/**
 * Standard JWT verification, PLUS a critical multi-tenant safety check:
 * the tenant encoded in the token must match the tenant resolved from
 * the request (subdomain/header). Without this check, a stolen or
 * replayed token from Tenant A could be pointed at Tenant B's subdomain
 * and the JWT itself would still "verify" successfully.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new ForbiddenException('Invalid or missing credentials');
    }

    const req = context.switchToHttp().getRequest<TenantRequest>();

    if (!req.tenant || user.tenantId !== req.tenant.id) {
      throw new ForbiddenException('Token does not belong to this tenant');
    }

    return user;
  }
}

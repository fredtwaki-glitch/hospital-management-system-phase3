import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Unlike JwtAuthGuard (staff) and PatientJwtAuthGuard (patient), this
 * one does NOT cross-check against req.tenant - platform admin routes
 * are excluded from TenantResolverMiddleware entirely (see app.module.ts),
 * since a platform admin isn't operating within any single tenant's
 * context. The only check needed here is "is this actually a platform
 * admin token."
 */
@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user || user.scope !== 'platform_admin') {
      throw err || new ForbiddenException('Invalid or missing platform admin credentials');
    }
    return user;
  }
}

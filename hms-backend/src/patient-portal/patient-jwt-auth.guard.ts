import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';

@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('patient-jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user || user.scope !== 'patient_portal') {
      throw err || new ForbiddenException('Invalid or missing patient credentials');
    }

    const req = context.switchToHttp().getRequest<TenantRequest>();
    if (!req.tenant || user.tenantId !== req.tenant.id) {
      throw new ForbiddenException('Token does not belong to this tenant');
    }

    return user;
  }
}

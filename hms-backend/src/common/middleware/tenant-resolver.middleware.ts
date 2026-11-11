import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NextFunction, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../../tenant/tenant.entity';
import { TenantConnectionManager } from '../../database/tenant-connection.manager';

export interface TenantRequest extends Request {
  // Non-optional: TenantResolverMiddleware always sets both fields before
  // any route handler runs (it throws NotFoundException when no tenant can
  // be resolved), so downstream code can rely on them being present.
  tenant: Tenant;
  tenantDataSource: import('typeorm').DataSource;
  // Populated by JwtAuthGuard on protected routes.
  user?: { sub: string; tenantId: string; role: string; email: string; staffNumber: string };
}

/**
 * Resolves which tenant a request belongs to, BEFORE any route logic runs.
 *
 * Resolution order:
 *   1. X-Tenant-Slug header (used by mobile apps / chatbot / server-to-server calls)
 *   2. Subdomain (e.g. acme-hospital.yourplatform.com) - used by the web app
 *
 * Every downstream module (patients, appointments, billing, payroll sync,
 * automation triggers) reads req.tenant / req.tenantDataSource instead of
 * re-resolving tenancy itself. This is the single choke point for
 * multi-tenant isolation - keep all tenant lookup logic here.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant, 'control')
    private tenantRepo: Repository<Tenant>,
    private connectionManager: TenantConnectionManager,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const slug = this.extractSlug(req);

    if (!slug) {
      throw new NotFoundException('No tenant could be resolved from this request');
    }

    const tenant = await this.tenantRepo.findOne({ where: { slug } });

    if (!tenant) {
      throw new NotFoundException(`Unknown tenant: ${slug}`);
    }

    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new NotFoundException('This account is currently suspended');
    }

    req.tenant = tenant;
    req.tenantDataSource = await this.connectionManager.getConnection(tenant.schemaName);

    next();
  }

  private extractSlug(req: Request): string | undefined {
    const headerSlug = req.header('X-Tenant-Slug');
    if (headerSlug) return headerSlug;

    // e.g. acme-hospital.yourplatform.com -> "acme-hospital"
    const host = req.hostname;
    const parts = host.split('.');
    if (parts.length > 2) {
      return parts[0];
    }

    return undefined;
  }
}

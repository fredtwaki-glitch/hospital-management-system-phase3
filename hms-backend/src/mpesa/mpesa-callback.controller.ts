import { Controller, Logger, Param, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { TenantConnectionManager } from '../database/tenant-connection.manager';
import { MpesaService } from './mpesa.service';

/**
 * Deliberately excluded from TenantResolverMiddleware (see app.module.ts,
 * same pattern as the platform admin routes) - Safaricom's servers call
 * these URLs directly and cannot send our X-Tenant-Slug header or hit a
 * tenant subdomain the way our own frontend does. Instead, the tenant
 * slug is embedded directly in the callback URL we register with
 * Safaricom per-request (see MpesaService.initiateStkPush) or at C2B
 * registration time, and resolved here manually.
 *
 * Always returns 200 OK with a ResultCode, regardless of what happened
 * on our end - Safaricom retries on non-200/malformed responses, and a
 * retry storm from our own processing errors is worse than swallowing
 * an error after logging it.
 */
@Controller('mpesa')
export class MpesaCallbackController {
  private readonly logger = new Logger(MpesaCallbackController.name);

  constructor(
    @InjectRepository(Tenant, 'control')
    private tenantRepo: Repository<Tenant>,
    private connectionManager: TenantConnectionManager,
    private mpesaService: MpesaService,
  ) {}

  @Post('callback/:tenantSlug')
  async stkCallback(@Param('tenantSlug') tenantSlug: string, @Body() body: any) {
    try {
      const tenant = await this.tenantRepo.findOne({ where: { slug: tenantSlug } });
      if (!tenant) {
        this.logger.error(`STK callback for unknown tenant slug "${tenantSlug}"`);
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }
      const tenantDataSource = await this.connectionManager.getConnection(tenant.schemaName);
      await this.mpesaService.handleStkCallback(tenantDataSource, tenant.id, body);
    } catch (err) {
      this.logger.error(`Error processing STK callback: ${(err as Error).message}`, (err as Error).stack);
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Post('c2b/:tenantSlug/validation')
  async c2bValidation(@Param('tenantSlug') tenantSlug: string) {
    // No DB work needed here - see MpesaService.handleC2bValidation for
    // why this accepts broadly rather than looking up the tenant/patient
    // before responding.
    return this.mpesaService.handleC2bValidation();
  }

  @Post('c2b/:tenantSlug/confirmation')
  async c2bConfirmation(@Param('tenantSlug') tenantSlug: string, @Body() body: any) {
    try {
      const tenant = await this.tenantRepo.findOne({ where: { slug: tenantSlug } });
      if (!tenant) {
        this.logger.error(`C2B confirmation for unknown tenant slug "${tenantSlug}"`);
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }
      const tenantDataSource = await this.connectionManager.getConnection(tenant.schemaName);
      await this.mpesaService.handleC2bConfirmation(tenantDataSource, tenant.id, body);
    } catch (err) {
      this.logger.error(`Error processing C2B confirmation: ${(err as Error).message}`, (err as Error).stack);
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}

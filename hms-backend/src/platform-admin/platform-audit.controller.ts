import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformJwtAuthGuard } from './platform-jwt-auth.guard';
import { PlatformAuditLog } from './platform-audit-log.entity';

@Controller('platform/tenants/:id/audit-log')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformAuditController {
  constructor(
    @InjectRepository(PlatformAuditLog, 'control')
    private auditRepo: Repository<PlatformAuditLog>,
  ) {}

  @Get()
  findForTenant(@Param('id') tenantId: string) {
    return this.auditRepo.find({ where: { targetTenantId: tenantId }, order: { createdAt: 'DESC' } });
  }
}

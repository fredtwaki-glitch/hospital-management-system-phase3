import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, RecordPaymentDto, UpdateClaimDto } from './dto/invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  create(@Req() req: TenantRequest, @Body() dto: CreateInvoiceDto) {
    const user = req.user as any;
    return this.billingService.createInvoice(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.billingService.findOne(req.tenantDataSource, id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  findByPatient(@Req() req: TenantRequest, @Query('patientId') patientId: string) {
    return this.billingService.findByPatient(req.tenantDataSource, patientId);
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  recordPayment(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    const user = req.user as any;
    return this.billingService.recordPayment(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }

  @Patch(':id/claim')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  updateClaim(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdateClaimDto) {
    const user = req.user as any;
    return this.billingService.updateClaim(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }
}

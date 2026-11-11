import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreateInsuranceCoverDto, UpdateInsuranceCoverDto } from './dto/insurance-cover.dto';
import { InsuranceCoversService } from './insurance-covers.service';

/**
 * Insurance/billing data, not clinical data - FRONT_DESK and
 * BILLING_STAFF have full access here (unlike clinical-notes/lab-orders,
 * where they're excluded). DOCTOR/NURSE get read-only, since knowing a
 * patient's cover can matter for referral/treatment decisions, but they
 * don't manage policy records.
 */
@Controller('insurance-covers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsuranceCoversController {
  constructor(private insuranceCoversService: InsuranceCoversService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BILLING_STAFF)
  create(@Req() req: TenantRequest, @Body() dto: CreateInsuranceCoverDto) {
    const user = req.user as any;
    return this.insuranceCoversService.create(req.tenantDataSource, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BILLING_STAFF, UserRole.DOCTOR, UserRole.NURSE)
  findByPatient(@Req() req: TenantRequest, @Query('patientId') patientId: string) {
    return this.insuranceCoversService.findByPatient(req.tenantDataSource, patientId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BILLING_STAFF, UserRole.DOCTOR, UserRole.NURSE)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.insuranceCoversService.findOne(req.tenantDataSource, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BILLING_STAFF)
  update(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdateInsuranceCoverDto) {
    const user = req.user as any;
    return this.insuranceCoversService.update(req.tenantDataSource, id, dto, user.sub);
  }
}

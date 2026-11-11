import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  create(@Req() req: TenantRequest, @Body() dto: CreatePrescriptionDto) {
    const user = req.user as any;
    return this.prescriptionsService.create(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  // PHARMACIST is included here (and only here, not on clinical-notes or
  // lab-orders) because pharmacy staff need to see what to fulfill -
  // that's the one place clinical and pharmacy access legitimately overlap.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST)
  findByPatient(@Req() req: TenantRequest, @Query('patientId') patientId: string) {
    return this.prescriptionsService.findByPatient(req.tenantDataSource, patientId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.prescriptionsService.findOne(req.tenantDataSource, id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  updateStatus(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdatePrescriptionStatusDto) {
    const user = req.user as any;
    return this.prescriptionsService.updateStatus(req.tenantDataSource, id, dto, user.sub);
  }
}

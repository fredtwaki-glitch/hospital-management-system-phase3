import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR)
  create(@Req() req: TenantRequest, @Body() dto: CreatePatientDto) {
    const user = req.user as any;
    return this.patientsService.create(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR, UserRole.BILLING_STAFF)
  findAll(@Req() req: TenantRequest) {
    return this.patientsService.findAll(req.tenantDataSource);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR, UserRole.BILLING_STAFF)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    const user = req.user as any;
    return this.patientsService.findOne(req.tenantDataSource, id, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR)
  update(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    const user = req.user as any;
    return this.patientsService.update(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }
}

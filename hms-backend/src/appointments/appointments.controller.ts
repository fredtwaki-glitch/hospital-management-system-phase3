import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK)
  create(@Req() req: TenantRequest, @Body() dto: CreateAppointmentDto) {
    const user = req.user as any;
    return this.appointmentsService.create(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR)
  findAll(@Req() req: TenantRequest, @Query('patientId') patientId?: string, @Query('providerId') providerId?: string) {
    return this.appointmentsService.findAll(req.tenantDataSource, { patientId, providerId });
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.NURSE, UserRole.DOCTOR)
  updateStatus(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    const user = req.user as any;
    return this.appointmentsService.updateStatus(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }
}

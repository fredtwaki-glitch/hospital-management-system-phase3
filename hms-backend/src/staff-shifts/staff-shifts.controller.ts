import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CompleteShiftDto } from './dto/complete-shift.dto';
import { StaffShiftsService } from './staff-shifts.service';

@Controller('staff-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffShiftsController {
  constructor(private readonly shifts: StaffShiftsService) {}

  @Post('start')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  start(@Req() req: TenantRequest) {
    return this.shifts.start(req.tenantDataSource, req.user!.sub);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  complete(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: CompleteShiftDto) {
    return this.shifts.complete(req.tenantDataSource, req.tenant.id, id, req.user!.sub, req.user!.role as UserRole, dto);
  }

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  listMine(@Req() req: TenantRequest) {
    return this.shifts.listMine(req.tenantDataSource, req.user!.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  listAll(@Req() req: TenantRequest) {
    return this.shifts.listAll(req.tenantDataSource);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreateLabOrderDto, UpdateLabOrderStatusDto } from './dto/lab-order.dto';
import { LabOrdersService } from './lab-orders.service';

@Controller('lab-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LabOrdersController {
  constructor(private labOrdersService: LabOrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  create(@Req() req: TenantRequest, @Body() dto: CreateLabOrderDto) {
    const user = req.user as any;
    return this.labOrdersService.create(req.tenantDataSource, req.tenant.id, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  findByPatient(@Req() req: TenantRequest, @Query('patientId') patientId: string) {
    const user = req.user as any;
    return this.labOrdersService.findByPatient(req.tenantDataSource, patientId, user.sub);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  updateStatus(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdateLabOrderStatusDto) {
    const user = req.user as any;
    return this.labOrdersService.updateStatus(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }
}

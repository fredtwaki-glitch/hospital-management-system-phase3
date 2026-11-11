import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreatePharmacyItemDto, DispenseStockDto, ReceiveStockDto } from './dto/pharmacy-item.dto';
import { PharmacyService } from './pharmacy.service';

@Controller('pharmacy/items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyController {
  constructor(private pharmacyService: PharmacyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  create(@Req() req: TenantRequest, @Body() dto: CreatePharmacyItemDto) {
    const user = req.user as any;
    return this.pharmacyService.createItem(req.tenantDataSource, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.NURSE)
  findAll(@Req() req: TenantRequest) {
    return this.pharmacyService.findAll(req.tenantDataSource);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  findLowStock(@Req() req: TenantRequest) {
    return this.pharmacyService.findLowStock(req.tenantDataSource);
  }

  @Post(':id/receive')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  receiveStock(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: ReceiveStockDto) {
    const user = req.user as any;
    return this.pharmacyService.receiveStock(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }

  @Post(':id/dispense')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  dispenseStock(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: DispenseStockDto) {
    const user = req.user as any;
    return this.pharmacyService.dispenseStock(req.tenantDataSource, req.tenant.id, id, dto, user.sub);
  }
}

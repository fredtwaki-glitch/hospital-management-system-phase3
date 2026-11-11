import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { CreatePayerDto, UpdatePayerDto } from './dto/payer.dto';
import { PayersService } from './payers.service';

@Controller('payers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayersController {
  constructor(private payersService: PayersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  create(@Req() req: TenantRequest, @Body() dto: CreatePayerDto) {
    const user = req.user as any;
    return this.payersService.create(req.tenantDataSource, dto, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  findAll(@Req() req: TenantRequest, @Query('activeOnly') activeOnly?: string) {
    return this.payersService.findAll(req.tenantDataSource, activeOnly === 'true');
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF, UserRole.FRONT_DESK)
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.payersService.findOne(req.tenantDataSource, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
  update(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: UpdatePayerDto) {
    const user = req.user as any;
    return this.payersService.update(req.tenantDataSource, id, dto, user.sub);
  }
}

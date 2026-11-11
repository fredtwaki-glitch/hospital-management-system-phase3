import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { UpdateOrgProfileDto } from './dto/org-profile.dto';
import { OrgProfileService } from './org-profile.service';

@Controller('org-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgProfileController {
  constructor(private orgProfileService: OrgProfileService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK)
  get(@Req() req: TenantRequest) {
    return this.orgProfileService.get(req.tenantDataSource);
  }

  @Put()
  @Roles(UserRole.ADMIN)
  update(@Req() req: TenantRequest, @Body() dto: UpdateOrgProfileDto) {
    return this.orgProfileService.upsert(req.tenantDataSource, dto);
  }
}

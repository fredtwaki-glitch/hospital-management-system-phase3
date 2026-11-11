import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from './platform-jwt-auth.guard';
import { PlatformTenantsService } from './platform-tenants.service';
import {
  CreateTenantDto,
  UpdateTenantModulesDto,
  UpdateTenantProfileDto,
  UpdateTenantSlugDto,
  UpdateTenantStatusDto,
} from './dto/platform-admin.dto';

@Controller('platform/tenants')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformTenantsController {
  constructor(private platformTenantsService: PlatformTenantsService) {}

  @Get()
  findAll() {
    return this.platformTenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.platformTenantsService.findOne(id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTenantDto) {
    const admin = req.user as any;
    return this.platformTenantsService.create(dto, admin.sub);
  }

  // Renaming lives here - PATCH /platform/tenants/:id/profile { "name": "New Name" }
  @Patch(':id/profile')
  updateProfile(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTenantProfileDto) {
    const admin = req.user as any;
    return this.platformTenantsService.updateProfile(id, dto, admin.sub);
  }

  @Patch(':id/slug')
  updateSlug(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTenantSlugDto) {
    const admin = req.user as any;
    return this.platformTenantsService.updateSlug(id, dto, admin.sub);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    const admin = req.user as any;
    return this.platformTenantsService.updateStatus(id, dto, admin.sub);
  }

  @Patch(':id/modules')
  updateModules(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTenantModulesDto) {
    const admin = req.user as any;
    return this.platformTenantsService.updateModules(id, dto, admin.sub);
  }
}

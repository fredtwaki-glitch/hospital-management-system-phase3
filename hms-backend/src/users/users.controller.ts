import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from './user.entity';
import { ListUsersQueryDto } from './dto/list-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Every staff role can list the directory (e.g. front desk picking a
  // provider to schedule against, a nurse finding a doctor) - this
  // returns a minimal projection (see UsersService), not full accounts,
  // so broad read access here doesn't leak anything sensitive.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST, UserRole.BILLING_STAFF)
  findAll(@Req() req: TenantRequest, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(req.tenantDataSource, query.role);
  }
}

import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;

  // Required, not optional - every staff account needs an HR/payroll
  // join key on file from day one, not added retroactively once the
  // Payroll integration actually gets wired up in Phase 3.
  @IsString()
  staffNumber: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;
}

/**
 * Note: registration here is intentionally unguarded by JwtAuthGuard for
 * the very first admin account of a tenant (bootstrap problem). In
 * practice you'll want to lock this down further - e.g. only allow
 * self-registration via an invite token, and require ADMIN role +
 * JwtAuthGuard for every registration after the first. Flagging this as
 * a Phase 1 follow-up rather than solving it here.
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Req() req: TenantRequest, @Body() dto: LoginDto) {
    return this.authService.login(req.tenantDataSource, req.tenant, dto.email, dto.password);
  }

  @Post('register')
  async register(@Req() req: TenantRequest, @Body() dto: RegisterDto) {
    return this.authService.register(req.tenantDataSource, dto);
  }
}

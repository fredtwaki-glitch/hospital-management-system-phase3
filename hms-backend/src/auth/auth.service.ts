import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { User, UserRole } from '../users/user.entity';
import { JwtPayload } from './jwt-payload.interface';

interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    staffNumber: string;
  };
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  staffNumber: string;
  licenseNumber?: string;
  department?: string;
  hireDate?: string;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  /**
   * `tenantDataSource` is the already-resolved per-tenant connection
   * (attached by TenantResolverMiddleware upstream) - auth never
   * queries across tenants.
   */
  async login(tenantDataSource: DataSource, tenant: Tenant, email: string, password: string): Promise<LoginResult> {
    const userRepo = tenantDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role,
      email: user.email,
      staffNumber: user.staffNumber,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        staffNumber: user.staffNumber,
      },
    };
  }

  async register(tenantDataSource: DataSource, data: RegisterData): Promise<{ id: string; email: string; staffNumber: string }> {
    const userRepo = tenantDataSource.getRepository(User);

    const existingEmail = await userRepo.findOne({ where: { email: data.email } });
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists in this organization');
    }

    const existingStaffNumber = await userRepo.findOne({ where: { staffNumber: data.staffNumber } });
    if (existingStaffNumber) {
      throw new ConflictException('A user with this staff number already exists in this organization');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = userRepo.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      staffNumber: data.staffNumber,
      licenseNumber: data.licenseNumber,
      department: data.department,
      hireDate: data.hireDate,
      isActive: true,
    });

    const saved = await userRepo.save(user);
    return { id: saved.id, email: saved.email, staffNumber: saved.staffNumber };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { PlatformAdmin } from './platform-admin.entity';
import { PlatformJwtPayload } from './platform-jwt-payload.interface';
import { PlatformLoginDto } from './dto/platform-admin.dto';

/**
 * No register() method, deliberately. Unlike staff (bootstrapped via an
 * open /auth/register on first tenant setup), platform admin accounts
 * are high-privilege by nature (cross-tenant access) and are created
 * only via the seed:platform-admin CLI script, run by whoever controls
 * the deployment - never through a public/API-reachable endpoint.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformAdmin, 'control')
    private adminRepo: Repository<PlatformAdmin>,
    private jwtService: JwtService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<{ accessToken: string; admin: { id: string; email: string; name: string } }> {
    const admin = await this.adminRepo.findOne({ where: { email: dto.email } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: PlatformJwtPayload = {
      sub: admin.id,
      scope: 'platform_admin',
      email: admin.email,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }
}

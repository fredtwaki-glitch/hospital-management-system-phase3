import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAdmin } from './platform-admin.entity';
import { PlatformAuditLog } from './platform-audit-log.entity';
import { Tenant } from '../tenant/tenant.entity';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtStrategy } from './platform-jwt.strategy';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [
    // 'control' connection - same named connection as TenantModule uses
    // for the Tenant entity; PlatformAdmin/PlatformAuditLog are new
    // control-plane-only tables alongside it.
    TypeOrmModule.forFeature([PlatformAdmin, PlatformAuditLog, Tenant], 'control'),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('PLATFORM_JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [PlatformAuthController, PlatformTenantsController, PlatformAuditController],
  providers: [PlatformAuthService, PlatformJwtStrategy, PlatformTenantsService, PlatformAuditService],
})
export class PlatformAdminModule {}

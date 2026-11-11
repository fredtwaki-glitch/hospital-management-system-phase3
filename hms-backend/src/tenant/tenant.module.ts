import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantConnectionManager } from '../database/tenant-connection.manager';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant], 'control')],
  providers: [TenantConnectionManager],
  exports: [TypeOrmModule, TenantConnectionManager],
})
export class TenantModule {}

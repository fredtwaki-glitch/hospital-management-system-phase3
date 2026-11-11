import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { CommunicationsModule } from '../communications/communications.module';
import { SupplierCommsController } from './supplier-comms.controller';
import { SupplierCommsService } from './supplier-comms.service';

@Module({
  imports: [TenantModule, CommunicationsModule],
  controllers: [SupplierCommsController],
  providers: [SupplierCommsService],
})
export class SupplierCommsModule {}

import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { BillingModule } from '../billing/billing.module';
import { MpesaClientService } from './mpesa-client.service';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { MpesaCallbackController } from './mpesa-callback.controller';

@Module({
  imports: [TenantModule, BillingModule],
  controllers: [MpesaController, MpesaCallbackController],
  providers: [MpesaClientService, MpesaService],
})
export class MpesaModule {}

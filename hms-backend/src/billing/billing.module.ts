import { Module } from '@nestjs/common';
import { InsuranceCoversModule } from '../insurance-covers/insurance-covers.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [InsuranceCoversModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

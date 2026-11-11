import { Module } from '@nestjs/common';
import { InsuranceCoversController } from './insurance-covers.controller';
import { InsuranceCoversService } from './insurance-covers.service';

@Module({
  controllers: [InsuranceCoversController],
  providers: [InsuranceCoversService],
  exports: [InsuranceCoversService],
})
export class InsuranceCoversModule {}

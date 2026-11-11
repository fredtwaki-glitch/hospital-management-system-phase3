import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { EventDispatcherService } from './event-dispatcher.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TenantModule],
  controllers: [EventsController],
  providers: [EventDispatcherService],
  exports: [EventDispatcherService],
})
export class EventsModule {}

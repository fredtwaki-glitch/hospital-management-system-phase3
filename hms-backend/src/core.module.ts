import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { DomainEventBus } from './events/event-bus.service';

@Global()
@Module({
  providers: [AuditService, DomainEventBus],
  exports: [AuditService, DomainEventBus],
})
export class CoreModule {}

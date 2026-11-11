import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { EventOutbox, OutboxStatus } from './event-outbox.entity';
import { HmsEventEnvelope } from './event-envelope';
import { HmsEventName, HmsEventPayload } from './event-contracts';

type EventHandler = (payload: any) => void | Promise<void>;

/**
 * Durable event publisher. Pass an EntityManager from the business
 * transaction when atomic persistence of the business change + event is
 * required. DataSource is accepted for legacy publishers during migration.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, EventHandler[]>();

  async publish<T extends HmsEventName>(
    connection: DataSource | EntityManager,
    tenantId: string,
    eventType: T,
    payload: HmsEventPayload<T>,
  ): Promise<string>;
  async publish(
    connection: DataSource | EntityManager,
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const repo = connection.getRepository(EventOutbox);
    const event = repo.create({
      eventId: randomUUID(), tenantId, eventType, eventVersion: 1,
      payload: payload as Record<string, unknown>, status: OutboxStatus.PENDING, attemptCount: 0,
      availableAt: new Date(), lockedAt: null, deliveredAt: null, lastError: null,
    });
    await repo.save(event);
    this.logger.log(`Queued ${eventType} (${event.eventId}) for tenant ${tenantId}`);
    return event.eventId;
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  async dispatchLocal(envelope: HmsEventEnvelope): Promise<void> {
    const handlers = this.handlers.get(envelope.type) ?? [];
    for (const handler of handlers) {
      await handler({ tenantId: envelope.tenantId, ...envelope.data, eventId: envelope.eventId });
    }
  }
}

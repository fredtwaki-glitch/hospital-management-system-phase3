import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../tenant/tenant.entity';
import { TenantConnectionManager } from '../database/tenant-connection.manager';
import { DomainEventBus } from './event-bus.service';
import { EventOutbox, OutboxStatus } from './event-outbox.entity';
import { HmsEventEnvelope } from './event-envelope';

@Injectable()
export class EventDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventDispatcherService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @InjectRepository(Tenant, 'control') private readonly tenants: Repository<Tenant>,
    private readonly connections: TenantConnectionManager,
    private readonly eventBus: DomainEventBus,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = Math.max(1000, Number(this.config.get('EVENT_DISPATCH_INTERVAL_MS') || 5000));
    this.timer = setInterval(() => void this.dispatchAll(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async dispatchAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.tenants.find({ where: { status: TenantStatus.ACTIVE } });
      for (const tenant of tenants) {
        try {
          await this.dispatchTenant(tenant.id, tenant.schemaName, tenant.licensedModules ?? []);
        } catch (error) {
          this.logger.error(`Outbox dispatch failed for tenant ${tenant.slug}: ${this.errorMessage(error)}`);
        }
      }
    } catch (error) {
      this.logger.error(`Unable to enumerate tenants for event dispatch: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatchTenant(tenantId: string, schemaName: string, licensedModules: string[]): Promise<void> {
    const ds = await this.connections.getConnection(schemaName);
    const repo = ds.getRepository(EventOutbox);
    const events = await ds.transaction(async (manager) => {
      const rows = await manager.getRepository(EventOutbox)
        .createQueryBuilder('event')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('(event.status IN (:...ready) AND event.availableAt <= :now)', {
          ready: [OutboxStatus.PENDING, OutboxStatus.RETRY], now: new Date(),
        })
        .orWhere('(event.status = :processing AND event.lockedAt < :stale)', {
          processing: OutboxStatus.PROCESSING, stale: new Date(Date.now() - 5 * 60_000),
        })
        .orderBy('event.createdAt', 'ASC')
        .take(25)
        .getMany();
      for (const row of rows) {
        row.status = OutboxStatus.PROCESSING;
        row.lockedAt = new Date();
        row.attemptCount += 1;
      }
      if (rows.length) await manager.getRepository(EventOutbox).save(rows);
      return rows;
    });

    for (const event of events) {
      const envelope: HmsEventEnvelope = {
        eventId: event.eventId,
        tenantId: event.tenantId,
        type: event.eventType,
        version: event.eventVersion,
        occurredAt: event.createdAt.toISOString(),
        data: event.payload,
      };
      try {
        if (licensedModules.includes('payroll')) await this.deliverWebhook(envelope, 'payroll');
        if (licensedModules.includes('automation')) await this.deliverWebhook(envelope, 'automation');
        await this.eventBus.dispatchLocal(envelope);
        await repo.update(event.eventId, {
          status: OutboxStatus.DELIVERED, deliveredAt: new Date(), lockedAt: null, lastError: null,
        });
      } catch (error) {
        const attempts = event.attemptCount;
        const exhausted = attempts >= 10;
        const delayMs = Math.min(60 * 60_000, 1000 * 2 ** Math.min(attempts, 12));
        await repo.update(event.eventId, {
          attemptCount: attempts,
          status: exhausted ? OutboxStatus.FAILED : OutboxStatus.RETRY,
          availableAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lastError: this.errorMessage(error).slice(0, 4000),
        });
        this.logger.error(`Event ${event.eventId} delivery ${exhausted ? 'exhausted' : 'scheduled for retry'}: ${this.errorMessage(error)}`);
      }
    }
  }

  private async deliverWebhook(envelope: HmsEventEnvelope, target: 'payroll' | 'automation'): Promise<void> {
    if (target === 'payroll' && envelope.type !== 'staff.shift.completed') return;
    const url = this.config.get<string>(target === 'payroll' ? 'PAYROLL_WEBHOOK_URL' : 'AUTOMATION_WEBHOOK_URL');
    if (!url) throw new Error(`${target.toUpperCase()}_WEBHOOK_URL is required for a licensed tenant event`);
    const parsedUrl = new URL(url);
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error(`${target.toUpperCase()}_WEBHOOK_URL must use HTTP or HTTPS`);
    if (this.config.get('NODE_ENV') === 'production' && parsedUrl.protocol !== 'https:') {
      throw new Error(`${target.toUpperCase()}_WEBHOOK_URL must use HTTPS in production`);
    }
    const secret = this.config.get<string>(target === 'payroll' ? 'PAYROLL_WEBHOOK_SECRET' : 'AUTOMATION_WEBHOOK_SECRET');
    if (!secret || secret.length < 32) throw new Error(`${target.toUpperCase()}_WEBHOOK_SECRET must contain at least 32 characters`);

    const body = JSON.stringify(envelope);
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-hms-event-id': envelope.eventId,
        'x-hms-event-type': envelope.type,
        'x-hms-signature': `sha256=${signature}`,
        'idempotency-key': envelope.eventId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`${target} webhook returned HTTP ${response.status}`);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

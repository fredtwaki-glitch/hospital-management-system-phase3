import { ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { EventOutbox, OutboxStatus } from './event-outbox.entity';

@Controller('integrations/events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly audit: AuditService) {}

  /**
   * Delivery health for this tenant. Deliberately returns NO event payloads
   * (they can contain staff/patient identifiers) - only metadata an operator
   * needs to triage: what failed, when, how many attempts, and why.
   */
  @Get('status')
  @Roles(UserRole.ADMIN)
  async status(@Req() req: TenantRequest) {
    const repository = req.tenantDataSource.getRepository(EventOutbox);

    const grouped = await repository
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.status')
      .getRawMany<{ status: OutboxStatus; count: string }>();

    const counts = Object.values(OutboxStatus).reduce<Record<string, number>>((result, status) => {
      result[status] = Number(grouped.find((row) => row.status === status)?.count ?? 0);
      return result;
    }, {});

    const recentFailures = await repository.find({
      select: {
        eventId: true,
        eventType: true,
        eventVersion: true,
        status: true,
        attemptCount: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { status: OutboxStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: 20,
    });

    return { counts, recentFailures };
  }

  /**
   * Operator replay for an event that exhausted its retries (status
   * `failed`). Resets it to `pending` so the dispatcher picks it up on its
   * next poll. Delivery is at-least-once and consumers dedupe by eventId, so
   * replaying an event whose first delivery actually landed is safe.
   */
  @Post(':eventId/replay')
  @Roles(UserRole.ADMIN)
  async replay(@Req() req: TenantRequest, @Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return req.tenantDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EventOutbox);
      const event = await repository.findOne({ where: { eventId }, lock: { mode: 'pessimistic_write' } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== OutboxStatus.FAILED) {
        throw new ConflictException(`Only failed events can be replayed (this event is ${event.status})`);
      }
      await repository.update(eventId, {
        status: OutboxStatus.PENDING,
        attemptCount: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      });
      await this.audit.record(manager, {
        userId: req.user!.sub,
        action: 'integration.event.replayed',
        resourceType: 'EventOutbox',
        resourceId: eventId,
        metadata: { eventType: event.eventType },
      });
      return { eventId, status: OutboxStatus.PENDING };
    });
  }
}

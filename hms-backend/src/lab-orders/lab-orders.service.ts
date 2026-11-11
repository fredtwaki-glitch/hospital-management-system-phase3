import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { CreateLabOrderDto, UpdateLabOrderStatusDto } from './dto/lab-order.dto';
import { LabOrder, LabOrderStatus } from './lab-order.entity';

@Injectable()
export class LabOrdersService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async create(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreateLabOrderDto,
    orderedByUserId: string,
  ): Promise<LabOrder> {
    const repo = tenantDataSource.getRepository(LabOrder);
    const order = await repo.save(repo.create({ ...dto, orderedByUserId }));

    await this.auditService.record(tenantDataSource, {
      userId: orderedByUserId,
      action: 'lab_order.created',
      resourceType: 'LabOrder',
      resourceId: order.id,
      metadata: { patientId: order.patientId, testName: order.testName },
    });

    // Automation Suite hook: route to the lab queue / external lab system.
    await this.eventBus.publish(tenantDataSource, tenantId, 'lab_order.created', {
      orderId: order.id,
      patientId: order.patientId,
      testName: order.testName,
      priority: order.priority,
    });

    return order;
  }

  async findByPatient(tenantDataSource: DataSource, patientId: string, actingUserId: string): Promise<LabOrder[]> {
    const orders = await tenantDataSource
      .getRepository(LabOrder)
      .find({ where: { patientId }, order: { createdAt: 'DESC' } });

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'lab_order.list_viewed',
      resourceType: 'Patient',
      resourceId: patientId,
      metadata: { count: orders.length },
    });

    return orders;
  }

  async updateStatus(
    tenantDataSource: DataSource,
    tenantId: string,
    id: string,
    dto: UpdateLabOrderStatusDto,
    actingUserId: string,
  ): Promise<LabOrder> {
    const repo = tenantDataSource.getRepository(LabOrder);
    const order = await repo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Lab order not found');
    }

    order.status = dto.status;
    if (dto.resultSummary) order.resultSummary = dto.resultSummary;
    if (dto.resultAttachmentUrl) order.resultAttachmentUrl = dto.resultAttachmentUrl;
    if (dto.status === LabOrderStatus.COMPLETED) order.completedAt = new Date();

    const saved = await repo.save(order);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'lab_order.status_changed',
      resourceType: 'LabOrder',
      resourceId: order.id,
      metadata: { newStatus: dto.status },
    });

    if (dto.status === LabOrderStatus.COMPLETED) {
      // The exact event named in the architecture doc's event table -
      // Automation Suite routes it, and Phase 4's chatbot can eventually
      // notify the patient "your results are ready."
      await this.eventBus.publish(tenantDataSource, tenantId, 'lab_order.result_ready', {
        orderId: order.id,
        patientId: order.patientId,
        testName: order.testName,
      });
    }

    return saved;
  }
}

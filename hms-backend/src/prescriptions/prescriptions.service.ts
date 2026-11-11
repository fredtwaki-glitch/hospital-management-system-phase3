import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/prescription.dto';
import { Prescription } from './prescription.entity';

@Injectable()
export class PrescriptionsService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async create(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreatePrescriptionDto,
    prescribedByUserId: string,
  ): Promise<Prescription> {
    const repo = tenantDataSource.getRepository(Prescription);
    const prescription = await repo.save(repo.create({ ...dto, prescribedByUserId }));

    await this.auditService.record(tenantDataSource, {
      userId: prescribedByUserId,
      action: 'prescription.created',
      resourceType: 'Prescription',
      resourceId: prescription.id,
      metadata: { patientId: prescription.patientId, medicationName: prescription.medicationName },
    });

    // Pharmacy queue (Automation Suite) and, later, the chatbot's
    // "your prescription is being prepared" notification both hook here.
    await this.eventBus.publish(tenantDataSource, tenantId, 'prescription.created', {
      prescriptionId: prescription.id,
      patientId: prescription.patientId,
      medicationName: prescription.medicationName,
    });

    return prescription;
  }

  async findByPatient(tenantDataSource: DataSource, patientId: string): Promise<Prescription[]> {
    return tenantDataSource.getRepository(Prescription).find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantDataSource: DataSource, id: string): Promise<Prescription> {
    const prescription = await tenantDataSource.getRepository(Prescription).findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    return prescription;
  }

  async updateStatus(
    tenantDataSource: DataSource,
    id: string,
    dto: UpdatePrescriptionStatusDto,
    actingUserId: string,
  ): Promise<Prescription> {
    const repo = tenantDataSource.getRepository(Prescription);
    const prescription = await repo.findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    prescription.status = dto.status;
    const saved = await repo.save(prescription);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'prescription.status_changed',
      resourceType: 'Prescription',
      resourceId: prescription.id,
      metadata: { newStatus: dto.status },
    });

    return saved;
  }
}

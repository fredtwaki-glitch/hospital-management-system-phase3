import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateInsuranceCoverDto, UpdateInsuranceCoverDto } from './dto/insurance-cover.dto';
import { CoverStatus, PatientInsuranceCover } from './patient-insurance-cover.entity';

@Injectable()
export class InsuranceCoversService {
  constructor(private auditService: AuditService) {}

  async create(tenantDataSource: DataSource, dto: CreateInsuranceCoverDto, actingUserId: string): Promise<PatientInsuranceCover> {
    const repo = tenantDataSource.getRepository(PatientInsuranceCover);

    // Guard against ambiguity: two ACTIVE covers at the same priority
    // for the same patient means billing wouldn't know which one to
    // bill first. Rather than silently demoting the existing one,
    // surface this to staff to resolve deliberately.
    const conflicting = await repo.findOne({
      where: { patientId: dto.patientId, priority: dto.priority, status: CoverStatus.ACTIVE },
    });
    if (conflicting) {
      throw new ConflictException(
        `Patient already has an active ${dto.priority} cover (id: ${conflicting.id}). Update or deactivate it first.`,
      );
    }

    const cover = await repo.save(repo.create(dto));

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'insurance_cover.created',
      resourceType: 'PatientInsuranceCover',
      resourceId: cover.id,
      metadata: { patientId: cover.patientId, coverCategory: cover.coverCategory, priority: cover.priority },
    });

    return cover;
  }

  async findByPatient(tenantDataSource: DataSource, patientId: string): Promise<PatientInsuranceCover[]> {
    return tenantDataSource
      .getRepository(PatientInsuranceCover)
      .find({ where: { patientId }, order: { priority: 'ASC', createdAt: 'DESC' } });
  }

  async findOne(tenantDataSource: DataSource, id: string): Promise<PatientInsuranceCover> {
    const cover = await tenantDataSource.getRepository(PatientInsuranceCover).findOne({ where: { id } });
    if (!cover) {
      throw new NotFoundException('Insurance cover not found');
    }
    return cover;
  }

  async update(
    tenantDataSource: DataSource,
    id: string,
    dto: UpdateInsuranceCoverDto,
    actingUserId: string,
  ): Promise<PatientInsuranceCover> {
    const repo = tenantDataSource.getRepository(PatientInsuranceCover);
    const cover = await this.findOne(tenantDataSource, id);

    if (dto.priority && dto.priority !== cover.priority) {
      const conflicting = await repo.findOne({
        where: { patientId: cover.patientId, priority: dto.priority, status: CoverStatus.ACTIVE },
      });
      if (conflicting && conflicting.id !== id) {
        throw new ConflictException(`Patient already has an active ${dto.priority} cover (id: ${conflicting.id})`);
      }
    }

    Object.assign(cover, dto);
    const saved = await repo.save(cover);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'insurance_cover.updated',
      resourceType: 'PatientInsuranceCover',
      resourceId: cover.id,
      metadata: { fields: Object.keys(dto) },
    });

    return saved;
  }

  /** Used by BillingService when creating an invoice against a specific cover. */
  async findActiveForBilling(tenantDataSource: DataSource, id: string): Promise<PatientInsuranceCover> {
    const cover = await this.findOne(tenantDataSource, id);
    if (cover.status !== CoverStatus.ACTIVE) {
      throw new ConflictException(`Insurance cover ${id} is not active (status: ${cover.status})`);
    }
    return cover;
  }
}

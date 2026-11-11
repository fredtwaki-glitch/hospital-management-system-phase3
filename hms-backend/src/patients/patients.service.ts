import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { isMinor } from './patient-age.util';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async create(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreatePatientDto,
    actingUserId: string,
  ): Promise<Patient> {
    this.assertGuardianRequirements(dto);

    const repo = tenantDataSource.getRepository(Patient);

    // Idempotent replay check: if the offline queue is retrying a write
    // whose first attempt actually succeeded server-side (but the
    // client never got the response - e.g. connection dropped mid-sync),
    // return the existing record instead of creating a duplicate
    // patient. Skips the audit/event publish below too, deliberately -
    // nothing new happened, so nothing new should be logged or emitted.
    if (dto.clientRequestId) {
      const existing = await repo.findOne({ where: { clientRequestId: dto.clientRequestId } });
      if (existing) {
        return existing;
      }
    }

    const patient = await repo.save(repo.create(dto)).catch((err) => {
      // Distinct from the idempotent-replay path above: this is TWO
      // DIFFERENT offline writes (different clientRequestId, or one
      // online + one offline) landing on the same MRN - the genuine
      // conflict scenario the offline-support scoping doc called out
      // ("two front-desk devices registering against the same MRN
      // while both offline"). Surfaced as a clear 409 so the offline
      // queue can flag it for a human to resolve, rather than silently
      // losing the second registration or crashing with a raw DB error.
      if (err.code === '23505' && err.detail?.includes('mrn')) {
        throw new ConflictException(
          `A patient with MRN "${dto.mrn}" already exists. This usually means two devices registered the same MRN while offline - check with the other device before retrying.`,
        );
      }
      throw err;
    });

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'patient.record.created',
      resourceType: 'Patient',
      resourceId: patient.id,
    });

    await this.eventBus.publish(tenantDataSource, tenantId, 'patient.registered', {
      patientId: patient.id,
      mrn: patient.mrn,
      isMinor: isMinor(patient.dateOfBirth),
    });

    return patient;
  }

  async findAll(tenantDataSource: DataSource): Promise<Patient[]> {
    return tenantDataSource.getRepository(Patient).find({ order: { lastName: 'ASC' } });
  }

  async findOne(tenantDataSource: DataSource, id: string, actingUserId: string): Promise<Patient> {
    const patient = await tenantDataSource.getRepository(Patient).findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Every individual patient-record view is audited - this is the
    // access log a hospital's compliance officer will ask for.
    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'patient.record.viewed',
      resourceType: 'Patient',
      resourceId: patient.id,
    });

    return patient;
  }

  async update(
    tenantDataSource: DataSource,
    tenantId: string,
    id: string,
    dto: UpdatePatientDto,
    actingUserId: string,
  ): Promise<Patient> {
    const repo = tenantDataSource.getRepository(Patient);
    const patient = await repo.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const merged = { ...patient, ...dto };
    this.assertGuardianRequirements(merged);

    Object.assign(patient, dto);
    const saved = await repo.save(patient);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'patient.record.updated',
      resourceType: 'Patient',
      resourceId: patient.id,
      metadata: { fields: Object.keys(dto) },
    });

    if (dto.isDeceased) {
      await this.eventBus.publish(tenantDataSource, tenantId, 'patient.deceased', { patientId: patient.id });
    }

    return saved;
  }

  /**
   * A minor can't legally consent to their own treatment or manage their
   * own portal access - a guardian on file is a hard requirement, not a
   * nice-to-have. Enforced here (cross-field, depends on dateOfBirth)
   * rather than as a DTO decorator.
   */
  private assertGuardianRequirements(data: { dateOfBirth?: string; guardianFullName?: string; guardianPhone?: string }): void {
    if (!data.dateOfBirth || !isMinor(data.dateOfBirth)) {
      return;
    }
    if (!data.guardianFullName || !data.guardianPhone) {
      throw new BadRequestException(
        'This patient is a minor (under 18) - guardianFullName and guardianPhone are required for minor patients.',
      );
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async create(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreateAppointmentDto,
    actingUserId: string,
  ): Promise<Appointment> {
    const repo = tenantDataSource.getRepository(Appointment);

    // Same idempotent-replay pattern as PatientsService.create - see
    // that method's comment for the full reasoning. Appointments have
    // no natural unique key the way patients have MRN, so there's no
    // equivalent "genuine conflict" case to handle here beyond this.
    if (dto.clientRequestId) {
      const existing = await repo.findOne({ where: { clientRequestId: dto.clientRequestId } });
      if (existing) {
        return existing;
      }
    }

    const appointment = await repo.save(
      repo.create({ ...dto, scheduledAt: new Date(dto.scheduledAt) }),
    );

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'appointment.created',
      resourceType: 'Appointment',
      resourceId: appointment.id,
    });

    // Automation Suite can subscribe to this to send reminders, or
    // trigger prep workflows (e.g. pull chart ahead of visit).
    await this.eventBus.publish(tenantDataSource, tenantId, 'appointment.scheduled', {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      scheduledAt: appointment.scheduledAt,
    });

    return appointment;
  }

  async findAll(tenantDataSource: DataSource, filters: { patientId?: string; providerId?: string }): Promise<Appointment[]> {
    return tenantDataSource.getRepository(Appointment).find({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.providerId ? { providerId: filters.providerId } : {}),
      },
      order: { scheduledAt: 'ASC' },
    });
  }

  async updateStatus(
    tenantDataSource: DataSource,
    tenantId: string,
    id: string,
    dto: UpdateAppointmentStatusDto,
    actingUserId: string,
  ): Promise<Appointment> {
    const repo = tenantDataSource.getRepository(Appointment);
    const appointment = await repo.findOne({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const previousStatus = appointment.status;
    appointment.status = dto.status;
    if (dto.notes) appointment.notes = dto.notes;
    const saved = await repo.save(appointment);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'appointment.status_changed',
      resourceType: 'Appointment',
      resourceId: appointment.id,
      metadata: { from: previousStatus, to: dto.status },
    });

    // "patient.admitted"-style events: this is the trigger point the
    // architecture doc calls out for Automation Suite workflows (e.g.
    // bed allocation) and, later, the chatbot (e.g. "you're checked in").
    if (dto.status === AppointmentStatus.CHECKED_IN) {
      await this.eventBus.publish(tenantDataSource, tenantId, 'patient.checked_in', {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
      });
    }

    if (dto.status === AppointmentStatus.COMPLETED) {
      await this.eventBus.publish(tenantDataSource, tenantId, 'appointment.completed', {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
      });
    }

    return saved;
  }
}

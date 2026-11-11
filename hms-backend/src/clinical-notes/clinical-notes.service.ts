import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { ClinicalNote } from './clinical-note.entity';
import { CreateClinicalNoteDto } from './dto/clinical-note.dto';

@Injectable()
export class ClinicalNotesService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async create(
    tenantDataSource: DataSource,
    tenantId: string,
    dto: CreateClinicalNoteDto,
    authorId: string,
  ): Promise<ClinicalNote> {
    const repo = tenantDataSource.getRepository(ClinicalNote);
    const note = await repo.save(repo.create({ ...dto, authorId }));

    await this.auditService.record(tenantDataSource, {
      userId: authorId,
      action: 'clinical_note.created',
      resourceType: 'ClinicalNote',
      resourceId: note.id,
      metadata: { patientId: note.patientId, noteType: note.noteType },
    });

    await this.eventBus.publish(tenantDataSource, tenantId, 'clinical_note.created', {
      noteId: note.id,
      patientId: note.patientId,
      noteType: note.noteType,
    });

    return note;
  }

  async findByPatient(tenantDataSource: DataSource, patientId: string, actingUserId: string): Promise<ClinicalNote[]> {
    const notes = await tenantDataSource
      .getRepository(ClinicalNote)
      .find({ where: { patientId }, order: { createdAt: 'DESC' } });

    // Reading a patient's clinical history is exactly the kind of access
    // a compliance audit will want a record of, same as viewing the
    // patient record itself.
    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'clinical_note.list_viewed',
      resourceType: 'Patient',
      resourceId: patientId,
      metadata: { count: notes.length },
    });

    return notes;
  }

  async findOne(tenantDataSource: DataSource, id: string, actingUserId: string): Promise<ClinicalNote> {
    const note = await tenantDataSource.getRepository(ClinicalNote).findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException('Clinical note not found');
    }

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'clinical_note.viewed',
      resourceType: 'ClinicalNote',
      resourceId: note.id,
    });

    return note;
  }
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ClinicalNoteType {
  PROGRESS = 'progress',
  CONSULTATION = 'consultation',
  DISCHARGE = 'discharge',
  NURSING = 'nursing',
}

/**
 * Deliberately its own table/resource, not a field on Patient. That
 * means access control is enforced at the endpoint level (see
 * ClinicalNotesController) rather than relying on field-level
 * filtering of a shared Patient response - simpler to reason about
 * and impossible to accidentally leak via a generic "get patient" call.
 */
@Entity('clinical_notes')
export class ClinicalNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  authorId: string; // users.id - the doctor/nurse who wrote it

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ type: 'enum', enum: ClinicalNoteType })
  noteType: ClinicalNoteType;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

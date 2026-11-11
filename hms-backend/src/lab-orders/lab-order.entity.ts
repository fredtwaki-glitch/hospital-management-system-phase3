import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum LabOrderPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
}

export enum LabOrderStatus {
  ORDERED = 'ordered',
  SPECIMEN_COLLECTED = 'specimen_collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Clinical resource, same access rules as ClinicalNote - results can be
 * as sensitive as a diagnosis. Kept separate from ClinicalNote rather
 * than folded in, since lab orders have their own status lifecycle
 * that Automation Suite / a future lab-integration will hook into.
 */
@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  orderedByUserId: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column()
  testName: string; // e.g. "Full Blood Count", "Malaria RDT"

  @Column({ type: 'enum', enum: LabOrderPriority, default: LabOrderPriority.ROUTINE })
  priority: LabOrderPriority;

  @Column({ type: 'enum', enum: LabOrderStatus, default: LabOrderStatus.ORDERED })
  status: LabOrderStatus;

  @Column({ type: 'text', nullable: true })
  resultSummary: string;

  @Column({ nullable: true })
  resultAttachmentUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

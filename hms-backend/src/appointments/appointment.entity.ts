import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CHECKED_IN = 'checked_in',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  // References users.id (a doctor/nurse). Not a formal FK across
  // modules to keep this entity simple to move if appointments ever
  // become their own service - enforced at the application layer instead.
  @Column()
  providerId: string;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ default: 30 })
  durationMinutes: number;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  // Idempotency key for offline sync replay - see Patient entity /
  // migration 1700000000009 for the full reasoning.
  @Column({ nullable: true })
  clientRequestId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

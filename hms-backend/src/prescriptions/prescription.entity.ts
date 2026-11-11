import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * A prescription is the doctor's ORDER. Pharmacy dispensing (see
 * pharmacy/pharmacy-item.entity.ts StockMovement) is the FULFILLMENT of
 * that order and references it via prescriptionId. Keeping these
 * separate mirrors how the two roles actually work: a doctor writes the
 * order without touching inventory, a pharmacist fulfills it without
 * being able to originate one.
 */
@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  prescribedByUserId: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column()
  medicationName: string;

  @Column()
  dosage: string; // e.g. "500mg"

  @Column()
  frequency: string; // e.g. "twice daily"

  @Column({ nullable: true })
  durationDays: number;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.ACTIVE })
  status: PrescriptionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

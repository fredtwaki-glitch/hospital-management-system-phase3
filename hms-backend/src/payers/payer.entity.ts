import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PayerType {
  NATIONAL_SCHEME = 'national_scheme', // e.g. SHA (Kenya) - a state-run scheme, not a company
  PRIVATE_INSURER = 'private_insurer', // e.g. Jubilee, AAR, Britam, CIC - underwrites both personal and corporate policies
}

/**
 * A Payer is the entity that ultimately pays a claim - not the same
 * thing as the patient's specific policy (see PatientInsuranceCover,
 * which references this). One Payer (e.g. "Jubilee Insurance") can
 * underwrite many patients' covers, some personal, some corporate.
 *
 * This replaces relying on OrgProfile's free-text acceptedInsuranceProviders
 * list as the source of truth - that field still exists for quick
 * public-facing notes, but billing and the public AI's insurance
 * answers should be grounded in this structured table instead.
 */
@Entity('payers')
export class Payer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: PayerType })
  payerType: PayerType;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ type: 'text', nullable: true })
  claimsSubmissionNotes: string; // e.g. portal URL, required documents, turnaround time

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

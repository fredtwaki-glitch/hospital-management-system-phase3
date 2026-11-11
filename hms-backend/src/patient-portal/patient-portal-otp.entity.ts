import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * MVP-level patient identity verification: a 6-digit code hashed and
 * stored, "delivered" via whatever channel is wired up (stubbed as a
 * log line here - see PatientAuthService). Before production use, wire
 * actual delivery (SMS/email provider) and consider whether a
 * regulated healthcare context needs a stronger identity check than a
 * one-time code (e.g. verifying against an existing patient portal
 * registration flow with ID verification).
 */
@Entity('patient_portal_otps')
export class PatientPortalOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

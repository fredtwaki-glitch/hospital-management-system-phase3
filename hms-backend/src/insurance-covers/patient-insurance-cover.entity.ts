import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CoverCategory {
  PERSONAL = 'personal', // patient bought/holds the policy themselves
  CORPORATE = 'corporate', // an employer/organization is the policyholder; patient is a beneficiary
  NATIONAL = 'national', // a state-run scheme (e.g. SHA) - not personal or corporate in the usual sense
}

export enum RelationshipToPolicyholder {
  SELF = 'self',
  SPOUSE = 'spouse',
  CHILD = 'child',
  OTHER_DEPENDENT = 'other_dependent',
}

export enum CoverPriority {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

export enum CoverStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

/**
 * One row per policy/membership a patient holds - a patient can have
 * MULTIPLE rows (e.g. a national scheme as PRIMARY plus a
 * corporate/personal top-up as SECONDARY), which is how coordination
 * of benefits actually works: the primary payer is billed first, and
 * whatever it doesn't cover falls to the secondary, with anything left
 * over becoming the patient's own responsibility (see Invoice).
 */
@Entity('patient_insurance_covers')
export class PatientInsuranceCover {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  payerId: string;

  @Column({ type: 'enum', enum: CoverCategory })
  coverCategory: CoverCategory;

  // Only meaningful when coverCategory = CORPORATE - the employer/
  // organization that holds the policy on the patient's behalf. Left
  // null for PERSONAL and NATIONAL covers, where there's no separate
  // organizational policyholder to name.
  @Column({ nullable: true })
  organizationName: string;

  @Column()
  memberNumber: string; // policy/member/beneficiary number as printed on the card

  @Column({ type: 'enum', enum: RelationshipToPolicyholder, default: RelationshipToPolicyholder.SELF })
  relationshipToPolicyholder: RelationshipToPolicyholder;

  @Column({ type: 'enum', enum: CoverPriority })
  priority: CoverPriority;

  @Column({ type: 'enum', enum: CoverStatus, default: CoverStatus.ACTIVE })
  status: CoverStatus;

  @Column({ type: 'date', nullable: true })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

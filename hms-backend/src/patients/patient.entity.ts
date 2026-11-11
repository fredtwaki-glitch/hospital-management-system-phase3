import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  UNSPECIFIED = 'unspecified',
}

export enum CitizenshipStatus {
  CITIZEN = 'citizen',
  NON_CITIZEN = 'non_citizen',
}

/**
 * Deliberately covers the ID documents actually in use across a
 * citizen/non-citizen/minor population - a national ID doesn't apply
 * to most children, and a passport/alien ID doesn't apply to a citizen.
 * NONE is valid and common (young children often have no ID document
 * of their own yet, only a guardian's).
 */
export enum IdentificationType {
  NATIONAL_ID = 'national_id',
  PASSPORT = 'passport',
  BIRTH_CERTIFICATE = 'birth_certificate',
  ALIEN_ID = 'alien_id', // resident non-citizens (e.g. work/residency permit holders)
  REFUGEE_ID = 'refugee_id',
  NONE = 'none',
}

export enum GuardianRelationship {
  PARENT = 'parent',
  LEGAL_GUARDIAN = 'legal_guardian',
  OTHER = 'other',
}

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-readable medical record number, unique within the tenant.
  // Front desk/clinical staff reference this, not the UUID.
  @Column({ unique: true })
  mrn: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'date' })
  dateOfBirth: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNSPECIFIED })
  gender: Gender;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  // --- Citizenship / identification ---
  @Column({ type: 'enum', enum: CitizenshipStatus, nullable: true })
  citizenshipStatus: CitizenshipStatus;

  @Column({ nullable: true })
  nationality: string; // e.g. "Kenyan", "Ugandan" - kept free-text rather than a fixed country enum

  @Column({ type: 'enum', enum: IdentificationType, default: IdentificationType.NONE })
  idType: IdentificationType;

  @Column({ nullable: true })
  idNumber: string;

  // --- Student status (school/university clinics, student cover eligibility) ---
  @Column({ default: false })
  isStudent: boolean;

  @Column({ nullable: true })
  institutionName: string;

  @Column({ nullable: true })
  studentIdNumber: string;

  // --- Guardian (required for minors - see PatientsService.assertGuardianRequirements) ---
  // Distinct from emergencyContact below: a guardian has legal authority
  // to consent to treatment on the patient's behalf; an emergency
  // contact is just who to call. For a minor these are very often the
  // same person, but they're conceptually different roles and a system
  // that conflates them can't correctly represent a minor whose
  // emergency contact (e.g. a grandparent) isn't their legal guardian.
  @Column({ nullable: true })
  guardianFullName: string;

  @Column({ type: 'enum', enum: GuardianRelationship, nullable: true })
  guardianRelationship: GuardianRelationship;

  @Column({ nullable: true })
  guardianPhone: string;

  @Column({ nullable: true })
  guardianEmail: string;

  @Column({ nullable: true })
  guardianIdNumber: string;

  @Column({ nullable: true })
  emergencyContactName: string;

  @Column({ nullable: true })
  emergencyContactPhone: string;

  @Column({ nullable: true })
  bloodType: string;

  // Kept as a simple string array at this stage - a dedicated allergy
  // model with severity/reaction detail can replace this once clinical
  // modules go deeper than intake-level detail.
  @Column('simple-array', { default: '' })
  allergies: string[];

  @Column({ default: false })
  isDeceased: boolean;

  // Idempotency key for offline sync replay - see migration
  // 1700000000009 for the full reasoning. Nullable; only set when this
  // record was created via the offline queue.
  @Column({ nullable: true })
  clientRequestId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

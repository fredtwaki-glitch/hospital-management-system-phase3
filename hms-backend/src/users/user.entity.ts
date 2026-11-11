import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Roles are intentionally coarse at this stage. Field-level restrictions
 * (e.g. "billing staff can't see clinical notes") are enforced separately
 * via guards/interceptors per module, not baked into the role enum -
 * that keeps this list from exploding as HMS grows.
 */
export enum UserRole {
  ADMIN = 'admin', // tenant-level administrator
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  PHARMACIST = 'pharmacist',
  BILLING_STAFF = 'billing_staff',
  FRONT_DESK = 'front_desk',
}

/**
 * Lives INSIDE each tenant's schema - a user only ever belongs to one
 * tenant. If a person works across multiple client orgs (rare, e.g. a
 * locum doctor), they get a separate account per tenant. This keeps the
 * isolation model simple and avoids cross-tenant identity leakage.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // The HR/payroll join key - this is what the Payroll Solution
  // integration (see architecture doc: staff.shift.completed -> payroll
  // run) actually keys off, not the internal UUID. Unique per tenant,
  // not globally, since staff numbering schemes are each hospital's own.
  @Column({ unique: true })
  staffNumber: string;

  // Professional registration/license number - e.g. a medical board
  // registration for a doctor, nursing council number for a nurse,
  // pharmacy board number for a pharmacist. Nullable because it's not
  // meaningful for every role (front desk/billing staff don't have one),
  // and left as free text rather than a per-profession structured
  // format since that varies by country and licensing body.
  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ nullable: true })
  department: string; // e.g. "Outpatient", "Radiology", "Pharmacy"

  @Column({ type: 'date', nullable: true })
  hireDate: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

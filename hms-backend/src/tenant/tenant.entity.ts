import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended', // e.g. non-payment, contract lapse
  OFFBOARDING = 'offboarding', // export/delete in progress
}

export enum TenantType {
  HOSPITAL = 'hospital',
  CLINIC = 'clinic',
  PHARMACY = 'pharmacy',
}

/**
 * Lives in the CONTROL-PLANE database only (not per-tenant schemas).
 * This is the single source of truth for "which orgs exist and which
 * products/modules they've licensed."
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string; // used for subdomain/header resolution, e.g. "acme-hospital"

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: TenantType })
  type!: TenantType;

  @Column({ unique: true })
  schemaName!: string; // e.g. "tenant_acme_hospital" - the isolated Postgres schema

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  // Which resold products this tenant has licensed. Drives feature flags
  // and which event-bus subscriptions are active for them.
  @Column('simple-array', { default: 'hms' })
  licensedModules!: string[]; // e.g. ['hms', 'payroll', 'automation']

  @Column({ nullable: true })
  dataResidencyRegion!: string; // e.g. "eu-west-1", "af-south-1" - compliance requirement

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Compliance requirement, not optional: every access to a patient record
 * (or other sensitive resource) is logged - who, what, when, from where.
 * Lives inside each tenant's schema alongside their own data.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  action: string; // e.g. "patient.record.viewed", "billing.invoice.updated"

  @Column({ nullable: true })
  resourceType: string; // e.g. "Patient", "Invoice"

  @Column({ nullable: true })
  resourceId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}

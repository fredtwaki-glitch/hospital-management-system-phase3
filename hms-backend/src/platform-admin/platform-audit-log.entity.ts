import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Separate from the per-tenant audit_logs table (which tracks clinical/
 * operational actions inside one hospital's data). This tracks actions
 * a PLATFORM admin took against tenant records themselves - renamed,
 * suspended, modules changed, etc. If a client ever disputes "you
 * suspended us without warning," this is the record that answers it.
 */
@Entity('platform_audit_logs')
export class PlatformAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  platformAdminId: string;

  @Column()
  action: string; // e.g. "tenant.renamed", "tenant.suspended", "tenant.modules_changed"

  @Column({ nullable: true })
  targetTenantId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}

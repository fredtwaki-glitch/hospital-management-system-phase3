import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RETRY = 'retry',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('event_outbox')
@Index('idx_event_outbox_dispatch', ['status', 'availableAt', 'createdAt'])
@Index('idx_event_outbox_tenant_type', ['tenantId', 'eventType'])
export class EventOutbox {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column()
  tenantId: string;

  @Column()
  eventType: string;

  @Column({ type: 'int', default: 1 })
  eventVersion: number;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  availableAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

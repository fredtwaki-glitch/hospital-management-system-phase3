import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Control-plane only - this table has nothing to do with any tenant's
 * schema. These are accounts for the people operating the platform
 * itself (you / your ops team), with visibility and control across
 * every hospital/clinic/pharmacy client.
 *
 * Deliberately no role enum yet (single flat "platform admin" level) -
 * add granularity (e.g. read-only support staff vs full admin) if/when
 * your own team grows past "everyone on it is trusted with everything."
 */
@Entity('platform_admins')
export class PlatformAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

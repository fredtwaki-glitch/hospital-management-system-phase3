import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Single row per tenant. This is the AI's ONLY source of truth for
 * factual claims to the public (hours, insurance, location) - the
 * public-inquiry persona is instructed to answer from this data and
 * nothing else, specifically so it can't hallucinate a policy or
 * insurance acceptance that isn't actually true.
 */
@Entity('org_profile')
export class OrgProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  publicPhone: string;

  @Column({ nullable: true })
  publicEmail: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  openingHours: string; // free text, e.g. "Mon-Fri 8am-6pm, Sat 9am-1pm, closed Sundays"

  @Column('simple-array', { default: '' })
  acceptedInsuranceProviders: string[];

  @Column({ type: 'text', nullable: true })
  additionalPublicNotes: string; // e.g. parking info, walk-in policy

  @UpdateDateColumn()
  updatedAt: Date;
}

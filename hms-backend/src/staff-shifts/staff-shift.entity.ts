
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum StaffShiftStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('staff_shifts')
@Index('idx_staff_shifts_staff_started', ['staffId', 'startedAt'])
export class StaffShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  staffId: string;

  @Column()
  staffNumber: string;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({
    type: 'enum',
    enum: StaffShiftStatus,
    default: StaffShiftStatus.IN_PROGRESS,
  })
  status: StaffShiftStatus;

  @Column({ type: 'int', default: 0 })
  breakMinutes: number;

  @Column({ type: 'int', nullable: true })
  minutesWorked: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column('uuid')
  createdByUserId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pharmacy_items')
export class PharmacyItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string; // e.g. "analgesic", "antibiotic"

  @Column({ default: 'unit' })
  unit: string; // e.g. "tablet", "vial", "box"

  @Column({ default: 0 })
  quantityOnHand: number;

  // When quantityOnHand drops to/below this, an inventory.low_stock
  // event fires for the Automation Suite reorder workflow.
  @Column({ default: 10 })
  reorderThreshold: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ nullable: true })
  supplier: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum StockMovementType {
  RECEIVED = 'received', // stock delivered from supplier
  DISPENSED = 'dispensed', // given to a patient
  ADJUSTED = 'adjusted', // manual correction (breakage, count correction)
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;

  // Positive for received, negative for dispensed - keeps the running
  // total a simple sum rather than needing type-specific arithmetic
  // everywhere it's read.
  @Column()
  quantityChange: number;

  @Column({ nullable: true })
  patientId: string; // set when type = dispensed

  @Column({ nullable: true })
  prescriptionId: string; // links a dispense back to the doctor's order it fulfills, when applicable

  @Column({ nullable: true })
  note: string;

  @Column()
  recordedByUserId: string;

  @CreateDateColumn()
  createdAt: Date;
}

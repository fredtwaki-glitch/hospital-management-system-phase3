import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  VOID = 'void',
}

export enum ClaimStatus {
  NOT_APPLICABLE = 'not_applicable', // self-pay invoice, no insurance involved
  PENDING_SUBMISSION = 'pending_submission', // a cover was selected but the claim hasn't been submitted yet
  SUBMITTED = 'submitted',
  PARTIALLY_APPROVED = 'partially_approved',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid', // payer has actually disbursed the approved amount
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: string; // numeric columns come back as strings from pg - kept as-is deliberately, cast at display time

  // Direct payments FROM THE PATIENT (cash, M-Pesa, card) - kept
  // distinct from amountReceivedFromPayer below, since these are two
  // different money flows that settle the same invoice.
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountPaid: string;

  @Column({ default: 'KES' })
  currency: string;

  // --- Insurance / coordination-of-benefits fields ---
  // Both nullable: an invoice with neither set is a plain self-pay invoice.
  @Column({ nullable: true })
  primaryCoverId: string;

  @Column({ nullable: true })
  secondaryCoverId: string;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.NOT_APPLICABLE })
  claimStatus: ClaimStatus;

  // What the payer(s) are expected/confirmed to cover, combined across
  // primary + secondary. Starts at 0 (undetermined) even when a cover
  // is attached - real adjudication takes time, this isn't calculated
  // automatically from a percentage since actual coverage rules live
  // with the insurer, not in this system.
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  payerCoveredAmount: string;

  // totalAmount - payerCoveredAmount, i.e. the patient's co-pay/
  // out-of-pocket portion. Stored explicitly (not just computed at
  // read time) so it reflects the coverage determination as of when
  // it was last updated, not a live recalculation that could drift as
  // totalAmount changes after a claim is already in progress.
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  patientResponsibility: string;

  // Actual money received FROM THE PAYER, distinct from payerCoveredAmount
  // (which is the expected/approved figure - this is what's actually landed).
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountReceivedFromPayer: string;

  @Column({ type: 'timestamptz', nullable: true })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column()
  description: string; // e.g. "Consultation - Dr. Otieno", "Paracetamol 500mg x20"

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ nullable: true })
  sourceType: string; // e.g. "appointment", "pharmacy_dispense" - links back to the originating event

  @Column({ nullable: true })
  sourceId: string;
}

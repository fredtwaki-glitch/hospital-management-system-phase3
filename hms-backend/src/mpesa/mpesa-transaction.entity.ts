import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum MpesaTransactionType {
  STK_PUSH = 'stk_push', // patient co-pay collected at time of billing (Lipa na M-Pesa Online)
  C2B = 'c2b', // patient paid independently via Paybill, before/without staff initiating it
}

export enum MpesaTransactionStatus {
  INITIATED = 'initiated', // STK push sent to phone, awaiting the patient's PIN entry
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled', // patient declined/timed out the STK prompt
}

/**
 * One row per M-Pesa payment attempt, STK or C2B. This is the audit
 * trail for reconciliation disputes ("the patient says they paid but
 * the invoice doesn't show it") - rawCallbackPayload keeps Safaricom's
 * full response so a dispute can be checked against source data, not
 * just our own derived fields.
 */
@Entity('mpesa_transactions')
export class MpesaTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: a C2B payment arrives before we necessarily know which
  // invoice it's for (see MpesaService.handleC2bConfirmation) - it may
  // sit unlinked until staff reconcile it manually.
  @Column({ nullable: true })
  invoiceId: string;

  @Column({ type: 'enum', enum: MpesaTransactionType })
  transactionType: MpesaTransactionType;

  @Column({ type: 'enum', enum: MpesaTransactionStatus, default: MpesaTransactionStatus.INITIATED })
  status: MpesaTransactionStatus;

  // Set for STK push - used to match Safaricom's async callback back to
  // this row, since the callback carries no reference to our invoice.
  @Column({ nullable: true })
  checkoutRequestId: string;

  @Column({ nullable: true })
  merchantRequestId: string;

  // Safaricom's own receipt number - the number a patient would quote
  // if disputing a payment. Only set once status = completed.
  @Column({ nullable: true })
  mpesaReceiptNumber: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ nullable: true })
  resultDescription: string; // Safaricom's human-readable outcome, e.g. "Request cancelled by user"

  @Column({ type: 'jsonb', nullable: true })
  rawCallbackPayload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

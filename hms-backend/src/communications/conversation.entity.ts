import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ConversationChannel {
  PUBLIC_INQUIRY = 'public_inquiry',
  PATIENT_PORTAL = 'patient_portal',
  SUPPLIER = 'supplier',
}

export enum ConversationStatus {
  OPEN = 'open', // AI is actively handling it
  AWAITING_HUMAN = 'awaiting_human', // AI flagged this for staff review/approval
  RESOLVED = 'resolved',
}

/**
 * One row per external thread, regardless of channel. Keeping a single
 * model (rather than separate tables per channel) means staff get one
 * inbox-style view across public inquiries, patient chats, and supplier
 * threads, and it's one place to enforce "AI never auto-sends anything
 * to a supplier without human approval."
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ConversationChannel })
  channel: ConversationChannel;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
  status: ConversationStatus;

  // Set when channel = patient_portal. Null for public_inquiry (no
  // identity yet) and supplier (not a patient concern).
  @Column({ nullable: true })
  patientId: string;

  // Set when channel = supplier.
  @Column({ nullable: true })
  supplierName: string;

  // Contact info for public_inquiry / supplier threads where there's no
  // logged-in identity to key off of.
  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  subject: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum MessageSenderType {
  END_USER = 'end_user', // patient, supplier contact, or member of the public
  AI = 'ai',
  STAFF = 'staff',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column({ type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType;

  // Set when senderType = staff (users.id). Null for end_user/ai.
  @Column({ nullable: true })
  staffUserId: string;

  @Column({ type: 'text' })
  content: string;

  // True for AI-drafted content that hasn't been approved/sent yet -
  // used by the supplier channel, where AI only ever drafts.
  @Column({ default: false })
  isDraft: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

import { User } from '../users/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { Patient } from '../patients/patient.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Invoice, InvoiceLineItem } from '../billing/invoice.entity';
import { PharmacyItem, StockMovement } from '../pharmacy/pharmacy-item.entity';
import { ClinicalNote } from '../clinical-notes/clinical-note.entity';
import { LabOrder } from '../lab-orders/lab-order.entity';
import { Prescription } from '../prescriptions/prescription.entity';
import { Conversation, Message } from '../communications/conversation.entity';
import { OrgProfile } from '../org-profile/org-profile.entity';
import { PatientPortalOtp } from '../patient-portal/patient-portal-otp.entity';
import { SupplierContact } from '../supplier-comms/supplier-contact.entity';
import { Payer } from '../payers/payer.entity';
import { PatientInsuranceCover } from '../insurance-covers/patient-insurance-cover.entity';
import { MpesaTransaction } from '../mpesa/mpesa-transaction.entity';
import { EventOutbox } from '../events/event-outbox.entity';
import { StaffShift } from '../staff-shifts/staff-shift.entity';

/**
 * Every entity here lives inside each tenant's isolated Postgres schema.
 * Add new tenant-scoped entities to this list ONLY - both
 * TenantConnectionManager (runtime) and the seed:tenant onboarding
 * script (provisioning) import from here, so there's exactly one place
 * that can get out of sync instead of three.
 */
export const TENANT_SCHEMA_ENTITIES = [
  User,
  AuditLog,
  Patient,
  Appointment,
  Invoice,
  InvoiceLineItem,
  PharmacyItem,
  StockMovement,
  ClinicalNote,
  LabOrder,
  Prescription,
  Conversation,
  Message,
  OrgProfile,
  PatientPortalOtp,
  SupplierContact,
  Payer,
  PatientInsuranceCover,
  MpesaTransaction,
  EventOutbox,
  StaffShift,
];

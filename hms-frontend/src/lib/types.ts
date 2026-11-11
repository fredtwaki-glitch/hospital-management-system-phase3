export interface StaffUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  staffNumber: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  phone?: string;
  email?: string;
  guardianFullName?: string;
  guardianPhone?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  reason?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  status: string;
  totalAmount: string;
  amountPaid: string;
  currency: string;
  claimStatus: string;
  payerCoveredAmount: string;
  patientResponsibility: string;
  amountReceivedFromPayer: string;
  primaryCoverId?: string;
  lineItems?: (InvoiceLineItem & { id: string })[];
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  noteType: string;
  content: string;
  createdAt: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  testName: string;
  priority: string;
  status: string;
  resultSummary?: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
  instructions?: string;
  status: string;
  createdAt: string;
}

export interface Payer {
  id: string;
  name: string;
  payerType: string;
  isActive: boolean;
}

export interface PatientInsuranceCover {
  id: string;
  patientId: string;
  payerId: string;
  coverCategory: string;
  organizationName?: string;
  memberNumber: string;
  priority: string;
  status: string;
}

export interface PharmacyItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  unitPrice: string;
  supplier?: string;
}

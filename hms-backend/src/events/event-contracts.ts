/**
 * Version 1 payload contracts. IDs are tenant-scoped UUIDs unless noted.
 * Payloads intentionally carry references and workflow metadata, not clinical
 * note contents, diagnoses, lab values, or payment credentials.
 */
export interface HmsEventPayloads {
  'patient.registered': { patientId: string; mrn: string; isMinor: boolean };
  'patient.deceased': { patientId: string };
  'appointment.scheduled': { appointmentId: string; patientId: string; scheduledAt: Date | string };
  'patient.checked_in': { appointmentId: string; patientId: string };
  'appointment.completed': { appointmentId: string; patientId: string; providerId: string };
  'invoice.generated': { invoiceId: string; patientId: string; totalAmount: string | number; currency: string; hasCover: boolean };
  'invoice.claim_pending': { invoiceId: string; primaryCoverId?: string; secondaryCoverId?: string };
  'invoice.paid': { invoiceId: string; patientId: string };
  'invoice.claim_status_changed': { invoiceId: string; patientId: string; claimStatus: string };
  'clinical_note.created': { noteId: string; patientId: string; noteType: string };
  'lab_order.created': { orderId: string; patientId: string; testName: string; priority: string };
  'lab_order.result_ready': { orderId: string; patientId: string; testName: string };
  'prescription.created': { prescriptionId: string; patientId: string; medicationName: string };
  'prescription.dispensed': { itemId: string; patientId?: string; quantity: number };
  'inventory.low_stock': { itemId: string; sku: string; name: string; quantityOnHand: number; reorderThreshold: number };
  'staff.shift.completed': {
    shiftId: string; staffId: string; staffNumber: string; staffName?: string;
    department: string | null; role: string | null; startedAt: string; endedAt: string;
    breakMinutes: number; minutesWorked: number; notes: string | null;
  };
}

export type HmsEventName = keyof HmsEventPayloads;
export type HmsEventPayload<T extends HmsEventName> = HmsEventPayloads[T];

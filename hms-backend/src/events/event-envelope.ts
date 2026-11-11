/** Stable event envelope shared by HMS, Payroll and Automation consumers. */
export interface HmsEventEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  tenantId: string;
  type: string;
  version: number;
  occurredAt: string;
  data: T;
}

export const HMS_EVENT_TYPES = {
  PATIENT_REGISTERED: 'patient.registered',
  PATIENT_DECEASED: 'patient.deceased',
  APPOINTMENT_SCHEDULED: 'appointment.scheduled',
  PATIENT_CHECKED_IN: 'patient.checked_in',
  APPOINTMENT_COMPLETED: 'appointment.completed',
  INVOICE_GENERATED: 'invoice.generated',
  INVOICE_CLAIM_PENDING: 'invoice.claim_pending',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_CLAIM_STATUS_CHANGED: 'invoice.claim_status_changed',
  CLINICAL_NOTE_CREATED: 'clinical_note.created',
  LAB_ORDER_CREATED: 'lab_order.created',
  LAB_RESULT_READY: 'lab_order.result_ready',
  PRESCRIPTION_CREATED: 'prescription.created',
  PRESCRIPTION_DISPENSED: 'prescription.dispensed',
  INVENTORY_LOW_STOCK: 'inventory.low_stock',
  STAFF_SHIFT_COMPLETED: 'staff.shift.completed',
} as const;

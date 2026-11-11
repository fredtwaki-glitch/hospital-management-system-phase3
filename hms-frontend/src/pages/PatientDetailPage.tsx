import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LedgerCard } from '../components/LedgerCard';
import { LedgerSteps } from '../components/LedgerSteps';
import { ClinicalNotesPanel } from '../components/panels/ClinicalNotesPanel';
import { LabOrdersPanel } from '../components/panels/LabOrdersPanel';
import { PrescriptionsPanel } from '../components/panels/PrescriptionsPanel';
import { InsuranceCoversPanel } from '../components/panels/InsuranceCoversPanel';
import { api, ApiError } from '../lib/api';
import { Appointment, Invoice, Patient } from '../lib/types';

const TABS = ['Overview', 'Notes', 'Labs', 'Prescriptions', 'Insurance'] as const;
type Tab = (typeof TABS)[number];

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');

  useEffect(() => {
    if (!id) return;
    api.get<Patient>(`/patients/${id}`).then(setPatient).catch((err: ApiError) => setError(err.message));
    api.get<Appointment[]>(`/appointments?patientId=${id}`).then(setAppointments).catch(() => {});
    api.get<Invoice[]>(`/invoices?patientId=${id}`).then(setInvoices).catch(() => {});
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!patient || !id) return <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>;

  const currentStep = invoices.length > 0 || appointments.length > 0 ? 2 : 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Patient record</div>
          <h1>
            {patient.firstName} {patient.lastName}
          </h1>
        </div>
      </div>

      <LedgerSteps current={currentStep} />

      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--paper-line)', marginBottom: 'var(--space-5)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--marigold)' : '2px solid transparent',
              borderRadius: 0,
              color: tab === t ? 'var(--ink)' : 'var(--ink-soft)',
              paddingBottom: 'var(--space-2)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <>
          <LedgerCard tabLabel="A · PATIENT" stampText="ON FILE" stampVariant="active">
            <div className="field-row">
              <div>
                <div className="eyebrow">MRN</div>
                <div className="mono">{patient.mrn}</div>
              </div>
              <div>
                <div className="eyebrow">Date of birth</div>
                <div>{patient.dateOfBirth}</div>
              </div>
            </div>
            <div className="field-row" style={{ marginTop: 'var(--space-3)' }}>
              <div>
                <div className="eyebrow">Phone</div>
                <div>{patient.phone || '—'}</div>
              </div>
              <div>
                <div className="eyebrow">Email</div>
                <div>{patient.email || '—'}</div>
              </div>
            </div>
            {patient.guardianFullName && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div className="eyebrow">Guardian</div>
                <div>
                  {patient.guardianFullName} · {patient.guardianPhone}
                </div>
              </div>
            )}
          </LedgerCard>

          <div style={{ display: 'flex', gap: 'var(--space-3)', margin: 'var(--space-5) 0' }}>
            <Link to={`/appointments/new?patientId=${patient.id}`} className="btn btn-secondary">
              B · Schedule visit
            </Link>
            <Link to={`/invoices/new?patientId=${patient.id}`} className="btn btn-secondary">
              C · Create bill
            </Link>
          </div>

          {appointments.length > 0 && (
            <>
              <h3 style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>Appointments</h3>
              {appointments.map((a) => (
                <LedgerCard
                  key={a.id}
                  tabLabel="B · VISIT"
                  stampText={a.status.replace('_', ' ')}
                  stampVariant={a.status === 'completed' ? 'active' : a.status === 'cancelled' || a.status === 'no_show' ? 'alert' : 'pending'}
                >
                  <div>{new Date(a.scheduledAt).toLocaleString()}</div>
                  {a.reason && <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>{a.reason}</div>}
                </LedgerCard>
              ))}
            </>
          )}

          {invoices.length > 0 && (
            <>
              <h3 style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>Invoices</h3>
              {invoices.map((inv) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
                  <LedgerCard tabLabel="C · BILL" stampText={inv.status.replace('_', ' ')} stampVariant={inv.status === 'paid' ? 'active' : inv.status === 'void' ? 'alert' : 'pending'}>
                    <div className="mono">
                      {inv.currency} {inv.totalAmount}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
                      Paid: {inv.currency} {inv.amountPaid}
                    </div>
                  </LedgerCard>
                </Link>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'Notes' && <ClinicalNotesPanel patientId={id} />}
      {tab === 'Labs' && <LabOrdersPanel patientId={id} />}
      {tab === 'Prescriptions' && <PrescriptionsPanel patientId={id} />}
      {tab === 'Insurance' && <InsuranceCoversPanel patientId={id} />}
    </div>
  );
}

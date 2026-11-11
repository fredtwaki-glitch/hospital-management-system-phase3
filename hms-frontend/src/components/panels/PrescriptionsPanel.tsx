import { FormEvent, useEffect, useState } from 'react';
import { LedgerCard, stampVariantForStatus } from '../LedgerCard';
import { api, ApiError } from '../../lib/api';

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
  status: string;
}

export function PrescriptionsPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<Prescription[] | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api
      .get<Prescription[]>(`/prescriptions?patientId=${patientId}`)
      .then(setItems)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, [patientId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/prescriptions', {
        patientId,
        medicationName,
        dosage,
        frequency,
        durationDays: durationDays ? Number(durationDays) : undefined,
      });
      setMedicationName('');
      setDosage('');
      setFrequency('');
      setDurationDays('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api.patch(`/prescriptions/${id}/status`, { status: 'cancelled' });
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleCreate} className="ledger-card">
        <span className="ledger-card__tab">NEW PRESCRIPTION</span>
        <div className="field-row">
          <div className="field">
            <label>Medication</label>
            <input value={medicationName} onChange={(e) => setMedicationName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Dosage</label>
            <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500mg" required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Frequency</label>
            <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="twice daily" required />
          </div>
          <div className="field">
            <label>Duration (days)</label>
            <input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Prescribe'}
        </button>
      </form>

      {items?.length === 0 && <div className="empty-state">No prescriptions yet.</div>}
      {items?.map((p) => (
        <LedgerCard key={p.id} tabLabel="RX" stampText={p.status} stampVariant={stampVariantForStatus(p.status)}>
          <div style={{ fontWeight: 600 }}>{p.medicationName}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
            {p.dosage} · {p.frequency} {p.durationDays ? `· ${p.durationDays} days` : ''}
          </div>
          {p.status === 'active' && (
            <button onClick={() => cancel(p.id)} className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }}>
              Cancel
            </button>
          )}
        </LedgerCard>
      ))}
    </div>
  );
}

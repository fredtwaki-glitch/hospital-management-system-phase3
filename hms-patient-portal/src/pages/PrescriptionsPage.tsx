import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  status: string;
}

export function PrescriptionsPage() {
  const [items, setItems] = useState<Prescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Prescription[]>('/patient-portal/me/prescriptions')
      .then(setItems)
      .catch((err) => setError((err as ApiError).message));
  }, []);

  return (
    <div>
      <div className="eyebrow">Your record</div>
      <h1 style={{ marginBottom: 'var(--space-5)' }}>Prescriptions</h1>

      {error && <div className="error-banner">{error}</div>}
      {items?.length === 0 && <div className="empty-state">No prescriptions on file.</div>}

      {items?.map((p) => (
        <div key={p.id} className="ledger-card">
          <span className="ledger-card__tab">RX</span>
          <span className={`ledger-card__stamp ledger-card__stamp--${p.status === 'active' ? 'active' : 'alert'}`}>{p.status}</span>
          <div style={{ fontWeight: 600 }}>{p.medicationName}</div>
          <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            {p.dosage} · {p.frequency}
          </div>
        </div>
      ))}
    </div>
  );
}

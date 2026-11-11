import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface LabOrder {
  id: string;
  testName: string;
  status: string;
  resultSummary?: string;
}

export function LabsPage() {
  const [items, setItems] = useState<LabOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LabOrder[]>('/patient-portal/me/lab-orders')
      .then(setItems)
      .catch((err) => setError((err as ApiError).message));
  }, []);

  return (
    <div>
      <div className="eyebrow">Your record</div>
      <h1 style={{ marginBottom: 'var(--space-5)' }}>Lab results</h1>

      {error && <div className="error-banner">{error}</div>}
      {items?.length === 0 && <div className="empty-state">No lab orders on file.</div>}

      {items?.map((o) => (
        <div key={o.id} className="ledger-card">
          <span className="ledger-card__tab">LAB</span>
          <span className={`ledger-card__stamp ledger-card__stamp--${o.status === 'completed' ? 'active' : 'pending'}`}>{o.status.replace('_', ' ')}</span>
          <div style={{ fontWeight: 600 }}>{o.testName}</div>
          {o.resultSummary ? (
            <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{o.resultSummary}</p>
          ) : (
            <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>Results not yet available.</p>
          )}
        </div>
      ))}
    </div>
  );
}

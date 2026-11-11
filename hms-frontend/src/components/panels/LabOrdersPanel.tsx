import { FormEvent, useEffect, useState } from 'react';
import { LedgerCard, stampVariantForStatus } from '../LedgerCard';
import { api, ApiError } from '../../lib/api';

interface LabOrder {
  id: string;
  testName: string;
  priority: string;
  status: string;
  resultSummary?: string;
  createdAt: string;
}

const STATUSES = ['ordered', 'specimen_collected', 'in_progress', 'completed', 'cancelled'];

export function LabOrdersPanel({ patientId }: { patientId: string }) {
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [testName, setTestName] = useState('');
  const [priority, setPriority] = useState('routine');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api
      .get<LabOrder[]>(`/lab-orders?patientId=${patientId}`)
      .then(setOrders)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, [patientId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/lab-orders', { patientId, testName, priority });
      setTestName('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const resultSummary = status === 'completed' ? window.prompt('Result summary (optional)') || undefined : undefined;
    try {
      await api.patch(`/lab-orders/${id}/status`, { status, resultSummary });
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleCreate} className="ledger-card">
        <span className="ledger-card__tab">ORDER TEST</span>
        <div className="field-row">
          <div className="field">
            <label>Test name</label>
            <input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Full Blood Count" required />
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">Stat</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Ordering…' : 'Order test'}
        </button>
      </form>

      {orders?.length === 0 && <div className="empty-state">No lab orders yet.</div>}
      {orders?.map((o) => (
        <LedgerCard key={o.id} tabLabel={o.priority.toUpperCase()} stampText={o.status.replace('_', ' ')} stampVariant={stampVariantForStatus(o.status)}>
          <div style={{ fontWeight: 600 }}>{o.testName}</div>
          {o.resultSummary && <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{o.resultSummary}</p>}
          {o.status !== 'completed' && o.status !== 'cancelled' && (
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
              {STATUSES.filter((s) => s !== o.status && s !== 'cancelled').map((s) => (
                <button key={s} onClick={() => updateStatus(o.id, s)} className="btn btn-secondary">
                  → {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </LedgerCard>
      ))}
    </div>
  );
}

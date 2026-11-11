import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LedgerSteps } from '../components/LedgerSteps';
import { api, ApiError } from '../lib/api';
import { InvoiceLineItem } from '../lib/types';

interface Cover {
  id: string;
  coverCategory: string;
  priority: string;
  memberNumber: string;
}

export function InvoiceCreatePage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const navigate = useNavigate();

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [primaryCoverId, setPrimaryCoverId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    api
      .get<Cover[]>(`/insurance-covers?patientId=${patientId}`)
      .then((all) => setCovers(all.filter((c) => c.priority === 'primary')))
      .catch(() => {});
  }, [patientId]);

  const total = lineItems.reduce((sum, li) => sum + (li.unitPrice || 0) * (li.quantity || 1), 0);

  function updateLineItem(index: number, patch: Partial<InvoiceLineItem>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((items) => [...items, { description: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError('No patient selected - go back to the patient record first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const invoice = await api.post<{ id: string }>('/invoices', {
        patientId,
        primaryCoverId: primaryCoverId || undefined,
        lineItems: lineItems.filter((li) => li.description.trim().length > 0),
      });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError((err as ApiError).message || 'Could not create invoice');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Bill</div>
          <h1>New invoice</h1>
        </div>
      </div>

      <LedgerSteps current={2} />

      <form onSubmit={handleSubmit} className="ledger-card">
        <span className="ledger-card__tab">C &middot; BILL</span>

        {error && <div className="error-banner">{error}</div>}
        {!patientId && (
          <div className="error-banner">No patient selected. Open a patient record and choose "Create bill" from there.</div>
        )}

        {covers.length > 0 && (
          <div className="field">
            <label>Bill against insurance cover (optional)</label>
            <select value={primaryCoverId} onChange={(e) => setPrimaryCoverId(e.target.value)}>
              <option value="">Self-pay — no cover</option>
              {covers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.coverCategory} · {c.memberNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        {lineItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 3, marginBottom: 0 }}>
              {i === 0 && <label>Description</label>}
              <input
                value={item.description}
                onChange={(e) => updateLineItem(i, { description: e.target.value })}
                placeholder="e.g. Consultation"
              />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              {i === 0 && <label>Qty</label>}
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
              />
            </div>
            <div className="field" style={{ flex: 1.5, marginBottom: 0 }}>
              {i === 0 && <label>Unit price</label>}
              <input
                type="number"
                min={0}
                value={item.unitPrice}
                onChange={(e) => updateLineItem(i, { unitPrice: Number(e.target.value) })}
              />
            </div>
            {lineItems.length > 1 && (
              <button type="button" onClick={() => removeLineItem(i)} className="btn btn-secondary" style={{ marginBottom: 0 }}>
                ✕
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addLineItem} className="btn btn-secondary" style={{ marginBottom: 'var(--space-5)' }}>
          + Add line
        </button>

        <div
          style={{
            borderTop: '1px solid var(--paper-line)',
            paddingTop: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="eyebrow">Total</span>
          <span className="mono" style={{ fontSize: 'var(--text-xl)' }}>
            KES {total.toFixed(2)}
          </span>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading || !patientId} style={{ marginTop: 'var(--space-5)' }}>
          {loading ? 'Creating…' : 'Create invoice →'}
        </button>
      </form>
    </div>
  );
}

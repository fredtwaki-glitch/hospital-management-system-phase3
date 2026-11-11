import { FormEvent, useEffect, useState } from 'react';
import { LedgerCard } from '../LedgerCard';
import { api, ApiError } from '../../lib/api';

interface Payer {
  id: string;
  name: string;
  payerType: string;
}
interface Cover {
  id: string;
  coverCategory: string;
  organizationName?: string;
  memberNumber: string;
  priority: string;
  status: string;
  payerId: string;
}

export function InsuranceCoversPanel({ patientId }: { patientId: string }) {
  const [covers, setCovers] = useState<Cover[] | null>(null);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [payerId, setPayerId] = useState('');
  const [coverCategory, setCoverCategory] = useState('national');
  const [organizationName, setOrganizationName] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [priority, setPriority] = useState('primary');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api
      .get<Cover[]>(`/insurance-covers?patientId=${patientId}`)
      .then(setCovers)
      .catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, [patientId]);
  useEffect(() => {
    api.get<Payer[]>('/payers?activeOnly=true').then(setPayers).catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/insurance-covers', {
        patientId,
        payerId,
        coverCategory,
        organizationName: coverCategory === 'corporate' ? organizationName : undefined,
        memberNumber,
        priority,
      });
      setMemberNumber('');
      setOrganizationName('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  const payerName = (id: string) => payers.find((p) => p.id === id)?.name || id;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleCreate} className="ledger-card">
        <span className="ledger-card__tab">ADD COVER</span>
        <div className="field-row">
          <div className="field">
            <label>Payer</label>
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)} required>
              <option value="">Select…</option>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={coverCategory} onChange={(e) => setCoverCategory(e.target.value)}>
              <option value="national">National</option>
              <option value="corporate">Corporate</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>
        {coverCategory === 'corporate' && (
          <div className="field">
            <label>Employer / organization</label>
            <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label>Member number</label>
            <input value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Add cover'}
        </button>
      </form>

      {covers?.length === 0 && <div className="empty-state">No insurance covers on file — this patient is self-pay unless one is added.</div>}
      {covers?.map((c) => (
        <LedgerCard key={c.id} tabLabel={c.priority.toUpperCase()} stampText={c.status} stampVariant={c.status === 'active' ? 'active' : 'alert'}>
          <div style={{ fontWeight: 600 }}>{payerName(c.payerId)}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
            {c.coverCategory} {c.organizationName ? `· ${c.organizationName}` : ''} · <span className="mono">{c.memberNumber}</span>
          </div>
        </LedgerCard>
      ))}
    </div>
  );
}

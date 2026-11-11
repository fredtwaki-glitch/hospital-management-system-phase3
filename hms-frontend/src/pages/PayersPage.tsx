import { FormEvent, useEffect, useState } from 'react';
import { LedgerCard } from '../components/LedgerCard';
import { api, ApiError } from '../lib/api';

interface Payer {
  id: string;
  name: string;
  payerType: string;
  isActive: boolean;
}

export function PayersPage() {
  const [payers, setPayers] = useState<Payer[] | null>(null);
  const [name, setName] = useState('');
  const [payerType, setPayerType] = useState('national_scheme');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api.get<Payer[]>('/payers').then(setPayers).catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/payers', { name, payerType });
      setName('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Payers</div>
          <h1>Insurers &amp; schemes</h1>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleCreate} className="ledger-card">
        <span className="ledger-card__tab">NEW PAYER</span>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jubilee Insurance" required />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={payerType} onChange={(e) => setPayerType(e.target.value)}>
              <option value="national_scheme">National scheme</option>
              <option value="private_insurer">Private insurer</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Add payer'}
        </button>
      </form>

      {payers?.map((p) => (
        <LedgerCard key={p.id} tabLabel={p.payerType === 'national_scheme' ? 'NATIONAL' : 'PRIVATE'} stampText={p.isActive ? 'active' : 'inactive'} stampVariant={p.isActive ? 'active' : 'alert'}>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
        </LedgerCard>
      ))}
    </div>
  );
}

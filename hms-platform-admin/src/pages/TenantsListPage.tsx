import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  licensedModules: string[];
}

export function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('hospital');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    api.get<Tenant[]>('/platform/tenants').then(setTenants).catch((err) => setError((err as ApiError).message));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/platform/tenants', { slug, name, type });
      setSlug('');
      setName('');
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-5)' }}>
        <div>
          <div className="eyebrow">Clients</div>
          <h1>Tenants</h1>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary">
          {showForm ? 'Cancel' : '+ Onboard tenant'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="panel">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="field">
              <label>Slug (subdomain)</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-hospital" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Hospital" required />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="pharmacy">Pharmacy</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Provisioning…' : 'Provision tenant'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Type</th>
            <th>Status</th>
            <th>Modules</th>
          </tr>
        </thead>
        <tbody>
          {tenants?.map((t) => (
            <tr key={t.id}>
              <td>
                <Link to={`/tenants/${t.id}`} style={{ color: 'var(--baraka)', fontWeight: 600, textDecoration: 'none' }}>
                  {t.name}
                </Link>
              </td>
              <td className="mono">{t.slug}</td>
              <td>{t.type}</td>
              <td>
                <span className={`badge badge--${t.status}`}>{t.status}</span>
              </td>
              <td>{t.licensedModules.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

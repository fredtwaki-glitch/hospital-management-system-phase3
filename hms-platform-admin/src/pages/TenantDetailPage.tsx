import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  licensedModules: string[];
  dataResidencyRegion: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ALL_MODULES = ['hms', 'payroll', 'automation'];

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [name, setName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!id) return;
    api.get<Tenant>(`/platform/tenants/${id}`).then((t) => {
      setTenant(t);
      setName(t.name);
      setNewSlug(t.slug);
      setModules(t.licensedModules);
    }).catch((err) => setError((err as ApiError).message));
    api.get<AuditEntry[]>(`/platform/tenants/${id}/audit-log`).then(setAuditLog).catch(() => {});
  }
  useEffect(load, [id]);

  async function withBusy(action: () => Promise<unknown>, successMessage: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      setNotice(successMessage);
      load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    await withBusy(() => api.patch(`/platform/tenants/${id}/profile`, { name }), 'Profile updated.');
  }

  async function handleSlugChange(e: FormEvent) {
    e.preventDefault();
    if (!id || !tenant) return;
    if (newSlug === tenant.slug) return;
    const confirmed = window.confirm(
      `Changing the subdomain from "${tenant.slug}" to "${newSlug}" will break any bookmarks or links using the old subdomain. Continue?`,
    );
    if (!confirmed) return;
    await withBusy(() => api.patch(`/platform/tenants/${id}/slug`, { newSlug }), 'Subdomain changed.');
  }

  async function handleStatusChange(status: string) {
    if (!id) return;
    const reason = status === 'suspended' ? window.prompt('Reason for suspending this tenant?') || undefined : undefined;
    await withBusy(() => api.patch(`/platform/tenants/${id}/status`, { status, reason }), `Status set to ${status}.`);
  }

  function toggleModule(mod: string) {
    setModules((current) => (current.includes(mod) ? current.filter((m) => m !== mod) : [...current, mod]));
  }

  async function handleModulesSave() {
    if (!id) return;
    await withBusy(() => api.patch(`/platform/tenants/${id}/modules`, { licensedModules: modules }), 'Licensed modules updated.');
  }

  if (!tenant) return <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>;

  return (
    <div>
      <div className="eyebrow">Tenant</div>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>{tenant.name}</h1>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <span className={`badge badge--${tenant.status}`}>{tenant.status}</span>{' '}
        <span className="mono" style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          {tenant.slug} · {tenant.type}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div style={{ color: 'var(--baraka-dark)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{notice}</div>
      )}

      <form onSubmit={handleRename} className="panel">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Profile</h3>
        <div className="field">
          <label>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={busy || name === tenant.name}>
          Save name
        </button>
      </form>

      <form onSubmit={handleSlugChange} className="panel">
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Subdomain</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)', marginBottom: 'var(--space-3)' }}>
          Changing this breaks old bookmarks/links but does not affect any staff or patient's ability to log in.
        </p>
        <div className="field">
          <label>Slug</label>
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={busy || newSlug === tenant.slug}>
          Change subdomain
        </button>
      </form>

      <div className="panel">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Status</h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn" disabled={busy || tenant.status === 'active'} onClick={() => handleStatusChange('active')}>
            Set active
          </button>
          <button className="btn" disabled={busy || tenant.status === 'suspended'} onClick={() => handleStatusChange('suspended')}>
            Suspend
          </button>
          <button className="btn" disabled={busy || tenant.status === 'offboarding'} onClick={() => handleStatusChange('offboarding')}>
            Mark offboarding
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Licensed modules</h3>
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          {ALL_MODULES.map((mod) => (
            <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={modules.includes(mod)} onChange={() => toggleModule(mod)} />
              {mod}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={handleModulesSave}>
          Save modules
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Audit trail</h3>
        {auditLog.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>No actions recorded yet.</p>}
        {auditLog.map((entry) => (
          <div key={entry.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--paper-line)', fontSize: 'var(--text-sm)' }}>
            <span className="mono">{new Date(entry.createdAt).toLocaleString()}</span> — {entry.action}
            {entry.metadata && (
              <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>{JSON.stringify(entry.metadata)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

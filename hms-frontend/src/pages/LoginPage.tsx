import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(tenantSlug, email, password);
      navigate('/patients');
    } catch (err) {
      setError((err as ApiError).message || 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--baraka-dark)',
      }}
    >
      <div style={{ width: 360 }}>
        <div className="eyebrow" style={{ color: 'var(--marigold)', marginBottom: 'var(--space-2)' }}>
          Staff sign-in
        </div>
        <h1 style={{ color: 'var(--paper-raised)', marginBottom: 'var(--space-6)' }}>Hospital Console</h1>

        <form onSubmit={handleSubmit} className="ledger-card" style={{ marginTop: 0 }}>
          <span className="ledger-card__tab">LOGIN</span>

          {error && <div className="error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="tenantSlug">Organization</label>
            <input
              id="tenantSlug"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="acme-hospital"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

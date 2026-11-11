import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { requestCode, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [mrn, setMrn] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestCode(tenantSlug, email, mrn);
      setStep('verify');
    } catch (err) {
      setError((err as ApiError).message || 'Could not request a code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyCode(tenantSlug, email, mrn, code);
      navigate('/');
    } catch (err) {
      setError((err as ApiError).message || 'That code didn\u2019t work — check and try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <h1 style={{ color: 'var(--paper-raised)', fontSize: 'var(--text-lg)' }}>Patient Portal</h1>
      </div>
      <div className="portal-content">
        {step === 'request' ? (
          <form onSubmit={handleRequest}>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 'var(--space-5)' }}>
              Enter your details on file and we'll send a one-time code.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Hospital</label>
              <input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="acme-hospital" required />
            </div>
            <div className="field">
              <label>Email on file</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Medical record number (MRN)</label>
              <input value={mrn} onChange={(e) => setMrn(e.target.value)} required />
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 'var(--space-5)' }}>
              If that matched a record on file, a 6-digit code was sent. Enter it below.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

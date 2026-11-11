import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LedgerSteps } from '../components/LedgerSteps';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { api, ApiError } from '../lib/api';

interface StaffDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const PROVIDERS_CACHE_KEY = 'cachedProviders';

export function AppointmentCreatePage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const navigate = useNavigate();
  const { submitOrQueue, isOnline } = useOfflineQueue();

  const [providers, setProviders] = useState<StaffDirectoryEntry[]>(() => {
    const cached = localStorage.getItem(PROVIDERS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  });
  const [providerId, setProviderId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<StaffDirectoryEntry[]>('/users?role=doctor')
      .then((result) => {
        setProviders(result);
        // Cached so the provider dropdown still works offline - this
        // is read-side caching (localStorage is fine for a small
        // list), separate from the write-queue (IndexedDB) used for
        // patients/appointments themselves.
        localStorage.setItem(PROVIDERS_CACHE_KEY, JSON.stringify(result));
      })
      .catch((err: ApiError) => {
        // A network failure here just means we keep showing whatever
        // was cached from last time (if anything) - not a hard error,
        // since offline scheduling should still work.
        if (!err.isNetworkError) setError(err.message);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError('No patient selected - go back to the patient record first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const provider = providers.find((p) => p.id === providerId);
      const { queued } = await submitOrQueue(
        'appointment',
        '/appointments',
        {
          patientId,
          providerId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          reason: reason || undefined,
        },
        `${provider ? `Dr. ${provider.firstName} ${provider.lastName}` : 'Appointment'} — ${new Date(scheduledAt).toLocaleString()}`,
      );
      navigate(queued ? '/patients' : `/patients/${patientId}`);
    } catch (err) {
      setError((err as ApiError).message || 'Could not schedule appointment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Schedule</div>
          <h1>New appointment</h1>
        </div>
      </div>

      <LedgerSteps current={1} />

      <form onSubmit={handleSubmit} className="ledger-card">
        <span className="ledger-card__tab">B &middot; VISIT</span>

        {error && <div className="error-banner">{error}</div>}
        {!patientId && (
          <div className="error-banner">No patient selected. Open a patient record and choose "Schedule visit" from there.</div>
        )}

        <div className="field">
          <label htmlFor="provider">Provider</label>
          <select id="provider" value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
            <option value="">Select a doctor…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                Dr. {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="scheduledAt">Date &amp; time</label>
          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="reason">Reason for visit</label>
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up consultation" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading || !patientId}>
          {loading ? 'Scheduling…' : 'Schedule appointment →'}
        </button>
        {!isOnline && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 'var(--space-2)' }}>
            You're offline — this will be queued and synced automatically once your connection returns.
          </p>
        )}
      </form>
    </div>
  );
}

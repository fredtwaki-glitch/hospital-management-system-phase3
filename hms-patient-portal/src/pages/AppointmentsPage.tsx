import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  reason?: string;
}

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Appointment[]>('/patient-portal/me/appointments')
      .then(setAppointments)
      .catch((err) => setError((err as ApiError).message));
  }, []);

  return (
    <div>
      <div className="eyebrow">Your record</div>
      <h1 style={{ marginBottom: 'var(--space-5)' }}>Visits</h1>

      {error && <div className="error-banner">{error}</div>}
      {appointments?.length === 0 && <div className="empty-state">No appointments on file yet.</div>}

      {appointments?.map((a) => (
        <div key={a.id} className="ledger-card">
          <span className="ledger-card__tab">VISIT</span>
          <span className={`ledger-card__stamp ledger-card__stamp--${a.status === 'completed' ? 'active' : a.status === 'cancelled' ? 'alert' : 'pending'}`}>
            {a.status.replace('_', ' ')}
          </span>
          <div style={{ fontWeight: 600 }}>{new Date(a.scheduledAt).toLocaleString()}</div>
          {a.reason && <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>{a.reason}</div>}
        </div>
      ))}
    </div>
  );
}

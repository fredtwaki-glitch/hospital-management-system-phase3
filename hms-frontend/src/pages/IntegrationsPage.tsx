import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';

interface FailedEvent {
  eventId: string;
  eventType: string;
  attemptCount: number;
  lastError: string | null;
  updatedAt: string;
}

interface EventStatus {
  counts: Record<'pending' | 'processing' | 'retry' | 'delivered' | 'failed', number>;
  recentFailures: FailedEvent[];
}

const ORDER: Array<keyof EventStatus['counts']> = ['pending', 'processing', 'retry', 'delivered', 'failed'];

/** Admin-only view of outbound event delivery (Payroll / Automation hand-off). */
export function IntegrationsPage() {
  const { staffUser } = useAuth();
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.get<EventStatus>('/integrations/events/status'));
    } catch (err) {
      setError(errorMessage(err, 'Could not load event delivery status'));
    }
  }, []);

  useEffect(() => {
    if (staffUser?.role !== 'admin') return;
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load, staffUser?.role]);

  async function replay(eventId: string) {
    setReplaying(eventId);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/integrations/events/${eventId}/replay`);
      setNotice('Event re-queued. It will be retried on the next dispatch cycle.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not replay event'));
    } finally {
      setReplaying(null);
    }
  }

  if (staffUser?.role !== 'admin') {
    return (
      <div>
        <div className="page-header"><div><div className="eyebrow">Integrations</div><h1>Event delivery</h1></div></div>
        <div className="error-banner">Only organization administrators can view integration status.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Integrations</div>
          <h1>Event delivery</h1>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="ledger-card" role="status"><span className="ledger-card__tab">OK</span>{notice}</div>}

      <div className="ledger-card">
        <span className="ledger-card__tab">OUTBOX</span>
        {!status ? (
          <p>Loading…</p>
        ) : (
          <div className="stat-row">
            {ORDER.map((key) => (
              <div className="stat" key={key}>
                <div className="stat__value">{status.counts[key]}</div>
                <div className="stat__label">{key}</div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 'var(--text-xs)', opacity: 0.75 }}>
          Events are delivered at least once to licensed Payroll / Automation webhooks. Failed events exhausted
          their retries and need operator review. Event contents are never shown here.
        </p>
      </div>

      <h2 style={{ marginTop: 'var(--space-6)' }}>Failed events</h2>
      {status && status.recentFailures.length === 0 ? (
        <div className="empty-state">No failed events.</div>
      ) : (
        <div className="ledger-card data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Event</th><th>Attempts</th><th>Last error</th><th>When</th><th /></tr>
            </thead>
            <tbody>
              {status?.recentFailures.map((event) => (
                <tr key={event.eventId}>
                  <td>
                    <div>{event.eventType}</div>
                    <div className="mono" style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{event.eventId}</div>
                  </td>
                  <td>{event.attemptCount}</td>
                  <td>{event.lastError ?? '—'}</td>
                  <td>{new Date(event.updatedAt).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => replay(event.eventId)} disabled={replaying === event.eventId}>
                      {replaying === event.eventId ? 'Queuing…' : 'Replay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { api, ApiError } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { Patient } from '../lib/types';

export function PatientsListPage() {
  const { pendingWrites } = useOfflineQueue();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    api
      .get<Patient[]>('/patients')
      .then((result) => {
        setPatients(result);
        setUsingCache(false);
        // Cache for offline search/browsing - see offlineDb.ts. This
        // is read-side caching; separate concern from the write queue.
        offlineDb.cachePatients(result);
      })
      .catch(async (err) => {
        const apiErr = err as ApiError;
        if (apiErr.isNetworkError) {
          const cached = await offlineDb.getCachedPatients<Patient>();
          setPatients(cached);
          setUsingCache(true);
        } else {
          setError(apiErr.message);
        }
      });
  }, []);

  const queuedPatients = pendingWrites.filter((w) => w.type === 'patient' && w.status === 'pending');

  const filtered = patients?.filter((p) => {
    const haystack = `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const filteredQueued = queuedPatients.filter((w) => w.displayLabel.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Register &middot; A</div>
          <h1>Patients</h1>
        </div>
        <Link to="/patients/new" className="btn btn-primary">
          + Register patient
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {usingCache && (
        <div className="error-banner" style={{ background: '#fbf3e6', borderColor: 'var(--marigold)', color: 'var(--ink)' }}>
          You're offline - showing the last synced patient list. New registrations below will appear once reconnected.
        </div>
      )}

      <div className="field" style={{ maxWidth: 320 }}>
        <input placeholder="Search by name or MRN…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!patients && !error && <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>}

      {filteredQueued.map((w) => (
        <div
          key={w.clientRequestId}
          className="patient-list-item"
          style={{ opacity: 0.7, cursor: 'default', borderStyle: 'dashed' }}
          title="Not yet synced - will become available once connectivity returns"
        >
          <span>{w.displayLabel}</span>
          <span className="mono" style={{ color: 'var(--marigold-dark)', fontSize: 'var(--text-xs)' }}>
            queued — not yet synced
          </span>
        </div>
      ))}

      {filtered && filtered.length === 0 && filteredQueued.length === 0 && (
        <div className="empty-state">
          {query ? 'No patients match that search.' : 'No patients registered yet. Register the first one to get started.'}
        </div>
      )}

      {filtered?.map((patient) => (
        <Link key={patient.id} to={`/patients/${patient.id}`} className="patient-list-item">
          <span>
            {patient.firstName} {patient.lastName}
          </span>
          <span className="mono" style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            {patient.mrn}
          </span>
        </Link>
      ))}
    </div>
  );
}

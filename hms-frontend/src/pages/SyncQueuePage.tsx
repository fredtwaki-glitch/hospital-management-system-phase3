import { LedgerCard } from '../components/LedgerCard';
import { useOfflineQueue } from '../context/OfflineQueueContext';

export function SyncQueuePage() {
  const { pendingWrites, isOnline, flushQueue, discardConflict } = useOfflineQueue();

  const pending = pendingWrites.filter((w) => w.status === 'pending');
  const conflicts = pendingWrites.filter((w) => w.status === 'conflict');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Offline queue</div>
          <h1>Sync status</h1>
        </div>
        {isOnline && pending.length > 0 && (
          <button className="btn btn-secondary" onClick={() => flushQueue()}>
            Retry now
          </button>
        )}
      </div>

      {!isOnline && (
        <div className="error-banner" style={{ background: '#fbf3e6', borderColor: 'var(--marigold)', color: 'var(--ink)' }}>
          You're offline. Anything queued below will sync automatically the moment your connection returns — no action
          needed unless something below is marked as needing attention.
        </div>
      )}

      {conflicts.length > 0 && (
        <>
          <h3 style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>Needs attention</h3>
          {conflicts.map((w) => (
            <LedgerCard key={w.clientRequestId} tabLabel={w.type === 'patient' ? 'A · PATIENT' : 'B · VISIT'} stampText="conflict" stampVariant="alert">
              <div style={{ fontWeight: 600 }}>{w.displayLabel}</div>
              <div style={{ color: 'var(--brick)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>{w.conflictMessage}</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <button className="btn btn-secondary" onClick={() => discardConflict(w.clientRequestId)}>
                  Discard — I'll re-enter it manually
                </button>
              </div>
            </LedgerCard>
          ))}
        </>
      )}

      {pending.length > 0 && (
        <>
          <h3 style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>Waiting to sync</h3>
          {pending.map((w) => (
            <LedgerCard key={w.clientRequestId} tabLabel={w.type === 'patient' ? 'A · PATIENT' : 'B · VISIT'} stampText="queued" stampVariant="pending">
              <div>{w.displayLabel}</div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                Queued {new Date(w.createdAt).toLocaleString()}
              </div>
            </LedgerCard>
          ))}
        </>
      )}

      {pending.length === 0 && conflicts.length === 0 && <div className="empty-state">Nothing queued — everything is synced.</div>}
    </div>
  );
}

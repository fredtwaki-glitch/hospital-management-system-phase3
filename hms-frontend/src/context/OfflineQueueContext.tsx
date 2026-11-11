import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { api, ApiError } from '../lib/api';
import { offlineDb, PendingWrite, PendingWriteType } from '../lib/offlineDb';

interface OfflineQueueContextValue {
  isOnline: boolean;
  pendingWrites: PendingWrite[];
  pendingCount: number;
  conflictCount: number;
  /**
   * Try the write live first. Only falls into the offline queue if the
   * request never reached the server at all (see api.ts's
   * isNetworkError distinction) - a real validation error or conflict
   * from the server is never queued, it's thrown straight back to the
   * caller to handle normally.
   */
  submitOrQueue: <T,>(
    type: PendingWriteType,
    path: string,
    payload: Record<string, unknown>,
    displayLabel: string,
  ) => Promise<{ queued: boolean; result?: T }>;
  flushQueue: () => Promise<void>;
  discardConflict: (clientRequestId: string) => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

const ENDPOINT_BY_TYPE: Record<PendingWriteType, string> = {
  patient: '/patients',
  appointment: '/appointments',
};

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    setPendingWrites(await offlineDb.getPendingWrites());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flushQueue = useCallback(async () => {
    if (flushing) return; // avoid overlapping flush attempts (e.g. reconnect firing twice)
    setFlushing(true);
    try {
      const writes = await offlineDb.getPendingWrites();
      for (const write of writes.filter((w) => w.status === 'pending')) {
        try {
          await api.post(ENDPOINT_BY_TYPE[write.type], write.payload);
          // Success (or an idempotent replay returning the original
          // record - see backend PatientsService/AppointmentsService)
          // both mean this queue entry is done.
          await offlineDb.deletePendingWrite(write.clientRequestId);
        } catch (err) {
          const apiErr = err as ApiError;
          if (apiErr.isNetworkError) {
            // Still offline (or dropped again mid-flush) - stop this
            // pass entirely rather than mark this or later items as
            // conflicts; they're not conflicts, connectivity just isn't
            // back yet. Will retry on the next reconnect/interval.
            break;
          }
          // A real server response rejecting this specific write (e.g.
          // the MRN-conflict 409 from two offline devices) - this is
          // the case that genuinely needs a human, so it moves out of
          // "will auto-retry" into "needs attention" rather than
          // looping forever on something retrying can't fix.
          await offlineDb.markConflict(write.clientRequestId, apiErr.message);
        }
      }
    } finally {
      setFlushing(false);
      await refresh();
    }
  }, [flushing, refresh]);

  // Auto-flush on reconnect, plus a periodic safety-net retry in case
  // the 'online' event doesn't fire reliably on every device/browser.
  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
    const interval = setInterval(() => {
      if (navigator.onLine) flushQueue();
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const submitOrQueue = useCallback(
    async <T,>(type: PendingWriteType, path: string, payload: Record<string, unknown>, displayLabel: string) => {
      const clientRequestId = crypto.randomUUID();
      const payloadWithKey = { ...payload, clientRequestId };

      try {
        const result = await api.post<T>(path, payloadWithKey);
        return { queued: false, result };
      } catch (err) {
        const apiErr = err as ApiError;
        if (!apiErr.isNetworkError) {
          // A real rejection (validation, business rule) - the calling
          // form should show this to the user immediately, not queue
          // something the server has already said no to.
          throw err;
        }
        await offlineDb.savePendingWrite({
          clientRequestId,
          type,
          payload: payloadWithKey,
          createdAt: new Date().toISOString(),
          status: 'pending',
          displayLabel,
        });
        await refresh();
        return { queued: true };
      }
    },
    [refresh],
  );

  const discardConflict = useCallback(
    async (clientRequestId: string) => {
      await offlineDb.deletePendingWrite(clientRequestId);
      await refresh();
    },
    [refresh],
  );

  const conflictCount = pendingWrites.filter((w) => w.status === 'conflict').length;
  const pendingCount = pendingWrites.filter((w) => w.status === 'pending').length;

  return (
    <OfflineQueueContext.Provider
      value={{ isOnline, pendingWrites, pendingCount, conflictCount, submitOrQueue, flushQueue, discardConflict }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return ctx;
}

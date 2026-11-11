const DB_NAME = 'hms-offline';
const DB_VERSION = 1;

export const STORES = {
  pendingWrites: 'pendingWrites',
  patientsCache: 'patientsCache',
} as const;

export type PendingWriteType = 'patient' | 'appointment';
export type PendingWriteStatus = 'pending' | 'conflict';

export interface PendingWrite {
  clientRequestId: string; // also the IndexedDB key
  type: PendingWriteType;
  payload: Record<string, unknown>;
  createdAt: string;
  status: PendingWriteStatus;
  conflictMessage?: string;
  // For appointments, staff need to see which patient this is for even
  // while the patient itself might also still be an unsynced queue
  // entry (e.g. "register patient then immediately schedule a visit,
  // both offline") - see PatientRegisterPage for how this gets threaded
  // through.
  displayLabel: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.pendingWrites)) {
        db.createObjectStore(STORES.pendingWrites, { keyPath: 'clientRequestId' });
      }
      if (!db.objectStoreNames.contains(STORES.patientsCache)) {
        db.createObjectStore(STORES.patientsCache, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export const offlineDb = {
  async savePendingWrite(write: PendingWrite): Promise<void> {
    await withStore(STORES.pendingWrites, 'readwrite', (store) => store.put(write));
  },
  async getPendingWrites(): Promise<PendingWrite[]> {
    return getAll<PendingWrite>(STORES.pendingWrites);
  },
  async deletePendingWrite(clientRequestId: string): Promise<void> {
    await withStore(STORES.pendingWrites, 'readwrite', (store) => store.delete(clientRequestId));
  },
  async markConflict(clientRequestId: string, message: string): Promise<void> {
    const writes = await getAll<PendingWrite>(STORES.pendingWrites);
    const match = writes.find((w) => w.clientRequestId === clientRequestId);
    if (match) {
      await withStore(STORES.pendingWrites, 'readwrite', (store) =>
        store.put({ ...match, status: 'conflict', conflictMessage: message }),
      );
    }
  },

  async cachePatients(patients: { id: string }[]): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORES.patientsCache, 'readwrite');
    const store = tx.objectStore(STORES.patientsCache);
    store.clear();
    patients.forEach((p) => store.put(p));
  },
  async getCachedPatients<T>(): Promise<T[]> {
    return getAll<T>(STORES.patientsCache);
  },
};

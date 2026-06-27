// Landauer Memory Principle (LMP) storage controller
// Audio blobs → IndexedDB (cold sump). Metadata only → localStorage.

export const LMP_DB_NAME   = 'ExergyNet_LMP_Sump';
export const LMP_STORE     = 'audio_blobs';

export function initLMPDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LMP_DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(LMP_STORE)) {
        db.createObjectStore(LMP_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function sinkAudioToColdSump(id: string, dataUrl: string): Promise<void> {
  const db = await initLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LMP_STORE, 'readwrite');
    tx.objectStore(LMP_STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function rehydrateAudioFromColdSump(id: string): Promise<string | null> {
  const db = await initLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(LMP_STORE, 'readonly');
    const req = tx.objectStore(LMP_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function obliterateAudioFromColdSump(id: string): Promise<void> {
  const db = await initLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LMP_STORE, 'readwrite');
    tx.objectStore(LMP_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function obliterateAllFromColdSump(): Promise<void> {
  const db = await initLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LMP_STORE, 'readwrite');
    tx.objectStore(LMP_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

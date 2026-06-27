export const xLMP_DB_NAME = 'ExergyNet_xLMP_Storage';
export const xLMP_STORE_NAME = 'audio_blobs';

// Initialize xLMP controller
export const initxLMPDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(xLMP_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(xLMP_STORE_NAME)) {
        db.createObjectStore(xLMP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// xLMP_Compress: write audio blob to xLMP_Storage
export const xLMP_Compress = async (id: string, base64Audio: string): Promise<void> => {
  const db = await initxLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(xLMP_STORE_NAME, 'readwrite');
    const store = tx.objectStore(xLMP_STORE_NAME);
    store.put(base64Audio, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// xLMP_Rehydrate: read audio blob from xLMP_Storage
export const xLMP_Rehydrate = async (id: string): Promise<string | null> => {
  const db = await initxLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(xLMP_STORE_NAME, 'readonly');
    const store = tx.objectStore(xLMP_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
};

// Obliterate entry from xLMP_Storage
export const xLMP_Obliterate = async (id: string): Promise<void> => {
  const db = await initxLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(xLMP_STORE_NAME, 'readwrite');
    const store = tx.objectStore(xLMP_STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Obliterate all entries from xLMP_Storage
export const xLMP_ObliterateAll = async (): Promise<void> => {
  const db = await initxLMPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(xLMP_STORE_NAME, 'readwrite');
    tx.objectStore(xLMP_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

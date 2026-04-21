
const DB_NAME = 'BrookspeedImageDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

import { storage } from '../core/config/firebaseConfig';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  
  // 1. Save to Local IndexedDB
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, dataUrl });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. Upload to Firebase Storage (Cloud Sync)
  try {
    const storageRef = ref(storage, `vehicle-media/${id}`);
    await uploadString(storageRef, dataUrl, 'data_url');
    console.log(`[STORAGE] Uploaded ${id} to cloud.`);
  } catch (error) {
    console.warn(`[STORAGE] Cloud upload failed for ${id}, kept in local cache only.`, error);
  }
}

export async function getImage(id: string): Promise<string | undefined> {
  const db = await openDB();
  
  // 1. Try Local IndexedDB first
  const localData = await new Promise<string | undefined>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.dataUrl);
    request.onerror = () => resolve(undefined);
  });

  if (localData) return localData;

  // 2. Fallback to Firebase Storage
  try {
    console.log(`[STORAGE] ${id} not in local cache, fetching from cloud...`);
    const storageRef = ref(storage, `vehicle-media/${id}`);
    const url = await getDownloadURL(storageRef);
    
    // Optional: Cache it locally once fetched
    if (url) {
        // Note: fetch the actual blob/dataUrl if we want to store it in IDB
        // For now, just returning the URL is enough for <img> tags
        return url;
    }
  } catch (error) {
    console.warn(`[STORAGE] ${id} not found in cloud.`, error);
  }

  return undefined;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error deleting image:', request.error);
      reject('Could not delete image from IndexedDB.');
    };
  });
}

export async function clearImageStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error clearing image store:', request.error);
      reject('Could not clear image store.');
    };
  });
}

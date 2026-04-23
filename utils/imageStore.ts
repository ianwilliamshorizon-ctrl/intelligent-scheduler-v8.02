
const DB_NAME = 'BrookspeedImageDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

import { storage } from '../core/config/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

/**
 * Saves an image, video or document to both local IndexedDB and Firebase Storage.
 * Accepts either a Base64 string (dataUrl) or a File/Blob object.
 */
export async function saveFile(id: string, data: string | File | Blob): Promise<void> {
  const db = await openDB();
  
  // Convert Base64 to Blob if necessary for more efficient storage/upload
  let blob: Blob;
  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const response = await fetch(data);
      blob = await response.blob();
    } else {
      blob = new Blob([data], { type: 'text/plain' });
    }
  } else {
    blob = data;
  }

  // 1. Save to Local IndexedDB (Store as Blob for efficiency)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, data: blob, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. Upload to Firebase Storage (Cloud Sync) - PERFORM IN BACKGROUND
  // We do NOT await this so the UI can close immediately as requested.
  const uploadToCloud = async () => {
    try {
      const storageRef = ref(storage, `vehicle-media/${id}`);
      const metadata = {
        contentType: blob.type || (id.toLowerCase().includes('video') ? 'video/mp4' : 'image/jpeg')
      };
      await uploadBytes(storageRef, blob, metadata);
      console.log(`[STORAGE] Background upload complete for ${id}.`);
    } catch (error) {
      console.warn(`[STORAGE] Background cloud upload failed for ${id}.`, error);
    }
  };

  uploadToCloud(); // Start background upload
}

export const saveImage = saveFile;

export async function getFile(id: string): Promise<string | undefined> {
  const db = await openDB();
  
  // 1. Try Local IndexedDB first
  const localResult = await new Promise<any | undefined>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });

  if (localResult) {
    // If it's a Blob, create an Object URL
    if (localResult.data instanceof Blob) {
      return URL.createObjectURL(localResult.data);
    }
    // Backward compatibility for old Base64 data
    return localResult.dataUrl || localResult.data;
  }

  // 2. Fallback to Firebase Storage
  try {
    console.log(`[STORAGE] ${id} not in local cache, fetching from cloud...`);
    const storageRef = ref(storage, `vehicle-media/${id}`);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    // console.warn(`[STORAGE] ${id} not found in cloud.`, error);
  }

  return undefined;
}

export const getImage = getFile;

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

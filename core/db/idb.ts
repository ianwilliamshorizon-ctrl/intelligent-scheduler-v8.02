import { get, set, del, clear, keys } from 'idb-keyval';

const DB_NAME = 'BrookspeedDataCache';
const STORE_NAME = 'keyval';

// The idb-keyval library handles DB and store creation automatically.

export const idbGet = async <T>(key: string): Promise<T | undefined> => {
    try {
        return await get(key);
    } catch (error) {
        console.error(`IndexedDB get error for key \"${key}\":`, error);
        return undefined;
    }
};

export const idbSet = async (key: string, value: any): Promise<void> => {
    try {
        await set(key, value);
    } catch (error) {
        console.error(`IndexedDB set error for key \"${key}\":`, error);
        // Optionally, handle quota exceeded errors here, e.g., by cleaning up old data.
    }
};

export const idbDel = async (key: string): Promise<void> => {
    try {
        await del(key);
    } catch (error) {
        console.error(`IndexedDB del error for key \"${key}\":`, error);
    }
};

export const idbClear = async (): Promise<void> => {
    try {
        await clear();
    } catch (error) {
        console.error('IndexedDB clear error:', error);
    }
};

export const idbKeys = async (): Promise<IDBValidKey[]> => {
    try {
        return await keys();
    } catch (error) {
        console.error('IndexedDB keys error:', error);
        return [];
    }
};

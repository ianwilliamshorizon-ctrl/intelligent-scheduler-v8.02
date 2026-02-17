export * from '../../types';

import { 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    collection, 
    getDocs,
    onSnapshot, 
    runTransaction,
    query, 
    WithFieldValue
} from 'firebase/firestore';

// We import the single source of truth for 'auth' and 'db' 
// which is now correctly configured to use (default)
import { auth, db } from '../config/firebaseConfig';

/**
 * COLLECTION NAMES
 */
export const COLLECTIONS = {
    PACKAGES: 'brooks_servicePackages',
    SETTINGS: 'brooks_settings',
    COUNTERS: 'brooks_counters'
};

/**
 * STORAGE TYPE HELPERS
 */
export const getStorageType = () => 'firestore';
export const getStorageTypeString = () => 'firestore';

/**
 * DATA CLEANING
 * Ensures undefined values don't crash Firestore
 */
const cleanDataForFirestore = (data: any) => {
    return JSON.parse(JSON.stringify(data, (key, value) => 
        value === undefined ? null : value
    ));
};

/**
 * REAL-TIME SUBSCRIPTION
 */
export const subscribeToCollection = <T>(
    collectionName: string, 
    callback: (data: T[]) => void
): () => void => {
    if (!db) return () => {};
    const q = query(collection(db, collectionName));
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.docs.length === 0) return; 

        const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as unknown as T[];
        
        // Alphabetical sorting logic from your original file
        const sortedItems = items.sort((a: any, b: any) => {
            const valA = (a.name || a.label || a.id || '').toLowerCase();
            const valB = (b.name || b.label || b.id || '').toLowerCase();
            return valA.localeCompare(valB);
        });
        
        callback(sortedItems);
    }, (error) => {
        console.error(`[Firestore Subscription Error] ${collectionName}:`, error);
    });
};

/**
 * FETCH ALL DOCUMENTS
 */
export const getAll = async <T>(collectionName: string): Promise<T[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];
    } catch (err) {
        console.error(`[Firestore getAll Error] ${collectionName}:`, err);
        return [];
    }
};

/**
 * SAVE/UPDATE DOCUMENT
 */
export const saveDocument = async <T extends { id: string }> (
    collectionName: string, 
    data: WithFieldValue<T>
): Promise<void> => {
    if (!db) return;
    const docId = String(data.id);
    const docRef = doc(db, collectionName, docId);
    try {
        const cleaned = cleanDataForFirestore(data);
        await setDoc(docRef, cleaned, { merge: true });
        console.log(`✅ [DB] Document Saved: ${collectionName}/${docId}`);
    } catch (err) {
        console.error(`❌ [DB] Save Failed: ${docId}`, err);
        throw err;
    }
};

/**
 * DELETE DOCUMENT
 */
export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, collectionName, docId));
        console.log(`🗑️ [DB] Document Deleted: ${docId}`);
    } catch (err) {
        console.error(`❌ [DB] Delete Failed: ${docId}`, err);
    }
};

/**
 * SEQUENCE GENERATOR (TRANSACTIONAL)
 * Used for Job IDs and other incrementing numbers
 */
export const generateSequenceId = async (prefix: string, entityShortCode: string): Promise<string> => {
    if (!db) return `${entityShortCode}${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    const counterRef = doc(db, COLLECTIONS.COUNTERS, `${entityShortCode}_${prefix}`);
    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentCount = counterDoc.exists() ? (counterDoc.data() as any).count || 0 : 0;
            const nextCount = currentCount + 1;
            transaction.set(counterRef, { count: nextCount }, { merge: true });
            return nextCount;
        });
        return `${entityShortCode}${prefix}${String(newId).padStart(6, '0')}`;
    } catch (e) {
        console.error("Sequence Error:", e);
        // Fallback to random ID if transaction fails
        return `${entityShortCode}${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    }
};

/**
 * SIMPLE KEY/VALUE STORAGE (SETTINGS)
 */
export const setItem = async (key: string, value: any) => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.SETTINGS, key);
    const cleanValue = cleanDataForFirestore(value);
    const payload = (typeof cleanValue !== 'object' || Array.isArray(cleanValue)) 
        ? { value: cleanValue } : cleanValue;
    await setDoc(docRef, payload, { merge: true });
};

/**
 * GET SETTING
 */
export const getItem = async <T>(key: string): Promise<T | null> => {
    if (!db) return null;
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, key));
        if (snap.exists()) {
            const data = snap.data();
            return (data.value !== undefined ? data.value : data) as T;
        }
    } catch (err) {
        console.error(`[DB getItem Error] ${key}:`, err);
    }
    return null;
};

/**
 * CLEAR STORE
 */
export const clearStore = async () => {
    console.warn("Manual clear required in Firebase Console for Firestore storage.");
};

// Re-exporting auth and db to maintain compatibility with other files
export { auth, db };
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs,
    onSnapshot, Firestore, runTransaction,
    query, WithFieldValue,
    initializeFirestore,
    CACHE_SIZE_UNLIMITED,
    persistentLocalCache
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from '../config/firebaseConfig';

const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let db: Firestore;
let auth: Auth | undefined;

/**
 * ENVIRONMENT-BASED DATABASE SELECTOR
 * Development/Workstations -> 'isdevdb'
 * UAT/Production -> '(default)' 
 */
const getDatabaseId = () => {
    const mode = import.meta.env.MODE; // 'development', 'production', or 'uat'
    
    switch (mode) {
        case 'development':
            return 'isdevdb';
        case 'uat':
            return '(default)'; // or 'isuatdb' if you have one
        case 'production':
            return '(default)';
        default:
            return 'isdevdb';
    }
};

const DATABASE_ID = getDatabaseId();

export const COLLECTIONS = {
    PACKAGES: 'brooks_servicePackages',
    SETTINGS: 'brooks_settings',
    COUNTERS: 'brooks_counters'
};

if (isFirebaseConfigured) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    try {
        // WORKSTATION OPTIMIZED INITIALIZATION
        db = initializeFirestore(app, {
            experimentalForceLongPolling: true,
            localCache: persistentLocalCache({
                cacheSizeBytes: CACHE_SIZE_UNLIMITED
            })
        }, DATABASE_ID);
        
        console.log(`🔥 [DB] Firestore Initialized in [${import.meta.env.MODE}] mode.`);
        console.log(`🎯 Targeting Database: [${DATABASE_ID}]`);
        
        // Expose to window for debugging
        (window as any).db = db;
        
    } catch (e) {
        db = getFirestore(app, DATABASE_ID);
        console.warn(`⚠️ [DB] Standard fallback used for [${DATABASE_ID}].`);
    }

    auth = getAuth(app);
} else {
    console.error("❌ [DB] Firebase is NOT configured. Check your firebaseConfig.ts");
}

export const getStorageType = () => isFirebaseConfigured ? 'firestore' : 'memory';
export const getStorageTypeString = () => getStorageType();

const cleanDataForFirestore = (data: any) => {
    return JSON.parse(JSON.stringify(data, (key, value) => 
        value === undefined ? null : value
    ));
};

export const subscribeToCollection = <T>(
    collectionName: string, 
    callback: (data: T[]) => void
): () => void => {
    if (!db) return () => {};

    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.docs.length === 0) return; 

        const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as unknown as T[];
        
        const sortedItems = items.sort((a: any, b: any) => {
            const valA = (a.name || a.label || a.id || '').toLowerCase();
            const valB = (b.name || b.label || b.id || '').toLowerCase();
            return valA.localeCompare(valB);
        });
        
        callback(sortedItems);
    }, (error) => {
        console.error(`[Firestore Subscription Error] ${collectionName}:`, error);
    });

    return unsubscribe;
};

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

export const saveDocument = async <T extends { id: string }>(
    collectionName: string, 
    data: WithFieldValue<T>
): Promise<void> => {
    if (!db) return;
    
    const docId = String(data.id);
    const docRef = doc(db, collectionName, docId);
    
    try {
        const cleaned = cleanDataForFirestore(data);
        await setDoc(docRef, cleaned, { merge: true });
        console.log(`✅ [DB] Document Saved to ${DATABASE_ID}: ${collectionName}/${docId}`);
    } catch (err) {
        console.error(`❌ [DB] Save Failed: ${docId}`, err);
        throw err;
    }
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, collectionName, docId));
        console.log(`🗑️ [DB] Document Deleted: ${docId}`);
    } catch (err) {
        console.error(`❌ [DB] Delete Failed: ${docId}`, err);
    }
};

export const generateSequenceId = async (prefix: string, entityShortCode: string): Promise<string> => {
    if (!db) return `${entityShortCode}${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    const counterRef = doc(db, COLLECTIONS.COUNTERS, `${entityShortCode}_${prefix}`);
    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentCount = 0;
            if (counterDoc.exists()) currentCount = counterDoc.data().count || 0;
            const nextCount = currentCount + 1;
            transaction.set(counterRef, { count: nextCount }, { merge: true });
            return nextCount;
        });
        return `${entityShortCode}${prefix}${String(newId).padStart(6, '0')}`;
    } catch (e) {
        return `${entityShortCode}${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    }
};

export const setItem = async (key: string, value: any) => {
    if (!db) return;
    const docRef = doc(db, COLLECTIONS.SETTINGS, key);
    const cleanValue = cleanDataForFirestore(value);
    const payload = (typeof cleanValue !== 'object' || Array.isArray(cleanValue)) 
        ? { value: cleanValue } : cleanValue;
    await setDoc(docRef, payload, { merge: true });
};

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

export const clearStore = async () => {
    console.warn("Manual clear required in Firebase Console for Firestore.");
};

export { auth, db };
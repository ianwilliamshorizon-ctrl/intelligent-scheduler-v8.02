import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, 
    onSnapshot, Firestore, runTransaction,
    query, WithFieldValue, getDocs,
    where, orderBy, limit
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig, currentEnvironment } from '../config/firebaseConfig';

// 1. Initialize the Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Database Routing Logic
const targetDbId = currentEnvironment === 'Development' ? 'isdevdb' : undefined;

// 3. Exports
export const db: Firestore = getFirestore(app, targetDbId);
export const auth: Auth = getAuth(app);

// --- THE TRACE ---
console.log("-----------------------------------------");
console.log("🛠️ FIREBASE CONNECTION TRACE");
console.log(`📍 Environment: ${currentEnvironment}`);
console.log(`🗄️ Target Database: ${targetDbId || '(default)'}`);
// @ts-ignore
const activePath = db?._databaseId?.database || 'default';
console.log(`✅ Active Path: ${activePath}`);
console.log("-----------------------------------------");

export const getStorageType = (): 'memory' | 'firestore' => {
    return (firebaseConfig.apiKey && firebaseConfig.projectId) ? 'firestore' : 'memory';
};

// --- Standard Helper Functions ---

/**
 * Global Fetch: Retrieves all documents from a collection.
 * Essential for Service Packages and Tax Rates.
 */
export const getAllDocuments = async <T>(collectionName: string): Promise<T[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];
    } catch (e) {
        console.error(`Error in getAllDocuments for ${collectionName}:`, e);
        return [];
    }
};

export const getAll = async <T>(collectionName: string): Promise<T[]> => {
    return getAllDocuments<T>(collectionName);
};

export const getById = async <T>(collectionName: string, id: string): Promise<T | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { ...docSnap.data(), id: docSnap.id } as T;
        }
    } catch (e) {
        console.error(`Error fetching doc ${id} from ${collectionName}:`, e);
    }
    return null;
};

export const subscribeToCollection = <T>(
    collectionName: string, 
    callback: (data: T[]) => void
): () => void => {
    if (!db) return () => {};
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as unknown as T[];
        callback(items);
    }, (error) => {
        console.error(`Error listening to ${collectionName}:`, error);
    });
};

export const saveDocument = async <T extends { id: string }>(
    collectionName: string, 
    data: WithFieldValue<T>,
    customId?: string
): Promise<void> => {
    if (!db) return;
    const docId = customId || (data as any).id;
    if (!docId) throw new Error("A valid Document ID is required");

    const docRef = doc(db, collectionName, docId);
    const dataWithId = { ...data, id: docId };
    const cleanData = JSON.parse(JSON.stringify(dataWithId));

    await setDoc(docRef, cleanData, { merge: true });
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, collectionName, docId));
};

// --- Settings Helpers ---

export const setItem = async (key: string, value: any) => {
    if (!db) return;
    try {
        const docRef = doc(db, 'brooks_settings', key);
        const payload = (typeof value !== 'object' || Array.isArray(value)) ? { value } : value;
        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.error("Error setting item:", e);
    }
};

export const getItem = async <T>(key: string): Promise<T | null> => {
    if (!db) return null;
    try {
        const snap = await getDoc(doc(db, 'brooks_settings', key));
        if (snap.exists()) {
            const data = snap.data();
            return (data.value !== undefined ? data.value : data) as T;
        }
    } catch (e) {
        console.error("Error getting item:", e);
    }
    return null;
};

export const generateSequenceId = async (prefix: string, entityShortCode: string): Promise<string> => {
    if (!db) return `${entityShortCode}${prefix}${Date.now()}`; 
    const counterRef = doc(db, 'brooks_counters', `${entityShortCode}_${prefix}`);
    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentCount = 0;
            if (counterDoc.exists()) {
                currentCount = counterDoc.data().count || 0;
            }
            const nextCount = currentCount + 1;
            transaction.set(counterRef, { count: nextCount }, { merge: true });
            return nextCount;
        });
        return `${entityShortCode}${prefix}${String(newId).padStart(5, '0')}`;
    } catch (e) {
        console.error("Transaction failed: ", e);
        return `${entityShortCode}${prefix}${Date.now().toString().slice(-5)}`;
    }
};

// --- Advanced Query Helpers ---

export const getWhere = async <T>(collectionName: string, field: string, operator: any, value: any): Promise<T[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, collectionName), where(field, operator, value));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];
    } catch (e) {
        console.error(`Error in getWhere for ${collectionName}:`, e);
        return [];
    }
};

export const getByIds = async <T>(collectionName: string, ids: string[]): Promise<T[]> => {
    if (!db || ids.length === 0) return [];
    try {
        const results: T[] = [];
        for (let i = 0; i < ids.length; i += 30) {
            const batchIds = ids.slice(i, i + 30);
            const q = query(collection(db, collectionName), where('id', 'in', batchIds));
            const snapshot = await getDocs(q);
            results.push(...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T)));
        }
        return results;
    } catch (e) {
        console.error(`Error in getByIds for ${collectionName}:`, e);
        return [];
    }
};

/**
 * Global Search: For "Cold Data" lookup (Parts/Customers).
 * Note: Firestore is case-sensitive. The UI must pass the correct casing.
 */
export const searchDocuments = async <T>(
    collectionName: string, 
    searchField: string, 
    searchTerm: string, 
    maxResults = 20
): Promise<T[]> => {
    if (!db || !searchTerm) return [];
    try {
        const term = searchTerm.trim();
        const q = query(
            collection(db, collectionName),
            orderBy(searchField),
            where(searchField, '>=', term),
            where(searchField, '<=', term + '\uf8ff'),
            limit(maxResults)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    } catch (e) {
        console.error(`Error searching ${collectionName}:`, e);
        return [];
    }
};

export const clearStore = async () => {
    console.warn("clearStore is not fully implemented for Firestore.");
};
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, 
    onSnapshot, Firestore, runTransaction,
    query, WithFieldValue, getDocs
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig, currentEnvironment } from '../config/firebaseConfig';

// 1. Initialize the Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Database Routing Logic
// We point to 'isdevdb' only if the environment is strictly 'Development'
const targetDbId = currentEnvironment === 'Development' ? 'isdevdb' : undefined;

// 3. Immediate Export (Ensures Sidebar stability)
export const db: Firestore = getFirestore(app, targetDbId);
export const auth: Auth = getAuth(app);

// --- THE TRACE (Check your browser console F12) ---
console.log("-----------------------------------------");
console.log("🛠️ FIREBASE CONNECTION TRACE");
console.log(`📍 Environment: ${currentEnvironment}`);
console.log(`🗄️ Target Database ID: ${targetDbId || '(default)'}`);
console.log(`🆔 Project ID: ${firebaseConfig.projectId}`);
// Access internal property to confirm actual connection path
// @ts-ignore
const activePath = db?._databaseId?.database || 'default';
console.log(`✅ Active Database: ${activePath}`);
console.log("-----------------------------------------");

export const getStorageType = (): 'memory' | 'firestore' => {
    return (firebaseConfig.apiKey && firebaseConfig.projectId) ? 'firestore' : 'memory';
};

// --- Standard Helper Functions ---

export const getAll = async <T>(collectionName: string): Promise<T[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];
        console.log(`[Trace] Fetched ${items.length} items from ${collectionName}`);
        return items;
    } catch (e) {
        console.error(`Error fetching collection ${collectionName}:`, e);
        return [];
    }
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
    data: WithFieldValue<T>
): Promise<void> => {
    if (!db) return;
    const docId = (data as any).id;
    if (!docId || typeof docId !== 'string') {
        throw new Error("A valid string Document ID is required for saveDocument");
    }
    const docRef = doc(db, collectionName, docId);
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, collectionName, docId));
};

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

export const clearStore = async () => {
    console.warn("clearStore is not fully implemented for Firestore.");
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

import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, 
    onSnapshot, Firestore, connectFirestoreEmulator, runTransaction,
    query, orderBy, DocumentData, WithFieldValue
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { firebaseConfig, isDev } from '../config/firebaseConfig';

// --- Configuration ---
const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let db: Firestore;
let auth: Auth | undefined;

if (isFirebaseConfigured) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // NOTE: Emulator connection is disabled by default to allow direct Cloud Firestore connection 
    // without starting a local service. Uncomment if you wish to use 'firebase emulators:start'.
    /*
    if (isDev()) {
        try {
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectAuthEmulator(auth, 'http://localhost:9099');
            console.log("🔥 Connected to Firebase Emulators");
        } catch (e) {
            console.warn("Firebase emulator connection failed (might already be connected):", e);
        }
    } else {
        console.log("☁️ Connected to Cloud Firestore");
    }
    */
    console.log("☁️ Connected to Cloud Firestore");
}

export const getStorageType = (): 'memory' | 'firestore' | 'emulator' => {
    if (!isFirebaseConfigured) return 'memory';
    return 'firestore';
};

export const getStorageTypeString = () => {
    if (!isFirebaseConfigured) return 'memory';
    return 'firestore';
};

// --- Real-Time Listeners ---
export const subscribeToCollection = <T>(
    collectionName: string, 
    callback: (data: T[]) => void
): () => void => {
    if (!db) return () => {};

    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as unknown as T[];
        
        callback(items);
    }, (error) => {
        console.error(`Error listening to ${collectionName}:`, error);
    });

    return unsubscribe;
};

// --- CRUD Operations ---

/**
 * Saves a document. Using setDoc with merge:true acts as an Upsert.
 */
export const saveDocument = async <T extends { id: string }>(
    collectionName: string, 
    data:WithFieldValue<T>
): Promise<void> => {
    if (!db) {
        console.warn("Firestore not configured, saveDocument ignored.");
        return;
    }
    // @ts-ignore
    if (!data.id) throw new Error("Document ID is required for saveDocument");
    
    // @ts-ignore
    const docRef = doc(db, collectionName, data.id);
    
    // Deep clone to remove potential undefined values which Firestore dislikes
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
};

export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, collectionName, docId));
};

// --- Concurrency Safe ID Generation ---

/**
 * Generates a unique, sequential ID using Firestore Transactions.
 */
export const generateSequenceId = async (prefix: string, entityShortCode: string): Promise<string> => {
    if (!db) return `${entityShortCode}${prefix}${Date.now()}`; // Fallback

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
        throw e;
    }
};

// --- Legacy Compatibility ---
export const setItem = async (key: string, value: any) => {
    if (!db) return;
    try {
        if (typeof value !== 'object' || Array.isArray(value)) {
            await setDoc(doc(db, 'brooks_settings', key), { value });
        } else {
             await setDoc(doc(db, 'brooks_settings', key), value);
        }
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
    console.warn("clearStore is not fully implemented for Firestore. Use Firebase Console to clear data.");
};

export { auth, db };

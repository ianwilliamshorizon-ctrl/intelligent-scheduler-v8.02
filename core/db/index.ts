import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, 
    onSnapshot, Firestore, runTransaction,
    query, WithFieldValue, writeBatch, getDocs, orderBy, limit,
    clearIndexedDbPersistence, terminate
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Paths aligned with your methodical structure
import { firebaseConfig } from '../config/firebaseConfig';
import * as initialData from '../../data/initialData';

// --- Configuration & Initialization ---
const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
const isDevelopment = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

let db: Firestore;
let auth: Auth | undefined;

if (isFirebaseConfigured) {
    try {
        const app = initializeApp(firebaseConfig);
        // TARGETING ISDEVDB
        db = getFirestore(app, "isdevdb"); 
        auth = getAuth(app);
        console.log("✅ Firebase Configured for Database: isdevdb");
    } catch (error) {
        console.error("❌ Firebase Init Error:", error);
    }
}

// --- Environment Helpers ---

export const getStorageType = () => {
    if (!isFirebaseConfigured) return 'none';
    return isDevelopment() ? 'development_firestore' : 'cloud_firestore';
};

export const clearStore = async () => {
    if (!db) return;
    try {
        await terminate(db); 
        await clearIndexedDbPersistence(db);
        console.log("📦 Cache cleared. Reloading...");
        window.location.reload(); 
    } catch (err) {
        console.error("Error clearing store:", err);
    }
};

// --- CRUD Operations ---

export const setItem = async (collectionName: string, data: any) => {
    if (!db) return;
    const docId = data.id || crypto.randomUUID();
    const docRef = doc(collection(db, collectionName), docId);
    await setDoc(docRef, { ...data, id: docId }, { merge: true });
};

export const saveDocument = setItem;
export const updateDocument = setItem;

export const deleteItem = async (collectionName: string, id: string) => {
    if (!db) return;
    const docRef = doc(collection(db, collectionName), id);
    await deleteDoc(docRef);
};

export const deleteDocument = deleteItem;

// --- Specialized Sequence Logic ---

export const generateSequenceId = async (collectionName: string, prefix: string, startNumber: number = 1000): Promise<string> => {
    if (!db) return `${prefix}-${startNumber}`;
    try {
        const q = query(collection(db, collectionName));
        const querySnapshot = await getDocs(q);
        let maxNumber = startNumber;
        querySnapshot.forEach((doc) => {
            const id = doc.id;
            if (id.startsWith(prefix)) {
                const parts = id.split('-');
                if (parts.length > 1) {
                    const numPart = parseInt(parts[1]);
                    if (!isNaN(numPart) && numPart > maxNumber) maxNumber = numPart;
                }
            }
        });
        return `${prefix}-${maxNumber + 1}`;
    } catch (error) {
        console.error("Error generating ID:", error);
        return `${prefix}-${Date.now()}`;
    }
};

// --- Real-time Sync ---

export const subscribeToCollection = (collectionName: string, setter: (data: any[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
        }));
        console.log(`📥 [isdevdb] Received ${data.length} records for ${collectionName}`);
        setter(data);
    }, (error) => {
        console.error(`❌ Sync error [${collectionName}]:`, error);
    });
};

// --- Hydration (The Master Reset) ---

export const hydrateDatabase = async () => {
    if (!db) {
        alert("Firestore is not configured.");
        return;
    }

    console.log("🚀 Starting database hydration into isdevdb...");
    
    // 1. Fetch the raw user data
    const initialUsers = initialData.getInitialUsers();
    
    /** * SPECIAL LOGIC: Extract unique roles from the user data
     * This creates the 'brooks_roles' collection dynamically.
     */
    const uniqueRoles = Array.from(new Set(initialUsers.map((u: any) => u.role)))
        .filter(Boolean)
        .map(roleName => ({
            id: roleName.toString().toLowerCase().replace(/\s+/g, '-'),
            name: roleName,
            permissions: [] // Default empty permissions
        }));

    const seedData: Record<string, any[]> = {
        'brooks_users': initialUsers,
        'brooks_roles': uniqueRoles, // Injected from the dynamic extraction above
        'brooks_businessEntities': initialData.getInitialBusinessEntities(),
        'brooks_customers': initialData.getInitialCustomers(),
        'brooks_vehicles': initialData.getInitialVehicles(),
        'brooks_lifts': initialData.getInitialLifts(),
        'brooks_engineers': initialData.getInitialEngineers(),
        'brooks_jobs': initialData.getInitialJobs(),
        'brooks_taxRates': initialData.getInitialTaxRates(),
        'brooks_suppliers': initialData.getInitialSuppliers(),
        'brooks_parts': initialData.getInitialParts(),
        'brooks_servicePackages': initialData.getInitialServicePackages(),
        'brooks_nominalCodes': initialData.getInitialNominalCodes(),
        'brooks_nominalCodeRules': initialData.getInitialNominalCodeRules(),
        'brooks_purchaseOrders': initialData.getInitialPurchaseOrders(),
        'brooks_saleVehicles': initialData.getInitialSaleVehicles(),
        'brooks_storageBookings': initialData.getInitialStorageBookings(),
        'brooks_rentalVehicles': initialData.getInitialRentalVehicles(),
        'brooks_batteryChargers': initialData.getInitialBatteryChargers(),
        'brooks_invoices': initialData.getInitialInvoices(),
        'brooks_estimates': initialData.getInitialEstimates()
    };

    try {
        for (const [colName, data] of Object.entries(seedData)) {
            if (!data || data.length === 0) continue;
            
            console.log(`Seeding ${colName}...`);
            const batch = writeBatch(db);
            
            data.forEach((item) => {
                const docId = item.id || (item.registration ? item.registration.replace(/\s/g, '').toUpperCase() : crypto.randomUUID());
                const docRef = doc(collection(db, colName), docId);
                batch.set(docRef, { ...item, id: docId });
            });

            await batch.commit();
        }
        alert("✅ Hydration Complete. Unique roles extracted and live in isdevdb.");
    } catch (error) {
        console.error("❌ Hydration error:", error);
    }
};

export { db, auth };
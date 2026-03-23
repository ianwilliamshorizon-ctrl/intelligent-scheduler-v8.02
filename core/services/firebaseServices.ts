import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Firestore
} from 'firebase/firestore';
import { firebaseConfig, FIREBASE_DATABASE_ID } from '../config/firebaseConfig'; 

// Initialize Firebase App if not already initialized
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Initialize Firestore with the specific Database ID from your config.
 * Production/UAT uses '(default)', Development uses 'isdevdb'.
 */
export const db: Firestore = getFirestore(app, FIREBASE_DATABASE_ID);

export interface RecordItem {
  id: string;
  name: string;
  searchField: string;
  [key: string]: any;
}

// Valid collection names for the Brooks project
export type BrooksCollection = 'brooks_customers' | 'brooks_parts' | 'brooks_vehicles';

/**
 * Searches 21,000+ records using the searchField index.
 * Optimized for performance by using prefix matching and a limit of 15.
 */
export const searchRecords = async (
  collectionName: BrooksCollection,
  searchTerm: string, 
  maxResults: number = 15
): Promise<RecordItem[]> => {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  try {
    const recordsRef = collection(db, collectionName);
    const lowerSearch = searchTerm.toLowerCase().trim();

    /**
     * Range query for prefix matching. 
     * Requires the 'searchField' to be indexed (automatic for single fields).
     */
    const q = query(
      recordsRef,
      where('searchField', '>=', lowerSearch),
      where('searchField', '<=', lowerSearch + '\uf8ff'),
      orderBy('searchField'),
      limit(maxResults)
    );

    const querySnapshot = await getDocs(q);
    const results: RecordItem[] = [];

    querySnapshot.forEach((doc) => {
      results.push({ 
        id: doc.id, 
        ...doc.data() 
      } as RecordItem);
    });

    return results;
  } catch (error) {
    console.error(`Firestore Search Error [${collectionName}]:`, error);
    throw error;
  }
};
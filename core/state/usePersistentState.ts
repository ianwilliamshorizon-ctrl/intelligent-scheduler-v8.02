import { useState, useEffect, useCallback } from 'react';
import { getAll } from '../db'; // Firestore fetcher
import { idbGet, idbSet, idbClear } from '../db/idb'; // Our new IndexedDB utility

export type UsePersistentStateTuple<T> = [T, React.Dispatch<React.SetStateAction<T>>, () => Promise<void>, boolean];

/**
 * A hook to manage state that is persisted in IndexedDB and synchronized with Firestore.
 * It replaces the previous localStorage-based implementation to handle large datasets.
 */
export function usePersistentState<T>(
    key: string,
    initialValue: T | (() => T)
): UsePersistentStateTuple<T> {
    // Initialize state with the provided default initialValue.
    // The actual state will be loaded asynchronously from IndexedDB and/or Firestore.
    const [state, setState] = useState<T>(() =>
        typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    );
    
    // Flag to prevent writing to IndexedDB before the initial state has been loaded.
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Function to refresh data from Firestore, update IndexedDB cache, and update the component state.
    const refreshStateFromDb = useCallback(async () => {
        console.log(`[Sync] Refreshing '${key}' from Firestore...`);
        try {
            const dbValue = await getAll(key); // Fetches all documents from the Firestore collection.
            const derivedInitialValue = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
            
            const newState = (dbValue && (dbValue as any[]).length > 0) ? dbValue : derivedInitialValue;
            
            await idbSet(key, newState); // Update the IndexedDB cache.
            setState(newState as T);     // Update the React state.
            console.log(`[Sync] Successfully refreshed '${key}'.`);
        } catch (error) {
            console.error(`[Sync] Failed to refresh '${key}' from Firestore:`, error);
        }
    }, [key, initialValue]);

    // Effect to load initial data on component mount.
    useEffect(() => {
        let isMounted = true;

        const loadInitialState = async () => {
            setIsLoading(true);
            // 1. Try to load from IndexedDB cache for a fast initial render.
            console.log(`[Cache] Loading '${key}' from IndexedDB...`);
            const cachedState = await idbGet<T>(key);
            
            if (isMounted && cachedState !== undefined) {
                setState(cachedState);
                console.log(`[Cache] Loaded '${key}' from cache.`);
            } else {
                console.log(`[Cache] No cache found for '${key}'.`);
            }
            
            // 2. Mark initialization as complete so that subsequent state changes can be cached.
            setIsInitialized(true);

            // 3. Refresh data from Firestore to ensure it's up-to-date.
            // This was the original behavior, ensuring data consistency.
            await refreshStateFromDb();
            if (isMounted) {
                setIsLoading(false);
            }
        };

        loadInitialState();

        return () => {
            isMounted = false;
        };
    }, [key, refreshStateFromDb]); // refreshStateFromDb is memoized with useCallback.

    // Effect to persist local state changes to the IndexedDB cache.
    // This captures optimistic UI updates (e.g., adding an item to a list before it's saved to the backend).
    useEffect(() => {
        // Only run this effect after the initial state has been loaded.
        if (!isInitialized) {
            return;
        }

        const saveStateToCache = async () => {
            console.log(`[Cache] Saving '${key}' to IndexedDB...`);
            await idbSet(key, state);
        };
        
        saveStateToCache();
    }, [key, state, isInitialized]);

    return [state, setState, refreshStateFromDb, isLoading];
}

// Function to clear the entire IndexedDB cache.
export const clearAllPersistentData = async () => {
    await idbClear();
    console.log('All persistent cache data in IndexedDB has been cleared.');
};

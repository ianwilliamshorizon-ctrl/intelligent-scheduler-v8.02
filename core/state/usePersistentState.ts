import { useState, useEffect, useCallback, useRef } from 'react';
import { getAll } from '../db'; // Firestore fetcher
import { idbGet, idbSet, idbClear } from '../db/idb'; // Our new IndexedDB utility

export type UsePersistentStateTuple<T> = [T, React.Dispatch<React.SetStateAction<T>>, () => Promise<void>, boolean];

export interface UsePersistentStateOptions {
    deferMs?: number;
}

/**
 * A hook to manage state that is persisted in IndexedDB and synchronized with Firestore.
 * Supports two-phase loading: instant IndexedDB cache hydration followed by background Firestore sync.
 */
export function usePersistentState<T>(
    key: string,
    initialValue: T | (() => T),
    skipLoad = false,
    options?: UsePersistentStateOptions
): UsePersistentStateTuple<T> {
    const deferMs = options?.deferMs ?? 0;

    // Initialize state with the provided default initialValue.
    // The actual state will be loaded asynchronously from IndexedDB and/or Firestore.
    const [state, setState] = useState<T>(() =>
        typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    );
    
    // Flag to prevent writing to IndexedDB before the initial state has been loaded.
    const [isInitialized, setIsInitialized] = useState(skipLoad);
    const [isLoading, setIsLoading] = useState(!skipLoad && deferMs === 0);
    const skipNextIdbWriteRef = useRef(true);

    // Function to refresh data from Firestore, update IndexedDB cache, and update the component state.
    const refreshStateFromDb = useCallback(async () => {
        if (skipLoad) return;
        try {
            const dbValue = await getAll(key); // Fetches all documents from the Firestore collection.
            const derivedInitialValue = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
            
            const newState = (dbValue && (dbValue as any[]).length > 0) ? dbValue : derivedInitialValue;
            
            skipNextIdbWriteRef.current = true;
            await idbSet(key, newState); // Update the IndexedDB cache.
            setState(newState as T);     // Update the React state.
        } catch (error) {
            console.error(`[Sync] Failed to refresh '${key}' from Firestore:`, error);
        }
    }, [key, initialValue, skipLoad]);

    // Effect to load initial data on component mount (Part 1: instant cache, Part 2: background Firestore sync).
    useEffect(() => {
        if (skipLoad) {
            setIsLoading(false);
            setIsInitialized(true);
            return;
        }

        let isMounted = true;
        let bgTimer: ReturnType<typeof setTimeout> | null = null;

        const loadInitialState = async () => {
            // 1. Try to load from IndexedDB cache for an instant initial render.
            const cachedState = await idbGet<T>(key);
            
            if (isMounted && cachedState !== undefined) {
                skipNextIdbWriteRef.current = true;
                setState(cachedState);
                // Cache hydrated — unblock UI immediately while Firestore syncs in background
                setIsLoading(false);
            }
            
            // 2. Mark initialization as complete so that subsequent user state changes can be cached.
            if (isMounted) {
                setIsInitialized(true);
            }

            // 3. Refresh data from Firestore in the background (optionally staggered for Tier 2 collections).
            const runBgSync = async () => {
                await refreshStateFromDb();
                if (isMounted) {
                    setIsLoading(false);
                }
            };

            if (deferMs > 0) {
                bgTimer = setTimeout(() => {
                    if (isMounted) {
                        runBgSync();
                    }
                }, deferMs);
            } else {
                await runBgSync();
            }
        };

        loadInitialState();

        return () => {
            isMounted = false;
            if (bgTimer) clearTimeout(bgTimer);
        };
    }, [key, refreshStateFromDb, skipLoad, deferMs]);

    // Effect to persist local user state changes to the IndexedDB cache.
    useEffect(() => {
        if (!isInitialized || skipLoad) {
            return;
        }
        if (skipNextIdbWriteRef.current) {
            skipNextIdbWriteRef.current = false;
            return;
        }

        idbSet(key, state).catch(err => console.warn(`[Cache] Failed to save '${key}':`, err));
    }, [key, state, isInitialized, skipLoad]);

    return [state, setState, refreshStateFromDb, isLoading];
}

// Function to clear the entire IndexedDB cache.
export const clearAllPersistentData = async () => {
    await idbClear();
    console.log('All persistent cache data in IndexedDB has been cleared.');
};

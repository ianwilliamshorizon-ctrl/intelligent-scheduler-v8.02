
import React, { useState, useEffect, useRef } from 'react';
import { subscribeToCollection, getItem } from '../db';

export const usePersistentState = <T,>(storageKey: string, getInitialValue: () => T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(getInitialValue());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    // Determine if this is a Collection (Array) or a Setting (Object/Primitive)
    // By convention in this app, keys starting with 'brooks_' that hold arrays are collections.
    const initialVal = getInitialValue();
    const isCollection = Array.isArray(initialVal);

    if (isCollection) {
        // Real-time Sync for Collections (Jobs, Customers, etc.)
        unsubscribe = subscribeToCollection(storageKey, (data) => {
            // Firestore returns the data. We update local state.
            // This handles the "User B sees User A's changes" requirement.
            setState(data as unknown as T);
            setIsHydrated(true);
        });
    } else {
        // One-time fetch for Settings/Config (legacy behavior for non-collection items)
        getItem<T>(storageKey).then((data) => {
            if (data) setState(data);
            setIsHydrated(true);
        });
    }

    return () => {
        unsubscribe();
    };
  }, [storageKey]);

  // We wrap setState to ensure we aren't just updating local state for Collections.
  // NOTE: In a pure Firestore architecture, you typically don't set state directly for collections,
  // you call db.saveDocument(). However, to keep compatibility with the huge existing codebase
  // that passes `setJobs` around, we keep this. 
  // IMPORTANT: The actual *writes* to DB must happen in the Action Hooks (useWorkshopActions), 
  // not here in the setter, otherwise we get infinite loops or massive writes.
  
  return [state, setState];
};

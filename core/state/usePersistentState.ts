import React, { useState, useEffect, useRef } from 'react';
import { subscribeToCollection, getItem, saveDocument, setItem } from '../db';

export const usePersistentState = <T,>(
  storageKey: string, 
  getInitialValue: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(getInitialValue());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let unsubscribe = () => {};
    
    const initialVal = getInitialValue();
    const isCollection = Array.isArray(initialVal);

    if (isCollection) {
        unsubscribe = subscribeToCollection(storageKey, (data) => {
            if (!isMounted.current) return;

            // 🛑 THE SYNC LOCK:
            // If the Master Sync is running, ignore Firestore snapshots.
            // This prevents the state from dropping to 1 item while seeding.
            if ((window as any).isSyncing) return;

            const incomingData = data as unknown as any[];
            const localData = initialVal as any[];
            
            if (incomingData && incomingData.length >= localData.length) {
                setState(data as unknown as T);
            } 
        });
    } else {
        getItem<T>(storageKey).then((data) => {
            if (isMounted.current && data !== null) setState(data);
        });
    }

    return () => {
        isMounted.current = false;
        unsubscribe();
    };
  }, [storageKey]);

  const setPersistentState: React.Dispatch<React.SetStateAction<T>> = (value) => {
    setState((prevState) => {
      const newState = typeof value === 'function' ? (value as any)(prevState) : value;
      if (Array.isArray(newState)) {
        newState.forEach(item => { if (item.id) saveDocument(storageKey, item); });
      } else {
        setItem(storageKey, newState);
      }
      return newState;
    });
  };

  return [state, setPersistentState];
};
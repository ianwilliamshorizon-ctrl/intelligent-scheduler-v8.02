import React, { useState, useEffect, useRef } from 'react';
import { subscribeToCollection, getItem, saveDocument, setItem, getAll, db } from '../db';
import { collection, getDocs } from 'firebase/firestore';

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
        // These are the "heavy" tables. We use getAll() to fetch once.
        // This stops the 15-30s "long-polling" lag.
        const heavyCollections = ['brooks_parts', 'brooks_customers', 'brooks_vehicles', 'brooks_auditLog'];
        
        if (heavyCollections.includes(storageKey)) {
            getAll<any>(storageKey).then(data => {
                if (isMounted.current && data && data.length > 0) {
                    setState(data as unknown as T);
                }
            }).catch(err => console.error(`Failed to fetch ${storageKey}`, err));
        } else {
            // Light collections (Jobs, etc.) stay live
            unsubscribe = subscribeToCollection(storageKey, (data) => {
                if (!isMounted.current || (window as any).isSyncing) return;
                
                const incomingData = data as unknown as any[];
                // Only update if we have data (prevents flicker on slow loads)
                if (incomingData && incomingData.length >= (initialVal as any[]).length) {
                    setState(data as unknown as T);
                } 
            });
        }
    } else {
        // Single document settings
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
        // Warning: This saves every item in the array to Firestore.
        // For 1,000+ parts, this is slow. 
        newState.forEach(item => { 
            if (item.id) saveDocument(storageKey, item); 
        });
      } else {
        setItem(storageKey, newState);
      }
      return newState;
    });
  };

  return [state, setPersistentState];
};
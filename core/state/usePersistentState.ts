import React, { useState, useEffect, useRef } from 'react';
import { subscribeToCollection, getItem, saveDocument, setItem, getAll, db } from '../db';
import { collection, getDocs } from 'firebase/firestore';
import { isEqual } from 'lodash';

const getChangedDocuments = (oldState: any[], newState: any[]) => {
    const changed: any[] = [];
    const oldMap = new Map(oldState.map(i => [i.id, i]));
    const newMap = new Map(newState.map(i => [i.id, i]));

    // Check for new or updated items
    for (const [id, newItem] of newMap.entries()) {
        const oldItem = oldMap.get(id);
        if (!oldItem || !isEqual(oldItem, newItem)) {
            // Prevent duplicate MOT jobs
            if (newItem.id.includes('-MOT') && oldState.some(job => job.id === newItem.id)) {
                continue;
            }
            changed.push(newItem);
        }
    }

    // Check for deleted items (optional, depending on desired behavior)
    // for (const [id, oldItem] of oldMap.entries()) {
    //     if (!newMap.has(id)) {
    //         // Handle deletion if necessary
    //     }
    // }

    return changed;
};

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
        const heavyCollections = ['brooks_parts', 'brooks_customers', 'brooks_vehicles', 'brooks_auditLog'];
        
        if (heavyCollections.includes(storageKey)) {
            getAll<any>(storageKey).then(data => {
                if (isMounted.current && data && data.length > 0) {
                    setState(data as unknown as T);
                }
            }).catch(err => console.error(`Failed to fetch ${storageKey}`, err));
        } else {
            unsubscribe = subscribeToCollection(storageKey, (data) => {
                if (!isMounted.current || (window as any).isSyncing) return;
                
                const incomingData = data as unknown as any[];
                if (incomingData && incomingData.length >= (initialVal as any[]).length) {
                    setState(data as unknown as T);
                } 
            });
        }
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
      const newState = typeof value === 'function' ? (value as (prevState: T) => T)(prevState) : value;

      if (Array.isArray(prevState) && Array.isArray(newState)) {
        const changedDocs = getChangedDocuments(prevState, newState);
        changedDocs.forEach(item => { 
            if (item.id) saveDocument(storageKey, item); 
        });
      } else if (JSON.stringify(prevState) !== JSON.stringify(newState)) {
        setItem(storageKey, newState);
      }
      return newState;
    });
  };

  return [state, setPersistentState];
};

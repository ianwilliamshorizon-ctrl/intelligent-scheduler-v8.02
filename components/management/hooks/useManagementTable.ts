
import { useState, useCallback } from 'react';
import { saveDocument, deleteDocument } from '../../../core/db';
import { COLLECTION_NAME } from '../../../core/config/firebaseConfig';

// The hook now requires a state setter function to manage the data array from the outside.
export const useManagementTable = <T extends { id: string }>(
    items: T[], 
    collectionName: string,
    setItems: (items: T[] | ((prevItems: T[]) => T[])) => void
) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const getPath = (name: string) => {
        const cleanName = name.replace('brooks_', '').replace(`${COLLECTION_NAME}_`, '');
        return `${COLLECTION_NAME}_${cleanName}`;
    };

    // This function now also handles updating the local state.
    const updateItem = useCallback(async (newItem: T) => {
        const path = getPath(collectionName);
        await saveDocument(path, newItem);
        setItems(prevItems => {
            const itemIndex = prevItems.findIndex(item => item.id === newItem.id);
            if (itemIndex > -1) {
                const newItems = [...prevItems];
                newItems[itemIndex] = newItem;
                return newItems;
            } else {
                return [newItem, ...prevItems];
            }
        });
    }, [collectionName, setItems]);

    // `deleteItem` no longer uses window.confirm and updates the local state.
    const deleteItem = useCallback(async (id: string) => {
        const path = getPath(collectionName);
        await deleteDocument(path, id);
        setItems(prevItems => prevItems.filter(item => item.id !== id));
    }, [collectionName, setItems]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const toggleSelectAll = useCallback((filteredItems: T[]) => {
        setSelectedIds(prev => {
            if (prev.size === filteredItems.length && filteredItems.length > 0) {
                return new Set();
            }
            return new Set(filteredItems.map(i => i.id));
        });
    }, []);

    // `bulkDelete` is simplified to just perform the deletion logic. Confirmation is now handled by the component.
    const bulkDelete = useCallback(async () => {
        const path = getPath(collectionName);
        const idsToDelete = Array.from(selectedIds);
        const deletePromises = idsToDelete.map(id => deleteDocument(path, id));
        await Promise.all(deletePromises);
        
        setItems(prevItems => prevItems.filter(item => !idsToDelete.includes(item.id)));
        setSelectedIds(new Set());
    }, [collectionName, setItems, selectedIds]);

    return {
        selectedIds,
        updateItem,
        deleteItem,
        toggleSelection,
        toggleSelectAll,
        bulkDelete
    };
};
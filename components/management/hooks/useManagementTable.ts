import { useState, useCallback } from 'react';
import { saveDocument, deleteDocument } from '../../../core/db';
import { COLLECTION_NAME } from '../../../core/config/firebaseConfig';

export const useManagementTable = <T extends { id: string }>(
    items: T[], 
    collectionName: string
) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const getPath = (name: string) => {
        const cleanName = name.replace('brooks_', '').replace(`${COLLECTION_NAME}_`, '');
        return `${COLLECTION_NAME}_${cleanName}`;
    };

    const updateItem = useCallback(async (newItem: T) => {
        const path = getPath(collectionName);
        await saveDocument(path, newItem);
    }, [collectionName]);

    const deleteItem = useCallback(async (id: string) => {
        // Optimization: Use a non-blocking confirmation or at least move logic out of render cycle
        if(window.confirm('Are you sure you want to permanently delete this item?')) {
            const path = getPath(collectionName);
            await deleteDocument(path, id);
        }
    }, [collectionName]);

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

    const bulkDelete = useCallback(async () => {
        const count = selectedIds.size;
        if (window.confirm(`Are you sure you want to permanently delete ${count} items?`)) {
            const path = getPath(collectionName);
            // Optimization: Promise.all is okay, but Firestore writeBatch is better for bulk.
            // For now, let's just clear selection immediately to improve perceived speed.
            const idsToDelete = Array.from(selectedIds);
            setSelectedIds(new Set()); 
            
            const deletePromises = idsToDelete.map(id => deleteDocument(path, id as string));
            await Promise.all(deletePromises);
        }
    }, [collectionName, selectedIds]);

    return {
        selectedIds,
        updateItem,
        deleteItem,
        toggleSelection,
        toggleSelectAll,
        bulkDelete
    };
};
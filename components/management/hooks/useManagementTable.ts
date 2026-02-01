
import { useState } from 'react';
import { saveDocument, deleteDocument } from '../../../core/db';

export const useManagementTable = <T extends { id: string }>(
    items: T[], 
    collectionName: string
) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const updateItem = async (newItem: T) => {
        // Persist to DB (Upsert)
        await saveDocument(collectionName, newItem);
    };

    const deleteItem = async (id: string) => {
        if(confirm('Are you sure you want to permanently delete this item?')) {
            await deleteDocument(collectionName, id);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = (filteredItems: T[]) => {
        if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const bulkDelete = async () => {
        if (confirm(`Are you sure you want to permanently delete ${selectedIds.size} items?`)) {
            // Delete all selected items concurrently
            const deletePromises = Array.from(selectedIds).map(id => deleteDocument(collectionName, id as string));
            await Promise.all(deletePromises);
            setSelectedIds(new Set());
        }
    };

    return {
        selectedIds,
        updateItem,
        deleteItem,
        toggleSelection,
        toggleSelectAll,
        bulkDelete
    };
};

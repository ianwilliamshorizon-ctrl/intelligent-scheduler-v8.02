import { useState } from 'react';
import { saveDocument, deleteDocument } from '../../../core/db';
import { COLLECTION_NAME } from '../../../core/config/firebaseConfig';

export const useManagementTable = <T extends { id: string }>(
    items: T[], 
    collectionName: string // e.g. "users", "businessEntities"
) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Helper to get the correct path (e.g. "isdevdb_users")
    // If collectionName already starts with "brooks_" or "isdevdb_", we handle it
    const getPath = (name: string) => {
        const cleanName = name.replace('brooks_', '').replace(`${COLLECTION_NAME}_`, '');
        return `${COLLECTION_NAME}_${cleanName}`;
    };

    const updateItem = async (newItem: T) => {
        const path = getPath(collectionName);
        console.log(`Saving to ${path} with ID: ${newItem.id}`);
        
        // Removed the third argument (newItem.id) to match the expected 2 arguments
        // saveDocument handles the ID inside the data object or internally
        await saveDocument(path, newItem);
    };

    const deleteItem = async (id: string) => {
        if(confirm('Are you sure you want to permanently delete this item?')) {
            const path = getPath(collectionName);
            await deleteDocument(path, id);
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
            const path = getPath(collectionName);
            const deletePromises = Array.from(selectedIds).map(id => deleteDocument(path, id as string));
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
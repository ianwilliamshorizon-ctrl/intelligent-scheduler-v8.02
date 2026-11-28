
import { useState, useCallback } from 'react';
import { saveDocument } from '../../../core/db';
import { COLLECTION_NAME } from '../../../core/config/firebaseConfig';
import { useApp } from '../../../core/state/AppContext';
import {
    getCollectionDisplayType,
    getItemDisplayLabel,
    safeDeleteWithTrash,
    showUndoDeleteToast,
    TrashEntry,
} from '../../../core/db/trash';

// The hook now requires a state setter function to manage the data array from the outside.
export const useManagementTable = <T extends { id: string }>(
    items: T[], 
    collectionName: string,
    setItems: (items: T[] | ((prevItems: T[]) => T[])) => void
) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { setConfirmation, currentUser } = useApp();

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

    // Confirms via ConfirmationModal, archives to brooks_trash, deletes, and offers Undo toast.
    const deleteItem = useCallback((id: string) => {
        const path = getPath(collectionName);
        const target = items.find(i => i.id === id);
        const itemType = getCollectionDisplayType(path);
        const label = getItemDisplayLabel(target, id);

        setConfirmation({
            isOpen: true,
            type: 'warning',
            title: `Delete ${itemType}`,
            message: `Are you sure you want to delete "${label}"? You can undo immediately or restore it later from the Recycle Bin.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                const entry = await safeDeleteWithTrash({
                    collectionName: path,
                    docId: id,
                    itemSnapshot: target,
                    label,
                    itemType,
                    deletedBy: currentUser?.id,
                });
                setItems(prevItems => prevItems.filter(item => item.id !== id));
                if (entry) {
                    showUndoDeleteToast([entry], (restored) => {
                        setItems(prevItems => [...restored, ...prevItems.filter(p => p.id !== id)]);
                    });
                }
            },
        });
    }, [collectionName, currentUser?.id, items, setConfirmation, setItems]);

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

    // Confirms bulk deletion via ConfirmationModal, archives to brooks_trash, and offers Undo toast.
    const bulkDelete = useCallback(() => {
        const path = getPath(collectionName);
        const idsToDelete = Array.from(selectedIds);
        if (idsToDelete.length === 0) return;
        const itemType = getCollectionDisplayType(path);

        setConfirmation({
            isOpen: true,
            type: 'warning',
            title: `Delete ${idsToDelete.length} ${itemType}(s)`,
            message: `Are you sure you want to delete ${idsToDelete.length} selected ${itemType.toLowerCase()}(s)? You can undo immediately or restore them later from the Recycle Bin.`,
            confirmText: `Delete (${idsToDelete.length})`,
            cancelText: 'Cancel',
            onConfirm: async () => {
                const entries: TrashEntry[] = [];
                for (const id of idsToDelete) {
                    const target = items.find(i => i.id === id);
                    const entry = await safeDeleteWithTrash({
                        collectionName: path,
                        docId: id,
                        itemSnapshot: target,
                        itemType,
                        deletedBy: currentUser?.id,
                    });
                    if (entry) entries.push(entry);
                }
                setItems(prevItems => prevItems.filter(item => !idsToDelete.includes(item.id)));
                setSelectedIds(new Set());
                if (entries.length > 0) {
                    showUndoDeleteToast(entries, (restored) => {
                        const restoredIds = new Set(restored.map(r => r.id));
                        setItems(prevItems => [...restored, ...prevItems.filter(p => !restoredIds.has(p.id))]);
                    });
                }
            },
        });
    }, [collectionName, currentUser?.id, items, selectedIds, setConfirmation, setItems]);

    return {
        selectedIds,
        updateItem,
        deleteItem,
        toggleSelection,
        toggleSelectAll,
        bulkDelete
    };
};
import React from 'react';
import { toast } from 'react-toastify';
import { deleteDocument, getAll, getDocument, saveDocument } from './index';

export const TRASH_COLLECTION = 'brooks_trash';

export interface TrashEntry {
    id: string;
    originalCollection: string;
    documentId: string;
    itemType: string;
    label: string;
    data: any;
    deletedAt: string;
    deletedBy?: string;
}

const COLLECTION_LABELS: Record<string, string> = {
    brooks_customers: 'Customer',
    brooks_vehicles: 'Vehicle',
    brooks_parts: 'Part',
    brooks_jobs: 'Job Card',
    brooks_invoices: 'Invoice',
    brooks_servicePackages: 'Service Package',
    brooks_engineers: 'Engineer',
    brooks_users: 'User',
    brooks_lifts: 'Lift / Bay',
    brooks_batteryChargers: 'Battery Charger',
    brooks_suppliers: 'Supplier',
    brooks_storageLocations: 'Storage Location',
    brooks_taxRates: 'Tax Code',
    brooks_discountCodes: 'Discount Code',
    brooks_inspectionDiagrams: 'Vehicle Diagram',
    brooks_inspectionTemplates: 'Inspection Template',
    brooks_businessEntities: 'Business Entity',
};

export const getCollectionDisplayType = (collectionName: string): string => {
    return COLLECTION_LABELS[collectionName] || collectionName.replace(/^brooks_/, '');
};

export const getItemDisplayLabel = (item: any, fallbackId?: string): string => {
    if (!item) return fallbackId || 'Item';
    const fullName = [item.forename, item.surname].filter(Boolean).join(' ').trim();
    return (
        item.registration ||
        item.partNumber ||
        item.name ||
        item.title ||
        fullName ||
        item.code ||
        item.model ||
        item.description ||
        item.id ||
        fallbackId ||
        'Item'
    );
};

/**
 * Archives a snapshot of a document into `brooks_trash` before deleting it
 * from its live collection, enabling Undo toasts and Recycle Bin recovery.
 */
export const safeDeleteWithTrash = async (params: {
    collectionName: string;
    docId: string;
    itemSnapshot?: any;
    label?: string;
    itemType?: string;
    deletedBy?: string;
}): Promise<TrashEntry | null> => {
    const { collectionName, docId, itemSnapshot, label, itemType, deletedBy } = params;
    const data = itemSnapshot ?? (await getDocument<any>(collectionName, docId));
    if (!data) {
        await deleteDocument(collectionName, docId);
        return null;
    }

    const entry: TrashEntry = {
        id: `trash_${collectionName}_${docId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        originalCollection: collectionName,
        documentId: docId,
        itemType: itemType || getCollectionDisplayType(collectionName),
        label: label || getItemDisplayLabel(data, docId),
        data,
        deletedAt: new Date().toISOString(),
        ...(deletedBy ? { deletedBy } : {}),
    };

    await saveDocument(TRASH_COLLECTION, entry);
    await deleteDocument(collectionName, docId);
    return entry;
};

/**
 * Restores a single TrashEntry back into its original collection and removes
 * the entry from `brooks_trash`.
 */
export const restoreTrashEntry = async (entry: TrashEntry): Promise<void> => {
    await saveDocument(entry.originalCollection, entry.data);
    await deleteDocument(TRASH_COLLECTION, entry.id);
};

/**
 * Permanently removes a TrashEntry from `brooks_trash`.
 */
export const purgeTrashEntry = async (trashId: string): Promise<void> => {
    await deleteDocument(TRASH_COLLECTION, trashId);
};

/**
 * Fetches all entries from `brooks_trash`, sorted newest first.
 */
export const fetchTrashEntries = async (): Promise<TrashEntry[]> => {
    const entries = await getAll<TrashEntry>(TRASH_COLLECTION);
    return entries.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
};

/**
 * Shows a toast notification with an Undo action for one or more trashed items.
 */
export const showUndoDeleteToast = (
    entries: TrashEntry[],
    onRestored?: (restoredItems: any[]) => void,
    customMessage?: string
): void => {
    if (entries.length === 0) return;
    const message =
        customMessage ||
        (entries.length === 1
            ? `Deleted ${entries[0].itemType}: ${entries[0].label}`
            : `Deleted ${entries.length} ${entries[0].itemType}(s)`);

    let undone = false;
    toast.info(
        ({ closeToast }) => (
            <div className="flex items-center justify-between gap-3 w-full">
                <span className="text-sm font-medium">{message}</span>
                <button
                    type="button"
                    onClick={async () => {
                        if (undone) return;
                        undone = true;
                        try {
                            for (const entry of entries) {
                                await restoreTrashEntry(entry);
                            }
                            onRestored?.(entries.map((e) => e.data));
                            toast.success(
                                entries.length === 1
                                    ? `Restored ${entries[0].label}`
                                    : `Restored ${entries.length} item(s)`
                            );
                        } catch (err) {
                            console.error('Undo restore failed:', err);
                            toast.error('Failed to restore item(s).');
                        } finally {
                            closeToast?.();
                        }
                    }}
                    className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 shrink-0"
                >
                    Undo
                </button>
            </div>
        ),
        { autoClose: 10000 }
    );
};

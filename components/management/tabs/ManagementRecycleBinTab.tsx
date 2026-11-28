import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Trash2, ArchiveRestore } from 'lucide-react';
import { toast } from 'react-toastify';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import {
    fetchTrashEntries,
    purgeTrashEntry,
    restoreTrashEntry,
    TrashEntry,
} from '../../../core/db/trash';

interface ManagementRecycleBinTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementRecycleBinTab: React.FC<ManagementRecycleBinTabProps> = ({
    searchTerm,
    onShowStatus,
}) => {
    const { setConfirmation } = useApp();
    const { forceRefresh } = useData();
    const [entries, setEntries] = useState<TrashEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const loadTrash = useCallback(async () => {
        setIsLoading(true);
        try {
            const list = await fetchTrashEntries();
            setEntries(list);
        } catch (err) {
            console.error('Failed to load Recycle Bin:', err);
            onShowStatus('Failed to load Recycle Bin items.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [onShowStatus]);

    useEffect(() => {
        loadTrash();
    }, [loadTrash]);

    const itemTypes = useMemo(() => {
        const set = new Set(entries.map((e) => e.itemType));
        return Array.from(set).sort();
    }, [entries]);

    const filteredEntries = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return entries.filter((entry) => {
            if (typeFilter !== 'ALL' && entry.itemType !== typeFilter) return false;
            if (!q) return true;
            return (
                entry.label.toLowerCase().includes(q) ||
                entry.itemType.toLowerCase().includes(q) ||
                entry.documentId.toLowerCase().includes(q) ||
                entry.originalCollection.toLowerCase().includes(q)
            );
        });
    }, [entries, searchTerm, typeFilter]);

    const handleRestore = async (entry: TrashEntry) => {
        try {
            await restoreTrashEntry(entry);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            try {
                await forceRefresh(entry.originalCollection as any);
            } catch {
                // Non-DataContext collections (e.g. brooks_users) still restore in Firestore
            }
            toast.success(`Restored ${entry.itemType}: ${entry.label}`);
            onShowStatus(`Restored ${entry.itemType}: ${entry.label}`, 'success');
        } catch (err) {
            console.error('Restore failed:', err);
            toast.error('Failed to restore item.');
            onShowStatus('Failed to restore item.', 'error');
        }
    };

    const handlePurge = (entry: TrashEntry) => {
        setConfirmation({
            isOpen: true,
            type: 'warning',
            title: 'Permanently Delete Item',
            message: `Permanently delete ${entry.itemType} "${entry.label}" from the Recycle Bin? This cannot be undone.`,
            confirmText: 'Delete Forever',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await purgeTrashEntry(entry.id);
                    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                    onShowStatus(`Permanently deleted "${entry.label}".`, 'info');
                } catch (err) {
                    console.error('Purge failed:', err);
                    onShowStatus('Failed to permanently delete item.', 'error');
                }
            },
        });
    };

    const handleEmptyBin = () => {
        if (entries.length === 0) return;
        setConfirmation({
            isOpen: true,
            type: 'warning',
            title: 'Empty Recycle Bin',
            message: `Permanently delete all ${entries.length} item(s) in the Recycle Bin? This cannot be undone.`,
            confirmText: `Empty (${entries.length})`,
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    for (const entry of entries) {
                        await purgeTrashEntry(entry.id);
                    }
                    setEntries([]);
                    onShowStatus('Recycle Bin emptied.', 'info');
                } catch (err) {
                    console.error('Empty bin failed:', err);
                    onShowStatus('Failed to empty Recycle Bin.', 'error');
                }
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ArchiveRestore size={20} className="text-indigo-600" />
                        Recycle Bin ({filteredEntries.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                        Deleted items from Data Management are archived here so they can be restored if removed by mistake.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                        <option value="ALL">All Types ({entries.length})</option>
                        {itemTypes.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={loadTrash}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    {entries.length > 0 && (
                        <button
                            type="button"
                            onClick={handleEmptyBin}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                            <Trash2 size={15} />
                            Empty Bin
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="p-8 text-center text-sm text-gray-500">Loading Recycle Bin...</div>
                ) : filteredEntries.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500 italic">
                        {entries.length === 0
                            ? 'Recycle Bin is empty.'
                            : 'No deleted items match your current filter.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                                <tr>
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-left">Item</th>
                                    <th className="px-4 py-3 text-left">Document ID</th>
                                    <th className="px-4 py-3 text-left">Deleted At</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                                {entry.itemType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{entry.label}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.documentId}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {entry.deletedAt ? new Date(entry.deletedAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestore(entry)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                                                >
                                                    <RotateCcw size={13} />
                                                    Restore
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePurge(entry)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
                                                >
                                                    <Trash2 size={13} />
                                                    Delete Forever
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

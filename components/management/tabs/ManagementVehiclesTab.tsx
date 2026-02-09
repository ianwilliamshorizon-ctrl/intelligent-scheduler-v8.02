import React, { useState, useMemo, useEffect, memo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, Customer } from '../../../types';
import { PlusCircle, Trash2, Upload, RefreshCw, Search } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import VehicleFormModal from '../../VehicleFormModal';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * MEMOIZED ROW: Essential for smooth scrolling and fast filtering.
 */
const VehicleRow = memo(({ 
    v, 
    searchTerm, 
    ownerName, 
    selected, 
    onToggle, 
    onEdit, 
    onDelete 
}: { 
    v: Vehicle, 
    searchTerm: string, 
    ownerName: string, 
    selected: boolean, 
    onToggle: (id: string) => void,
    onEdit: (v: Vehicle) => void,
    onDelete: (id: string) => void
}) => (
    <tr className="hover:bg-indigo-50/30 transition-colors group">
        <CheckboxCell id={v.id} selectedIds={new Set(selected ? [v.id] : [])} onToggle={() => onToggle(v.id)} />
        <td className="p-4">
            <span className="font-mono font-bold bg-[#FFCC00] text-black border border-black/20 px-2 py-1 rounded text-sm shadow-sm">
                <HighlightText text={String(v.registration)} highlight={searchTerm} />
            </span>
        </td>
        <td className="p-4 font-semibold text-gray-700">
            <HighlightText text={`${v.make} ${v.model}`} highlight={searchTerm} />
        </td>
        <td className="p-4 text-gray-600 font-medium">
            {ownerName}
        </td>
        <td className="p-4 text-right">
            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(v)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-all shadow-sm">Edit</button>
                <button onClick={() => onDelete(v.id)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs transition-all shadow-sm">Delete</button>
            </div>
        </td>
    </tr>
));

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    const pattern = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(pattern);
    return (
        <>
            {parts.map((part, i) => 
                pattern.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-black rounded-sm px-0.5">{part}</mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

export const ManagementVehiclesTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { vehicles, customers, jobs, estimates, invoices } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(vehicles, 'brooks_vehicles');

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // DEBOUNCE LOGIC
    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 250);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    /**
     * OPTIMIZATION: Create a Map of customer names indexed by ID.
     * This prevents O(n^2) lookups during the table render.
     */
    const customerMap = useMemo(() => {
        const map = new Map<string, string>();
        customers.forEach(c => {
            map.set(c.id, getCustomerDisplayName(c));
        });
        return map;
    }, [customers]);

    const filtered = useMemo(() => {
        const list = vehicles || [];
        if (!debouncedSearch) return list;
        const words = debouncedSearch.toLowerCase().split(' ').filter(w => w.length > 0);
        return list.filter(v => {
            const ownerName = customerMap.get(v.customerId) || '';
            const data = `${v.registration} ${v.make} ${v.model} ${ownerName}`.toLowerCase();
            return words.every(word => data.includes(word));
        });
    }, [vehicles, debouncedSearch, customerMap]);

    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        onShowStatus("Processing batch vehicle import...", "info");
        try {
            const data = await parseCsv(file);
            const batch = writeBatch(db);
            let count = 0;
            const existingIds = new Set(vehicles.map(v => v.id));

            for (const row of data) {
                const id = row.id || crypto.randomUUID();
                if (!existingIds.has(id)) {
                    batch.set(doc(collection(db, 'brooks_vehicles'), id), {
                        ...row,
                        id,
                        registration: String(row.registration || '').toUpperCase().replace(/\s/g, ''),
                        make: String(row.make || 'Unknown'),
                        model: String(row.model || 'Unknown'),
                        customerId: row.customerId || 'unknown_owner',
                    });
                    count++;
                }
                if (count > 0 && count % 400 === 0) await batch.commit();
            }
            if (count > 0) {
                await batch.commit();
                onShowStatus(`Imported ${count} vehicles.`, 'success');
            }
        } catch (err) {
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-bold border border-red-200 shadow-sm">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <label className={`flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm text-sm font-semibold transition-all ${isImporting ? 'opacity-50' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600"/>}
                        Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportVehicles} disabled={isImporting} />
                    </label>
                    <button onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 text-sm font-semibold">
                        <PlusCircle size={16}/> Add Vehicle
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-y-auto max-h-[72vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => toggleSelectAll(filtered)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                </th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Registration</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Make / Model</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Owner</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <Search size={24} className="text-gray-300 mx-auto mb-2" />
                                        <div className="text-gray-400 text-lg">No matching vehicles</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(v => (
                                    <VehicleRow 
                                        key={v.id} 
                                        v={v} 
                                        searchTerm={debouncedSearch} 
                                        ownerName={customerMap.get(v.customerId) || 'Unknown Owner'}
                                        selected={selectedIds.has(v.id)}
                                        onToggle={toggleSelection}
                                        onEdit={(veh) => { setSelectedVehicle(veh); setIsModalOpen(true); }}
                                        onDelete={deleteItem}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(v) => { updateItem(v); setIsModalOpen(false); }} 
                    vehicle={selectedVehicle} 
                    customers={customers}
                    jobs={jobs}
                    estimates={estimates}
                    invoices={invoices}
                />
            )}
        </div>
    );
};
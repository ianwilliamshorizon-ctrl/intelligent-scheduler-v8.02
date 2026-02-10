import React, { useState, useMemo, useEffect, memo, useDeferredValue, useCallback, useTransition } from 'react';
import { VList } from 'virtua';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, Customer } from '../../../types';
import { PlusCircle, Trash2, Upload, RefreshCw, Search, Car } from 'lucide-react';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import VehicleFormModal from '../../VehicleFormModal';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * PRODUCTION ROW COMPONENT
 * Fixed height (64px) for perfect virtualization sync.
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
    <div className="border-b border-gray-100 flex items-center hover:bg-indigo-50/50 transition-colors text-sm bg-white h-[64px] w-full shrink-0 group">
        <div className="w-12 flex justify-center shrink-0">
             <input 
                type="checkbox" 
                checked={selected} 
                onChange={() => onToggle(v.id)} 
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer" 
            />
        </div>

        <div className="px-4 w-[20%] shrink-0">
            <span className="font-mono font-bold bg-[#FFCC00] text-black border border-black/20 px-2 py-1 rounded text-sm shadow-sm uppercase whitespace-nowrap">
                <HighlightText text={String(v.registration)} highlight={searchTerm} />
            </span>
        </div>

        <div className="px-4 w-[35%] shrink-0">
            <div className="font-bold text-gray-900 text-base leading-tight">
                <HighlightText text={`${v.make} ${v.model}`} highlight={searchTerm} />
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {v.vin || 'NO VIN PROVIDED'}
            </div>
        </div>

        <div className="px-4 w-[25%] shrink-0 flex flex-col justify-center">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Owner</div>
            <div className="text-gray-700 font-medium truncate italic">
                {ownerName}
            </div>
        </div>

        <div className="px-4 flex-1 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => onEdit(v)} 
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md font-bold text-xs shadow-sm hover:bg-indigo-700"
            >
                Edit
            </button>
            <button 
                onClick={() => onDelete(v.id)} 
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md font-bold text-xs hover:bg-red-600 hover:text-white transition-colors"
            >
                Del
            </button>
        </div>
    </div>
));

const HighlightText = memo(({ text, highlight }: { text: string; highlight: string }) => {
    const content = String(text);
    if (!highlight.trim()) return <>{content}</>;
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    const pattern = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = content.split(pattern);
    return (
        <>
            {parts.map((part, i) => 
                pattern.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-black rounded-sm px-0.5">{part}</mark>
                ) : (part)
            )}
        </>
    );
});

export const ManagementVehiclesTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { vehicles, customers, jobs, estimates, invoices } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(vehicles, 'brooks_vehicles');

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isPending, startTransition] = useTransition();

    // 1. Use Deferred Value to keep the keyboard input buttery smooth
    const deferredSearch = useDeferredValue(searchTerm);

    // 2. Map of customer names for instant O(1) lookup
    const customerMap = useMemo(() => {
        const map = new Map<string, string>();
        customers.forEach(c => map.set(c.id, getCustomerDisplayName(c)));
        return map;
    }, [customers]);

    // 3. Pre-index search data for fast filtering
    const searchableItems = useMemo(() => {
        return vehicles.map(v => ({
            ...v,
            _owner: customerMap.get(v.customerId) || 'Unknown Owner',
            _low: `${v.registration} ${v.make} ${v.model} ${customerMap.get(v.customerId) || ''}`.toLowerCase()
        }));
    }, [vehicles, customerMap]);

    const filtered = useMemo(() => {
        if (!deferredSearch) return searchableItems;
        const words = deferredSearch.toLowerCase().split(' ').filter(w => w.length > 0);
        return searchableItems.filter(v => words.every(word => v._low.includes(word)));
    }, [searchableItems, deferredSearch]);

    const handleEdit = useCallback((veh: Vehicle) => {
        startTransition(() => {
            setSelectedVehicle(veh);
            setIsModalOpen(true);
        });
    }, []);

    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        onShowStatus("Processing batch vehicle import...", "info");
        try {
            const data = await parseCsv(file);
            let count = 0;
            const existingIds = new Set(vehicles.map(v => v.id));
            const batchLimit = 400;
            let currentBatch = writeBatch(db);

            for (const row of data) {
                const id = row.id || crypto.randomUUID();
                if (!existingIds.has(id)) {
                    const vehicleData = {
                        ...row,
                        id,
                        registration: String(row.registration || '').toUpperCase().replace(/\s/g, ''),
                        make: String(row.make || 'Unknown'),
                        model: String(row.model || 'Unknown'),
                        customerId: row.customerId || 'unknown_owner',
                    };
                    currentBatch.set(doc(collection(db, 'brooks_vehicles'), id), vehicleData);
                    count++;

                    if (count > 0 && count % batchLimit === 0) {
                        await currentBatch.commit();
                        currentBatch = writeBatch(db);
                    }
                }
            }
            if (count % batchLimit !== 0) await currentBatch.commit();
            onShowStatus(count > 0 ? `Imported ${count} vehicles.` : 'No new vehicles found.', 'success');
        } catch (err) {
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-bold border border-red-200 shadow-sm animate-in slide-in-from-left-2">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                    <div className="text-sm text-gray-400 italic">
                        {isPending && <RefreshCw size={12} className="animate-spin inline mr-2" />}
                        {deferredSearch ? `Matched ${filtered.length} vehicles` : `${vehicles.length} vehicles total`}
                    </div>
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

            {/* Main Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-[400px]">
                {/* Custom Header */}
                <div className="bg-gray-50 border-b border-gray-200 flex text-[10px] font-bold text-gray-600 uppercase tracking-widest shrink-0">
                    <div className="w-12 p-4 flex justify-center">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.size === filtered.length && filtered.length > 0} 
                            onChange={() => toggleSelectAll(filtered)} 
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer" 
                        />
                    </div>
                    <div className="p-4 w-[20%]">Registration</div>
                    <div className="p-4 w-[35%]">Make / Model</div>
                    <div className="p-4 w-[25%]">Owner</div>
                    <div className="p-4 flex-1 text-right">Actions</div>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 bg-white relative">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                            <Search size={24} className="text-gray-300 mb-2" />
                            <div className="text-gray-400">No matching vehicles found</div>
                        </div>
                    ) : (
                        <VList>
                            {filtered.map(v => (
                                <VehicleRow 
                                    key={v.id} 
                                    v={v} 
                                    searchTerm={deferredSearch} 
                                    ownerName={v._owner}
                                    selected={selectedIds.has(v.id)}
                                    onToggle={toggleSelection}
                                    onEdit={handleEdit}
                                    onDelete={deleteItem}
                                />
                            ))}
                        </VList>
                    )}
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
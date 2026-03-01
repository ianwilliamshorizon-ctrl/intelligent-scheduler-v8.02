import React, { useState, useMemo, useEffect, memo, useDeferredValue, useCallback, useTransition } from 'react';
import { VList } from 'virtua';
import { useData } from '../../../core/state/DataContext';
import { Customer, Vehicle, Job, Estimate, Invoice } from '../../../types';
import { PlusCircle, Trash2, Upload, RefreshCw, Search, Mail, Phone, MapPin } from 'lucide-react';
import { useManagementTable } from '../hooks/useManagementTable';
import { generateCustomerId, generateCustomerSearchField } from '../../../core/utils/customerUtils';
import { parseCsv } from '../../../utils/csvUtils';
import CustomerFormModal from '../../CustomerFormModal';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

interface ManagementCustomersTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

/**
 * PRODUCTION ROW COMPONENT
 */
const CustomerRow = memo(({ 
    c, 
    searchTerm, 
    isSelected, 
    onToggle, 
    onEdit, 
    onDelete 
}: { 
    c: Customer, 
    searchTerm: string, 
    isSelected: boolean,
    onToggle: (id: string) => void,
    onEdit: (id: string) => void,
    onDelete: (id: string) => void
}) => (
    <div className="border-b border-gray-100 flex items-center hover:bg-indigo-50/50 transition-colors text-sm bg-white h-[72px] w-full shrink-0 group">
        <div className="w-12 flex justify-center shrink-0">
             <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={() => onToggle(c.id)} 
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer" 
            />
        </div>
        
        <div className="px-4 w-[30%] shrink-0">
            <div className="font-bold text-gray-900 text-base leading-tight">
                <HighlightText text={`${c.forename} ${c.surname}`} highlight={searchTerm} />
            </div>
            {c.companyName && (
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="px-1 py-0 text-[9px] bg-indigo-100 text-indigo-700 rounded font-bold uppercase tracking-tighter">Business</span>
                    <span className="text-xs text-gray-500 font-medium truncate">
                        <HighlightText text={c.companyName} highlight={searchTerm} />
                    </span>
                </div>
            )}
        </div>

        <div className="px-4 w-[20%] shrink-0">
            <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                <HighlightText text={c.id} highlight={searchTerm} />
            </span>
        </div>

        <div className="px-4 w-[25%] shrink-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Phone size={12} className="text-gray-400" />
                {c.mobile || c.phone || 'No Phone'}
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-xs truncate">
                <Mail size={12} className="text-gray-400 shrink-0" />
                <span className="truncate">{c.email || 'No Email'}</span>
            </div>
        </div>

        <div className="px-4 w-[10%] shrink-0 flex items-center gap-1.5 font-bold text-gray-600 uppercase">
            <MapPin size={14} className="text-gray-300" />
            <HighlightText text={c.postcode || '—'} highlight={searchTerm} />
        </div>

        <div className="px-4 flex-1 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => onEdit(c.id)} 
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md font-bold text-xs shadow-sm hover:bg-indigo-700"
            >
                Edit
            </button>
            <button 
                onClick={() => onDelete(c.id)} 
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

export const ManagementCustomersTab: React.FC<ManagementCustomersTabProps> = ({ searchTerm, onShowStatus }) => {
    const { customers, vehicles, jobs, estimates, invoices } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(customers, 'brooks_customers');
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isPending, startTransition] = useTransition();

    const selectedCustomer = useMemo(() => 
        selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null,
        [customers, selectedCustomerId]
    );

    // 1. Use Deferred Value to prioritize input responsiveness
    const deferredSearch = useDeferredValue(searchTerm);

    // 2. Pre-index for faster filtering
    const searchableItems = useMemo(() => {
        return customers.map(c => ({
            ...c,
            _low: `${c.id} ${c.forename} ${c.surname} ${c.companyName || ''} ${c.postcode || ''} ${c.searchField || ''}`.toLowerCase()
        }));
    }, [customers]);

    const filtered = useMemo(() => {
        if (!deferredSearch) return searchableItems;
        const searchWords = deferredSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        return searchableItems.filter(c => 
            searchWords.every(word => c._low.includes(word))
        );
    }, [searchableItems, deferredSearch]);

    const handleEdit = useCallback((id: string) => {
        startTransition(() => {
            setSelectedCustomerId(id);
            setIsModalOpen(true);
        });
    }, []);

    const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        onShowStatus("Processing batch customer import...", "info");

        try {
            const data = await parseCsv(file);
            let addedCount = 0;
            const existingIds = new Set(customers.map(c => c.id.toLowerCase()));
            const batchLimit = 400;
            let currentBatch = writeBatch(db);

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const id = row.id || generateCustomerId(row.surname || 'New', customers);
                
                if (!existingIds.has(id.toLowerCase())) {
                    const baseCustomer = {
                        ...row,
                        id: id,
                        forename: row.forename || 'Unknown',
                        surname: row.surname || 'Unknown',
                        createdDate: row.createdDate || new Date().toISOString(),
                        marketingConsent: row.marketingConsent === 'true' || false,
                        serviceReminderConsent: row.serviceReminderConsent !== 'false'
                    };

                    const finalCustomer = {
                        ...baseCustomer,
                        searchField: generateCustomerSearchField(baseCustomer)
                    };

                    const docRef = doc(collection(db, 'brooks_customers'), id);
                    currentBatch.set(docRef, finalCustomer);
                    addedCount++;

                    if (addedCount > 0 && addedCount % batchLimit === 0) {
                        await currentBatch.commit();
                        currentBatch = writeBatch(db);
                    }
                }
            }

            if (addedCount % batchLimit !== 0) {
                await currentBatch.commit();
            }

            onShowStatus(addedCount > 0 ? `Successfully imported ${addedCount} customers.` : 'No new customers found.', 'success');
        } catch (err) {
            onShowStatus('Error importing customers.', 'error');
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
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-bold border border-red-200 animate-in fade-in slide-in-from-left-2">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                    <div className="text-sm text-gray-400 italic">
                        {isPending && <RefreshCw size={12} className="animate-spin inline mr-2" />}
                        {deferredSearch ? `Matched ${filtered.length} customers` : `${customers.length} total records`}
                    </div>
                </div>
                <div className="flex gap-2">
                    <label className={`flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm text-sm font-semibold ${isImporting ? 'opacity-50' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600"/>}
                        {isImporting ? 'Loading...' : 'Import CSV'}
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} disabled={isImporting} />
                    </label>
                    <button onClick={() => { setSelectedCustomerId(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 text-sm font-semibold">
                        <PlusCircle size={16}/> Add Customer
                    </button>
                </div>
            </div>

            {/* Virtualized Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-[400px]">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 flex text-[10px] font-bold text-gray-600 uppercase tracking-wider shrink-0">
                    <div className="w-12 p-4 flex justify-center">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.size === filtered.length && filtered.length > 0} 
                            onChange={() => toggleSelectAll(filtered)} 
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer" 
                        />
                    </div>
                    <div className="p-4 w-[30%] shrink-0">Customer Details</div>
                    <div className="p-4 w-[20%] shrink-0">Account Ref</div>
                    <div className="p-4 w-[25%] shrink-0">Contact</div>
                    <div className="p-4 w-[10%] shrink-0">Postcode</div>
                    <div className="p-4 flex-1 text-right">Actions</div>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 bg-white relative">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                            <Search size={24} className="text-gray-300 mb-2" />
                            <div className="text-gray-400">No matching customers found</div>
                        </div>
                    ) : (
                        <VList>
                            {filtered.map(c => (
                                <CustomerRow 
                                    key={c.id} 
                                    c={c} 
                                    searchTerm={deferredSearch} 
                                    isSelected={selectedIds.has(c.id)}
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
                <CustomerFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(c) => { 
                        const updatedWithSearch = {
                            ...c,
                            searchField: generateCustomerSearchField(c)
                        };
                        updateItem(updatedWithSearch); 
                        setIsModalOpen(false); 
                    }} 
                    customer={selectedCustomer} 
                    existingCustomers={customers}
                    vehicles={vehicles}
                    jobs={jobs}
                    estimates={estimates}
                    invoices={invoices}
                />
            )}
        </div>
    );
};
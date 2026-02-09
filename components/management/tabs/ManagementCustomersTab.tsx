import React, { useState, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Customer } from '../../../types';
import { PlusCircle, Trash2, Upload, RefreshCw, Search } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { generateCustomerId, generateCustomerSearchField } from '../../../core/utils/customerUtils';
import { parseCsv } from '../../../utils/csvUtils';
import CustomerFormModal from '../../CustomerFormModal';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * HELPER: Highlight matching text in yellow
 */
const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    if (words.length === 0) return <>{text}</>;

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

export const ManagementCustomersTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { customers, vehicles, jobs, estimates, invoices } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(customers, 'brooks_customers');
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    /**
     * SMART FRAGMENT SEARCH
     * Checks pre-computed searchField and fallback details
     */
    const filtered = useMemo(() => {
        const list = customers || [];
        if (!searchTerm) return list;
        
        const term = searchTerm.toLowerCase();
        const searchWords = term.split(' ').filter(word => word.length > 0);
        
        return list.filter(c => {
            const combinedData = `${c.id} ${c.forename} ${c.surname} ${c.companyName || ''} ${c.postcode || ''} ${c.searchField || ''}`.toLowerCase();
            // Match MUST contain all words typed in the search box
            return searchWords.every(word => combinedData.includes(word));
        });
    }, [customers, searchTerm]);

    const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        onShowStatus("Processing batch customer import...", "info");

        try {
            const data = await parseCsv(file);
            const batch = writeBatch(db);
            let addedCount = 0;

            const existingIds = new Set(customers.map(c => c.id.toLowerCase()));

            for (const row of data) {
                // Generate a robust ID if not provided
                const id = row.id || generateCustomerId(row.surname || 'New', customers);
                
                // Only add if ID doesn't already exist
                if (!existingIds.has(id.toLowerCase())) {
                    const baseCustomer = {
                        ...row,
                        id: id,
                        forename: row.forename || 'Unknown',
                        surname: row.surname || 'Unknown',
                        createdDate: row.createdDate || new Date().toISOString(),
                        marketingConsent: row.marketingConsent === 'true' || false,
                        serviceReminderConsent: row.serviceReminderConsent !== 'false' // default true
                    };

                    // Injects searchField on import for fast future lookups
                    const finalCustomer = {
                        ...baseCustomer,
                        searchField: generateCustomerSearchField(baseCustomer)
                    };

                    const docRef = doc(collection(db, 'brooks_customers'), id);
                    batch.set(docRef, finalCustomer);
                    addedCount++;
                }
                
                // Firestore limit is 500, we commit at 400 for safety if the list is huge
                if (addedCount > 0 && addedCount % 400 === 0) {
                    await batch.commit();
                }
            }

            if (addedCount > 0) {
                await batch.commit();
                onShowStatus(`Successfully imported ${addedCount} customers.`, 'success');
            } else {
                onShowStatus('No new customers found. Duplicates were skipped.', 'info');
            }
        } catch (err) {
            console.error("Import Error:", err);
            onShowStatus('Error importing customers. Check file format.', 'error');
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
                        <button 
                            onClick={bulkDelete} 
                            className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-bold transition-all border border-red-200 shadow-sm"
                        >
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <label className={`flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm transition-all text-sm font-semibold ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600"/>}
                        {isImporting ? 'Loading...' : 'Import CSV'}
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} disabled={isImporting} />
                    </label>
                    
                    <button 
                        onClick={() => { setSelectedCustomerId(null); setIsModalOpen(true); }} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all text-sm font-semibold"
                    >
                        <PlusCircle size={16}/> Add New Customer
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-y-auto max-h-[72vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.size === filtered.length && filtered.length > 0} 
                                        onChange={() => toggleSelectAll(filtered)} 
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                    />
                                </th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Customer Details</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Account Reference</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Contact Info</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Postcode</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center">
                                        <Search size={24} className="text-gray-300 mx-auto mb-2" />
                                        <div className="text-gray-400 text-lg">No matching customers found</div>
                                        <div className="text-gray-300 text-sm">Try searching by name, postcode, or company.</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <CheckboxCell id={c.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                        <td className="p-4">
                                            <div className="font-bold text-gray-900 text-base">
                                                <HighlightText text={`${c.forename} ${c.surname}`} highlight={searchTerm} />
                                            </div>
                                            {c.companyName && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">Business</span>
                                                    <span className="text-sm text-gray-500 font-medium">
                                                        <HighlightText text={c.companyName} highlight={searchTerm} />
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                                                <HighlightText text={c.id} highlight={searchTerm} />
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-700 font-medium">{c.mobile || c.phone || 'No Phone'}</div>
                                            <div className="text-gray-400 text-xs">{c.email || 'No Email Address'}</div>
                                        </td>
                                        <td className="p-4 font-bold text-gray-600">
                                            <HighlightText text={c.postcode || '—'} highlight={searchTerm} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setSelectedCustomerId(c.id); setIsModalOpen(true); }} 
                                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-all shadow-sm"
                                                >
                                                    Edit Profile
                                                </button>
                                                <button 
                                                    onClick={() => deleteItem(c.id)} 
                                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs transition-all shadow-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
                    customerId={selectedCustomerId} 
                    customers={customers}
                    vehicles={vehicles}
                    jobs={jobs}
                    estimates={estimates}
                    invoices={invoices}
                />
            )}
        </div>
    );
};
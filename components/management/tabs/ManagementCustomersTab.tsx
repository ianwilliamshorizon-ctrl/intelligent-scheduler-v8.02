import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Customer } from '../../../types';
import { PlusCircle, Trash2, Upload, User, Phone, Mail, Hash } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { generateCustomerId } from '../../../core/utils/customerUtils';
import { parseCsv } from '../../../utils/csvUtils';
import CustomerFormModal from '../../CustomerFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementCustomersTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // Defensively destructure with fallbacks
    const { customers = [], setCustomers, refreshActiveData } = useData();
    
    // 1. Local State for Instant UI Feedback
    const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers || []);

    // 2. Sync with Global Data Context
    useEffect(() => {
        if (customers) {
            setLocalCustomers(customers);
        }
    }, [customers]);

    // Pass safe array to hook
    const { selectedIds, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(localCustomers || [], 'brooks_customers');
    
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filtered list with defensive checks
    const filtered = (localCustomers || []).filter(c => 
        `${c.forename} ${c.surname}`.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (c.companyName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (c.id || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

    /**
     * handleSave
     * Persists single customer and updates local UI immediately
     */
    const handleSave = async (updatedCustomer: Customer) => {
        try {
            await saveDocument('brooks_customers', updatedCustomer);
            
            const updateFn = (prev: Customer[]) => {
                const existingList = prev || [];
                const exists = existingList.find(c => c.id === updatedCustomer.id);
                if (exists) return existingList.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
                return [...existingList, updatedCustomer];
            };

            setLocalCustomers(updateFn);
            if (setCustomers) setCustomers(updateFn);
            
            setIsModalOpen(false);
            setSelectedCustomer(null);
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus('Customer saved successfully.', 'success');
        } catch (error) {
            onShowStatus('Failed to save customer.', 'error');
        }
    };

    /**
     * handleImportCustomers
     * Processes CSV and updates UI incrementally
     */
    const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        onShowStatus("Processing CSV import...", 'info');
        try {
            const data = await parseCsv(file);
            const importedList: Customer[] = [];
            const currentList = localCustomers || [];

            for (const row of data) {
                const id = row.id || generateCustomerId(row.surname || 'Unknown', [...currentList, ...importedList]);
                const newCustomer: Customer = {
                    id,
                    forename: row.forename || 'Unknown',
                    surname: row.surname || 'Unknown',
                    phone: row.phone || '',
                    mobile: row.mobile || '',
                    email: row.email || '',
                    addressLine1: row.addressLine1 || '',
                    postcode: row.postcode || '',
                    createdDate: new Date().toISOString(),
                    marketingConsent: false,
                    serviceReminderConsent: true,
                    ...row
                };

                if (!currentList.some(ex => ex.id === id)) {
                    await saveDocument('brooks_customers', newCustomer);
                    importedList.push(newCustomer);
                }
            }

            if (importedList.length > 0) {
                const finalUpdate = (prev: Customer[]) => [...(prev || []), ...importedList];
                setLocalCustomers(finalUpdate);
                if (setCustomers) setCustomers(finalUpdate);
            }

            onShowStatus(`Successfully imported ${importedList.length} customers.`, 'success');
            if (refreshActiveData) await refreshActiveData(true);
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing customers. Check file format.', 'error');
        }
        e.target.value = '';
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Customer Directory</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage client profiles and contact information</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-colors shadow-sm border border-red-100">
                            <Trash2 size={18}/> Delete ({selectedIds.size})
                        </button>
                    )}
                    <label className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 cursor-pointer transition-all active:scale-95 shadow-sm">
                        <Upload size={18}/> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} />
                    </label>
                    <button 
                        onClick={() => { setSelectedCustomer(null); setIsModalOpen(true); }} 
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                        <PlusCircle size={18}/> Add Customer
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={filtered.length > 0 && selectedIds.size === filtered.length} 
                                        onChange={() => toggleSelectAll(filtered)} 
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                                    />
                                </th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Customer Details</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Account ID</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Contact Info</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <CheckboxCell id={c.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shadow-sm">
                                                {(c.forename?.[0] || '')}{(c.surname?.[0] || '')}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{c.forename} {c.surname}</div>
                                                {c.companyName && <div className="text-[10px] font-black text-indigo-500 uppercase tracking-tight">{c.companyName}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <Hash size={12} />
                                            <span className="font-mono text-xs font-bold">{c.id}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-gray-600 font-medium text-xs">
                                                <Phone size={12} className="text-gray-400" /> {c.mobile || c.phone || 'No Phone'}
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                                                <Mail size={12} /> {c.email || 'No Email'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => { setSelectedCustomer(c); setIsModalOpen(true); }} 
                                            className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => { if(window.confirm('Delete this customer?')) deleteItem(c.id); }} 
                                            className="font-black text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <User size={48} className="text-gray-200 mb-2" />
                                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No customers found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <CustomerFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedCustomer(null);
                    }} 
                    onSave={handleSave} 
                    customer={selectedCustomer} 
                    existingCustomers={customers || []} 
                />
            )}
        </div>
    );
};
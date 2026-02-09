import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Customer } from '../../../types';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { generateCustomerId, generateCustomerSearchField } from '../../../core/utils/customerUtils';
import { parseCsv } from '../../../utils/csvUtils';
import CustomerFormModal from '../../CustomerFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementCustomersTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { customers, vehicles, jobs, estimates, invoices } = useData();
    // Persist specifically to 'brooks_customers' on isdevdb
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(customers, 'brooks_customers');
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Optimized filtering using the pre-computed searchField
    const filtered = customers.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            (c.searchField && c.searchField.includes(term)) || 
            (c.id && c.id.toLowerCase().includes(term)) ||
            // Fallback safety for legacy/unsynced records
            `${c.forename} ${c.surname}`.toLowerCase().includes(term) ||
            (c.companyName || '').toLowerCase().includes(term)
        );
    });

    const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseCsv(file);
            const newCustomers: Customer[] = data.map((row: any) => {
                const baseCustomer = {
                    id: row.id || generateCustomerId(row.surname || 'Unknown', customers),
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
                // Injects searchField on import
                return {
                    ...baseCustomer,
                    searchField: generateCustomerSearchField(baseCustomer)
                };
            });
            
            for (const c of newCustomers) {
                if (!customers.some(ex => ex.id === c.id)) {
                    await saveDocument('brooks_customers', c);
                }
            }
            onShowStatus(`Imported ${newCustomers.length} customers successfully.`, 'success');
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing customers. Please check file format.', 'error');
        }
        e.target.value = '';
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
                    <label className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm transition-all text-sm font-semibold">
                        <Upload size={16} className="text-blue-600"/> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} />
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
                                        <div className="text-gray-400 text-lg">No matching customers found</div>
                                        <div className="text-gray-300 text-sm">Try adjusting your search or add a new record.</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <CheckboxCell id={c.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                        <td className="p-4">
                                            <div className="font-bold text-gray-900 text-base">{c.forename} {c.surname}</div>
                                            {c.companyName && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">Business</span>
                                                    <span className="text-sm text-gray-500 font-medium">{c.companyName}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                                                {c.id}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-700 font-medium">{c.mobile || c.phone || 'No Phone'}</div>
                                            <div className="text-gray-400 text-xs">{c.email || 'No Email Address'}</div>
                                        </td>
                                        <td className="p-4 font-bold text-gray-600">
                                            {c.postcode || '—'}
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
                        // Maintain the searchField every time a record is touched
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
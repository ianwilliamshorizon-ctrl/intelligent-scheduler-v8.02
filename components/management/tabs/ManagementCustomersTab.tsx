
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Customer } from '../../../types';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { generateCustomerId } from '../../../core/utils/customerUtils';
import { parseCsv } from '../../../utils/csvUtils';
import CustomerFormModal from '../../CustomerFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementCustomersTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { customers, vehicles, jobs, estimates, invoices } = useData();
    // Use 'brooks_customers' for persistence
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(customers, 'brooks_customers');
    
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filtered = customers.filter(c => 
        `${c.forename} ${c.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseCsv(file);
            const newCustomers: Customer[] = data.map((row: any) => ({
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
            }));
            
            // Persist imported items one by one (or batched if we optimized)
            for (const c of newCustomers) {
                if (!customers.some(ex => ex.id === c.id)) {
                    await saveDocument('brooks_customers', c);
                }
            }
            onShowStatus(`Imported customers successfully.`, 'success');
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing customers. Please check file format.', 'error');
        }
        e.target.value = '';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 flex items-center gap-2 text-sm font-semibold">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer shadow">
                        <Upload size={16}/> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers} />
                    </label>
                    <button onClick={() => { setSelectedCustomer(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                        <PlusCircle size={16}/> Add Customer
                    </button>
                </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 w-10 text-center">
                                <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => toggleSelectAll(filtered)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </th>
                            <th className="p-2">Name</th><th className="p-2">Account No</th><th className="p-2">Contact</th><th className="p-2">Postcode</th><th className="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} className="border-b hover:bg-gray-50">
                                <CheckboxCell id={c.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                <td className="p-2 font-medium">{c.forename} {c.surname} {c.companyName ? `(${c.companyName})` : ''}</td>
                                <td className="p-2 font-mono text-xs">{c.id}</td>
                                <td className="p-2">{c.phone || c.mobile || c.email}</td>
                                <td className="p-2">{c.postcode}</td>
                                <td className="p-2">
                                    <button onClick={() => { setSelectedCustomer(c); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-3">Edit</button>
                                    <button onClick={() => deleteItem(c.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <CustomerFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(c) => { updateItem(c); setIsModalOpen(false); }} 
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


import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Supplier } from '../../../types';
import { PlusCircle } from 'lucide-react';
import SupplierFormModal from '../../SupplierFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

export const ManagementSuppliersTab = () => {
    const { suppliers } = useData();
    const { updateItem, deleteItem } = useManagementTable(suppliers, 'brooks_suppliers');

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div>
            <div className="flex justify-end mb-4">
                 <button onClick={() => { setSelectedSupplier(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Supplier
                </button>
            </div>
             <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Company Name</th><th className="p-2">Contact Person</th><th className="p-2">Details</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">{s.name}</td>
                                <td className="p-2">{s.contactName}</td>
                                <td className="p-2 text-xs">{s.phone} / {s.email}</td>
                                <td className="p-2">
                                    <button onClick={() => { setSelectedSupplier(s); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-2">Edit</button>
                                    <button onClick={() => deleteItem(s.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <SupplierFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(s) => { updateItem(s); setIsModalOpen(false); }} 
                    supplier={selectedSupplier} 
                />
            )}
        </div>
    );
};

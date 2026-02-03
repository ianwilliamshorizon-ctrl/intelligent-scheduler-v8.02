import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Supplier } from '../../../types';
import { PlusCircle } from 'lucide-react';
import SupplierFormModal from '../../SupplierFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementSuppliersTab = () => {
    // We bring in the setter to sync global state after our local update
    const { suppliers, setSuppliers, refreshActiveData } = useData();
    
    // 1. Local State for instant feedback
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers || []);

    // 2. Sync local state with background data refreshes
    useEffect(() => {
        if (suppliers) {
            setLocalSuppliers(suppliers);
        }
    }, [suppliers]);

    const { deleteItem } = useManagementTable(suppliers, 'brooks_suppliers');

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    /**
     * handleSave
     * Replaces the old updateItem to ensure the UI updates instantly
     */
    const handleSave = async (updatedSupplier: Supplier) => {
        try {
            // A. Save to Database
            await saveDocument('brooks_suppliers', updatedSupplier);
            
            // B. Prepare the updated array
            const updateFn = (prev: Supplier[]) => {
                const exists = prev.find(s => s.id === updatedSupplier.id);
                if (exists) {
                    return prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s);
                }
                return [...prev, updatedSupplier];
            };

            // C. Update Local UI immediately
            setLocalSuppliers(updateFn);

            // D. Update Global Context
            if (setSuppliers) {
                setSuppliers(updateFn);
            }

            // E. Trigger background refresh
            await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedSupplier(null);
        } catch (error: any) {
            console.error("Supplier save failed:", error);
            alert(`Failed to save supplier: ${error.message}`);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Suppliers & Vendors</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage parts suppliers and service providers</p>
                </div>
                <button 
                    onClick={() => { setSelectedSupplier(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Supplier
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Company Name</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Contact Person</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Details</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {localSuppliers.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-bold text-gray-900">{s.name}</td>
                                    <td className="p-4 text-gray-600 font-medium">{s.contactName}</td>
                                    <td className="p-4">
                                        <div className="text-xs text-gray-500">{s.email}</div>
                                        <div className="text-xs font-bold text-indigo-600">{s.phone}</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => { setSelectedSupplier(s); setIsModalOpen(true); }} 
                                            className="text-indigo-600 font-black text-xs uppercase mr-4 hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm(`Delete ${s.name}?`)) deleteItem(s.id);
                                            }} 
                                            className="text-gray-300 hover:text-red-600 font-black text-xs uppercase transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {localSuppliers.length === 0 && (
                        <div className="p-12 text-center text-gray-400 italic">
                            No suppliers found.
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <SupplierFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedSupplier(null);
                    }} 
                    onSave={handleSave} 
                    supplier={selectedSupplier} 
                />
            )}
        </div>
    );
};
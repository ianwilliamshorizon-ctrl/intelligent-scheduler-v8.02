import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Supplier } from '../../../types';
import { PlusCircle, Building2, Mail, Phone } from 'lucide-react';
import SupplierFormModal from '../../SupplierFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementSuppliersTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // 1. DEFENSIVE DESTRUCTURING
    const { 
        suppliers = [], 
        setSuppliers, 
        refreshActiveData 
    } = useData();
    
    // 2. Local State for instant feedback
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers || []);

    // 3. Sync local state with context
    useEffect(() => {
        if (suppliers) {
            setLocalSuppliers(suppliers);
        }
    }, [suppliers]);

    const { deleteItem } = useManagementTable(localSuppliers || [], 'brooks_suppliers');

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter logic to match other tabs
    const filtered = (localSuppliers || []).filter(s => 
        (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (s.contactName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

    /**
     * handleSave
     * Ensures UI updates instantly and context stays in sync
     */
    const handleSave = async (updatedSupplier: Supplier) => {
        try {
            await saveDocument('brooks_suppliers', updatedSupplier);
            
            const updateFn = (prev: Supplier[]) => {
                const current = prev || [];
                const exists = current.find(s => s.id === updatedSupplier.id);
                if (exists) {
                    return current.map(s => s.id === updatedSupplier.id ? updatedSupplier : s);
                }
                return [...current, updatedSupplier];
            };

            setLocalSuppliers(updateFn);
            if (setSuppliers) setSuppliers(updateFn);

            if (refreshActiveData) await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedSupplier(null);
            onShowStatus('Supplier saved successfully.', 'success');
        } catch (error: any) {
            console.error("Supplier save failed:", error);
            onShowStatus(`Failed to save supplier: ${error.message}`, 'error');
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
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Company / Entity</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Contact Point</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Communication</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length > 0 ? (
                                filtered.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Building2 size={16}/></div>
                                                <div className="font-black text-gray-900 uppercase text-xs tracking-tight">{s.name}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-600 font-bold uppercase text-[11px]">{s.contactName || '---'}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Mail size={12} className="text-gray-300"/> {s.email || 'No Email'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600">
                                                    <Phone size={12} className="text-indigo-300"/> {s.phone || 'No Phone'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => { setSelectedSupplier(s); setIsModalOpen(true); }} 
                                                className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`Permanently remove ${s.name} from records?`)) deleteItem(s.id);
                                                }} 
                                                className="font-black text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                                        No suppliers matching your search criteria
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
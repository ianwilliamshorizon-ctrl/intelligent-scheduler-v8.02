import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Supplier } from '../../../types';
import { PlusCircle, Building2, Mail, Phone, SearchX } from 'lucide-react';
import SupplierFormModal from '../../SupplierFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementSuppliersTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // 1. Defensive Destructuring
    const { 
        suppliers = [], 
        setSuppliers, 
        refreshActiveData 
    } = useData();
    
    // 2. Local State for instant feedback
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(Array.isArray(suppliers) ? suppliers : []);

    // 3. Sync local state with context
    useEffect(() => {
        setLocalSuppliers(Array.isArray(suppliers) ? suppliers : []);
    }, [suppliers]);

    const { deleteItem } = useManagementTable(Array.isArray(suppliers) ? suppliers : [], 'brooks_suppliers');

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter logic with safety checks
    const filtered = localSuppliers.filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    /**
     * handleSave
     * Ensures UI updates instantly and context stays in sync with Cloud Settle Buffer
     */
    const handleSave = async (updatedSupplier: Supplier) => {
        try {
            await saveDocument('brooks_suppliers', updatedSupplier);
            
            const updateFn = (prev: Supplier[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(s => s.id === updatedSupplier.id);
                return exists 
                    ? current.map(s => s.id === updatedSupplier.id ? updatedSupplier : s)
                    : [...current, updatedSupplier];
            };

            // Immediate UI update for responsiveness
            setLocalSuppliers(updateFn);
            if (setSuppliers) setSuppliers(updateFn);

            setIsModalOpen(false);
            setSelectedSupplier(null);

            // Cloud Settle Buffer - Allow DB to index before re-fetching
            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }
            
            onShowStatus('Supplier saved successfully.', 'success');
        } catch (error: any) {
            console.error("Supplier save failed:", error);
            onShowStatus(`Failed to save supplier: ${error.message}`, 'error');
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={24} />
                        Suppliers & Vendors
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Manage parts suppliers and service providers</p>
                </div>
                <button 
                    onClick={() => { setSelectedSupplier(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Supplier
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Company / Entity</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Contact Point</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Communication</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                                filtered.map(s => (
                                    <tr key={s.id} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    <Building2 size={20}/>
                                                </div>
                                                <div className="font-black text-slate-900 uppercase tracking-tight text-sm">
                                                    {s.name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-slate-600 font-bold uppercase text-[11px] tracking-wide">
                                            {s.contactName || '---'}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Mail size={12} className="text-slate-300"/> {s.email || 'No Email'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600">
                                                    <Phone size={12} className="text-indigo-300"/> {s.phone || 'No Phone'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => { setSelectedSupplier(s); setIsModalOpen(true); }} 
                                                    className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 px-3 py-2 hover:bg-indigo-50 rounded-lg transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Permanently remove ${s.name} from records?`)) deleteItem(s.id);
                                                    }} 
                                                    className="font-black text-[10px] uppercase tracking-widest text-slate-300 hover:text-red-600 px-3 py-2 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <SearchX size={64} strokeWidth={1} />
                                            <span className="font-black uppercase tracking-[0.3em] text-xs">No Vendors Logged</span>
                                        </div>
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
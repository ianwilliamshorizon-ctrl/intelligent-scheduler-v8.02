import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage } from '../../../types';
import { PlusCircle, Edit3, Trash2, Package, Tag, Layers, SearchX } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';
import { saveDocument } from '../../../core/db/index';

export const ManagementPackagesTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { servicePackages = [], setServicePackages, taxRates, businessEntities, parts, refreshActiveData } = useData();
    const { selectedEntityId } = useApp();
    
    // 1. Local State for Instant UI Feedback
    const [localPackages, setLocalPackages] = useState<ServicePackage[]>(Array.isArray(servicePackages) ? servicePackages : []);

    useEffect(() => {
        setLocalPackages(Array.isArray(servicePackages) ? servicePackages : []);
    }, [servicePackages]);

    const { deleteItem } = useManagementTable(servicePackages, 'brooks_servicePackages');

    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filtering logic with defensive checks
    const filtered = localPackages.filter(p => 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Optimized Save with Settle Buffer
    const handleSave = async (updatedPackage: ServicePackage) => {
        try {
            await saveDocument('brooks_servicePackages', updatedPackage);
            
            const updateFn = (prev: ServicePackage[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(p => p.id === updatedPackage.id);
                return exists 
                    ? current.map(p => p.id === updatedPackage.id ? updatedPackage : p)
                    : [...current, updatedPackage];
            };

            // Immediate UI Update
            setLocalPackages(updateFn);
            if (setServicePackages) setServicePackages(updateFn);

            setIsModalOpen(false);
            setSelectedPackage(null);

            // 3. Cloud Settle Buffer
            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }

            onShowStatus('Service package configuration saved.', 'success');
        } catch (error: any) {
            onShowStatus(error.message || 'Failed to save package', 'error');
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Package className="text-indigo-600" size={24} />
                        Service Packages
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Standardized labor and parts bundles for rapid estimating</p>
                </div>
                <button 
                    onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> New Package
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Package Label</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Standard Price</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Management</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                                filtered.map(p => (
                                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                                                    <Layers size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 uppercase tracking-tight text-sm group-hover:text-indigo-600 transition-colors">
                                                        {p.name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Tag size={12} className="text-slate-300" />
                                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                                                            {p.id?.split('-')[0] || 'NEW'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                                {formatCurrency(p.totalPrice)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button 
                                                    onClick={() => { setSelectedPackage(p); setIsModalOpen(true); }} 
                                                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                    title="Edit Package"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Delete service package: ${p.name}?`)) deleteItem(p.id);
                                                    }} 
                                                    className="p-2.5 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Remove Package"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <SearchX size={64} strokeWidth={1} />
                                            <span className="font-black uppercase tracking-[0.3em] text-xs">No Packages Logged</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <ServicePackageFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedPackage(null);
                    }} 
                    onSave={handleSave} 
                    servicePackage={selectedPackage} 
                    taxRates={taxRates} 
                    entityId={selectedEntityId} 
                    businessEntities={businessEntities || []} 
                    parts={parts || []} 
                />
            )}
        </div>
    );
};
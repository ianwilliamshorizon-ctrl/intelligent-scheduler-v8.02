import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage } from '../../../types';
import { PlusCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';
import { saveDocument } from '../../../core/db/index';

export const ManagementPackagesTab = () => {
    const { servicePackages, setServicePackages, taxRates, businessEntities, parts, refreshActiveData } = useData();
    const { selectedEntityId } = useApp();
    
    // 1. Local State for instant UI feedback
    const [localPackages, setLocalPackages] = useState<ServicePackage[]>(servicePackages || []);

    // 2. Sync local state with global data (for background refreshes)
    useEffect(() => {
        if (servicePackages) {
            setLocalPackages(servicePackages);
        }
    }, [servicePackages]);

    const { deleteItem } = useManagementTable(servicePackages, 'brooks_servicePackages');

    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    /**
     * handleSave
     * Direct database write followed by immediate UI update
     */
    const handleSave = async (updatedPackage: ServicePackage) => {
        try {
            // A. Save to Database
            await saveDocument('brooks_servicePackages', updatedPackage);
            
            // B. Local update logic
            const updateFn = (prev: ServicePackage[]) => {
                const exists = prev.find(p => p.id === updatedPackage.id);
                if (exists) {
                    return prev.map(p => p.id === updatedPackage.id ? updatedPackage : p);
                }
                return [...prev, updatedPackage];
            };

            // C. Update Local UI instantly
            setLocalPackages(updateFn);

            // D. Update Global Context
            if (setServicePackages) {
                setServicePackages(updateFn);
            }

            // E. Background sync
            await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedPackage(null);
        } catch (error: any) {
            console.error("Package save failed:", error);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Service Packages</h2>
                    <p className="text-sm text-gray-500 font-medium">Standardized labor and parts bundles</p>
                </div>
                <button 
                    onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Service Package
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Package Name</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Total Price</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {localPackages.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{p.name}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">{p.id.split('-')[0]}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-indigo-600">
                                        {formatCurrency(p.totalPrice)}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button 
                                            onClick={() => { setSelectedPackage(p); setIsModalOpen(true); }} 
                                            className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg font-black text-xs uppercase transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm(`Delete ${p.name}?`)) deleteItem(p.id);
                                            }} 
                                            className="px-3 py-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg font-black text-xs uppercase transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {localPackages.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-gray-400 font-bold italic">
                                        No service packages found.
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
                    businessEntities={businessEntities} 
                    parts={parts} 
                />
            )}
        </div>
    );
};
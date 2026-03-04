
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage } from '../../../types';
import { PlusCircle, Copy, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';

interface ManagementPackagesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementPackagesTab: React.FC<ManagementPackagesTabProps> = ({ searchTerm, onShowStatus }) => {
    const { servicePackages, setServicePackages, taxRates, businessEntities, parts } = useData();
    const { selectedEntityId, setConfirmation } = useApp();
    const { updateItem, deleteItem } = useManagementTable<ServicePackage>(
        servicePackages,
        'brooks_servicePackages',
        setServicePackages
    );

    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredPackages = (servicePackages || []).filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleClone = (pkg: ServicePackage) => {
        const newPackage = JSON.parse(JSON.stringify(pkg));
        newPackage.id = `pkg_${Date.now()}`;
        newPackage.name = `${pkg.name} (Copy)`;
        if (newPackage.costItems && Array.isArray(newPackage.costItems)) {
            newPackage.costItems = newPackage.costItems.map(item => ({
                ...item,
                id: crypto.randomUUID()
            }));
        }
        updateItem(newPackage);
        onShowStatus(`Cloned "${pkg.name}" successfully.`, 'success');
    };
    
    const handleDelete = (pkg: ServicePackage) => {
        setConfirmation({
            isOpen: true,
            title: 'Confirm Deletion',
            message: `Are you sure you want to delete the package "${pkg.name}"? This action cannot be undone.`,
            type: 'warning',
            onConfirm: () => {
                deleteItem(pkg.id);
                onShowStatus(`Deleted "${pkg.name}" successfully.`, 'success');
            }
        });
    };

    return (
        <div>
            <div className="flex justify-end mb-4">
                 <button onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Service Package
                </button>
            </div>
             <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Package Name</th><th className="p-2 text-right">Total Price</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                        {filteredPackages.map(p => (
                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">{p.name}</td>
                                <td className="p-2 text-right">{formatCurrency(p.totalPrice)}</td>
                                <td className="p-2 flex items-center gap-2">
                                    <button onClick={() => { setSelectedPackage(p); setIsModalOpen(true); }} className="text-indigo-600 hover:underline">Edit</button>
                                    <button onClick={() => handleClone(p)} className="text-blue-600 hover:underline flex items-center gap-1"><Copy size={12}/> Clone</button>
                                    <button onClick={() => handleDelete(p)} className="text-red-600 hover:underline flex items-center gap-1"><Trash2 size={12}/> Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <ServicePackageFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(p) => { 
                        updateItem(p); 
                        setIsModalOpen(false); 
                        onShowStatus('Service package saved successfully', 'success'); 
                    }} 
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

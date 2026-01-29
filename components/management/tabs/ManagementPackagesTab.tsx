
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage } from '../../../types';
import { PlusCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';

export const ManagementPackagesTab = () => {
    const { servicePackages, taxRates, businessEntities, parts } = useData();
    const { selectedEntityId } = useApp();
    const { updateItem, deleteItem } = useManagementTable(servicePackages, 'brooks_servicePackages');

    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
                        {servicePackages.map(p => (
                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">{p.name}</td>
                                <td className="p-2 text-right">{formatCurrency(p.totalPrice)}</td>
                                <td className="p-2">
                                    <button onClick={() => { setSelectedPackage(p); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-2">Edit</button>
                                    <button onClick={() => deleteItem(p.id)} className="text-red-600 hover:underline">Delete</button>
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
                    onSave={(p) => { updateItem(p); setIsModalOpen(false); }} 
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

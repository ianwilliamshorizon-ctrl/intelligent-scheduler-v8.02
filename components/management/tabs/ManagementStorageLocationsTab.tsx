
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { StorageLocation } from '../../../types';
import { PlusCircle, Edit, Trash2, MapPin } from 'lucide-react';
import StorageLocationFormModal from '../../StorageLocationFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

interface ManagementStorageLocationsTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementStorageLocationsTab: React.FC<ManagementStorageLocationsTabProps> = ({ searchTerm, onShowStatus }) => {
    const { storageLocations, setStorageLocations, businessEntities } = useData();
    const { updateItem, deleteItem } = useManagementTable(storageLocations, 'brooks_storageLocations', setStorageLocations);

    const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredLocations = storageLocations.filter(loc => 
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (businessEntities.find(e => e.id === loc.entityId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by Entity
    const locationsByEntity = filteredLocations.reduce((acc, loc) => {
        const entityName = businessEntities.find(e => e.id === loc.entityId)?.name || 'Unknown Entity';
        if (!acc[entityName]) acc[entityName] = [];
        acc[entityName].push(loc);
        return acc;
    }, {} as Record<string, StorageLocation[]>);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Storage Locations</h3>
                <button onClick={() => { setSelectedLocation(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Location
                </button>
            </div>
            
            <div className="overflow-y-auto max-h-[70vh] border rounded-lg bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-3 font-semibold text-gray-600">Name</th>
                            <th className="p-3 font-semibold text-gray-600">Capacity (Slots)</th>
                            <th className="p-3 font-semibold text-gray-600">Weekly Rate</th>
                            <th className="p-3 font-semibold text-gray-600">Business Entity</th>
                            <th className="p-3 font-semibold text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {Object.keys(locationsByEntity).sort().map(entityName => (
                            <React.Fragment key={entityName}>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <td colSpan={5} className="p-2 font-bold text-gray-700 pl-4">{entityName}</td>
                                </tr>
                                {locationsByEntity[entityName]
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(loc => (
                                    <tr key={loc.id} className="hover:bg-gray-50">
                                        <td className="p-3 pl-6 font-medium text-gray-800 flex items-center gap-2">
                                            <MapPin size={16} className="text-gray-400"/> {loc.name}
                                        </td>
                                        <td className="p-3 text-gray-600 font-bold">{loc.capacity}</td>
                                        <td className="p-3 text-gray-600 font-bold">£{(loc.weeklyRate || 0).toFixed(2)}</td>
                                        <td className="p-3 text-gray-600">{entityName}</td>
                                        <td className="p-3 flex gap-2">
                                            <button onClick={() => { setSelectedLocation(loc); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this storage location?')) {
                                                    deleteItem(loc.id);
                                                }
                                            }} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {filteredLocations.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">No storage locations found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <StorageLocationFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(l) => { updateItem(l); setIsModalOpen(false); onShowStatus('Storage location saved.', 'success'); }} 
                    location={selectedLocation} 
                    businessEntities={businessEntities} 
                />
            )}
        </div>
    );
};

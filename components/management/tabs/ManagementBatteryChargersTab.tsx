
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { BatteryCharger } from '../../../types';
import { PlusCircle, Edit, Trash2, BatteryCharging } from 'lucide-react';
import BatteryChargerFormModal from '../../BatteryChargerFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

export const ManagementBatteryChargersTab = () => {
    const { batteryChargers, businessEntities } = useData();
    const { updateItem, deleteItem } = useManagementTable(batteryChargers, 'brooks_batteryChargers');

    const [selectedCharger, setSelectedCharger] = useState<BatteryCharger | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Battery Chargers</h3>
                <button onClick={() => { setSelectedCharger(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Charger
                </button>
            </div>
            
            <div className="overflow-y-auto max-h-[70vh] border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-3 font-semibold text-gray-600">Name</th>
                            <th className="p-3 font-semibold text-gray-600">Entity</th>
                            <th className="p-3 font-semibold text-gray-600">Location</th>
                            <th className="p-3 font-semibold text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {batteryChargers.map(charger => {
                            const entity = businessEntities.find(e => e.id === charger.entityId);
                            return (
                                <tr key={charger.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-medium text-gray-800 flex items-center gap-2">
                                        <BatteryCharging size={16} className="text-green-600"/>
                                        {charger.name}
                                    </td>
                                    <td className="p-3 text-gray-600">{entity?.name || 'Unknown'}</td>
                                    <td className="p-3 text-gray-600">{charger.locationDescription || '-'}</td>
                                    <td className="p-3 flex gap-2">
                                        <button onClick={() => { setSelectedCharger(charger); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => deleteItem(charger.id)} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {batteryChargers.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-500">No battery chargers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <BatteryChargerFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(c) => { updateItem(c); setIsModalOpen(false); }} 
                    charger={selectedCharger} 
                    businessEntities={businessEntities} 
                />
            )}
        </div>
    );
};

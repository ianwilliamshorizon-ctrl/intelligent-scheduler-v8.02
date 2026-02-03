import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { BatteryCharger } from '../../../types';
import { PlusCircle, Edit, Trash2, BatteryCharging } from 'lucide-react';
import BatteryChargerFormModal from '../../BatteryChargerFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementBatteryChargersTab = () => {
    const { batteryChargers, setBatteryChargers, businessEntities, refreshActiveData } = useData();
    
    // 1. Local State for instant feedback
    const [localChargers, setLocalChargers] = useState<BatteryCharger[]>(batteryChargers || []);

    // 2. Sync local state with global data (for background refreshes)
    useEffect(() => {
        if (batteryChargers) {
            setLocalChargers(batteryChargers);
        }
    }, [batteryChargers]);

    const { deleteItem } = useManagementTable(batteryChargers, 'brooks_batteryChargers');

    const [selectedCharger, setSelectedCharger] = useState<BatteryCharger | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    /**
     * handleSave
     * Persists to DB and updates local state immediately to prevent flicker
     */
    const handleSave = async (updatedCharger: BatteryCharger) => {
        try {
            // A. Save to Database
            await saveDocument('brooks_batteryChargers', updatedCharger);
            
            // B. Prepare the updated array
            const updateFn = (prev: BatteryCharger[]) => {
                const exists = prev.find(c => c.id === updatedCharger.id);
                if (exists) {
                    return prev.map(c => c.id === updatedCharger.id ? updatedCharger : c);
                }
                return [...prev, updatedCharger];
            };

            // C. Update Local UI instantly
            setLocalChargers(updateFn);

            // D. Update Global Context
            if (setBatteryChargers) {
                setBatteryChargers(updateFn);
            }

            // E. Trigger background refresh
            await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedCharger(null);
        } catch (error: any) {
            console.error("Charger save failed:", error);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Battery Chargers</h2>
                    <p className="text-sm text-gray-500 font-medium">Track charging station locations and assignments</p>
                </div>
                <button 
                    onClick={() => { setSelectedCharger(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Charger
                </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Charger Name</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Entity</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Location / Notes</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {localChargers.map(charger => {
                                const entity = (businessEntities || []).find(e => e.id === charger.entityId);
                                return (
                                    <tr key={charger.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4 font-bold text-gray-900 flex items-center gap-3">
                                            <div className="bg-green-50 p-1.5 rounded-lg">
                                                <BatteryCharging size={16} className="text-green-600"/>
                                            </div>
                                            {charger.name}
                                        </td>
                                        <td className="p-4 text-gray-600 font-medium">{entity?.name || 'Unknown'}</td>
                                        <td className="p-4 text-gray-500 text-xs italic">{charger.locationDescription || 'No description provided'}</td>
                                        <td className="p-4 text-right space-x-2">
                                            <button 
                                                onClick={() => { setSelectedCharger(charger); setIsModalOpen(true); }} 
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`Delete ${charger.name}?`)) deleteItem(charger.id);
                                                }} 
                                                className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {localChargers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-400 font-bold italic">
                                        No battery chargers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <BatteryChargerFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedCharger(null);
                    }} 
                    onSave={handleSave} 
                    charger={selectedCharger} 
                    businessEntities={businessEntities || []} 
                />
            )}
        </div>
    );
};
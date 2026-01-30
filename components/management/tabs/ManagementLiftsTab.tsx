
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Lift } from '../../../types';
import { PlusCircle, Edit, Trash2, ArrowUpCircle } from 'lucide-react';
import LiftFormModal from '../../LiftFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

export const ManagementLiftsTab = () => {
    const { lifts, businessEntities } = useData();
    const { updateItem, deleteItem } = useManagementTable(lifts, 'brooks_lifts');

    const [selectedLift, setSelectedLift] = useState<Lift | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Group lifts by Entity for better visualization
    const liftsByEntity = lifts.reduce((acc, lift) => {
        const entityName = businessEntities.find(e => e.id === lift.entityId)?.name || 'Unknown Entity';
        if (!acc[entityName]) acc[entityName] = [];
        acc[entityName].push(lift);
        return acc;
    }, {} as Record<string, Lift[]>);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Workshop Lifts & Bays</h3>
                <button onClick={() => { setSelectedLift(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Lift
                </button>
            </div>
            
            <div className="overflow-y-auto max-h-[70vh] border rounded-lg bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-3 font-semibold text-gray-600">Name</th>
                            <th className="p-3 font-semibold text-gray-600">Workshop Entity</th>
                            <th className="p-3 font-semibold text-gray-600">Type</th>
                            <th className="p-3 font-semibold text-gray-600">Color</th>
                            <th className="p-3 font-semibold text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {Object.keys(liftsByEntity).sort().map(entityName => (
                            <React.Fragment key={entityName}>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <td colSpan={5} className="p-2 font-bold text-gray-700 pl-4">{entityName}</td>
                                </tr>
                                {liftsByEntity[entityName]
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(lift => (
                                    <tr key={lift.id} className="hover:bg-gray-50">
                                        <td className="p-3 pl-6 font-medium text-gray-800 flex items-center gap-2">
                                            <ArrowUpCircle size={16} className="text-gray-400"/> {lift.name}
                                        </td>
                                        <td className="p-3 text-gray-600">{entityName}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${lift.type === 'MOT' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {lift.type}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full bg-${lift.color}-500 border border-gray-300`}></div>
                                                <span className="capitalize text-gray-600">{lift.color}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 flex gap-2">
                                            <button onClick={() => { setSelectedLift(lift); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => deleteItem(lift.id)} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {lifts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">No lifts configured. Click "Add Lift" to start.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <LiftFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(l) => { updateItem(l); setIsModalOpen(false); }} 
                    lift={selectedLift} 
                    businessEntities={businessEntities} 
                />
            )}
        </div>
    );
};

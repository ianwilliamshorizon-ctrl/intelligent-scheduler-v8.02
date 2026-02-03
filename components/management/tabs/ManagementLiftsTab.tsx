import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Lift } from '../../../types';
import { PlusCircle, Edit, Trash2, ArrowUpCircle } from 'lucide-react';
import LiftFormModal from '../../LiftFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementLiftsTab = () => {
    const { lifts, setLifts, businessEntities, refreshActiveData } = useData();
    
    // 1. Local State for instant feedback
    const [localLifts, setLocalLifts] = useState<Lift[]>(lifts || []);

    // 2. Sync local state with background data refreshes
    useEffect(() => {
        if (lifts) {
            setLocalLifts(lifts);
        }
    }, [lifts]);

    const { deleteItem } = useManagementTable(lifts, 'brooks_lifts');
    const [selectedLift, setSelectedLift] = useState<Lift | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    /**
     * handleSave
     * Persists to DB and updates local state immediately
     */
    const handleSave = async (updatedLift: Lift) => {
        try {
            await saveDocument('brooks_lifts', updatedLift);
            
            const updateFn = (prev: Lift[]) => {
                const exists = prev.find(l => l.id === updatedLift.id);
                if (exists) return prev.map(l => l.id === updatedLift.id ? updatedLift : l);
                return [...prev, updatedLift];
            };

            // Update UI
            setLocalLifts(updateFn);
            
            // Sync Context
            if (setLifts) {
                setLifts(updateFn);
            }

            await refreshActiveData(true);
            setIsModalOpen(false);
            setSelectedLift(null);
        } catch (error: any) {
            console.error("Lift save failed:", error);
            alert(`Error: ${error.message}`);
        }
    };

    // 3. Grouping logic using useMemo for performance
    const liftsByEntity = useMemo(() => {
        return localLifts.reduce((acc, lift) => {
            const entityName = (businessEntities || []).find(e => e.id === lift.entityId)?.name || 'Unknown Entity';
            if (!acc[entityName]) acc[entityName] = [];
            acc[entityName].push(lift);
            return acc;
        }, {} as Record<string, Lift[]>);
    }, [localLifts, businessEntities]);

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Workshop Lifts & Bays</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage physical workshop infrastructure</p>
                </div>
                <button 
                    onClick={() => { setSelectedLift(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Lift
                </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Name / ID</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Workshop Entity</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Type</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">UI Color</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {Object.keys(liftsByEntity).sort().map(entityName => (
                                <React.Fragment key={entityName}>
                                    <tr className="bg-gray-50/50">
                                        <td colSpan={5} className="p-3 pl-4 font-black text-[11px] text-indigo-600 uppercase tracking-wider">{entityName}</td>
                                    </tr>
                                    {liftsByEntity[entityName]
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(lift => (
                                        <tr key={lift.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 pl-6 font-bold text-gray-900">
                                                <div className="flex items-center gap-3">
                                                    <ArrowUpCircle size={16} className="text-gray-400"/> 
                                                    {lift.name}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 font-medium">{entityName}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tight ${lift.type === 'MOT' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {lift.type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full bg-${lift.color}-500 border border-gray-200`}></div>
                                                    <span className="capitalize text-xs font-bold text-gray-500">{lift.color}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button 
                                                    onClick={() => { setSelectedLift(lift); setIsModalOpen(true); }} 
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Delete ${lift.name}?`)) deleteItem(lift.id);
                                                    }} 
                                                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            {localLifts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 font-bold italic">No lifts configured.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <LiftFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedLift(null);
                    }} 
                    onSave={handleSave} 
                    lift={selectedLift} 
                    businessEntities={businessEntities || []} 
                />
            )}
        </div>
    );
};
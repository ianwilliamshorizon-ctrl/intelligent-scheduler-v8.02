import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Lift } from '../../../types';
import { PlusCircle, Edit3, Trash2, ArrowUpCircle, Drill, Info, Building2 } from 'lucide-react';
import LiftFormModal from '../../LiftFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementLiftsTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { lifts = [], setLifts, businessEntities = [], refreshActiveData } = useData();
    
    const [localLifts, setLocalLifts] = useState<Lift[]>(lifts || []);

    useEffect(() => {
        if (lifts) setLocalLifts(lifts);
    }, [lifts]);

    const { deleteItem } = useManagementTable(lifts, 'brooks_lifts');
    const [selectedLift, setSelectedLift] = useState<Lift | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSave = async (updatedLift: Lift) => {
        try {
            await saveDocument('brooks_lifts', updatedLift);
            
            const updateFn = (prev: Lift[]) => {
                const exists = prev.find(l => l.id === updatedLift.id);
                return exists ? prev.map(l => l.id === updatedLift.id ? updatedLift : l) : [...prev, updatedLift];
            };

            setLocalLifts(updateFn);
            if (setLifts) setLifts(updateFn);

            await refreshActiveData(true);
            setIsModalOpen(false);
            setSelectedLift(null);
            onShowStatus('Workshop lift updated successfully.', 'success');
        } catch (error: any) {
            onShowStatus(error.message || 'Failed to save lift', 'error');
        }
    };

    // Filter and Grouping logic
    const liftsByEntity = useMemo(() => {
        const filtered = localLifts.filter(l => 
            l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.type.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.reduce((acc, lift) => {
            const entityName = (businessEntities || []).find(e => e.id === lift.entityId)?.name || 'Independent / Unknown';
            if (!acc[entityName]) acc[entityName] = [];
            acc[entityName].push(lift);
            return acc;
        }, {} as Record<string, Lift[]>);
    }, [localLifts, businessEntities, searchTerm]);

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Drill className="text-indigo-600" size={24} />
                        Workshop Bays & Lifts
                    </h2>
                    <p className="text-sm text-slate-500 font-medium italic">Configure physical capacity and scheduler visual coding</p>
                </div>
                <button 
                    onClick={() => { setSelectedLift(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> New Bay
                </button>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Identifier</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Classification</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">UI Coding</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.keys(liftsByEntity).length > 0 ? (
                                Object.keys(liftsByEntity).sort().map(entityName => (
                                    <React.Fragment key={entityName}>
                                        <tr className="bg-slate-50/80 border-y border-slate-100">
                                            <td colSpan={4} className="px-6 py-2.5">
                                                <div className="flex items-center gap-2 text-indigo-600">
                                                    <Building2 size={12} />
                                                    <span className="font-black text-[10px] uppercase tracking-widest">{entityName}</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {liftsByEntity[entityName]
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(lift => (
                                            <tr key={lift.id} className="group hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                                                            <ArrowUpCircle size={18} />
                                                        </div>
                                                        <span className="font-bold text-slate-900 uppercase tracking-tight">{lift.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                                                        lift.type === 'MOT' 
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                    }`}>
                                                        {lift.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div 
                                                                className="w-8 h-4 rounded-md shadow-sm border border-black/5" 
                                                                style={{ backgroundColor: lift.color }}
                                                            ></div>
                                                            <div 
                                                                className="absolute -inset-1 rounded-lg opacity-20 blur-sm -z-10" 
                                                                style={{ backgroundColor: lift.color }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                                                            {lift.color}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button 
                                                            onClick={() => { setSelectedLift(lift); setIsModalOpen(true); }} 
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        >
                                                            <Edit3 size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if(window.confirm(`Decommission lift: ${lift.name}?`)) deleteItem(lift.id);
                                                            }} 
                                                            className="p-2 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Info size={40} strokeWidth={1} />
                                            <span className="font-black text-xs uppercase tracking-widest text-slate-500">No matching bays found</span>
                                        </div>
                                    </td>
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
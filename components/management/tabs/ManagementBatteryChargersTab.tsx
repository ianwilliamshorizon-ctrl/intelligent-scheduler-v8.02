import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { BatteryCharger } from '../../../types';
import { PlusCircle, Edit3, Trash2, BatteryCharging, MapPin, Building2, Zap } from 'lucide-react';
import BatteryChargerFormModal from '../../BatteryChargerFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementBatteryChargersTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { batteryChargers = [], setBatteryChargers, businessEntities = [], refreshActiveData } = useData();
    
    const [localChargers, setLocalChargers] = useState<BatteryCharger[]>(batteryChargers || []);

    useEffect(() => {
        if (batteryChargers) setLocalChargers(batteryChargers);
    }, [batteryChargers]);

    const { deleteItem } = useManagementTable(batteryChargers, 'brooks_batteryChargers');

    const [selectedCharger, setSelectedCharger] = useState<BatteryCharger | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter logic
    const filtered = localChargers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.locationDescription || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = async (updatedCharger: BatteryCharger) => {
        try {
            await saveDocument('brooks_batteryChargers', updatedCharger);
            
            const updateFn = (prev: BatteryCharger[]) => {
                const exists = prev.find(c => c.id === updatedCharger.id);
                return exists 
                    ? prev.map(c => c.id === updatedCharger.id ? updatedCharger : c) 
                    : [...prev, updatedCharger];
            };

            setLocalChargers(updateFn);
            if (setBatteryChargers) setBatteryChargers(updateFn);
            
            await refreshActiveData(true);
            setIsModalOpen(false);
            setSelectedCharger(null);
            onShowStatus('Charger configuration saved.', 'success');
        } catch (error: any) {
            onShowStatus(error.message || 'Failed to save charger', 'error');
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Zap className="text-emerald-500" size={24} fill="currentColor" />
                        Charging Stations
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Hardware asset tracking and site deployment</p>
                </div>
                <button 
                    onClick={() => { setSelectedCharger(null); setIsModalOpen(true); }} 
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Register Charger
                </button>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Hardware Label</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Assigned Entity</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Deployment Notes</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Management</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                                filtered.map(charger => {
                                    const entity = (businessEntities || []).find(e => e.id === charger.entityId);
                                    return (
                                        <tr key={charger.id} className="group hover:bg-slate-50/50 transition-all">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                                                        <BatteryCharging size={20} />
                                                    </div>
                                                    <span className="font-black text-slate-900 uppercase tracking-tight text-sm">
                                                        {charger.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-slate-600 font-bold uppercase text-[11px] tracking-tight">
                                                    <Building2 size={14} className="text-slate-400" />
                                                    {entity?.name || <span className="text-slate-300 italic">Unassigned</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-start gap-2 max-w-xs">
                                                    <MapPin size={14} className="text-slate-300 mt-0.5 shrink-0" />
                                                    <span className="text-slate-500 text-xs font-medium leading-relaxed">
                                                        {charger.locationDescription || 'No specific location data provided.'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end items-center gap-1">
                                                    <button 
                                                        onClick={() => { setSelectedCharger(charger); setIsModalOpen(true); }} 
                                                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        title="Edit Configuration"
                                                    >
                                                        <Edit3 size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if(window.confirm(`Permanently remove ${charger.name}?`)) deleteItem(charger.id);
                                                        }} 
                                                        className="p-2.5 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Decommission"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <BatteryCharging size={64} strokeWidth={1} />
                                            <span className="font-black uppercase tracking-[0.3em] text-xs">No Assets Logged</span>
                                        </div>
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
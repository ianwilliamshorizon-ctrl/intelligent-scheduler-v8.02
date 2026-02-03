import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Upload, Zap, RefreshCw, User, Hash, Car, SearchX, FileText } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveImage, getImage } from '../../../utils/imageStore';
import VehicleFormModal from '../../VehicleFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementVehiclesTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // 1. Initial Data Safety
    const { 
        vehicles = [], 
        customers = [], 
        inspectionDiagrams = [], 
        setVehicles, 
        refreshActiveData 
    } = useData();
    
    const [localVehicles, setLocalVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setLocalVehicles(Array.isArray(vehicles) ? vehicles : []);
    }, [vehicles]);

    const { selectedIds, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(localVehicles, 'brooks_vehicles');

    // 2. Defensive Filter Logic
    const filtered = useMemo(() => {
        const term = (searchTerm || '').toLowerCase().trim();
        if (!term) return localVehicles;
        return localVehicles.filter(v => 
            (v.registration || '').toLowerCase().includes(term) ||
            (v.make || '').toLowerCase().includes(term) ||
            (v.model || '').toLowerCase().includes(term)
        );
    }, [localVehicles, searchTerm]);

    const handleSave = async (updatedVehicle: Vehicle) => {
        try {
            await saveDocument('brooks_vehicles', updatedVehicle);
            const updateFn = (prev: Vehicle[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(v => v.id === updatedVehicle.id);
                return exists ? current.map(v => v.id === updatedVehicle.id ? updatedVehicle : v) : [...current, updatedVehicle];
            };
            setLocalVehicles(updateFn);
            if (setVehicles) setVehicles(updateFn);
            
            setIsModalOpen(false);
            setSelectedVehicle(null);
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus('Vehicle registry updated.', 'success');
        } catch (error) {
            onShowStatus('Failed to save vehicle.', 'error');
        }
    };

    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        onShowStatus("Processing import...", 'info');
        try {
            const data = await parseCsv(file);
            const importedList: Vehicle[] = [];

            for (const row of data) {
                const id = row.id || crypto.randomUUID();
                const newVehicle: Vehicle = {
                    id,
                    registration: (row.registration || '').toUpperCase().replace(/\s/g, ''),
                    make: row.make || 'Unknown',
                    model: row.model || 'Unknown',
                    customerId: row.customerId || 'unassigned',
                    ...row,
                    images: Array.isArray(row.images) ? row.images : [] 
                };
                
                await saveDocument('brooks_vehicles', newVehicle);
                importedList.push(newVehicle);
            }

            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus(`Imported ${importedList.length} vehicles.`, 'success');
        } catch (err) {
            onShowStatus('Error importing vehicles.', 'error');
        }
        e.target.value = '';
    };

    const autoAssignVehicleDiagrams = async () => {
        const diagramsList = Array.isArray(inspectionDiagrams) ? inspectionDiagrams : [];
        if (!diagramsList.length) { 
            onShowStatus("Diagram library is empty.", 'error'); 
            return; 
        }
        
        const candidates = localVehicles.filter(v => {
            const imgs = Array.isArray(v.images) ? v.images : [];
            return !imgs.some(img => img.isPrimaryDiagram);
        });

        if (candidates.length === 0) { 
            onShowStatus("No vehicles require assignments.", 'info'); 
            return; 
        }
        
        setIsUpdating(true);
        let assignedCount = 0;

        try {
            for (const v of candidates) {
                let bestMatch: InspectionDiagram | undefined;
                let bestScore = 0;
                const vMake = (v.make || '').toLowerCase().trim();
                const vModel = (v.model || '').toLowerCase().trim();
                
                for (const d of diagramsList) {
                    let score = 0;
                    const dMake = (d.make || '').toLowerCase().trim();
                    const dModel = (d.model || '').toLowerCase().trim();
                    if (dMake === vMake && dModel === vModel) score = 100;
                    else if (dMake === vMake && vModel.includes(dModel)) score = 80;
                    if (score > bestScore) { bestScore = score; bestMatch = d; }
                }

                if (bestMatch && bestScore > 0) {
                    const imageData = await getImage(bestMatch.imageId);
                    if (imageData) {
                        const newImageId = `veh_diag_${v.id}_${Date.now()}`;
                        await saveImage(newImageId, imageData);
                        const updatedV = { 
                            ...v, 
                            images: [...(Array.isArray(v.images) ? v.images : []), { id: newImageId, isPrimaryDiagram: true }] 
                        };
                        await saveDocument('brooks_vehicles', updatedV);
                        assignedCount++;
                    }
                }
            }
            
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus(`Successfully linked ${assignedCount} diagrams.`, 'success');
        } catch (e) {
            onShowStatus("Auto-assignment failed.", 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Car className="text-indigo-600" size={24} />
                        Vehicle Registry
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Global fleet management and technical specifications</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-rose-100 transition-all border border-rose-100">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={autoAssignVehicleDiagrams} disabled={isUpdating} className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm">
                        {isUpdating ? <RefreshCw size={16} className="animate-spin text-indigo-600"/> : <Zap size={16} className="text-amber-500"/>} 
                        Auto-Link Diagrams
                    </button>
                    <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
                        <Upload size={16} className="text-indigo-600"/> Import
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportVehicles} />
                    </label>
                    <button onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                        <PlusCircle size={16}/> Add Vehicle
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={filtered.length > 0 && selectedIds.size === filtered.length} 
                                        onChange={() => toggleSelectAll(filtered)} 
                                        className="rounded border-slate-300 text-indigo-600 w-4 h-4" 
                                    />
                                </th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Registration</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Specs & Technical</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Ownership</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(v => {
                                const owner = (Array.isArray(customers) ? customers : []).find(c => c.id === v.customerId);
                                const hasDiagram = Array.isArray(v.images) && v.images.some(img => img.isPrimaryDiagram);
                                
                                return (
                                    <tr key={v.id} className="hover:bg-slate-50/50 transition-all group">
                                        <CheckboxCell id={v.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                        <td className="px-6 py-5">
                                            {/* Restored the Amber/Yellow Plate styling */}
                                            <span className="bg-amber-400 text-slate-900 px-3 py-1 rounded font-black text-sm border-2 border-slate-900 tracking-tighter shadow-sm uppercase inline-block">
                                                {v.registration}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-black text-slate-900 uppercase text-xs tracking-tight">{v.make} {v.model}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                                                    <Hash size={10}/> {v.vin || 'NO VIN PROVIDED'}
                                                </div>
                                                {hasDiagram && (
                                                    <div className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border border-emerald-100">
                                                        <FileText size={10} /> Diagram
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-tight">
                                                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                                                    <User size={12} />
                                                </div>
                                                {owner ? `${owner.forename} ${owner.surname}` : <span className="text-slate-300 italic font-medium lowercase">unassigned</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setSelectedVehicle(v); setIsModalOpen(true); }} className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all">Edit</button>
                                                <button onClick={() => { if(window.confirm('Delete vehicle?')) deleteItem(v.id); }} className="font-black text-[10px] uppercase tracking-widest text-slate-300 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <SearchX size={64} strokeWidth={1} />
                                            <span className="font-black uppercase tracking-[0.3em] text-xs">No Records Found</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedVehicle(null);
                    }} 
                    onSave={handleSave} 
                    vehicle={selectedVehicle} 
                    customers={Array.isArray(customers) ? customers : []} 
                />
            )}
        </div>
    );
};
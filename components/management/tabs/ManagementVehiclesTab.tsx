import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Upload, Zap, RefreshCw, User, Hash } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveImage, getImage } from '../../../utils/imageStore';
import VehicleFormModal from '../../VehicleFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementVehiclesTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // 1. DEFENSIVE DESTRUCTURING: Fallback to [] for all arrays to prevent Production crashes
    const { 
        vehicles = [], 
        customers = [], 
        inspectionDiagrams = [], 
        setVehicles, 
        refreshActiveData 
    } = useData();
    
    // 2. Local State for Instant UI Feedback
    const [localVehicles, setLocalVehicles] = useState<Vehicle[]>(vehicles || []);

    // 3. Sync with Global Data Context
    useEffect(() => {
        if (vehicles) setLocalVehicles(vehicles);
    }, [vehicles]);

    const { selectedIds, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(localVehicles || [], 'brooks_vehicles');

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Filter logic with defensive string handling
    const filtered = (localVehicles || []).filter(v => 
        (v.registration || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (v.make || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (v.model || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

    const handleSave = async (updatedVehicle: Vehicle) => {
        try {
            await saveDocument('brooks_vehicles', updatedVehicle);
            const updateFn = (prev: Vehicle[]) => {
                const current = prev || [];
                const exists = current.find(v => v.id === updatedVehicle.id);
                return exists ? current.map(v => v.id === updatedVehicle.id ? updatedVehicle : v) : [...current, updatedVehicle];
            };
            setLocalVehicles(updateFn);
            if (setVehicles) setVehicles(updateFn);
            
            setIsModalOpen(false);
            setSelectedVehicle(null);
            if (refreshActiveData) await refreshActiveData(true);
            onShowStatus('Vehicle saved successfully.', 'success');
        } catch (error) {
            onShowStatus('Failed to save vehicle.', 'error');
        }
    };

    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        onShowStatus("Importing vehicles...", 'info');
        try {
            const data = await parseCsv(file);
            const importedList: Vehicle[] = [];
            const currentList = localVehicles || [];

            for (const row of data) {
                const id = row.id || crypto.randomUUID();
                const newVehicle: Vehicle = {
                    id,
                    registration: (row.registration || '').toUpperCase().replace(/\s/g, ''),
                    make: row.make || 'Unknown',
                    model: row.model || 'Unknown',
                    customerId: row.customerId || 'unknown_owner',
                    ...row
                };
                
                if (!currentList.some(ex => ex.id === id)) {
                    await saveDocument('brooks_vehicles', newVehicle);
                    importedList.push(newVehicle);
                }
            }

            if (importedList.length > 0) {
                const finalUpdate = (prev: Vehicle[]) => [...(prev || []), ...importedList];
                setLocalVehicles(finalUpdate);
                if (setVehicles) setVehicles(finalUpdate);
            }
            onShowStatus(`Imported ${importedList.length} vehicles.`, 'success');
            if (refreshActiveData) await refreshActiveData(true);
        } catch (err) {
            onShowStatus('Error importing vehicles.', 'error');
        }
        e.target.value = '';
    };

    const autoAssignVehicleDiagrams = async () => {
        const diagramsList = inspectionDiagrams || [];
        if (!diagramsList.length) { 
            onShowStatus("Library is empty. Upload diagrams first.", 'error'); 
            return; 
        }
        
        const candidates = (localVehicles || []).filter(v => !v.images?.some(img => img.isPrimaryDiagram));
        if (candidates.length === 0) { 
            onShowStatus("All vehicles already have diagrams.", 'success'); 
            return; 
        }
        
        setIsUpdating(true);
        let assignedCount = 0;
        const updatedVehicles = [...(localVehicles || [])];

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
                            images: [...(v.images || []), { id: newImageId, isPrimaryDiagram: true }] 
                        };
                        await saveDocument('brooks_vehicles', updatedV);
                        
                        const idx = updatedVehicles.findIndex(veh => veh.id === v.id);
                        if (idx !== -1) updatedVehicles[idx] = updatedV;
                        assignedCount++;
                    }
                }
            }
            
            setLocalVehicles(updatedVehicles);
            if (setVehicles) setVehicles(updatedVehicles);
            onShowStatus(`Assigned diagrams to ${assignedCount} vehicles.`, 'success');
        } catch (e) {
            onShowStatus("Error during auto-assignment.", 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Vehicle Registry</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage fleet details and inspection diagrams</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-colors border border-red-100">
                            <Trash2 size={18}/> Delete ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={autoAssignVehicleDiagrams} disabled={isUpdating} className="bg-purple-50 text-purple-600 border-2 border-purple-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 disabled:opacity-50 transition-all">
                        {isUpdating ? <RefreshCw size={18} className="animate-spin"/> : <Zap size={18}/>} Auto-Assign
                    </button>
                    <label className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 cursor-pointer transition-all active:scale-95 shadow-sm">
                        <Upload size={18}/> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportVehicles} />
                    </label>
                    <button onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                        <PlusCircle size={18}/> Add Vehicle
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={() => toggleSelectAll(filtered)} className="rounded border-gray-300 text-indigo-600 w-4 h-4" />
                                </th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Registration</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Make & Model</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Registered Owner</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(v => {
                                const owner = (customers || []).find(c => c.id === v.customerId);
                                const hasDiagram = v.images?.some(img => img.isPrimaryDiagram);
                                return (
                                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <CheckboxCell id={v.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                        <td className="p-4">
                                            <span className="bg-yellow-400 text-black px-3 py-1 rounded font-black text-sm border-2 border-black tracking-tighter shadow-sm uppercase inline-block">
                                                {v.registration}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-900 uppercase text-xs">{v.make} {v.model}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight flex items-center gap-1">
                                                    <Hash size={10}/> {v.vin || 'NO VIN'}
                                                </div>
                                                {hasDiagram && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Diagram Linked</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-gray-600 font-medium text-xs">
                                                <User size={14} className="text-gray-300"/>
                                                {owner ? `${owner.forename} ${owner.surname}` : <span className="text-gray-300 italic">Unassigned</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => { setSelectedVehicle(v); setIsModalOpen(true); }} className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all">Edit</button>
                                            <button onClick={() => { if(window.confirm('Delete vehicle?')) deleteItem(v.id); }} className="font-black text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all">Delete</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No vehicles found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    vehicle={selectedVehicle} 
                    customers={customers || []} 
                />
            )}
        </div>
    );
};
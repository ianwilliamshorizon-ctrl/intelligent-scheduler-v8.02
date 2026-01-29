
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Upload, Zap, RefreshCw } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveImage, getImage } from '../../../utils/imageStore';
import VehicleFormModal from '../../VehicleFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementVehiclesTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { vehicles, customers, inspectionDiagrams } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(vehicles, 'brooks_vehicles');

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const filtered = vehicles.filter(v => 
        v.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseCsv(file);
            const newVehicles: Vehicle[] = data.map((row: any) => ({
                id: row.id || crypto.randomUUID(),
                registration: (row.registration || '').toUpperCase().replace(/\s/g, ''),
                make: row.make || 'Unknown',
                model: row.model || 'Unknown',
                customerId: row.customerId || 'unknown_owner',
                ...row
            }));
            
            // Persistent Save
            for (const v of newVehicles) {
                if (!vehicles.some(ex => ex.id === v.id)) {
                    await saveDocument('brooks_vehicles', v);
                }
            }
            onShowStatus(`Imported vehicles successfully.`, 'success');
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing vehicles. Please check file format.', 'error');
        }
        e.target.value = '';
    };

    const autoAssignVehicleDiagrams = async () => {
        if (!inspectionDiagrams || inspectionDiagrams.length === 0) { onShowStatus("Library is empty. Upload diagrams first.", 'error'); return; }
        const candidates = vehicles.filter(v => !v.images?.some(img => img.isPrimaryDiagram));
        if (candidates.length === 0) { onShowStatus("All vehicles already have diagrams.", 'success'); return; }
        
        setIsUpdating(true);
        onShowStatus(`Scanning library for matches...`, 'info');
        
        let assignedCount = 0;
        try {
            for (const v of candidates) {
                let bestMatch: InspectionDiagram | undefined;
                let bestScore = 0;
                const vMake = (v.make || '').toLowerCase().trim();
                const vModel = (v.model || '').toLowerCase().trim();
                const vFull = `${vMake} ${vModel}`;
                for (const d of inspectionDiagrams) {
                    let score = 0;
                    const dMake = (d.make || '').toLowerCase().trim();
                    const dModel = (d.model || '').toLowerCase().trim();
                    const dFull = `${dMake} ${dModel}`;
                    if (dMake === vMake && dModel === vModel) score = 100;
                    else if (dMake === vMake && vModel.includes(dModel) && dModel.length > 2) score = 80;
                    else if (vFull.includes(dModel) && dModel.length > 3) score = 60;
                    else if (dModel === 'generic' || dModel === 'saloon') score = 1;
                    if (score > bestScore) { bestScore = score; bestMatch = d; }
                }
                if (bestMatch && bestScore > 0) {
                    try {
                        const imageData = await getImage(bestMatch.imageId);
                        if (imageData) {
                             const newImageId = `veh_diag_${v.id}_${Date.now()}`;
                             await saveImage(newImageId, imageData);
                             const newImages = v.images ? [...v.images] : [];
                             newImages.push({ id: newImageId, isPrimaryDiagram: true });
                             
                             // Persistent Save for this vehicle
                             await saveDocument('brooks_vehicles', { ...v, images: newImages });
                             assignedCount++;
                        }
                    } catch (imgErr) { console.error(`Failed to assign diagram to vehicle ${v.registration}`, imgErr); }
                }
            }
            if (assignedCount > 0) {
                onShowStatus(`Success! Assigned diagrams to ${assignedCount} vehicles.`, 'success');
            } else { onShowStatus("Scan complete. No suitable matches found.", 'info'); }
        } catch (e) { console.error("Auto assign error", e); onShowStatus("Error during auto-assignment.", 'error'); } finally { setIsUpdating(false); }
    };

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                     {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 flex items-center gap-2 text-sm font-semibold">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={autoAssignVehicleDiagrams} disabled={isUpdating} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 shadow flex items-center gap-2 disabled:opacity-50">
                        {isUpdating ? <RefreshCw size={16} className="animate-spin"/> : <Zap size={16}/>} Auto-Assign Diagrams
                    </button>
                    <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer shadow">
                        <Upload size={16}/> Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportVehicles} />
                    </label>
                    <button onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                        <PlusCircle size={16}/> Add Vehicle
                    </button>
                </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 w-10 text-center">
                                <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => toggleSelectAll(filtered)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </th>
                            <th className="p-2">Registration</th><th className="p-2">Make/Model</th><th className="p-2">Owner</th><th className="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(v => {
                            const owner = customers.find(c => c.id === v.customerId);
                            return (
                                <tr key={v.id} className="border-b hover:bg-gray-50">
                                    <CheckboxCell id={v.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                    <td className="p-2 font-mono font-bold">{v.registration}</td>
                                    <td className="p-2">{v.make} {v.model}</td>
                                    <td className="p-2">{owner ? `${owner.forename} ${owner.surname}` : 'Unknown'}</td>
                                    <td className="p-2">
                                        <button onClick={() => { setSelectedVehicle(v); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-3">Edit</button>
                                        <button onClick={() => deleteItem(v.id)} className="text-red-600 hover:underline">Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(v) => { updateItem(v); setIsModalOpen(false); }} 
                    vehicle={selectedVehicle} 
                    customers={customers} 
                />
            )}
        </div>
    );
};

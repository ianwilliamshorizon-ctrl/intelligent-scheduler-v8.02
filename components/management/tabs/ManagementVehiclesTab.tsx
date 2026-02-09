import React, { useState, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Vehicle, InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Upload, Zap, RefreshCw, Search } from 'lucide-react';
import { CheckboxCell } from '../shared/CheckboxCell';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveImage, getImage } from '../../../utils/imageStore';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import VehicleFormModal from '../../VehicleFormModal';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * HELPER: Highlight matching text in yellow
 */
const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    if (words.length === 0) return <>{text}</>;

    const pattern = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(pattern);

    return (
        <>
            {parts.map((part, i) => 
                pattern.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-black rounded-sm px-0.5">{part}</mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

export const ManagementVehiclesTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { vehicles, customers, inspectionDiagrams, jobs, estimates, invoices } = useData();
    const { selectedIds, updateItem, deleteItem, toggleSelection, toggleSelectAll, bulkDelete } = useManagementTable(vehicles, 'brooks_vehicles');

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    /**
     * SMART FRAGMENT SEARCH
     * Matches multiple words against Reg, Make, and Model
     */
    const filtered = useMemo(() => {
        const list = vehicles || [];
        if (!searchTerm) return list;
        
        const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word.length > 0);
        
        return list.filter(v => {
            const vData = `${v.registration} ${v.make} ${v.model}`.toLowerCase();
            return searchWords.every(word => vData.includes(word));
        });
    }, [vehicles, searchTerm]);

    /**
     * BATCH IMPORT (High Speed)
     */
    const handleImportVehicles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsImporting(true);
        onShowStatus("Processing batch vehicle import...", "info");

        try {
            const data = await parseCsv(file);
            const batch = writeBatch(db);
            let addedCount = 0;
            const existingIds = new Set(vehicles.map(v => v.id));

            for (const row of data) {
                const id = row.id || crypto.randomUUID();
                if (!existingIds.has(id)) {
                    const vehicleData = {
                        ...row,
                        id,
                        registration: String(row.registration || '').toUpperCase().replace(/\s/g, ''),
                        make: String(row.make || 'Unknown'),
                        model: String(row.model || 'Unknown'),
                        customerId: row.customerId || 'unknown_owner',
                    };

                    const docRef = doc(collection(db, 'brooks_vehicles'), id);
                    batch.set(docRef, vehicleData);
                    addedCount++;
                }

                if (addedCount > 0 && addedCount % 400 === 0) {
                    await batch.commit();
                }
            }

            if (addedCount > 0) {
                await batch.commit();
                onShowStatus(`Successfully imported ${addedCount} vehicles.`, 'success');
            } else {
                onShowStatus('No new vehicles to import.', 'info');
            }
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing vehicles.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    /**
     * AUTO-ASSIGN DIAGRAMS
     */
    const autoAssignVehicleDiagrams = async () => {
        if (!inspectionDiagrams || inspectionDiagrams.length === 0) { 
            onShowStatus("Library is empty. Upload diagrams first.", 'error'); 
            return; 
        }
        const candidates = vehicles.filter(v => !v.images?.some(img => img.isPrimaryDiagram));
        if (candidates.length === 0) { 
            onShowStatus("All vehicles already have diagrams.", 'success'); 
            return; 
        }
        
        setIsUpdating(true);
        onShowStatus(`Scanning library for matches...`, 'info');
        
        let assignedCount = 0;
        try {
            for (const v of candidates) {
                let bestMatch: InspectionDiagram | undefined;
                let bestScore = 0;
                
                const vMake = String(v.make || '').toLowerCase().trim();
                const vModel = String(v.model || '').toLowerCase().trim();
                const vFull = `${vMake} ${vModel}`;

                for (const d of inspectionDiagrams) {
                    let score = 0;
                    const dMake = String(d.make || '').toLowerCase().trim();
                    const dModel = String(d.model || '').toLowerCase().trim();

                    if (dMake === vMake && dModel === vModel) score = 100;
                    else if (dMake === vMake && vModel.includes(dModel) && dModel.length > 2) score = 80;
                    else if (vFull.includes(dModel) && dModel.length > 3) score = 60;
                    else if (dModel === 'generic' || dModel === 'saloon') score = 1;
                    
                    if (score > bestScore) { 
                        bestScore = score; 
                        bestMatch = d; 
                    }
                }

                if (bestMatch && bestScore > 0) {
                    const imageData = await getImage(bestMatch.imageId);
                    if (imageData) {
                        const newImageId = `veh_diag_${v.id}_${Date.now()}`;
                        await saveImage(newImageId, imageData);
                        const newImages = v.images ? [...v.images] : [];
                        newImages.push({ id: newImageId, isPrimaryDiagram: true });
                        
                        await updateItem({ ...v, images: newImages });
                        assignedCount++;
                    }
                }
            }
            onShowStatus(assignedCount > 0 ? `Assigned diagrams to ${assignedCount} vehicles.` : "No matches found.", 'info');
        } catch (e) { 
            onShowStatus("Error during auto-assignment.", 'error'); 
        } finally { 
            setIsUpdating(false); 
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={bulkDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm font-bold border border-red-200 shadow-sm transition-all">
                            <Trash2 size={16}/> Delete ({selectedIds.size})
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={autoAssignVehicleDiagrams} disabled={isUpdating} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 shadow-md flex items-center gap-2 text-sm font-semibold disabled:opacity-50 transition-all">
                        {isUpdating ? <RefreshCw size={16} className="animate-spin"/> : <Zap size={16}/>} Auto-Assign Diagrams
                    </button>
                    <label className={`flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm text-sm font-semibold transition-all ${isImporting ? 'opacity-50' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin text-blue-600" /> : <Upload size={16} className="text-blue-600"/>}
                        Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportVehicles} disabled={isImporting} />
                    </label>
                    <button onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 text-sm font-semibold transition-all">
                        <PlusCircle size={16}/> Add Vehicle
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-y-auto max-h-[72vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => toggleSelectAll(filtered)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                </th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Registration</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Make / Model</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider">Owner</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[11px] tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <Search size={24} className="text-gray-300 mx-auto mb-2" />
                                        <div className="text-gray-400 text-lg">No matching vehicles</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(v => {
                                    const owner = customers.find(c => c.id === v.customerId);
                                    return (
                                        <tr key={v.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <CheckboxCell id={v.id} selectedIds={selectedIds} onToggle={toggleSelection} />
                                            <td className="p-4">
                                                <span className="font-mono font-bold bg-[#FFCC00] text-black border border-black/20 px-2 py-1 rounded text-sm shadow-sm">
                                                    <HighlightText text={String(v.registration)} highlight={searchTerm} />
                                                </span>
                                            </td>
                                            <td className="p-4 font-semibold text-gray-700">
                                                <HighlightText text={`${v.make} ${v.model}`} highlight={searchTerm} />
                                            </td>
                                            <td className="p-4 text-gray-600 font-medium">{getCustomerDisplayName(owner)}</td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setSelectedVehicle(v); setIsModalOpen(true); }} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-all shadow-sm">Edit</button>
                                                    <button onClick={() => deleteItem(v.id)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs transition-all shadow-sm">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <VehicleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(v) => { updateItem(v); setIsModalOpen(false); }} 
                    vehicle={selectedVehicle} 
                    customers={customers}
                    jobs={jobs}
                    estimates={estimates}
                    invoices={invoices}
                />
            )}
        </div>
    );
};
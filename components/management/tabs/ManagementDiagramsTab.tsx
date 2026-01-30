import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Edit, FolderInput, CarFront } from 'lucide-react';
import AsyncImage from '../../AsyncImage';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveImage } from '../../../utils/imageStore';
import InspectionDiagramFormModal from '../../InspectionDiagramFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementDiagramsTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    // FIX: Destructure with a default empty array to prevent the 'filter' error
    const { inspectionDiagrams = [] } = useData(); 
    
    // Safety check for the hook as well
    const { updateItem, deleteItem } = useManagementTable(inspectionDiagrams, 'brooks_inspectionDiagrams');

    const [selectedDiagram, setSelectedDiagram] = useState<InspectionDiagram | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter now safe because inspectionDiagrams is guaranteed to be an array
    const filtered = inspectionDiagrams.filter(d => 
        (d.make?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (d.model?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const handleBulkUploadDiagrams = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        onShowStatus("Uploading diagrams...", 'info');
        const files: File[] = Array.from(e.target.files);
        let successCount = 0;
        try {
            for (const file of files) {
                await new Promise<void>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        if (event.target?.result) {
                            const dataUrl = event.target.result as string;
                            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
                            let make = 'Generic'; let model = nameWithoutExt;
                            const parts = nameWithoutExt.split(' ');
                            if (['porsche', 'audi', 'vw', 'volkswagen', 'bmw', 'mercedes', 'ford', 'ferrari', 'mclaren', 'lamborghini', 'honda', 'toyota'].includes(parts[0].toLowerCase())) {
                                make = parts[0]; model = parts.slice(1).join(' ');
                            }
                            make = make.charAt(0).toUpperCase() + make.slice(1); 
                            model = model.charAt(0).toUpperCase() + model.slice(1);
                            
                            const imageId = `diag_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            try {
                                await saveImage(imageId, dataUrl);
                                const newDiagram: InspectionDiagram = { id: crypto.randomUUID(), make, model, imageId };
                                await saveDocument('brooks_inspectionDiagrams', newDiagram);
                                successCount++;
                            } catch (err) { console.error(`Failed to save image for ${file.name}`, err); }
                        }
                        resolve();
                    };
                    reader.onerror = () => resolve(); 
                    reader.readAsDataURL(file);
                });
            }
            onShowStatus(`Successfully imported ${successCount} diagrams.`, 'success');
        } catch (e) { 
            console.error("Bulk upload failed", e); 
            onShowStatus("An error occurred during bulk upload.", 'error'); 
        } finally { e.target.value = ''; }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-4 gap-2">
                <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer shadow">
                    <FolderInput size={16}/> Bulk Upload
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkUploadDiagrams} />
                </label>
                <button onClick={() => { setSelectedDiagram(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Diagram
                </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[70vh]">
                {filtered.map(d => (
                    <div key={d.id} className="border rounded-lg bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="h-32 bg-gray-100 flex items-center justify-center p-2">
                            <AsyncImage imageId={d.imageId} alt={`${d.make} ${d.model}`} className="max-w-full max-h-full object-contain"/>
                        </div>
                        <div className="p-3">
                            <h4 className="font-bold text-sm text-gray-800">{d.make}</h4>
                            <p className="text-xs text-gray-600">{d.model}</p>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setSelectedDiagram(d); setIsModalOpen(true); }} className="p-1 bg-white rounded-full text-indigo-600 hover:text-indigo-800 shadow"><Edit size={14}/></button>
                            <button onClick={() => deleteItem(d.id)} className="p-1 bg-white rounded-full text-red-600 hover:text-red-800 shadow"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-full text-center py-10 text-gray-500">
                        <CarFront size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No diagrams found.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <InspectionDiagramFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(d) => { updateItem(d); setIsModalOpen(false); }} 
                    diagram={selectedDiagram} 
                />
            )}
        </div>
    );
};
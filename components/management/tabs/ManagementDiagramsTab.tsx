import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { InspectionDiagram } from '../../../types';
import { PlusCircle, Trash2, Edit, FolderInput, CarFront } from 'lucide-react';
import AsyncImage from '../../AsyncImage';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveImage } from '../../../utils/imageStore';
import InspectionDiagramFormModal from '../../InspectionDiagramFormModal';
import { saveDocument } from '../../../core/db';

export const ManagementDiagramsTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { 
        inspectionDiagrams = [], 
        setInspectionDiagrams, 
    } = useData();
    
    // 1. Local state for instant grid updates
    const [localDiagrams, setLocalDiagrams] = useState<InspectionDiagram[]>(Array.isArray(inspectionDiagrams) ? inspectionDiagrams : []);

    useEffect(() => {
        setLocalDiagrams(Array.isArray(inspectionDiagrams) ? inspectionDiagrams : []);
    }, [inspectionDiagrams]);

    const { deleteItem } = useManagementTable(inspectionDiagrams || [], 'brooks_inspectionDiagrams');

    const [selectedDiagram, setSelectedDiagram] = useState<InspectionDiagram | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Defensive filtering
    const filtered = (localDiagrams || []).filter(d => 
        (d.make || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
        (d.model || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

    /**
     * handleSave - Optimized for Cloud Sync
     */
    const handleSave = async (updatedDiagram: InspectionDiagram) => {
        try {
            await saveDocument('brooks_inspectionDiagrams', updatedDiagram);
            
            const updateFn = (prev: InspectionDiagram[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(d => d.id === updatedDiagram.id);
                return exists ? current.map(d => d.id === updatedDiagram.id ? updatedDiagram : d) : [...current, updatedDiagram];
            };

            // Instant UI update
            setLocalDiagrams(updateFn);
            if (setInspectionDiagrams) setInspectionDiagrams(updateFn);
            
            setIsModalOpen(false);
            setSelectedDiagram(null);

            onShowStatus("Diagram saved successfully.", "success");
        } catch (error) {
            console.error("Save failed:", error);
            onShowStatus("Failed to save diagram.", "error");
        }
    };

    /**
     * handleBulkUploadDiagrams
     * Optimized to update UI per item but refresh cloud only once at end
     */
    const handleBulkUploadDiagrams = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        onShowStatus("Processing bulk upload...", 'info');
        const files: File[] = Array.from(e.target.files);
        let successCount = 0;
        const newlyAdded: InspectionDiagram[] = [];

        try {
            for (const file of files) {
                await new Promise<void>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        if (event.target?.result) {
                            const dataUrl = event.target.result as string;
                            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
                            
                            let make = 'Generic'; 
                            let model = nameWithoutExt;
                            const parts = nameWithoutExt.split(' ');
                            
                            const commonMakes = ['porsche', 'audi', 'vw', 'volkswagen', 'bmw', 'mercedes', 'ford', 'ferrari', 'mclaren', 'lamborghini', 'honda', 'toyota', 'land rover', 'range rover'];
                            
                            if (commonMakes.includes(parts[0].toLowerCase())) {
                                make = parts[0]; 
                                model = parts.slice(1).join(' ');
                            }
                            
                            make = make.charAt(0).toUpperCase() + make.slice(1); 
                            model = (model || 'Standard').charAt(0).toUpperCase() + (model || 'Standard').slice(1);
                            
                            const imageId = `diag_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                            
                            try {
                                await saveImage(imageId, dataUrl);
                                const newDiagram: InspectionDiagram = { 
                                    id: crypto.randomUUID(), 
                                    make, 
                                    model, 
                                    imageId 
                                };
                                
                                await saveDocument('brooks_inspectionDiagrams', newDiagram);
                                newlyAdded.push(newDiagram);
                                successCount++;
                                
                                // Incremental UI update for visual progress
                                setLocalDiagrams(prev => [...(prev || []), newDiagram]);
                            } catch (err) { 
                                console.error(`Failed to save image for ${file.name}`, err); 
                            }
                        }
                        resolve();
                    };
                    reader.onerror = () => resolve(); 
                    reader.readAsDataURL(file);
                });
            }

            // Sync global context once
            if (setInspectionDiagrams) {
                setInspectionDiagrams(prev => [...(prev || []), ...newlyAdded]);
            }

            onShowStatus(`Successfully imported ${successCount} diagrams.`, 'success');

        } catch (e) { 
            console.error("Bulk upload failed", e); 
            onShowStatus("An error occurred during bulk upload.", 'error'); 
        } finally { 
            e.target.value = ''; 
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Inspection Diagrams</h2>
                    <p className="text-sm text-gray-500 font-medium">Visual templates for vehicle damage reports</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 cursor-pointer transition-all active:scale-95 shadow-sm">
                        <FolderInput size={18}/> 
                        <span>Bulk Upload</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkUploadDiagrams} />
                    </label>
                    <button 
                        onClick={() => { setSelectedDiagram(null); setIsModalOpen(true); }} 
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                        <PlusCircle size={18}/> Add Diagram
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 overflow-y-auto max-h-[70vh] pr-2 pb-8">
                {filtered.map(d => (
                    <div key={d.id} className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                        <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                            <AsyncImage 
                                imageId={d.imageId} 
                                alt={`${d.make} ${d.model}`} 
                                className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                            />
                        </div>
                        
                        <div className="p-4 border-t border-gray-50 bg-white">
                            <h4 className="font-black text-[10px] text-indigo-600 uppercase tracking-widest truncate">{d.make}</h4>
                            <p className="text-xs text-gray-900 font-bold truncate uppercase">{d.model}</p>
                        </div>

                        <div className="absolute inset-0 bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                            <button 
                                onClick={() => { setSelectedDiagram(d); setIsModalOpen(true); }} 
                                className="p-2.5 bg-white rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-xl transition-all transform translate-y-4 group-hover:translate-y-0"
                            >
                                <Edit size={16}/>
                            </button>
                            <button 
                                onClick={() => {
                                    if(window.confirm(`Delete the ${d.make} ${d.model} template?`)) deleteItem(d.id);
                                }} 
                                className="p-2.5 bg-white rounded-xl text-red-600 hover:bg-red-600 hover:text-white shadow-xl transition-all transform translate-y-4 group-hover:translate-y-0 delay-75"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <CarFront size={64} className="text-gray-200 mb-4" />
                        <h3 className="text-gray-400 font-bold uppercase tracking-widest text-sm">No templates found</h3>
                        <p className="text-gray-400 text-xs mt-1">Try a different search or upload new diagrams</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <InspectionDiagramFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedDiagram(null);
                    }} 
                    onSave={handleSave} 
                    diagram={selectedDiagram} 
                />
            )}
        </div>
    );
};
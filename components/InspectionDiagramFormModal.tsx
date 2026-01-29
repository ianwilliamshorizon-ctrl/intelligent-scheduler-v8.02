import React, { useState, useEffect } from 'react';
import { InspectionDiagram } from '../types';
import FormModal from './FormModal';
import { saveImage, getImage } from '../utils/imageStore';
import { X, Upload } from 'lucide-react';

interface InspectionDiagramFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (diagram: InspectionDiagram) => void;
    diagram: InspectionDiagram | null;
}

const InspectionDiagramFormModal: React.FC<InspectionDiagramFormModalProps> = ({ isOpen, onClose, onSave, diagram }) => {
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [imageId, setImageId] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (diagram) {
                setMake(diagram.make);
                setModel(diagram.model);
                setImageId(diagram.imageId);
                getImage(diagram.imageId).then(setPreviewUrl);
            } else {
                setMake('');
                setModel('');
                setImageId('');
                setPreviewUrl(null);
            }
        }
    }, [isOpen, diagram]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const newId = `diag_${Date.now()}`;
                try {
                    await saveImage(newId, dataUrl);
                    setImageId(newId);
                    setPreviewUrl(dataUrl);
                } catch (error) {
                    console.error("Failed to save image", error);
                    alert("Failed to save image to database");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        if (!make || !model || !imageId) {
            alert('Please provide Make, Model and an Image.');
            return;
        }
        onSave({
            id: diagram?.id || crypto.randomUUID(),
            make,
            model,
            imageId
        });
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={diagram ? 'Edit Diagram' : 'Add Inspection Diagram'}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Make</label>
                        <input value={make} onChange={e => setMake(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g. Porsche" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <input value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g. 911" />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagram Image</label>
                    {previewUrl ? (
                        <div className="relative border rounded-lg overflow-hidden h-64 bg-gray-100 flex items-center justify-center">
                            <img src={previewUrl} alt="Diagram" className="max-h-full max-w-full object-contain" />
                            <button onClick={() => { setPreviewUrl(null); setImageId(''); }} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Click to upload diagram image</span>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export default InspectionDiagramFormModal;
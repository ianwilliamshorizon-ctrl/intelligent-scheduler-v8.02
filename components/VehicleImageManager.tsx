import React, { useRef } from 'react';
import { Vehicle, VehicleImage } from '../types';
import { Upload, Trash2, CheckSquare } from 'lucide-react';
import { saveImage } from '../utils/imageStore';
import AsyncImage from './AsyncImage';

interface VehicleImageManagerProps {
    vehicle: Vehicle;
    onUpdateVehicle: (vehicle: Vehicle) => void;
}

const VehicleImageManager: React.FC<VehicleImageManagerProps> = ({ vehicle, onUpdateVehicle }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newImages: VehicleImage[] = [];
            const savePromises: Promise<void>[] = [];
            
            // FIX: Directly iterate over FileList. `Array.from()` was causing type inference issues, leading to `file` being typed as `unknown`.
            for (const file of event.target.files) {
                const newImage: VehicleImage = {
                    id: crypto.randomUUID(),
                    isPrimaryDiagram: false,
                };
                newImages.push(newImage);

                const reader = new FileReader();
                const savePromise = new Promise<void>((resolve, reject) => {
                    reader.onloadend = () => {
                        saveImage(newImage.id, reader.result as string).then(resolve).catch(reject);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                savePromises.push(savePromise);
            }

            Promise.all(savePromises).then(() => {
                const updatedImages = [...(vehicle.images || []), ...newImages];
                onUpdateVehicle({ ...vehicle, images: updatedImages });
            }).catch(error => {
                console.error("Error saving one or more images:", error);
                alert("Could not save one or more images.");
            });
        }
        if (event.target) event.target.value = '';
    };

    const handleSetAsDiagram = (imageId: string) => {
        const updatedImages = (vehicle.images || []).map(img => ({
            ...img,
            isPrimaryDiagram: img.id === imageId,
        }));
        onUpdateVehicle({ ...vehicle, images: updatedImages });
    };

    const handleRemoveImage = (imageId: string) => {
        const updatedImages = (vehicle.images || []).filter(img => img.id !== imageId);
        onUpdateVehicle({ ...vehicle, images: updatedImages });
        // NOTE: Does not delete from IndexedDB to prevent accidental data loss.
    };

    return (
        <div className="p-4 bg-gray-100/50 mt-4 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Vehicle Images</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(vehicle.images || []).map(image => (
                    <div key={image.id} className={`relative group border-2 rounded-lg overflow-hidden ${image.isPrimaryDiagram ? 'border-indigo-500' : 'border-transparent'}`}>
                        <AsyncImage imageId={image.id} alt="Vehicle" className="w-full h-24 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                            <button
                                onClick={() => handleSetAsDiagram(image.id)}
                                disabled={image.isPrimaryDiagram}
                                className="w-full flex items-center justify-center gap-1 text-xs py-1 px-2 bg-green-600 text-white rounded disabled:bg-green-800 disabled:cursor-not-allowed"
                            >
                                <CheckSquare size={14} /> Set as Diagram
                            </button>
                            <button
                                onClick={() => handleRemoveImage(image.id)}
                                className="w-full flex items-center justify-center gap-1 text-xs py-1 px-2 bg-red-600 text-white rounded"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                        {image.isPrimaryDiagram && (
                            <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 text-white text-center text-xs font-bold py-0.5">
                                DIAGRAM
                            </div>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
                >
                    <Upload size={24} />
                    <span className="text-sm mt-1">Upload Image</span>
                </button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
};

export default VehicleImageManager;
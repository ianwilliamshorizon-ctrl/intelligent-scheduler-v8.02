import React, { useRef, useEffect } from 'react';
import { SaleVehicle, SaleMediaItem } from '../types';
import { Upload, Trash2, FileText, Camera, Download } from 'lucide-react';
import { saveImage, getImage } from '../utils/imageStore';
import AsyncImage from './AsyncImage';

interface MediaManagerProps {
    media: SaleMediaItem[];
    onUpdate: (media: SaleMediaItem[]) => void;
}

const MediaManager: React.FC<MediaManagerProps> = ({ media, onUpdate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newMedia: SaleMediaItem[] = [];
            const savePromises: Promise<void>[] = [];
            
            for (const file of event.target.files) {
                const isImage = file.type.startsWith('image/');
                const mediaItem: SaleMediaItem = {
                    id: crypto.randomUUID(),
                    type: isImage ? 'Photo' : 'Document',
                    name: file.name,
                    uploadedAt: new Date().toISOString()
                };
                newMedia.push(mediaItem);
                savePromises.push(saveImage(mediaItem.id, file));
            }

            try {
                await Promise.all(savePromises);
                const updatedMedia = [...(media || []), ...newMedia];
                onUpdate(updatedMedia);
            } catch (error) {
                console.error("Error saving media:", error);
                alert("Could not save one or more files.");
            }
        }
        if (event.target) event.target.value = '';
    };

    const handleRemoveMedia = (id: string) => {
        if (window.confirm('Are you sure you want to delete this file?')) {
            const updatedMedia = (media || []).filter(m => m.id !== id);
            onUpdate(updatedMedia);
        }
    };

    const handleDownload = async (item: SaleMediaItem) => {
        const dataUrl = await getImage(item.id);
        if (dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = item.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // If it's a blob URL we created, we should ideally revoke it later, 
            // but for a one-off download it's usually fine.
        } else {
            alert('Could not retrieve file data.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Camera size={16} className="text-indigo-500" />
                    Gallery & Documents
                </h4>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                    <Upload size={14} /> Add Photos/Docs
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(media || []).map(item => (
                    <div key={item.id} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        {item.type === 'Photo' ? (
                            <div className="h-28 w-full relative">
                                <AsyncImage imageId={item.id} alt={item.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => handleDownload(item)} className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-indigo-600 hover:text-white transition-colors"><Download size={14}/></button>
                                    <button onClick={() => handleRemoveMedia(item.id)} className="p-1.5 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-28 w-full bg-gray-50 flex flex-col items-center justify-center p-2 relative">
                                <FileText size={40} className="text-gray-400 mb-1" />
                                <span className="text-[10px] text-center text-gray-500 font-medium truncate w-full px-2">{item.name}</span>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => handleDownload(item)} className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-indigo-600 hover:text-white transition-colors"><Download size={14}/></button>
                                    <button onClick={() => handleRemoveMedia(item.id)} className="p-1.5 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        )}
                        <div className="p-2 border-t bg-gray-50/50">
                             <p className="text-[10px] text-gray-500 truncate font-medium">{item.name}</p>
                             <p className="text-[9px] text-gray-400">{new Date(item.uploadedAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
                {(media || []).length === 0 && (
                    <div className="col-span-full py-10 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
                        <Camera size={32} className="opacity-20 mb-2" />
                        <p className="text-sm">No photos or documents uploaded yet.</p>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
};

export default MediaManager;

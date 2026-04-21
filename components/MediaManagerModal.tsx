
import React, { useState, useRef, useEffect } from 'react';
import { CheckInPhoto } from '../types';
import { X, Save, Camera, Upload, Trash2, Film } from 'lucide-react';
import { saveImage, deleteImage } from '../utils/imageStore';
import AsyncMedia from './AsyncMedia';

interface MediaManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialMedia: CheckInPhoto[];
    onSave: (updatedMedia: CheckInPhoto[]) => void;
}

interface TempMedia extends CheckInPhoto {
    tempDataUrl?: string; // For new uploads before saving
}

const MediaManagerModal: React.FC<MediaManagerModalProps> = ({ isOpen, onClose, title, initialMedia, onSave }) => {
    const [mediaList, setMediaList] = useState<TempMedia[]>([]);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setMediaList(initialMedia || []);
        }
    }, [isOpen, initialMedia]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            for (const file of event.target.files) {
                const reader = new FileReader();
                const isVideo = file.type.startsWith('video/');
                reader.onloadend = () => {
                    const dataUrl = reader.result as string;
                    const newMedia: TempMedia = {
                        id: crypto.randomUUID(),
                        notes: '',
                        tempDataUrl: dataUrl,
                        type: isVideo ? 'video' : 'photo'
                    };
                    setMediaList(prev => [...prev, newMedia]);
                };
                reader.readAsDataURL(file);
            }
        }
        event.target.value = '';
    };

    const handleRemoveMedia = (id: string) => {
        setMediaList(prev => prev.filter(m => m.id !== id));
    };

    const handleNotesChange = (id: string, notes: string) => {
        setMediaList(prev => prev.map(m => m.id === id ? { ...m, notes } : m));
    };

    const handleSave = async () => {
        const finalMedia: CheckInPhoto[] = [];
        
        for (const item of mediaList) {
            if (item.tempDataUrl) {
                // New item, save to DB
                try {
                    await saveImage(item.id, item.tempDataUrl);
                    finalMedia.push({ id: item.id, notes: item.notes, type: item.type });
                } catch (e) {
                    console.error("Failed to save media", e);
                    alert("Failed to save image/video. Please try again.");
                    return;
                }
            } else {
                // Existing item, preserve ID
                finalMedia.push({ id: item.id, notes: item.notes, type: item.type });
            }
        }
        
        // Cleanup deleted items? Not doing strict cleanup here to avoid data loss if cancelled, 
        // rely on orphan cleanup scripts if needed later.

        onSave(finalMedia);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up">
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                
                <main className="flex-grow overflow-y-auto p-6 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {mediaList.map(item => (
                            <div key={item.id} className="relative group border rounded-lg overflow-hidden bg-black shadow-sm">
                                {item.tempDataUrl ? (
                                    item.tempDataUrl.startsWith('data:video') || item.type === 'video' ? (
                                        <video src={item.tempDataUrl} className="w-full h-40 object-contain" controls />
                                    ) : (
                                        <img src={item.tempDataUrl} alt="Preview" className="w-full h-40 object-cover" />
                                    )
                                ) : (
                                    <AsyncMedia 
                                        imageId={item.id} 
                                        alt="Media item" 
                                        className="w-full h-full object-cover" 
                                    />
                                )}
                                
                                <button 
                                    onClick={() => handleRemoveMedia(item.id)} 
                                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                                
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60">
                                    <input 
                                        type="text" 
                                        value={item.notes || ''}
                                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                        placeholder="Add description..."
                                        className="w-full bg-transparent text-white text-xs border-none focus:ring-0 placeholder-gray-300"
                                    />
                                </div>
                            </div>
                        ))}
                        
                        <div className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex flex-col items-center justify-center p-4 bg-white text-gray-500">
                             <div className="flex gap-4 mb-2">
                                <button 
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 text-indigo-600 transition"
                                >
                                    <Camera size={24}/>
                                    <span className="text-xs">Photo</span>
                                </button>
                                <button 
                                    onClick={() => videoInputRef.current?.click()}
                                    className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 text-indigo-600 transition"
                                >
                                    <Film size={24}/>
                                    <span className="text-xs">Video</span>
                                </button>
                                <div className="w-px bg-gray-200"></div>
                                <button 
                                    onClick={() => uploadInputRef.current?.click()}
                                    className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 text-indigo-600 transition"
                                >
                                    <Upload size={24}/>
                                    <span className="text-xs">Upload</span>
                                </button>
                             </div>
                             <p className="text-[10px] text-center">Capture vehicle media</p>
                        </div>
                    </div>
                    
                    <input 
                        ref={cameraInputRef} 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                    <input 
                        ref={videoInputRef} 
                        type="file" 
                        accept="video/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                    <input 
                        ref={uploadInputRef} 
                        type="file" 
                        accept="image/*,video/*" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                </main>
                
                <footer className="p-4 border-t flex justify-end gap-2 bg-white rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow">
                        <Save size={16}/> Save Media
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MediaManagerModal;

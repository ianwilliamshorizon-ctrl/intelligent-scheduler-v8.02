import React, { useState, useRef, useEffect } from 'react';
import * as T from '../types';
import { X, Save, Camera, Upload, Trash2, Film, Edit } from 'lucide-react';
import { saveImage, deleteImage } from '../utils/imageStore';
import AsyncMedia from './AsyncMedia';
import MediaLightbox from './MediaLightbox';

interface MediaManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialMedia: T.CheckInPhoto[];
    onSave: (updatedMedia: T.CheckInPhoto[]) => void;
}

interface TempMedia extends T.CheckInPhoto {
    tempDataUrl?: string; // For new uploads before saving
    file?: File; // Store the actual file for efficient saving
}

const MediaManagerModal: React.FC<MediaManagerModalProps> = ({ isOpen, onClose, title, initialMedia, onSave }) => {
    const [mediaList, setMediaList] = useState<TempMedia[]>([]);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setMediaList(initialMedia || []);
        }
    }, [isOpen, initialMedia]);

    // Cleanup object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            mediaList.forEach(m => {
                if (m.tempDataUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(m.tempDataUrl);
                }
            });
        };
    }, [mediaList]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            for (const file of event.target.files) {
                const isVideo = file.type.startsWith('video/');
                const previewUrl = URL.createObjectURL(file);
                
                const newMedia: TempMedia = {
                    id: crypto.randomUUID(),
                    notes: '',
                    tempDataUrl: previewUrl,
                    file: file,
                    type: isVideo ? 'video' : 'photo'
                };
                setMediaList(prev => [...prev, newMedia]);
            }
        }
        event.target.value = '';
    };

    const handleNotesChange = (id: string, notes: string) => {
        setMediaList(prev => prev.map(m => m.id === id ? { ...m, notes } : m));
    };

    const handleRemoveMedia = (id: string) => {
        setMediaList(prev => prev.filter(m => m.id !== id));
    };

    const [editingItem, setEditingItem] = useState<string | null>(null);

    const handleStatusChange = (id: string, status: T.ChecklistItemStatus) => {
        setMediaList(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    };

    const handleSave = async () => {
        const finalMedia: T.CheckInPhoto[] = [];
        
        for (const item of mediaList) {
            if (item.file || item.tempDataUrl) {
                // New item or item with preview, save to DB
                try {
                    // Pass the actual File object if available for better performance
                    await saveImage(item.id, item.file || item.tempDataUrl!);
                    finalMedia.push({ id: item.id, notes: item.notes, type: item.type, status: item.status });
                } catch (e) {
                    console.error("Failed to save media", e);
                    alert("Failed to save image/video. Please try again.");
                    return;
                }
            } else {
                // Existing item, preserve ID
                finalMedia.push({ id: item.id, notes: item.notes, type: item.type, status: item.status });
            }
        }
        
        onSave(finalMedia);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up border border-white/20">
                <header className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                            <Camera size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} className="text-gray-500" /></button>
                </header>
                
                <main className="flex-grow overflow-y-auto p-6 bg-white">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {mediaList.map((item, index) => {
                            const isAttention = item.status === 'attention';
                            const isUrgent = item.status === 'urgent';
                            const isOk = item.status === 'ok';

                            return (
                                <div 
                                    key={item.id} 
                                    className={`relative group rounded-xl overflow-hidden bg-white shadow-md flex flex-col h-56 transition-all hover:shadow-xl border-4 ${
                                        isAttention ? 'border-indigo-500 animate-pulse-subtle' : 
                                        isUrgent ? 'border-red-500' : 
                                        'border-transparent'
                                    }`}
                                >
                                    <div 
                                        className="h-2/3 relative cursor-pointer overflow-hidden"
                                        onClick={() => {
                                            setLightboxIndex(index);
                                            setIsLightboxOpen(true);
                                        }}
                                    >
                                        {item.tempDataUrl ? (
                                            item.type === 'video' ? (
                                                <video src={item.tempDataUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            ) : (
                                                <img src={item.tempDataUrl} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            )
                                        ) : (
                                            <AsyncMedia 
                                                imageId={item.id} 
                                                type={item.type}
                                                alt="Media item" 
                                                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                            />
                                        )}
                                        
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity" />
                                        
                                        {item.status && (
                                            <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter text-white shadow-lg ${
                                                isAttention ? 'bg-yellow-500' : isUrgent ? 'bg-red-600' : 'bg-green-500'
                                            }`}>
                                                {item.status}
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-1/3 p-2 bg-gray-50 flex flex-col justify-between border-t border-gray-100">
                                        <div className="flex items-center justify-between gap-1">
                                            <input 
                                                type="text"
                                                value={item.notes || ''}
                                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                                placeholder="Add notes..."
                                                className="flex-grow bg-white text-gray-700 text-[11px] p-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                            <button 
                                                onClick={() => setEditingItem(item.id)}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Full Edit"
                                            >
                                                <Edit size={14} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => handleStatusChange(item.id, 'ok')}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isOk ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 hover:bg-green-100 hover:text-green-600'}`}
                                                >
                                                    <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-current rotate-45 mb-0.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleStatusChange(item.id, 'attention')}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isAttention ? 'bg-yellow-400 text-black shadow-inner shadow-yellow-600/30' : 'bg-gray-200 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600'}`}
                                                    title="Mark for Attention (Yellow Line)"
                                                >
                                                    <span className="font-bold text-[10px]">!</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleStatusChange(item.id, 'urgent')}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isUrgent ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400 hover:bg-red-100 hover:text-red-600'}`}
                                                >
                                                    <span className="font-bold text-[10px]">X</span>
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveMedia(item.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detailed Edit Overlay */}
                                    {editingItem === item.id && (
                                        <div className="absolute inset-0 bg-white/95 z-10 flex flex-col p-4 animate-in fade-in zoom-in duration-200">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-sm text-indigo-700">Detailed Edit</h4>
                                                <button onClick={() => setEditingItem(null)}><X size={16} /></button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 tracking-wider">Internal Notes</label>
                                                    <textarea 
                                                        value={item.notes || ''}
                                                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                                        rows={4}
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        placeholder="Add detailed documentation about this document..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 tracking-wider">Status Flag</label>
                                                    <div className="flex gap-2">
                                                        {(['ok', 'attention', 'urgent', 'na'] as T.ChecklistItemStatus[]).map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleStatusChange(item.id, status)}
                                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                                                    item.status === status 
                                                                        ? (status === 'ok' ? 'bg-green-500 text-white' : status === 'attention' ? 'bg-yellow-400 text-black' : status === 'urgent' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white')
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setEditingItem(null)}
                                                className="mt-auto w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700"
                                            >
                                                Done Editing
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        <div className="border-2 border-dashed border-indigo-200 rounded-lg flex flex-col items-center justify-center p-4 bg-indigo-50/30 hover:bg-indigo-50 transition-colors h-48">
                             <div className="flex flex-col items-center gap-3">
                                <div className="flex gap-2">
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
                                    <div className="w-px bg-gray-200 mx-1"></div>
                                    <button 
                                        onClick={() => uploadInputRef.current?.click()}
                                        className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 text-indigo-600 transition"
                                    >
                                        <Upload size={24}/>
                                        <span className="text-xs">Upload</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center">Capture vehicle media</p>
                             </div>
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
                
                <footer className="p-4 border-t flex justify-end gap-3 bg-gray-50">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save All Media
                    </button>
                </footer>
            </div>

            <MediaLightbox 
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                mediaIds={mediaList.map(m => m.id)}
                initialIndex={lightboxIndex}
            />
        </div>
    );
};

export default MediaManagerModal;

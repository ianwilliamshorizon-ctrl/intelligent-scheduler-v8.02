import React, { useState, useEffect, useRef } from 'react';
import { Job, CheckInPhoto } from '../types';
import { X, Save, KeyRound, Camera, Trash2, Plus, Upload, Milestone, Film } from 'lucide-react';
import { saveImage } from '../utils/imageStore';
import AsyncMedia from './AsyncMedia';
import MediaLightbox from './MediaLightbox';

interface TempCheckInPhoto extends CheckInPhoto {
    tempDataUrl?: string;
    file?: File;
}

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    job: Job | null;
}

const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose, onSave, job }) => {
    const [keyNumber, setKeyNumber] = useState<string>('');
    const [mileage, setMileage] = useState<string>('');
    const [photos, setPhotos] = useState<TempCheckInPhoto[]>([]);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    useEffect(() => {
        if (job) {
            setKeyNumber(job.keyNumber?.toString() || '');
            setMileage(job.mileage?.toString() || '');
            setPhotos(job.checkInPhotos || []);
        }
    }, [job]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            for (const file of event.target.files) {
                const isVideo = file.type.startsWith('video/');
                const previewUrl = URL.createObjectURL(file);
                
                const newPhoto: TempCheckInPhoto = {
                    id: crypto.randomUUID(),
                    tempDataUrl: previewUrl,
                    file: file,
                    type: isVideo ? 'video' : 'photo'
                };
                setPhotos(prev => [...prev, newPhoto]);
            }
        }
        event.target.value = ''; // Reset file input
    };

    // Cleanup object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            photos.forEach(p => {
                if (p.tempDataUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(p.tempDataUrl);
                }
            });
        };
    }, [photos]);

    const handleRemovePhoto = (id: string) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handlePhotoNotesChange = (id: string, notes: string) => {
        setPhotos(prev => prev.map(p => p.id === id ? { ...p, notes } : p));
    }

    const handleSave = async () => {
        if (!job) return;

        // Save new images to IndexedDB and prepare the final photo data for the job object
        const finalPhotos: CheckInPhoto[] = [];
        for (const photo of photos) {
            if (photo.file || photo.tempDataUrl) { // This is a new photo
                try {
                    // Pass the actual File object if available for better performance
                    await saveImage(photo.id, photo.file || photo.tempDataUrl!);
                    finalPhotos.push({ id: photo.id, notes: photo.notes, type: photo.type });
                } catch (error) {
                    console.error("Could not save check-in media:", error);
                    alert(`Failed to save one of the media items (${photo.id}). Please try again.`);
                    return; // Abort save if any image fails
                }
            } else { // This is an existing photo
                finalPhotos.push({ id: photo.id, notes: photo.notes, type: photo.type });
            }
        }

        const updatedJob: Job = {
            ...job,
            keyNumber: keyNumber || undefined,
            mileage: mileage ? parseInt(mileage, 10) : undefined,
            checkInPhotos: finalPhotos,
            vehicleStatus: 'On Site'
        };
        console.log("[CheckIn] Saving job...", updatedJob);
        try {
            await onSave(updatedJob);
            onClose();
        } catch (err) {
            console.error("[CheckIn] Save error:", err);
            alert("Failed to update job status. Please check your connection.");
        }
    };

    if (!isOpen || !job) return null;

    const partsReady = job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required';

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[70] flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50/50 rounded-t-2xl sm:rounded-t-xl">
                    <h2 className="text-lg sm:text-xl font-bold text-indigo-700 truncate pr-4">Check In: {job.id}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    <div className={`p-3 rounded-xl text-xs sm:text-sm border ${partsReady ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                        <p className="font-extrabold uppercase tracking-tight mb-1">Parts Status: {job.partsStatus || 'Not Required'}</p>
                        {partsReady ? (
                        <p className="opacity-90">Parts are ready. Job will be workshop-ready after check-in.</p>
                        ) : (
                        <p className="opacity-90">Parts not yet received. Job will stay pending after check-in.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label htmlFor="keyNumber" className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                <KeyRound size={12} /> Key Number
                            </label>
                            <input
                                id="keyNumber"
                                type="number"
                                value={keyNumber}
                                onChange={e => setKeyNumber(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                                placeholder="e.g. 27"
                                inputMode="numeric"
                            />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label htmlFor="mileage" className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                <Milestone size={12} /> Current Mileage
                            </label>
                            <input
                                id="mileage"
                                type="number"
                                value={mileage}
                                onChange={e => setMileage(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                                placeholder="e.g. 45000"
                                inputMode="numeric"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                            <Camera size={12} /> Condition Photos
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {photos.map((photo, index) => (
                                <div 
                                    key={photo.id} 
                                    className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm cursor-pointer"
                                    onClick={() => {
                                        setLightboxIndex(index);
                                        setIsLightboxOpen(true);
                                    }}
                                >
                                    {photo.tempDataUrl ? (
                                        photo.type === 'video' ? (
                                            <video src={photo.tempDataUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={photo.tempDataUrl} alt="Vehicle condition" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <AsyncMedia imageId={photo.id} type={photo.type} alt="Vehicle condition" className="w-full h-full object-cover" />
                                    )}
                                    <button onClick={() => handleRemovePhoto(photo.id)} className="absolute top-1 right-1 bg-white/90 p-1.5 rounded-full text-red-500 shadow-md hover:bg-red-50 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs p-1">
                                        <input 
                                            type="text"
                                            value={photo.notes || ''}
                                            onChange={(e) => handlePhotoNotesChange(photo.id, e.target.value)}
                                            placeholder="Add notes..."
                                            className="w-full bg-transparent text-white text-[10px] p-1 border-none focus:ring-0 outline-none placeholder:text-white/50"
                                        />
                                    </div>
                                </div>
                            ))}
                             <div className="w-full h-32 sm:h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group p-2">
                                <div className="flex sm:flex-col items-center gap-4 sm:gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:text-indigo-600 transition"
                                    >
                                        <Camera size={24} />
                                        <span className="text-[10px] font-bold uppercase mt-1">Photo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => videoInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:text-indigo-600 transition"
                                    >
                                        <Film size={24} />
                                        <span className="text-[10px] font-bold uppercase mt-1">Video</span>
                                    </button>
                                    <div className="hidden sm:block w-px h-8 bg-gray-300"></div>
                                    <button
                                        type="button"
                                        onClick={() => uploadInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:text-indigo-600 transition"
                                    >
                                        <Upload size={24} />
                                        <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input
                            ref={uploadInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between gap-3 p-4 border-t bg-gray-50/50">
                    <button onClick={onClose} className="flex-1 py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]">
                        <Save size={18} /> Confirm Check-In
                    </button>
                </footer>
            </div>

            <MediaLightbox 
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                mediaIds={photos.map(p => p.id)}
                initialIndex={lightboxIndex}
            />
        </div>
    );
};

export default CheckInModal;
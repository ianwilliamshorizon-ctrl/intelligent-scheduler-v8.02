import React, { useState, useEffect, useRef } from 'react';
import { Job, CheckInPhoto } from '../types';
import { 
    X, 
    Save, 
    KeyRound, 
    Camera, 
    Trash2, 
    Plus, 
    Upload, 
    Film, 
    Gauge, 
    Car, 
    CheckCircle2, 
    Clock 
} from 'lucide-react';
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
    };

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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[70] flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-slate-100">
                {/* Modal Header */}
                <header className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-3xl sm:rounded-t-2xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 shadow-2xs">
                            <Car size={18} />
                        </div>
                        <div className="truncate">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                                Vehicle Check-In
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 font-mono">
                                Job #{job.id}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </header>

                <main className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    {/* Parts Status Banner */}
                    <div className={`p-3.5 rounded-2xl text-xs sm:text-sm border flex items-center gap-3 ${
                        partsReady 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs ${
                            partsReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {partsReady ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                        </div>
                        <div className="min-w-0 flex-grow">
                            <p className="font-black uppercase tracking-tight text-xs">
                                Parts Status: {job.partsStatus || 'Not Required'}
                            </p>
                            <p className="opacity-90 text-[11px] font-medium leading-tight mt-0.5">
                                {partsReady 
                                    ? 'All parts ready or not required. Vehicle will be workshop-ready upon check-in.' 
                                    : 'Parts pending delivery. Vehicle will remain in pending state after check-in.'}
                            </p>
                        </div>
                    </div>

                    {/* Key Number & Mileage */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                            <label htmlFor="keyNumber" className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                                <KeyRound size={13} className="text-indigo-600" />
                                <span>Key Peg / Tag Number</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="keyNumber"
                                    type="text"
                                    value={keyNumber}
                                    onChange={e => setKeyNumber(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 text-base shadow-2xs"
                                    placeholder="e.g. 27"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (keyNumber.endsWith('S')) {
                                            setKeyNumber(keyNumber.slice(0, -1));
                                        } else {
                                            setKeyNumber(keyNumber + 'S');
                                        }
                                    }}
                                    className={`px-3.5 rounded-xl font-black text-sm border flex items-center justify-center gap-1 transition-all shadow-2xs ${
                                        keyNumber.endsWith('S') 
                                            ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                                    title="Toggle Sales 'S' Suffix"
                                >
                                    +S
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                            <label htmlFor="mileage" className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                                <Gauge size={13} className="text-indigo-600" />
                                <span>Current Mileage</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="mileage"
                                    type="number"
                                    value={mileage}
                                    onChange={e => setMileage(e.target.value)}
                                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 text-base shadow-2xs"
                                    placeholder="e.g. 45000"
                                    inputMode="numeric"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                    mi
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Condition Media (Photos / Videos) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <Camera size={13} className="text-indigo-600" />
                                <span>Condition Media ({photos.length})</span>
                            </label>
                            <span className="text-[11px] font-medium text-slate-400">
                                Click thumbnail to enlarge
                            </span>
                        </div>

                        {/* Neat Action Buttons Row */}
                        <div className="grid grid-cols-3 gap-2.5">
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700 hover:text-indigo-700 font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
                            >
                                <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                    <Camera size={13} />
                                </div>
                                <span className="truncate">Photo</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-slate-700 hover:text-purple-700 font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
                            >
                                <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                                    <Film size={13} />
                                </div>
                                <span className="truncate">Video</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => uploadInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 hover:text-blue-700 font-bold text-xs shadow-2xs transition-all active:scale-[0.98]"
                            >
                                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <Upload size={13} />
                                </div>
                                <span className="truncate">Upload</span>
                            </button>
                        </div>

                        {/* Media Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                            {photos.map((photo, index) => (
                                <div 
                                    key={photo.id} 
                                    className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
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

                                    {/* Media Type Indicator */}
                                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                        {photo.type === 'video' ? <Film size={10} /> : <Camera size={10} />}
                                        <span className="uppercase">{photo.type === 'video' ? 'Video' : 'Photo'}</span>
                                    </span>

                                    {/* Delete Button */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemovePhoto(photo.id);
                                        }} 
                                        className="absolute top-2 right-2 bg-white/95 hover:bg-red-50 text-slate-400 hover:text-red-600 p-1.5 rounded-xl shadow-md transition-colors"
                                        title="Remove media"
                                    >
                                        <Trash2 size={13} />
                                    </button>

                                    {/* Notes input overlay */}
                                    <div 
                                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2 pt-4"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input 
                                            type="text"
                                            value={photo.notes || ''}
                                            onChange={(e) => handlePhotoNotesChange(photo.id, e.target.value)}
                                            placeholder="Add notes..."
                                            className="w-full bg-white/20 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/20 focus:bg-white/90 focus:text-slate-900 focus:border-white focus:ring-0 outline-none placeholder:text-white/70 transition-all"
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Drop / Add Tile */}
                            <div 
                                onClick={() => uploadInputRef.current?.click()}
                                className="aspect-square border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/30 transition-all cursor-pointer group p-3 text-center"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-white group-hover:bg-indigo-600 text-slate-400 group-hover:text-white flex items-center justify-center shadow-xs border border-slate-200 group-hover:border-indigo-600 transition-all mb-2">
                                    <Plus size={18} />
                                </div>
                                <span className="text-xs font-black text-slate-700 group-hover:text-indigo-700 transition-colors">
                                    Add Media
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    Photo or video
                                </span>
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
                </main>

                {/* Modal Footer */}
                <footer className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl sm:rounded-b-2xl">
                    <button 
                        onClick={onClose} 
                        className="py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="flex items-center justify-center gap-2 py-2.5 px-5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                    >
                        <Save size={15} />
                        <span>Confirm Check-In</span>
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
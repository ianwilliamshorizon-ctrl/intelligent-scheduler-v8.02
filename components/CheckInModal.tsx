import React, { useState, useEffect, useRef } from 'react';
import { Job, CheckInPhoto } from '../types';
import { X, Save, KeyRound, Camera, Trash2, Plus, Upload, Milestone } from 'lucide-react';
import { saveImage } from '../utils/imageStore';
import AsyncImage from './AsyncImage';

interface TempCheckInPhoto extends CheckInPhoto {
    tempDataUrl?: string;
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
    const uploadInputRef = useRef<HTMLInputElement>(null);

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
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result as string;
                    // We only need the dataUrl for temporary preview before saving
                    const newPhoto: TempCheckInPhoto = {
                        id: crypto.randomUUID(),
                        tempDataUrl: dataUrl
                    };
                    setPhotos(prev => [...prev, newPhoto]);
                };
                reader.readAsDataURL(file);
            }
        }
        event.target.value = ''; // Reset file input
    };

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
            if (photo.tempDataUrl) { // This is a new photo
                try {
                    await saveImage(photo.id, photo.tempDataUrl);
                    finalPhotos.push({ id: photo.id, notes: photo.notes });
                } catch (error) {
                    console.error("Could not save check-in image:", error);
                    alert(`Failed to save one of the images (${photo.id}). Please try again.`);
                    return; // Abort save if any image fails
                }
            } else { // This is an existing photo
                finalPhotos.push({ id: photo.id, notes: photo.notes });
            }
        }

        const updatedJob: Job = {
            ...job,
            keyNumber: keyNumber ? parseInt(keyNumber, 10) : undefined,
            mileage: mileage ? parseInt(mileage, 10) : undefined,
            checkInPhotos: finalPhotos,
            vehicleStatus: 'On Site'
        };
        onSave(updatedJob);
        onClose();
    };

    if (!isOpen || !job) return null;

    const partsReady = job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required';

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Check In Vehicle: {job.id}</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-6 space-y-4">
                    <div className={`p-3 rounded-lg text-sm mb-4 ${partsReady ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        <p className="font-bold">Current Parts Status: {job.partsStatus || 'Not Required'}</p>
                        {partsReady ? (
                        <p>Parts are ready. After check-in, this job will be ready for the workshop.</p>
                        ) : (
                        <p>Parts are not yet fully received. Job will not be ready for the workshop until they are.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="keyNumber" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <KeyRound size={14} /> Key Number
                            </label>
                            <input
                                id="keyNumber"
                                type="number"
                                value={keyNumber}
                                onChange={e => setKeyNumber(e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="e.g., 27"
                            />
                        </div>
                        <div>
                            <label htmlFor="mileage" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                <Milestone size={14} /> Mileage
                            </label>
                            <input
                                id="mileage"
                                type="number"
                                value={mileage}
                                onChange={e => setMileage(e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="e.g., 45000"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                            <Camera size={14} /> Condition Photos
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                            {photos.map(photo => (
                                <div key={photo.id} className="relative group border rounded-lg overflow-hidden">
                                    {photo.tempDataUrl ? (
                                        <img src={photo.tempDataUrl} alt="Vehicle condition" className="w-full h-32 object-cover" />
                                    ) : (
                                        <AsyncImage imageId={photo.id} alt="Vehicle condition" className="w-full h-32 object-cover" />
                                    )}
                                    <button onClick={() => handleRemovePhoto(photo.id)} className="absolute top-1 right-1 bg-white/70 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                    <input 
                                        type="text"
                                        value={photo.notes || ''}
                                        onChange={(e) => handlePhotoNotesChange(photo.id, e.target.value)}
                                        placeholder="Add notes..."
                                        className="absolute bottom-0 left-0 right-0 w-full bg-black/50 text-white text-xs p-1 border-t border-white/20"
                                    />
                                </div>
                            ))}
                             <div className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 p-2">
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-gray-100 hover:text-indigo-600 transition"
                                        title="Use device camera"
                                    >
                                        <Camera size={24} />
                                        <span className="text-sm mt-1">Take Photo</span>
                                    </button>
                                    <div className="w-px h-16 bg-gray-300"></div>
                                    <button
                                        type="button"
                                        onClick={() => uploadInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-gray-100 hover:text-indigo-600 transition"
                                        title="Upload from device storage"
                                    >
                                        <Upload size={24} />
                                        <span className="text-sm mt-1">Upload File</span>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                    'Take Photo' will use your camera on mobile. On desktop, it may open a file browser.
                                </p>
                            </div>
                        </div>
                        <input
                            ref={cameraInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input
                            ref={uploadInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-end gap-2 p-4 border-t bg-gray-50">
                    <button onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg">
                        <Save size={16} /> Confirm Check-In
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckInModal;
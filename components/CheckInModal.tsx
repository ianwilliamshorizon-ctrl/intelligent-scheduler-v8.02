import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Job, CheckInPhoto, ServicePackage, TaxRate } from '../types';
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
    Clock,
    Wrench,
    Package
} from 'lucide-react';
import { saveImage } from '../utils/imageStore';
import { calculatePackagePrices } from '../core/utils/packageUtils';
import AsyncMedia from './AsyncMedia';
import MediaLightbox from './MediaLightbox';

interface TempCheckInPhoto extends CheckInPhoto {
    tempDataUrl?: string;
    file?: File;
}

export interface CheckInAdditions {
    packages: ServicePackage[];
    checks: string[];
    customExtra?: {
        description: string;
        deltaGross: number;
    };
}

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    onAuthorizeCheckInExtra?: (job: Job, description: string, deltaGross: number) => Promise<void> | void;
    onCheckInAdditions?: (job: Job, additions: CheckInAdditions) => Promise<void> | void;
    servicePackages?: ServicePackage[];
    taxRates?: TaxRate[];
    job: Job | null;
}

const CheckInModal: React.FC<CheckInModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onAuthorizeCheckInExtra,
    onCheckInAdditions,
    servicePackages = [],
    taxRates = [],
    job
}) => {
    const [keyNumber, setKeyNumber] = useState<string>('');
    const [mileage, setMileage] = useState<string>('');
    const [photos, setPhotos] = useState<TempCheckInPhoto[]>([]);
    const [checkInput, setCheckInput] = useState<string>('');
    const [checkItems, setCheckItems] = useState<string[]>([]);
    const [packageSearch, setPackageSearch] = useState<string>('');
    const [selectedPackages, setSelectedPackages] = useState<ServicePackage[]>([]);
    const [extraWorkAuthorized, setExtraWorkAuthorized] = useState<boolean>(false);
    const [extraWorkDescription, setExtraWorkDescription] = useState<string>('');
    const [extraWorkGross, setExtraWorkGross] = useState<string>('');
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
            setCheckInput('');
            setCheckItems([]);
            setPackageSearch('');
            setSelectedPackages([]);
            setExtraWorkAuthorized(false);
            setExtraWorkDescription('');
            setExtraWorkGross('');
        }
    }, [job]);

    const availablePackages = useMemo(() => {
        const term = packageSearch.trim().toLowerCase();
        const selectedIds = new Set(selectedPackages.map(p => p.id));
        return [...servicePackages]
            .filter(p => !selectedIds.has(p.id))
            .filter(p => {
                if (!term) return true;
                return (p.name || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term);
            })
            .sort((a, b) => {
                // Prioritize packages belonging to the job's business entity
                const aMatch = job?.entityId && a.entityId === job.entityId ? 0 : 1;
                const bMatch = job?.entityId && b.entityId === job.entityId ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
                return (a.name || '').localeCompare(b.name || '');
            });
    }, [servicePackages, selectedPackages, packageSearch, job?.entityId]);

    const handleAddCheckItem = () => {
        const trimmed = checkInput.trim();
        if (!trimmed) return;
        setCheckItems(prev => [...prev, trimmed]);
        setCheckInput('');
    };

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

        const finalChecks = [...checkItems];
        if (checkInput.trim()) {
            finalChecks.push(checkInput.trim());
        }

        const trimmedExtra = extraWorkDescription.trim();
        const extraAmount = parseFloat(extraWorkGross) || 0;
        const noteLines: string[] = [];
        if (finalChecks.length > 0) {
            finalChecks.forEach(c => noteLines.push(`[Check-In Check Requested: ${c}]`));
        }
        selectedPackages.forEach(pkg => {
            const { net, vat } = calculatePackagePrices(pkg, taxRates);
            const gross = net + vat;
            noteLines.push(`[Check-In Package Added: ${pkg.name || 'Service Package'} (+£${gross.toFixed(2)} inc VAT)]`);
        });
        if (extraWorkAuthorized && trimmedExtra) {
            noteLines.push(`[Check-In Extra Authorized: ${trimmedExtra}${extraAmount > 0 ? ` (+£${extraAmount.toFixed(2)} inc VAT)` : ''}]`);
        }

        const existingObs = job.technicianObservations || [];
        const newObs = finalChecks.map(c => `Check-In Request: ${c}`);

        const updatedJob: Job = {
            ...job,
            keyNumber: keyNumber || undefined,
            mileage: mileage ? parseInt(mileage, 10) : undefined,
            checkInPhotos: finalPhotos,
            vehicleStatus: 'On Site',
            technicianObservations: newObs.length > 0 ? [...existingObs, ...newObs] : job.technicianObservations,
            notes: noteLines.length > 0
                ? (job.notes ? `${job.notes}\n${noteLines.join('\n')}` : noteLines.join('\n'))
                : job.notes
        };
        console.log("[CheckIn] Saving job...", updatedJob);
        try {
            await onSave(updatedJob);
            const hasAdditions = selectedPackages.length > 0 || finalChecks.length > 0 || (extraWorkAuthorized && !!trimmedExtra);
            if (hasAdditions && onCheckInAdditions) {
                await onCheckInAdditions(updatedJob, {
                    packages: selectedPackages,
                    checks: finalChecks,
                    customExtra: (extraWorkAuthorized && trimmedExtra)
                        ? { description: trimmedExtra, deltaGross: extraAmount }
                        : undefined,
                });
            } else if (extraWorkAuthorized && trimmedExtra && onAuthorizeCheckInExtra) {
                await onAuthorizeCheckInExtra(updatedJob, trimmedExtra, extraAmount);
            }
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
                    <div className={`p-3.5 rounded-2xl text-xs sm:text-sm border flex items-center gap-3 ${partsReady
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs ${partsReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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
                                    className={`px-3.5 rounded-xl font-black text-sm border flex items-center justify-center gap-1 transition-all shadow-2xs ${keyNumber.endsWith('S')
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

                    {/* Job Card Checks & Additional Service Packages at Check-In */}
                    <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <Wrench size={13} className="text-amber-600" />
                                Job Card Checks &amp; Extra Service Packages
                            </span>
                            <span className="text-[10px] font-semibold text-amber-700">
                                Added straight to Job Card &amp; Estimate
                            </span>
                        </div>

                        {/* 1. Add Check / Concern to Job Card */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-slate-700">
                                Add Check / Concern to Job Card
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={checkInput}
                                    onChange={e => setCheckInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCheckItem();
                                        }
                                    }}
                                    placeholder="e.g. Noise from suspension, check wipers"
                                    className="flex-1 px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCheckItem}
                                    disabled={!checkInput.trim()}
                                    className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-40 flex items-center gap-1 shrink-0"
                                >
                                    <Plus size={14} /> Add Check
                                </button>
                            </div>
                            {checkItems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {checkItems.map((item, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-800">
                                            <span>Check: {item}</span>
                                            <button
                                                type="button"
                                                onClick={() => setCheckItems(prev => prev.filter((_, i) => i !== idx))}
                                                className="text-slate-400 hover:text-red-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. Pull down Service Package */}
                        {servicePackages.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-amber-200/70">
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                    <Package size={12} className="text-indigo-600" />
                                    Add Service Package (records authorized override)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={packageSearch}
                                        onChange={e => setPackageSearch(e.target.value)}
                                        placeholder="Filter packages..."
                                        className="px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white font-medium"
                                    />
                                    <select
                                        value=""
                                        onChange={e => {
                                            const pkg = servicePackages.find(p => p.id === e.target.value);
                                            if (pkg) {
                                                setSelectedPackages(prev => [...prev, pkg]);
                                            }
                                        }}
                                        className="sm:col-span-2 px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white font-semibold text-slate-800"
                                    >
                                        <option value="">-- Select Service Package to Add --</option>
                                        {availablePackages.map(pkg => {
                                            const { net, vat } = calculatePackagePrices(pkg, taxRates);
                                            const gross = net + vat;
                                            return (
                                                <option key={pkg.id} value={pkg.id}>
                                                    {pkg.name} — £{gross.toFixed(2)} inc VAT
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                {selectedPackages.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {selectedPackages.map(pkg => {
                                            const { net, vat } = calculatePackagePrices(pkg, taxRates);
                                            const gross = net + vat;
                                            return (
                                                <span key={pkg.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900">
                                                    <span>{pkg.name} (£{gross.toFixed(2)})</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPackages(prev => prev.filter(p => p.id !== pkg.id))}
                                                        className="text-indigo-400 hover:text-red-600"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Custom Bespoke Extra Work */}
                        <div className="pt-1 border-t border-amber-200/70">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={extraWorkAuthorized}
                                    onChange={e => setExtraWorkAuthorized(e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-xs font-bold text-amber-950">
                                    Other custom extra work authorized at Check-In
                                </span>
                            </label>
                            {extraWorkAuthorized && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                                    <input
                                        type="text"
                                        value={extraWorkDescription}
                                        onChange={e => setExtraWorkDescription(e.target.value)}
                                        placeholder="Extra work requested (e.g. Wipers)"
                                        className="sm:col-span-2 px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white font-medium"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={extraWorkGross}
                                        onChange={e => setExtraWorkGross(e.target.value)}
                                        placeholder="Extra £ inc VAT"
                                        className="px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white font-mono font-bold"
                                    />
                                </div>
                            )}
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
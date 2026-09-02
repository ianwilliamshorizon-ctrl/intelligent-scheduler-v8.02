import React, { useState, useRef } from 'react';
import { 
    Job, 
    Vehicle, 
    Customer, 
    FindingCategory, 
    FindingSeverity, 
    InspectionFinding 
} from '../../types';
import { 
    Camera, 
    AlertTriangle, 
    AlertOctagon, 
    CheckCircle2, 
    X, 
    Upload, 
    Wrench, 
    Clock, 
    Trash2, 
    Sparkles, 
    Send, 
    Loader2, 
    Car,
    Plus,
    Check,
    Layers
} from 'lucide-react';
import { toast } from 'react-toastify';
import { saveFile } from '../../utils/imageStore';
import { useApp } from '../../core/state/AppContext';
import { COMMON_FINDING_SUGGESTIONS, syncFindingsToJob } from '../../core/utils/inspectionFindingUtils';
import SpeechToTextButton from '../shared/SpeechToTextButton';

interface FastTrackFindingModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    onSaveJob: (updatedJob: Job) => Promise<void> | void;
}

interface DraftFindingItem {
    id: string;
    category: FindingCategory;
    severity: FindingSeverity;
    itemLabel: string;
    notes: string;
    suggestedHours: number | '';
    suggestedParts: string;
    photos: { id: string; name: string; file: File; previewUrl: string }[];
}

const CATEGORIES: { id: FindingCategory; label: string; icon: string }[] = [
    { id: 'Brakes', label: 'Brakes', icon: '🛑' },
    { id: 'Tyres', label: 'Tyres & Wheels', icon: '🛞' },
    { id: 'Leaks & Fluids', label: 'Leaks & Fluids', icon: '💧' },
    { id: 'Suspension & Steering', label: 'Suspension & Steering', icon: '🔩' },
    { id: 'Exhaust', label: 'Exhaust & Emissions', icon: '💨' },
    { id: 'Engine & Drivetrain', label: 'Engine & Drivetrain', icon: '⚙️' },
    { id: 'Electrical', label: 'Electrical & Battery', icon: '⚡' },
    { id: 'Body & Glass', label: 'Body & Glass', icon: '🚗' },
    { id: 'Other', label: 'Other Observation', icon: '🔍' }
];

export const FastTrackFindingModal: React.FC<FastTrackFindingModalProps> = ({
    isOpen,
    onClose,
    job,
    vehicle,
    customer,
    onSaveJob
}) => {
    const { currentUser } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // List of already staged findings in this session
    const [stagedFindings, setStagedFindings] = useState<DraftFindingItem[]>([]);

    // Active item being edited in the form
    const [category, setCategory] = useState<FindingCategory>('Brakes');
    const [severity, setSeverity] = useState<FindingSeverity>('urgent');
    const [itemLabel, setItemLabel] = useState('Discs Worn Below Minimum Thickness');
    const [notes, setNotes] = useState('');
    const [suggestedHours, setSuggestedHours] = useState<number | ''>('');
    const [suggestedParts, setSuggestedParts] = useState('');
    const [photos, setPhotos] = useState<{ id: string; name: string; file: File; previewUrl: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handlePhotoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const newFiles = Array.from(e.target.files);
        const newItems = newFiles.map(file => ({
            id: `finding_photo_${crypto.randomUUID()}`,
            name: file.name,
            file,
            previewUrl: URL.createObjectURL(file)
        }));
        setPhotos(prev => [...prev, ...newItems]);
        e.target.value = '';
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleSelectSuggestion = (suggestion: string) => {
        setItemLabel(suggestion);
        if (!notes) {
            setNotes(`Requires replacement: ${suggestion.toLowerCase()}.`);
        }
    };

    // Stage the current form item into the batch list
    const handleStageCurrentItem = () => {
        if (!itemLabel.trim()) {
            toast.error('Please enter a finding name or select a suggestion first.');
            return false;
        }

        const newItem: DraftFindingItem = {
            id: `draft_${crypto.randomUUID()}`,
            category,
            severity,
            itemLabel: itemLabel.trim(),
            notes: notes.trim(),
            suggestedHours,
            suggestedParts: suggestedParts.trim(),
            photos
        };

        setStagedFindings(prev => [...prev, newItem]);

        // Reset form for next item
        setCategory('Leaks & Fluids');
        setSeverity('attention');
        setItemLabel('Coolant Leak from Radiator / Hose Junction');
        setNotes('');
        setSuggestedHours('');
        setSuggestedParts('');
        setPhotos([]);
        toast.info(`Item staged (${newItem.category}: ${newItem.itemLabel})`);
        return true;
    };

    const handleRemoveStagedItem = (id: string) => {
        setStagedFindings(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmitAll = async (e: React.FormEvent) => {
        e.preventDefault();

        // If current form has an item filled, automatically stage it
        let itemsToSubmit = [...stagedFindings];
        if (itemLabel.trim()) {
            itemsToSubmit.push({
                id: `draft_${crypto.randomUUID()}`,
                category,
                severity,
                itemLabel: itemLabel.trim(),
                notes: notes.trim(),
                suggestedHours,
                suggestedParts: suggestedParts.trim(),
                photos
            });
        }

        if (itemsToSubmit.length === 0) {
            toast.error('Please enter at least one finding before submitting.');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalFindings: InspectionFinding[] = [];

            for (const item of itemsToSubmit) {
                // 1. Upload photos
                const savedPhotosMeta: { id: string; name?: string; uploadedAt: string }[] = [];
                for (const photo of item.photos) {
                    await saveFile(photo.id, photo.file);
                    savedPhotosMeta.push({
                        id: photo.id,
                        name: photo.name,
                        uploadedAt: new Date().toISOString()
                    });
                }

                // 2. Create InspectionFinding
                finalFindings.push({
                    id: `finding_${crypto.randomUUID()}`,
                    jobId: job.id,
                    category: item.category,
                    itemLabel: item.itemLabel,
                    severity: item.severity,
                    notes: item.notes,
                    photos: savedPhotosMeta,
                    suggestedLabourHours: item.suggestedHours !== '' ? Number(item.suggestedHours) : undefined,
                    suggestedParts: item.suggestedParts || undefined,
                    status: 'Pending Review',
                    createdAt: new Date().toISOString(),
                    createdByUserId: currentUser?.id || 'unknown_technician',
                    createdByName: currentUser?.name || 'Technician'
                });
            }

            // 3. Automatically sync all findings into job.inspectionChecklist and job.technicianObservations
            const updatedJob = syncFindingsToJob(job, finalFindings);

            // 4. Commit updated job to database
            await onSaveJob(updatedJob);

            toast.success(`🚨 ${finalFindings.length} Ramp finding(s) sent to Service Desk & synced to Inspection Sheet!`);
            onClose();
        } catch (error) {
            console.error('Failed to submit inspection findings:', error);
            toast.error('Failed to save inspection findings.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalItemCount = stagedFindings.length + (itemLabel.trim() ? 1 : 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95">
                
                {/* Header Strip */}
                <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white px-5 py-3.5 flex items-center justify-between border-b border-rose-900/40 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-rose-600 text-white rounded-xl shadow-md">
                            <AlertOctagon size={20} />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                                    Ramp Inspection Findings
                                </h3>
                                <span className="bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    Multi-Select Alert
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 flex items-center gap-2">
                                <span className="font-mono bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black text-[10px]">{vehicle?.registration || 'NO REG'}</span>
                                <span>{vehicle?.make} {vehicle?.model} • Job #{job.id}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Staged Items Banner (if any) */}
                {stagedFindings.length > 0 && (
                    <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex flex-col gap-1.5 shrink-0">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            <span className="flex items-center gap-1.5 text-indigo-700">
                                <Layers size={13} />
                                Staged Findings in this Batch ({stagedFindings.length})
                            </span>
                            <span className="text-slate-500 text-[10px]">Will be submitted together</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {stagedFindings.map((item, idx) => (
                                <div 
                                    key={item.id}
                                    className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-2 shadow-2xs ${
                                        item.severity === 'urgent'
                                            ? 'bg-rose-50 border-rose-300 text-rose-900'
                                            : 'bg-amber-50 border-amber-300 text-amber-900'
                                    }`}
                                >
                                    <span>{item.severity === 'urgent' ? '🔴' : '🟡'}</span>
                                    <span className="font-bold">{item.category}:</span>
                                    <span className="truncate max-w-[140px]">{item.itemLabel}</span>
                                    {item.photos.length > 0 && (
                                        <span className="text-[10px] text-slate-500">📸{item.photos.length}</span>
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveStagedItem(item.id)}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                        title="Remove from batch"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Scrollable Form for Current Item */}
                <form onSubmit={handleSubmitAll} className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
                    
                    {/* Item Progress Bar */}
                    <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                            {stagedFindings.length > 0 ? `Item #${stagedFindings.length + 1} Details` : 'Item Details'}
                        </span>
                        <span className="text-xs font-semibold text-indigo-600">
                            Add multiple items before submitting
                        </span>
                    </div>

                    {/* Urgency / Severity Traffic Lights */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Finding Urgency (Traffic Light eVHC)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setSeverity('urgent')}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    severity === 'urgent'
                                        ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                }`}
                            >
                                <span className="text-lg">🔴</span>
                                <span className="text-xs font-black uppercase tracking-wider">Red (Immediate)</span>
                                <span className={`text-[10px] ${severity === 'urgent' ? 'text-rose-100' : 'text-rose-600'}`}>Unsafe / Urgent Action</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSeverity('attention')}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    severity === 'attention'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                <span className="text-lg">🟡</span>
                                <span className="text-xs font-black uppercase tracking-wider">Amber (Advisory)</span>
                                <span className={`text-[10px] ${severity === 'attention' ? 'text-amber-100' : 'text-amber-700'}`}>Recommended Soon</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSeverity('ok')}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    severity === 'ok'
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                            >
                                <span className="text-lg">🟢</span>
                                <span className="text-xs font-black uppercase tracking-wider">Green (Rechecked)</span>
                                <span className={`text-[10px] ${severity === 'ok' ? 'text-emerald-100' : 'text-emerald-700'}`}>Serviceable</span>
                            </button>
                        </div>
                    </div>

                    {/* Category Selector Buttons */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Component / System Area
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        setCategory(cat.id);
                                        const suggestions = COMMON_FINDING_SUGGESTIONS[cat.id];
                                        if (suggestions && suggestions.length > 0) {
                                            setItemLabel(suggestions[0]);
                                        }
                                    }}
                                    className={`py-2 px-2.5 rounded-lg border text-left text-xs font-bold flex items-center gap-1.5 transition cursor-pointer truncate ${
                                        category === cat.id
                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{cat.icon}</span>
                                    <span className="truncate">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Common Issue Suggestions Pill Strip */}
                    {COMMON_FINDING_SUGGESTIONS[category] && (
                        <div>
                            <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Sparkles size={13} className="text-indigo-600" />
                                Quick Suggestions for {category}:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {COMMON_FINDING_SUGGESTIONS[category].map((sug, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(sug)}
                                        className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                                            itemLabel === sug
                                                ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Item / Component Description Field */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Observation Summary
                        </label>
                        <input 
                            type="text"
                            value={itemLabel}
                            onChange={(e) => setItemLabel(e.target.value)}
                            placeholder="e.g. Front brake discs scored below minimum thickness"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>

                    {/* Detailed Notes with Voice Dictation */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Technician Notes & Measurements
                            </label>
                            <SpeechToTextButton 
                                onTranscript={(text) => {
                                    setNotes(prev => prev ? `${prev} ${text}` : text);
                                }}
                            />
                        </div>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter measurements or observations (e.g. Discs measured 30.1mm, min 30.5mm. Heavy outer lip)."
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                        />
                    </div>

                    {/* Photo Evidence Capture Strip */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                                <Camera size={15} className="text-indigo-600" />
                                Photo Evidence ({photos.length})
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                                    title="Take photo directly from camera"
                                >
                                    <Camera size={14} /> Snap Photo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    title="Choose photos from device gallery"
                                >
                                    <Upload size={14} /> Upload
                                </button>
                                <input 
                                    ref={cameraInputRef}
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    className="hidden" 
                                    onChange={handlePhotoSelection} 
                                />
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*" 
                                    multiple 
                                    className="hidden" 
                                    onChange={handlePhotoSelection} 
                                />
                            </div>
                        </div>

                        {photos.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                                {photos.map((photo) => (
                                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white aspect-square shadow-2xs">
                                        <img 
                                            src={photo.previewUrl} 
                                            alt={photo.name} 
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePhoto(photo.id)}
                                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full shadow hover:bg-rose-700 transition cursor-pointer"
                                            title="Delete photo"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic text-center py-2">
                                No photos attached for this item.
                            </p>
                        )}
                    </div>

                    {/* Optional Quick Labour & Parts Estimates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock size={12} className="text-indigo-600" />
                                Estimated Labour (Hours)
                            </label>
                            <input 
                                type="number" 
                                step="0.25"
                                min="0"
                                value={suggestedHours}
                                onChange={(e) => setSuggestedHours(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="e.g. 1.0"
                                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Wrench size={12} className="text-indigo-600" />
                                Recommended Parts
                            </label>
                            <input 
                                type="text" 
                                value={suggestedParts}
                                onChange={(e) => setSuggestedParts(e.target.value)}
                                placeholder="e.g. Front discs + pad set"
                                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                            />
                        </div>
                    </div>

                    {/* Button to Stage Another Item */}
                    <div className="pt-2 flex justify-center">
                        <button
                            type="button"
                            onClick={handleStageCurrentItem}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs active:scale-95"
                        >
                            <Plus size={15} />
                            <span>+ Stage Item & Add Another Finding</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || totalItemCount === 0}
                            className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Syncing {totalItemCount} Finding(s)...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={15} />
                                    <span>Submit {totalItemCount > 1 ? `All (${totalItemCount} Findings)` : 'Alert'} to Service Desk</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FastTrackFindingModal;

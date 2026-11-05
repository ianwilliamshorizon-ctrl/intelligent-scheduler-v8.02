import React, { useState, useMemo } from 'react';
import { ChecklistSection, ChecklistItemStatus } from '../types';
import { 
    X, Check, AlertTriangle, XCircle, HelpCircle, Camera, 
    ArrowRight, ArrowLeft, Pause, Play, Sparkles, CheckCircle2, RotateCcw, ListFilter
} from 'lucide-react';
import SpeechToTextButton from './shared/SpeechToTextButton';

interface FlatInspectionStep {
    sectionId: string;
    sectionTitle: string;
    itemId: string;
    itemLabel: string;
    status: ChecklistItemStatus;
    comment: string;
    photoRequired?: boolean;
    photoNotes?: string;
}

interface GuidedInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    checklistData: ChecklistSection[];
    onChecklistUpdate: (updated: ChecklistSection[]) => void;
    vehicleRegistration?: string;
    vehicleModel?: string;
}

export const GuidedInspectionModal: React.FC<GuidedInspectionModalProps> = ({
    isOpen,
    onClose,
    checklistData,
    onChecklistUpdate,
    vehicleRegistration,
    vehicleModel
}) => {
    // Flatten all sections into a sequential list of steps
    const initialSteps = useMemo(() => {
        const steps: FlatInspectionStep[] = [];
        (checklistData || []).forEach(section => {
            (section.items || []).forEach(item => {
                steps.push({
                    sectionId: section.id,
                    sectionTitle: section.title,
                    itemId: item.id,
                    itemLabel: item.label,
                    status: item.status || 'na',
                    comment: item.comment || '',
                    photoRequired: false,
                    photoNotes: ''
                });
            });
        });
        return steps;
    }, [checklistData]);

    const [steps, setSteps] = useState<FlatInspectionStep[]>(initialSteps);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [subStep, setSubStep] = useState<'answer' | 'photoPrompt' | 'photoNotes'>('answer');
    const [jumpStepInput, setJumpStepInput] = useState<string>('');

    // Keep internal steps in sync if modal re-opens
    React.useEffect(() => {
        if (isOpen) {
            setSteps(initialSteps);
            setCurrentStepIndex(0);
            setSubStep('answer');
        }
    }, [isOpen, initialSteps]);

    if (!isOpen || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;
    const isLastStep = currentStepIndex === totalSteps - 1;

    // Synchronize current state back to parent checklist
    const syncToParent = (currentStepsState: FlatInspectionStep[]) => {
        const updated = checklistData.map(section => ({
            ...section,
            items: section.items.map(item => {
                const found = currentStepsState.find(s => s.sectionId === section.id && s.itemId === item.id);
                if (found) {
                    const extraComment = found.photoRequired 
                        ? `${found.comment ? `${found.comment} | ` : ''}[Photo Required: ${found.photoNotes || 'Yes'}]`
                        : found.comment;
                    return {
                        ...item,
                        status: found.status,
                        comment: extraComment
                    };
                }
                return item;
            })
        }));
        onChecklistUpdate(updated);
    };

    const handleSelectStatus = (status: ChecklistItemStatus) => {
        const updated = [...steps];
        updated[currentStepIndex] = {
            ...updated[currentStepIndex],
            status
        };
        setSteps(updated);
        syncToParent(updated);
        // Move to photo prompt
        setSubStep('photoPrompt');
    };

    const handleCommentChange = (comment: string) => {
        const updated = [...steps];
        updated[currentStepIndex] = {
            ...updated[currentStepIndex],
            comment
        };
        setSteps(updated);
        syncToParent(updated);
    };

    const handlePhotoChoice = (needPhoto: boolean) => {
        const updated = [...steps];
        updated[currentStepIndex] = {
            ...updated[currentStepIndex],
            photoRequired: needPhoto
        };
        setSteps(updated);
        syncToParent(updated);

        if (needPhoto) {
            setSubStep('photoNotes');
        } else {
            // Proceed to next step if not last
            if (!isLastStep) {
                setCurrentStepIndex(prev => prev + 1);
                setSubStep('answer');
            }
        }
    };

    const handlePhotoNotesSubmit = (notes: string) => {
        const updated = [...steps];
        updated[currentStepIndex] = {
            ...updated[currentStepIndex],
            photoNotes: notes
        };
        setSteps(updated);
        syncToParent(updated);

        if (!isLastStep) {
            setCurrentStepIndex(prev => prev + 1);
            setSubStep('answer');
        }
    };

    const handleJumpToStep = (targetStepNumber: number) => {
        const idx = targetStepNumber - 1;
        if (idx >= 0 && idx < totalSteps) {
            setCurrentStepIndex(idx);
            setSubStep('answer');
            setJumpStepInput('');
        }
    };

    const handlePauseAndSave = () => {
        syncToParent(steps);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-base sm:text-lg">Guided Vehicle Inspection Host</h3>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    Step-by-Step
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {vehicleRegistration ? `${vehicleRegistration} ${vehicleModel ? `• ${vehicleModel}` : ''}` : 'Interactive inspection walkthrough'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handlePauseAndSave}
                        className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
                        title="Close / Pause"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2">
                    <div 
                        className="bg-indigo-600 h-2 transition-all duration-300"
                        style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Main Content Area */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Section Badge & Question */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                                {currentStep.sectionTitle}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                                Question {currentStepIndex + 1} of {totalSteps}
                            </span>
                        </div>

                        <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                            {currentStep.itemLabel}
                        </h2>

                        {/* Status Selection Buttons */}
                        <div className="pt-2">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Record Finding:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('ok')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'ok'
                                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border-slate-200 hover:border-emerald-300'
                                    }`}
                                >
                                    <Check size={16} />
                                    <span>OK / Pass</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('attention')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'attention'
                                            ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                            : 'bg-white hover:bg-amber-50 text-amber-800 border-slate-200 hover:border-amber-300'
                                    }`}
                                >
                                    <AlertTriangle size={16} />
                                    <span>Attention</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('urgent')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'urgent'
                                            ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-300'
                                            : 'bg-white hover:bg-red-50 text-red-800 border-slate-200 hover:border-red-300'
                                    }`}
                                >
                                    <XCircle size={16} />
                                    <span>Urgent</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('na')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'na'
                                            ? 'bg-slate-500 text-white border-slate-600 shadow-md ring-2 ring-slate-300'
                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <HelpCircle size={16} />
                                    <span>N/A</span>
                                </button>
                            </div>
                        </div>

                        {/* Finding Comments with Speech to Text */}
                        <div className="pt-2">
                            <label className="text-xs font-bold text-slate-500 block mb-1">
                                Engineer Notes / Observations:
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={currentStep.comment || ''}
                                    onChange={e => handleCommentChange(e.target.value)}
                                    placeholder="Add specific observations, wear levels, or defect details..."
                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <SpeechToTextButton 
                                    onTranscript={text => handleCommentChange(currentStep.comment ? `${currentStep.comment} ${text}` : text)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 2b: Photo Prompt Sub-Step */}
                    {subStep === 'photoPrompt' && (
                        <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Camera size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-indigo-950">
                                        Do you need a photo for this step?
                                    </h4>
                                    <p className="text-xs text-indigo-700">
                                        Attach visual evidence for customer report or estimate.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handlePhotoChoice(true)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs"
                                >
                                    Yes (Require Photo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePhotoChoice(false)}
                                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition"
                                >
                                    No (Proceed)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2c: Photo Notes Sub-Step */}
                    {subStep === 'photoNotes' && (
                        <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3 animate-fade-in">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase">
                                <Camera size={16} className="text-amber-600" />
                                <span>Photo Flagged for Step #{currentStepIndex + 1}</span>
                            </div>
                            <input
                                type="text"
                                defaultValue={currentStep.photoNotes || ''}
                                placeholder="Describe what the photo should show (e.g. OSF inner brake pad wear, oil seepage at sump)..."
                                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        handlePhotoNotesSubmit(e.currentTarget.value);
                                    }
                                }}
                            />
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={e => {
                                        const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                                        handlePhotoNotesSubmit(input?.value || '');
                                    }}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5"
                                >
                                    <span>Save Photo Notes & Continue</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Running Inspection Log */}
                    <div className="border border-slate-200 rounded-2xl bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1.5">
                                <ListFilter size={14} className="text-indigo-600" />
                                Running Inspection Log ({steps.filter(s => s.status !== 'na' || s.comment).length} items recorded)
                            </h4>
                            <span className="text-[11px] text-slate-400">Live Auto-Save</span>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 divide-y divide-slate-100">
                            {steps.map((st, i) => {
                                const isRecorded = st.status !== 'na' || !!st.comment || st.photoRequired;
                                return (
                                    <div 
                                        key={st.itemId}
                                        className={`pt-1.5 flex items-start justify-between gap-2 text-xs transition ${
                                            i === currentStepIndex ? 'bg-indigo-50/70 p-2 rounded-lg font-bold text-indigo-950' : 'text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2 flex-1">
                                            <span className="font-mono text-slate-400 text-[11px] mt-0.5">#{i + 1}</span>
                                            <div>
                                                <span className="font-semibold text-slate-900">{st.itemLabel}</span>
                                                {st.comment && <span className="text-slate-500 block text-[11px] italic">&ldquo;{st.comment}&rdquo;</span>}
                                                {st.photoRequired && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded mt-0.5">
                                                        📷 Photo Required {st.photoNotes ? `(${st.photoNotes})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                st.status === 'ok' ? 'bg-emerald-100 text-emerald-800' :
                                                st.status === 'attention' ? 'bg-amber-100 text-amber-800' :
                                                st.status === 'urgent' ? 'bg-red-100 text-red-800' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {st.status.toUpperCase()}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleJumpToStep(i + 1)}
                                                className="text-[10px] text-indigo-600 hover:text-indigo-900 font-bold underline"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Navigation Choice */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Jump to Step Input */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs text-slate-500 font-medium">Go back to step #:</span>
                        <input
                            type="number"
                            min={1}
                            max={totalSteps}
                            value={jumpStepInput}
                            onChange={e => setJumpStepInput(e.target.value)}
                            placeholder="e.g. 1"
                            className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && jumpStepInput) {
                                    handleJumpToStep(parseInt(jumpStepInput, 10));
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => jumpStepInput && handleJumpToStep(parseInt(jumpStepInput, 10))}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition"
                        >
                            Jump
                        </button>
                    </div>

                    {/* Step Options: Continue / Back / Pause */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handlePauseAndSave}
                            className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                            <Pause size={13} />
                            <span>Pause & Save Log</span>
                        </button>

                        {currentStepIndex > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentStepIndex(prev => Math.max(0, prev - 1));
                                    setSubStep('answer');
                                }}
                                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <ArrowLeft size={13} />
                                <span>Previous Step</span>
                            </button>
                        )}

                        {!isLastStep ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentStepIndex(prev => Math.min(totalSteps - 1, prev + 1));
                                    setSubStep('answer');
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5"
                            >
                                <span>Continue</span>
                                <ArrowRight size={13} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handlePauseAndSave}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={13} />
                                <span>Complete Inspection</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuidedInspectionModal;

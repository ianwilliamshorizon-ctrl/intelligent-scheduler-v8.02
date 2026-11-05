import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChecklistSection, ChecklistItemStatus } from '../types';
import { 
    X, Check, AlertTriangle, XCircle, HelpCircle, Camera, 
    ArrowRight, ArrowLeft, Pause, Sparkles, CheckCircle2, ListFilter,
    Volume2, VolumeX, Mic, MicOff, RotateCcw, Radio
} from 'lucide-react';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import { findBestVoice, prepareTextForSpeech } from '../core/utils/speechUtils';
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

    // Speech & Voice Navigation State
    const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(true);
    const [isVoiceControlActive, setIsVoiceControlActive] = useState<boolean>(true);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);

    // Refs for speech recognition and audio echo prevention
    const isSpeakingRef = useRef<boolean>(false);
    const recognitionRef = useRef<any>(null);
    const shouldListenRef = useRef<boolean>(true);
    const subStepRef = useRef<'answer' | 'photoPrompt' | 'photoNotes'>('answer');
    const currentStepIndexRef = useRef<number>(0);
    const stepsRef = useRef<FlatInspectionStep[]>(initialSteps);

    // Keep refs in sync with current state
    useEffect(() => {
        subStepRef.current = subStep;
    }, [subStep]);

    useEffect(() => {
        currentStepIndexRef.current = currentStepIndex;
    }, [currentStepIndex]);

    useEffect(() => {
        stepsRef.current = steps;
    }, [steps]);

    useEffect(() => {
        shouldListenRef.current = isVoiceControlActive;
    }, [isVoiceControlActive]);

    // Check Web Speech API support
    const isSpeechRecognitionSupported = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    }, []);

    // Synchronize current state back to parent checklist
    const syncToParent = useCallback((currentStepsState: FlatInspectionStep[]) => {
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
    }, [checklistData, onChecklistUpdate]);

    // Text-to-Speech speaking function
    const speakText = useCallback((text: string, onDone?: () => void) => {
        if (!isTtsEnabled) {
            onDone?.();
            return;
        }

        try {
            cloudSpeechSynthesis.cancel();
            isSpeakingRef.current = true;
            setIsSpeaking(true);

            const cleaned = prepareTextForSpeech(text);
            const utterance = new CloudSpeechSynthesisUtterance(cleaned);
            
            const voices = cloudSpeechSynthesis.getVoices();
            const preferredVoice = findBestVoice(voices, { lang: 'en-GB', gender: 'female' });
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            utterance.lang = 'en-GB';

            const finishSpeaking = () => {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                onDone?.();
            };

            utterance.onend = () => {
                finishSpeaking();
            };

            utterance.onerror = (e: any) => {
                console.warn('Speech synthesis error / interrupted:', e);
                finishSpeaking();
            };

            cloudSpeechSynthesis.speak(utterance);
        } catch (err) {
            console.error('Failed to speak text:', err);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            onDone?.();
        }
    }, [isTtsEnabled]);

    // Read the current step aloud
    const readCurrentStep = useCallback((stepIndex: number) => {
        const step = stepsRef.current[stepIndex];
        if (!step) return;

        const textToSpeak = `Question ${stepIndex + 1}. ${step.sectionTitle}. ${step.itemLabel}.`;
        speakText(textToSpeak);
    }, [speakText]);

    // Replay current step audio
    const handleRepeatAudio = () => {
        if (subStep === 'answer') {
            readCurrentStep(currentStepIndex);
        } else if (subStep === 'photoPrompt') {
            speakText("Do you need a photo for this step? Say Yes or No.");
        } else if (subStep === 'photoNotes') {
            speakText("Photo flagged. Say your photo notes, or say Next when ready.");
        }
    };

    // Step status selection handler
    const handleSelectStatus = useCallback((status: ChecklistItemStatus) => {
        const stepIdx = currentStepIndexRef.current;
        const currentSteps = stepsRef.current;
        const updated = [...currentSteps];
        updated[stepIdx] = {
            ...updated[stepIdx],
            status
        };
        setSteps(updated);
        syncToParent(updated);

        const statusLabel = 
            status === 'ok' ? 'Pass' : 
            status === 'attention' ? 'Attention' : 
            status === 'urgent' ? 'Urgent' : 'N A';

        setLastHeardCommand(`Marked: ${statusLabel}`);

        // Prompt for photo both on screen and via voice
        setSubStep('photoPrompt');
        speakText(`${statusLabel} recorded. Do you need a photo for this step? Say Yes or No.`);
    }, [syncToParent, speakText]);

    // Comment change handler
    const handleCommentChange = useCallback((comment: string) => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            comment
        };
        setSteps(updated);
        syncToParent(updated);
    }, [syncToParent]);

    // Advance to next step
    const advanceToNextStep = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        const total = stepsRef.current.length;
        if (stepIdx < total - 1) {
            const nextIdx = stepIdx + 1;
            setCurrentStepIndex(nextIdx);
            setSubStep('answer');
            readCurrentStep(nextIdx);
        } else {
            speakText("Inspection complete! All items recorded.");
        }
    }, [readCurrentStep, speakText]);

    // Photo prompt decision handler
    const handlePhotoChoice = useCallback((needPhoto: boolean) => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            photoRequired: needPhoto
        };
        setSteps(updated);
        syncToParent(updated);

        if (needPhoto) {
            setLastHeardCommand("Photo Flagged: Yes");
            setSubStep('photoNotes');
            speakText("Photo required flagged. Say photo notes, or say Next when ready.");
        } else {
            setLastHeardCommand("Photo Flagged: No");
            speakText("No photo needed. Say Next when ready, or continue.", () => {
                // Keep ready for "Next"
            });
        }
    }, [syncToParent, speakText]);

    // Photo notes submission handler
    const handlePhotoNotesSubmit = useCallback((notes: string) => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            photoNotes: notes
        };
        setSteps(updated);
        syncToParent(updated);

        setLastHeardCommand(`Photo notes saved`);
        advanceToNextStep();
    }, [syncToParent, advanceToNextStep]);

    // Go back to previous step
    const handlePreviousStep = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        if (stepIdx > 0) {
            const prevIdx = stepIdx - 1;
            setCurrentStepIndex(prevIdx);
            setSubStep('answer');
            setLastHeardCommand("Going back to previous step");
            readCurrentStep(prevIdx);
        }
    }, [readCurrentStep]);

    // Jump to specific step
    const handleJumpToStep = useCallback((targetStepNumber: number) => {
        const idx = targetStepNumber - 1;
        const total = stepsRef.current.length;
        if (idx >= 0 && idx < total) {
            setCurrentStepIndex(idx);
            setSubStep('answer');
            setJumpStepInput('');
            setLastHeardCommand(`Jumped to step #${targetStepNumber}`);
            readCurrentStep(idx);
        }
    }, [readCurrentStep]);

    // Pause & Save handler
    const handlePauseAndSave = useCallback(() => {
        cloudSpeechSynthesis.cancel();
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_) {}
        }
        syncToParent(stepsRef.current);
        onClose();
    }, [syncToParent, onClose]);

    // Continuous Hands-Free Speech Recognition Engine
    useEffect(() => {
        if (!isOpen) return;

        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionClass) {
            setVoiceError("Speech recognition is not supported in this browser. You can still use the screen buttons.");
            return;
        }

        let recognition: any = null;
        let isManuallyStopped = false;

        const startListening = () => {
            if (!shouldListenRef.current || isManuallyStopped) return;

            try {
                recognition = new SpeechRecognitionClass();
                recognitionRef.current = recognition;
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'en-GB';

                recognition.onstart = () => {
                    setIsListening(true);
                    setVoiceError(null);
                };

                recognition.onresult = (event: any) => {
                    // Prevent feedback/echo loops while system TTS is speaking
                    if (isSpeakingRef.current) {
                        return;
                    }

                    const lastResult = event.results[event.results.length - 1];
                    if (!lastResult || !lastResult[0]) return;

                    const transcript = lastResult[0].transcript.trim().toLowerCase();
                    console.log("[Guided Host Voice Command Heard]:", transcript);

                    // Navigation commands that work at any time
                    if (/\b(next|continue|move on|go next|next step|next question)\b/i.test(transcript)) {
                        setLastHeardCommand(`Heard: "${transcript}" → Next Step`);
                        advanceToNextStep();
                        return;
                    }

                    if (/\b(back|previous|go back|last step)\b/i.test(transcript)) {
                        setLastHeardCommand(`Heard: "${transcript}" → Previous Step`);
                        handlePreviousStep();
                        return;
                    }

                    if (/\b(repeat|say again|read again|what was that|pardon)\b/i.test(transcript)) {
                        setLastHeardCommand(`Heard: "${transcript}" → Replaying Audio`);
                        handleRepeatAudio();
                        return;
                    }

                    if (/\b(pause|stop|save log|pause inspection|finish inspection)\b/i.test(transcript)) {
                        setLastHeardCommand(`Heard: "${transcript}" → Pausing & Saving`);
                        handlePauseAndSave();
                        return;
                    }

                    // Context-aware commands based on current sub-step
                    const currentSubStep = subStepRef.current;

                    if (currentSubStep === 'answer') {
                        // Status commands
                        if (/\b(ok|okay|pass|passed|good|fine|all good|clear|tick)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → OK / Pass`);
                            handleSelectStatus('ok');
                        } else if (/\b(attention|amber|monitor|caution|warning|advisory)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → Attention`);
                            handleSelectStatus('attention');
                        } else if (/\b(urgent|red|fail|failed|danger|defect|dangerous|broken|replace)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → Urgent`);
                            handleSelectStatus('urgent');
                        } else if (/\b(not applicable|n a|na|skip|none)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → N/A`);
                            handleSelectStatus('na');
                        }
                    } else if (currentSubStep === 'photoPrompt') {
                        // Photo Prompt commands
                        if (/\b(yes|yeah|yep|photo|take photo|need photo|require photo|true)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → Photo Required`);
                            handlePhotoChoice(true);
                        } else if (/\b(no|nope|nah|none|don't|dont|no photo|negative)\b/i.test(transcript)) {
                            setLastHeardCommand(`Heard: "${transcript}" → No Photo`);
                            handlePhotoChoice(false);
                        }
                    } else if (currentSubStep === 'photoNotes') {
                        // Photo Notes dictation
                        if (/\b(save|done|finish notes|complete notes)\b/i.test(transcript)) {
                            const stepIdx = currentStepIndexRef.current;
                            handlePhotoNotesSubmit(stepsRef.current[stepIdx]?.photoNotes || '');
                        } else {
                            // Dictate photo notes
                            const stepIdx = currentStepIndexRef.current;
                            const existing = stepsRef.current[stepIdx]?.photoNotes || '';
                            const newNotes = existing ? `${existing} ${transcript}` : transcript;
                            setLastHeardCommand(`Dictated: "${transcript}"`);
                            
                            const updated = [...stepsRef.current];
                            updated[stepIdx] = {
                                ...updated[stepIdx],
                                photoNotes: newNotes
                            };
                            setSteps(updated);
                        }
                    }
                };

                recognition.onerror = (event: any) => {
                    console.warn('[Guided Host Voice Error]:', event.error);
                    if (event.error === 'not-allowed') {
                        setVoiceError('Microphone permission blocked. Please enable microphone permissions in your browser.');
                        setIsListening(false);
                    }
                };

                recognition.onend = () => {
                    setIsListening(false);
                    // Automatically restart continuous listening if modal is still active
                    if (shouldListenRef.current && !isManuallyStopped && isOpen) {
                        setTimeout(() => {
                            try {
                                if (shouldListenRef.current && !isManuallyStopped) {
                                    recognition.start();
                                }
                            } catch (_) {}
                        }, 300);
                    }
                };

                recognition.start();
            } catch (err) {
                console.warn('[Guided Host Voice Init Error]:', err);
            }
        };

        if (isVoiceControlActive) {
            startListening();
        }

        return () => {
            isManuallyStopped = true;
            cloudSpeechSynthesis.cancel();
            if (recognition) {
                try {
                    recognition.stop();
                } catch (_) {}
            }
        };
    }, [isOpen, isVoiceControlActive, advanceToNextStep, handlePreviousStep, handleRepeatAudio, handlePauseAndSave, handleSelectStatus, handlePhotoChoice, handlePhotoNotesSubmit]);

    // Read initial step when modal opens
    useEffect(() => {
        if (isOpen && steps.length > 0) {
            // Small initial delay so browser finishes modal transition
            const timer = setTimeout(() => {
                readCurrentStep(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, readCurrentStep, steps.length]);

    if (!isOpen || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;
    const isLastStep = currentStepIndex === totalSteps - 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30 flex-shrink-0">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-base sm:text-lg tracking-tight">Guided Inspection Host</h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wide">
                                    Hands-Free Voice
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {vehicleRegistration ? `${vehicleRegistration} ${vehicleModel ? `• ${vehicleModel}` : ''}` : 'Interactive read-aloud vehicle inspection walkthrough'}
                            </p>
                        </div>
                    </div>

                    {/* Audio & Mic Controls in Header */}
                    <div className="flex items-center gap-2">
                        {/* TTS Voice Toggle */}
                        <button
                            type="button"
                            onClick={() => {
                                if (isTtsEnabled) {
                                    cloudSpeechSynthesis.cancel();
                                }
                                setIsTtsEnabled(!isTtsEnabled);
                            }}
                            className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                                isTtsEnabled 
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 hover:bg-indigo-500/30' 
                                    : 'bg-white/10 text-slate-400 hover:text-white'
                            }`}
                            title={isTtsEnabled ? 'Mute Voice Prompts' : 'Enable Voice Prompts'}
                        >
                            {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            <span className="hidden sm:inline">{isTtsEnabled ? 'Voice On' : 'Muted'}</span>
                        </button>

                        {/* Hands-Free Mic Toggle */}
                        {isSpeechRecognitionSupported && (
                            <button
                                type="button"
                                onClick={() => setIsVoiceControlActive(!isVoiceControlActive)}
                                className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                                    isVoiceControlActive 
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30' 
                                        : 'bg-white/10 text-slate-400 hover:text-white'
                                }`}
                                title={isVoiceControlActive ? 'Pause Hands-Free Voice' : 'Resume Hands-Free Voice'}
                            >
                                {isVoiceControlActive ? <Mic size={16} className="text-emerald-400 animate-pulse" /> : <MicOff size={16} />}
                                <span className="hidden sm:inline">{isVoiceControlActive ? 'Mic Active' : 'Mic Off'}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handlePauseAndSave}
                            className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white ml-1"
                            title="Pause & Save"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Progress Bar & Status Line */}
                <div className="w-full bg-slate-100 h-2">
                    <div 
                        className="bg-indigo-600 h-2 transition-all duration-300"
                        style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Voice Status Pill / Banner */}
                <div className="bg-slate-900 text-slate-200 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isSpeaking ? (
                            <div className="flex items-center gap-2 text-indigo-400 font-bold animate-pulse">
                                <Volume2 size={15} />
                                <span>Host is reading aloud...</span>
                            </div>
                        ) : isVoiceControlActive && isListening ? (
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Listening... (Say &ldquo;OK&rdquo;, &ldquo;Attention&rdquo;, &ldquo;Urgent&rdquo;, &ldquo;Next&rdquo;)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400">
                                <MicOff size={14} />
                                <span>Voice control paused. Click mic to enable.</span>
                            </div>
                        )}

                        {lastHeardCommand && (
                            <span className="hidden md:inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[11px] text-amber-300 font-semibold ml-2">
                                🎯 {lastHeardCommand}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleRepeatAudio}
                            className="p-1 hover:bg-white/10 text-slate-300 hover:text-white rounded flex items-center gap-1 text-[11px] font-bold transition"
                            title="Repeat Question Audio"
                        >
                            <RotateCcw size={12} />
                            <span>Repeat</span>
                        </button>
                    </div>
                </div>

                {voiceError && (
                    <div className="bg-amber-50 text-amber-900 px-4 py-1.5 text-xs font-semibold border-b border-amber-200 flex items-center justify-between">
                        <span>⚠️ {voiceError}</span>
                        <button 
                            type="button" 
                            onClick={() => setVoiceError(null)} 
                            className="text-amber-700 hover:text-amber-950 underline font-bold ml-2"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Section Badge & Question Card */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                                {currentStep.sectionTitle}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                                Question {currentStepIndex + 1} of {totalSteps}
                            </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                                {currentStep.itemLabel}
                            </h2>
                            <button
                                type="button"
                                onClick={handleRepeatAudio}
                                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-indigo-600 transition shadow-xs flex-shrink-0"
                                title="Read question aloud"
                            >
                                <Volume2 size={18} />
                            </button>
                        </div>

                        {/* Status Selection Buttons */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    Record Finding:
                                </p>
                                <span className="text-[11px] text-slate-600 font-semibold italic">
                                    (Or say: &ldquo;Pass&rdquo;, &ldquo;Attention&rdquo;, &ldquo;Urgent&rdquo;, &ldquo;N/A&rdquo;)
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('ok')}
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'ok'
                                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border-slate-200 hover:border-emerald-300'
                                    }`}
                                >
                                    <Check size={18} />
                                    <span>OK / Pass</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('attention')}
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'attention'
                                            ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                            : 'bg-white hover:bg-amber-50 text-amber-800 border-slate-200 hover:border-amber-300'
                                    }`}
                                >
                                    <AlertTriangle size={18} />
                                    <span>Attention</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('urgent')}
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'urgent'
                                            ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-300'
                                            : 'bg-white hover:bg-red-50 text-red-800 border-slate-200 hover:border-red-300'
                                    }`}
                                >
                                    <XCircle size={18} />
                                    <span>Urgent</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('na')}
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition ${
                                        currentStep.status === 'na'
                                            ? 'bg-slate-500 text-white border-slate-600 shadow-md ring-2 ring-slate-300'
                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <HelpCircle size={18} />
                                    <span>N/A</span>
                                </button>
                            </div>
                        </div>

                        {/* Finding Comments with Dictation */}
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
                                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl flex-shrink-0">
                                    <Camera size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm text-indigo-950">
                                        Do you need a photo for this step?
                                    </h4>
                                    <p className="text-xs text-indigo-700 font-medium">
                                        Say <span className="font-bold underline">&ldquo;Yes&rdquo;</span> or <span className="font-bold underline">&ldquo;No&rdquo;</span> hands-free, or click below.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => handlePhotoChoice(true)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs"
                                >
                                    Yes (Require Photo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePhotoChoice(false)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition"
                                >
                                    No (Proceed)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2c: Photo Notes Sub-Step */}
                    {subStep === 'photoNotes' && (
                        <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase">
                                    <Camera size={16} className="text-amber-600" />
                                    <span>Photo Flagged for Step #{currentStepIndex + 1}</span>
                                </div>
                                <span className="text-[11px] text-amber-700 font-semibold italic">
                                    (Dictate notes or say &ldquo;Next&rdquo; when ready)
                                </span>
                            </div>
                            <input
                                type="text"
                                value={currentStep.photoNotes || ''}
                                onChange={e => {
                                    const stepIdx = currentStepIndex;
                                    const updated = [...steps];
                                    updated[stepIdx] = {
                                        ...updated[stepIdx],
                                        photoNotes: e.target.value
                                    };
                                    setSteps(updated);
                                }}
                                placeholder="Describe what the photo should show (e.g. inner pad wear, oil seepage at sump)..."
                                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        handlePhotoNotesSubmit(e.currentTarget.value);
                                    }
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handlePhotoNotesSubmit(currentStep.photoNotes || '')}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5"
                                >
                                    <span>Save Notes & Continue</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ready for Next Voice Prompt Notice */}
                    {currentStep.status !== 'na' && subStep === 'answer' && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                                <span className="font-semibold">
                                    Finding confirmed. Say <strong className="underline">&ldquo;Next&rdquo;</strong> aloud or click Continue when ready for the next step.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={advanceToNextStep}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex-shrink-0 flex items-center gap-1"
                            >
                                <span>Next</span>
                                <ArrowRight size={12} />
                            </button>
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
                                                className="text-[10px] text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
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
                        <span className="text-xs text-slate-500 font-medium">Jump to step #:</span>
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
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                            Jump
                        </button>
                    </div>

                    {/* Step Options: Continue / Back / Pause */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handlePauseAndSave}
                            className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Pause size={13} />
                            <span>Pause & Save Log</span>
                        </button>

                        {currentStepIndex > 0 && (
                            <button
                                type="button"
                                onClick={handlePreviousStep}
                                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowLeft size={13} />
                                <span>Previous Step</span>
                            </button>
                        )}

                        {!isLastStep ? (
                            <button
                                type="button"
                                onClick={advanceToNextStep}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>Continue (or say &ldquo;Next&rdquo;)</span>
                                <ArrowRight size={13} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handlePauseAndSave}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
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

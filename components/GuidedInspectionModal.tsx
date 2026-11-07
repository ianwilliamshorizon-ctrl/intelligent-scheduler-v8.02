import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChecklistSection, ChecklistItemStatus, TyreCheckData, TyreLocation, TyreData } from '../types';
import {
    X, Check, AlertTriangle, XCircle, HelpCircle, Camera,
    ArrowRight, ArrowLeft, Pause, Sparkles, CheckCircle2, ListFilter,
    Volume2, VolumeX, Mic, MicOff, RotateCcw, AlertCircle, RefreshCw,
    Disc, Gauge, FileText, CheckCheck, Edit2, ChevronRight, Eye
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
    tyreData?: TyreCheckData;
    onTyreUpdate?: (updated: TyreCheckData) => void;
}

type InspectionMode = 'checklist' | 'tyres' | 'summary';
type InspectionSubStep = 'answer' | 'findingNotes' | 'photoPrompt' | 'photoNotes';
type TyreSubStep = 'depths' | 'comments';

export const TYRE_KEYS: TyreLocation[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'spare'];

export const TYRE_META: Record<TyreLocation, { name: string; spokenName: string; short: string; position: string }> = {
    frontLeft: { name: 'Nearside Front (NSF)', spokenName: 'Near side Front', short: 'NSF', position: 'Nearside Front' },
    frontRight: { name: 'Offside Front (OSF)', spokenName: 'Off side Front', short: 'OSF', position: 'Offside Front' },
    rearLeft: { name: 'Nearside Rear (NSR)', spokenName: 'Near side Rear', short: 'NSR', position: 'Nearside Rear' },
    rearRight: { name: 'Offside Rear (OSR)', spokenName: 'Off side Rear', short: 'OSR', position: 'Offside Rear' },
    spare: { name: 'Spare Tyre', spokenName: 'Spare Tyre', short: 'SP', position: 'Boot / Underslung' },
};

export const statusConfig: Record<ChecklistItemStatus, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    ok: { icon: Check, color: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-500', label: 'OK / Pass' },
    attention: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-500', label: 'Attention' },
    urgent: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-500', border: 'border-red-500', label: 'Urgent' },
    na: { icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-400', border: 'border-slate-300', label: 'N/A' },
};

// Automatic status evaluation based on tread depths and damage remarks
export const evaluateTyreStatus = (outer?: number, middle?: number, inner?: number, comments?: string): ChecklistItemStatus => {
    const depths = [outer, middle, inner].filter((d): d is number => d !== undefined && !isNaN(d));
    const c = (comments || '').toLowerCase();
    const hasDefect = /\b(nail|puncture|screw|bulge|cut|tear|cord|cracked|perished|damage|damaged|bald)\b/i.test(c);

    if (depths.length > 0) {
        const min = Math.min(...depths);
        if (min <= 1.6 || hasDefect) return 'urgent';
        if (min < 3.0) return 'attention';
        return 'ok';
    }
    if (hasDefect) return 'urgent';
    return 'ok';
};

// Spoken numbers extractor for tyre tread depths
export const parseSpokenDepths = (
    rawText: string,
    isFinal: boolean = false,
    existingBuffer: number[] = []
): { result: { outer: number; middle: number; inner: number } | null; newBuffer: number[] } => {
    let t = rawText.toLowerCase();

    // 1. Spoken digit words to numbers (zero through ten)
    const wordDigits: Record<string, string> = {
        zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
        six: '6', seven: '7', eight: '8', nine: '9', ten: '10'
    };
    for (const [w, digit] of Object.entries(wordDigits)) {
        t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), digit);
    }

    // 2. Fractions like "4 and a half" or "4 & a half" -> 4.5
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:and|&)\s*(?:a\s+)?half\b/gi, (_, n) => `${parseFloat(n) + 0.5}`);
    // Standalone "half" or "a half" -> 0.5
    t = t.replace(/\b(?:a\s+half|half)\b/gi, '0.5');

    // 3. Spoken decimals: "4 point 5", "4 dot 5" -> 4.5
    t = t.replace(/(\d+)\s*(?:point|dot)\s*(\d+)/gi, '$1.$2');
    // Leading point: "point 5", "dot 5" -> 0.5
    t = t.replace(/\b(?:point|dot)\s*(\d+)/gi, '0.$1');

    // 4. Extract all valid float numbers (0 to 35 mm)
    const matches = t.match(/\d+(?:\.\d+)?/g);
    if (!matches || matches.length === 0) {
        return { result: null, newBuffer: existingBuffer };
    }

    const nums = matches
        .map(Number)
        .filter(n => !isNaN(n) && n >= 0 && n <= 35)
        .map(n => Math.round(n * 10) / 10);

    if (nums.length === 0) {
        return { result: null, newBuffer: existingBuffer };
    }

    // Check if user explicitly said "across", "all", "even", "same"
    const isAllAcross = /\b(across|all|even|same|round|flat)\b/i.test(t);
    if (nums.length === 1 && isAllAcross) {
        return {
            result: { outer: nums[0], middle: nums[0], inner: nums[0] },
            newBuffer: [nums[0], nums[0], nums[0]]
        };
    }

    // Case A: 3 or more numbers provided in one phrase (e.g. "4.5, 4, 3.5" or "5.5 5 4.5")
    if (nums.length >= 3) {
        return {
            result: { outer: nums[0], middle: nums[1], inner: nums[2] },
            newBuffer: [nums[0], nums[1], nums[2]]
        };
    }

    // Case B: Numbers spoken sequentially with pauses (on finalized utterance)
    if (isFinal) {
        const nextBuf = [...existingBuffer];
        for (const n of nums) {
            if (nextBuf.length < 3) {
                nextBuf.push(n);
            }
        }
        if (nextBuf.length === 3) {
            return {
                result: { outer: nextBuf[0], middle: nextBuf[1], inner: nextBuf[2] },
                newBuffer: nextBuf
            };
        }
        return { result: null, newBuffer: nextBuf };
    }

    return { result: null, newBuffer: existingBuffer };
};

const createDefaultTyres = (incoming?: TyreCheckData): TyreCheckData => {
    const base: TyreCheckData = {
        frontLeft: { indicator: 'na', outer: undefined, middle: undefined, inner: undefined, comments: '' },
        frontRight: { indicator: 'na', outer: undefined, middle: undefined, inner: undefined, comments: '' },
        rearLeft: { indicator: 'na', outer: undefined, middle: undefined, inner: undefined, comments: '' },
        rearRight: { indicator: 'na', outer: undefined, middle: undefined, inner: undefined, comments: '' },
        spare: { indicator: 'na', outer: undefined, middle: undefined, inner: undefined, comments: '' },
    };
    if (!incoming) return base;
    return {
        ...base,
        ...incoming
    };
};

export const GuidedInspectionModal: React.FC<GuidedInspectionModalProps> = ({
    isOpen,
    onClose,
    checklistData,
    onChecklistUpdate,
    vehicleRegistration,
    vehicleModel,
    tyreData,
    onTyreUpdate
}) => {
    // Mode: checklist, tyres, summary
    const [mode, setMode] = useState<InspectionMode>('checklist');
    const modeRef = useRef<InspectionMode>('checklist');
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Unique storage key based on registration or checklist id to persist progress
    const storageKey = useMemo(() => {
        const reg = (vehicleRegistration || '').trim().toUpperCase();
        const model = (vehicleModel || '').trim().toLowerCase();
        const firstId = checklistData[0]?.id || 'chk';
        return `guided_inspection_progress_${reg || model || firstId}`;
    }, [vehicleRegistration, vehicleModel, checklistData]);

    const tyreStorageKey = useMemo(() => {
        const reg = (vehicleRegistration || '').trim().toUpperCase();
        const model = (vehicleModel || '').trim().toLowerCase();
        return `guided_inspection_tyres_${reg || model || 'tyres'}`;
    }, [vehicleRegistration, vehicleModel]);

    // Flatten all sections into a sequential list of steps
    const initialSteps = useMemo(() => {
        const steps: FlatInspectionStep[] = [];
        (checklistData || []).forEach(section => {
            (section.items || []).forEach(item => {
                const photoReq = (item.comment || '').includes('[Photo Required');
                let cleanComment = item.comment || '';
                let photoNotes = '';
                if (photoReq) {
                    const match = cleanComment.match(/\[Photo Required:\s*([^\]]*)\]/);
                    if (match) {
                        photoNotes = match[1] === 'Yes' ? '' : match[1];
                    }
                    cleanComment = cleanComment.replace(/\|?\s*\[Photo Required:[^\]]*\]/g, '').trim();
                }
                steps.push({
                    sectionId: section.id,
                    sectionTitle: section.title,
                    itemId: item.id,
                    itemLabel: item.label,
                    status: item.status || 'na',
                    comment: cleanComment,
                    photoRequired: photoReq,
                    photoNotes: photoNotes
                });
            });
        });
        return steps;
    }, [checklistData]);

    // Calculate initial resume index
    const getInitialResumeIndex = useCallback(() => {
        if (!initialSteps || initialSteps.length === 0) return 0;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved !== null) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < initialSteps.length) {
                    return parsed;
                }
            }
        } catch (_) { }

        const firstUnrecorded = initialSteps.findIndex(s => {
            return (s.status !== 'ok' && s.status !== 'attention' && s.status !== 'urgent' && (!s.comment || s.comment.trim() === ''));
        });
        return firstUnrecorded !== -1 ? firstUnrecorded : 0;
    }, [initialSteps, storageKey]);

    const [steps, setSteps] = useState<FlatInspectionStep[]>(initialSteps);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [subStep, setSubStep] = useState<InspectionSubStep>('answer');
    const [jumpStepInput, setJumpStepInput] = useState<string>('');

    // Tyre Report State
    const [tyres, setTyres] = useState<TyreCheckData>(() => {
        try {
            const saved = localStorage.getItem(tyreStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                return createDefaultTyres({ ...(tyreData || {}), ...parsed });
            }
        } catch (_) {}
        return createDefaultTyres(tyreData);
    });
    const tyresRef = useRef<TyreCheckData>(tyres);
    useEffect(() => { tyresRef.current = tyres; }, [tyres]);

    const [currentTyreIndex, setCurrentTyreIndex] = useState<number>(0);
    const currentTyreIndexRef = useRef<number>(0);
    useEffect(() => { currentTyreIndexRef.current = currentTyreIndex; }, [currentTyreIndex]);

    const [tyreSubStep, setTyreSubStep] = useState<TyreSubStep>('depths');
    const tyreSubStepRef = useRef<TyreSubStep>('depths');
    useEffect(() => { tyreSubStepRef.current = tyreSubStep; }, [tyreSubStep]);

    // Speech & Voice Navigation State
    const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(true);
    const [isVoiceControlActive, setIsVoiceControlActive] = useState<boolean>(true);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [liveTranscript, setLiveTranscript] = useState<string>('');
    const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [needsMicPermission, setNeedsMicPermission] = useState<boolean>(false);

    // Refs for speech recognition and synchronization
    const recognitionRef = useRef<any>(null);
    const isManuallyStoppedRef = useRef<boolean>(false);
    const subStepRef = useRef<InspectionSubStep>('answer');
    const currentStepIndexRef = useRef<number>(0);
    const stepsRef = useRef<FlatInspectionStep[]>(initialSteps);
    const lastBotUtteranceRef = useRef<string>('');
    const lastCommandTimestampRef = useRef<number>(0);
    const lastSpokenTextRef = useRef<string>('');
    const lastSpokenTimeRef = useRef<number>(0);
    const hasInitialSpokenRef = useRef<boolean>(false);
    const isSpeakingRef = useRef<boolean>(false);
    const safetyTimerRef = useRef<any>(null);
    const lastSpeechEndTimeRef = useRef<number>(0);
    const depthsBufferRef = useRef<number[]>([]);
    const tyreSubStepStartTimeRef = useRef<number>(Date.now());
    const [depthsBufferDisplay, setDepthsBufferDisplay] = useState<number[]>([]);

    // Keep refs in sync with current state
    useEffect(() => { subStepRef.current = subStep; }, [subStep]);
    useEffect(() => { currentStepIndexRef.current = currentStepIndex; }, [currentStepIndex]);
    useEffect(() => { stepsRef.current = steps; }, [steps]);

    // Save current step progress to storage
    const saveProgress = useCallback((stepIdx: number) => {
        try {
            localStorage.setItem(storageKey, stepIdx.toString());
        } catch (_) { }
    }, [storageKey]);

    // Save tyre progress
    const saveTyreData = useCallback((updated: TyreCheckData) => {
        setTyres(updated);
        try {
            localStorage.setItem(tyreStorageKey, JSON.stringify(updated));
        } catch (_) {}
        onTyreUpdate?.(updated);
    }, [tyreStorageKey, onTyreUpdate]);

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

    // Text-to-Speech speaking function with strict deduplication & acoustic shielding
    const speakText = useCallback((text: string, onDone?: () => void) => {
        if (!isTtsEnabled) {
            onDone?.();
            return;
        }

        const now = Date.now();
        if (lastSpokenTextRef.current === text && now - lastSpokenTimeRef.current < 1500) {
            return;
        }
        lastSpokenTextRef.current = text;
        lastSpokenTimeRef.current = now;

        try {
            cloudSpeechSynthesis.cancel();
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            lastBotUtteranceRef.current = text.toLowerCase();

            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }

            const cleaned = prepareTextForSpeech(text);
            const utterance = new CloudSpeechSynthesisUtterance(cleaned);

            const voices = cloudSpeechSynthesis.getVoices();
            const preferredVoice = findBestVoice(voices, { lang: 'en-GB', gender: 'female' });
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            utterance.lang = 'en-GB';

            const finishSpeaking = () => {
                if (safetyTimerRef.current) {
                    clearTimeout(safetyTimerRef.current);
                    safetyTimerRef.current = null;
                }
                isSpeakingRef.current = false;
                lastSpeechEndTimeRef.current = Date.now();
                setIsSpeaking(false);
                onDone?.();
            };

            utterance.onend = () => {
                finishSpeaking();
            };

            utterance.onerror = () => {
                finishSpeaking();
            };

            const dynamicTimeoutMs = Math.max(15000, cleaned.length * 150);
            safetyTimerRef.current = setTimeout(() => {
                finishSpeaking();
            }, dynamicTimeoutMs);

            cloudSpeechSynthesis.speak(utterance);
        } catch (err) {
            console.error('Failed to speak text:', err);
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
            isSpeakingRef.current = false;
            lastSpeechEndTimeRef.current = Date.now();
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

    // Read the current tyre prompt aloud
    const readCurrentTyre = useCallback((tyreIdx: number, sub: TyreSubStep = 'depths') => {
        const loc = TYRE_KEYS[tyreIdx];
        const info = TYRE_META[loc];
        if (sub === 'depths') {
            speakText(`${info.spokenName || info.position}. Please say outer, middle, and inner tread depths. For example, 6, 6, 5.`);
        } else {
            speakText(`${info.spokenName || info.position}: Say comments such as nail in tyre or damage, or say Continue when ready.`);
        }
    }, [speakText]);

    // Replay current audio depending on mode
    const handleRepeatAudio = useCallback(() => {
        if (modeRef.current === 'checklist') {
            const activeSubStep = subStepRef.current;
            if (activeSubStep === 'answer') {
                readCurrentStep(currentStepIndexRef.current);
            } else if (activeSubStep === 'findingNotes') {
                speakText("Please describe what you observed, or say Continue.");
            } else if (activeSubStep === 'photoPrompt') {
                speakText("Do you need a photo for this step? Say Yes or No.");
            } else if (activeSubStep === 'photoNotes') {
                speakText("Photo flagged. Say your photo notes, or say Next when ready.");
            }
        } else if (modeRef.current === 'tyres') {
            readCurrentTyre(currentTyreIndexRef.current, tyreSubStepRef.current);
        }
    }, [readCurrentStep, readCurrentTyre, speakText]);

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
        saveProgress(stepIdx);

        const statusLabel =
            status === 'ok' ? 'Pass' :
                status === 'attention' ? 'Attention' :
                    status === 'urgent' ? 'Urgent' : 'N A';

        setLastHeardCommand(`Marked: ${statusLabel}`);

        if (status === 'attention' || status === 'urgent') {
            setSubStep('findingNotes');
            speakText(`${statusLabel} recorded. Please describe what you observed, or say Continue.`);
        } else {
            setSubStep('photoPrompt');
            speakText(`${statusLabel} recorded. Do you need a photo for this step? Say Yes or No.`);
        }
    }, [syncToParent, speakText, saveProgress]);

    // Retake Notes handler (checklist)
    const handleRetakeNotes = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        const activeSubStep = subStepRef.current;

        if (activeSubStep === 'findingNotes') {
            const updated = [...stepsRef.current];
            updated[stepIdx] = {
                ...updated[stepIdx],
                comment: ''
            };
            setSteps(updated);
            syncToParent(updated);
            setLiveTranscript('');
            setLastHeardCommand("Observation notes cleared for retake");
            speakText("Observation notes cleared. Please dictate your notes again.");
        } else if (activeSubStep === 'photoNotes') {
            const updated = [...stepsRef.current];
            updated[stepIdx] = {
                ...updated[stepIdx],
                photoNotes: ''
            };
            setSteps(updated);
            syncToParent(updated);
            setLiveTranscript('');
            setLastHeardCommand("Photo notes cleared for retake");
            speakText("Photo notes cleared. Please dictate your photo details again.");
        } else {
            const updated = [...stepsRef.current];
            updated[stepIdx] = {
                ...updated[stepIdx],
                comment: ''
            };
            setSteps(updated);
            syncToParent(updated);
            setLiveTranscript('');
            setLastHeardCommand("Notes cleared");
            speakText("Notes cleared.");
        }
    }, [syncToParent, speakText]);

    // Reset finding to re-record status
    const handleResetFinding = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            status: 'na',
            comment: '',
            photoRequired: undefined,
            photoNotes: ''
        };
        setSteps(updated);
        syncToParent(updated);
        setSubStep('answer');
        subStepRef.current = 'answer';
        setLiveTranscript('');
        setLastHeardCommand("Finding reset to re-record");
        speakText("Finding reset. Say Pass, Attention, or Urgent.");
    }, [syncToParent, speakText]);

    // Advance to next step (or transition to tyre check when checklist is complete)
    const advanceToNextStep = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        const total = stepsRef.current.length;
        if (stepIdx < total - 1) {
            const nextIdx = stepIdx + 1;
            setCurrentStepIndex(nextIdx);
            setSubStep('answer');
            saveProgress(nextIdx);
            readCurrentStep(nextIdx);
        } else {
            // Checklist complete -> Transition into Tyre Check!
            setMode('tyres');
            setCurrentTyreIndex(0);
            setTyreSubStep('depths');
            speakText("Checklist items complete! Now moving to the tyre check report. Starting with Near side Front. Please say outer, middle, and inner tread depths.");
        }
    }, [readCurrentStep, speakText, saveProgress]);

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

    // Finding notes submitted
    const handleFindingNotesSubmit = useCallback((notes: string) => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            comment: notes
        };
        setSteps(updated);
        syncToParent(updated);
        saveProgress(stepIdx);

        setLastHeardCommand(`Notes recorded`);
        setSubStep('photoPrompt');
        speakText("Observation recorded. Do you need a photo for this step? Say Yes or No.");
    }, [syncToParent, speakText, saveProgress]);

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
        saveProgress(stepIdx);

        if (needPhoto) {
            setSubStep('photoNotes');
            setLastHeardCommand("Photo flagged: Yes");
            speakText("Photo required. Say photo notes, or say Next when ready.");
        } else {
            setLastHeardCommand("Photo flagged: No");
            speakText("No photo needed. Say Next when ready.");
        }
    }, [syncToParent, speakText, saveProgress]);

    // Photo notes submitted
    const handlePhotoNotesSubmit = useCallback((notes: string) => {
        const stepIdx = currentStepIndexRef.current;
        const updated = [...stepsRef.current];
        updated[stepIdx] = {
            ...updated[stepIdx],
            photoNotes: notes
        };
        setSteps(updated);
        syncToParent(updated);
        saveProgress(stepIdx);

        setLastHeardCommand("Photo notes recorded");
        advanceToNextStep();
    }, [syncToParent, advanceToNextStep, saveProgress]);

    // Navigate to previous step
    const handlePreviousStep = useCallback(() => {
        const stepIdx = currentStepIndexRef.current;
        if (stepIdx > 0) {
            const prevIdx = stepIdx - 1;
            setCurrentStepIndex(prevIdx);
            currentStepIndexRef.current = prevIdx;
            setSubStep('answer');
            subStepRef.current = 'answer';
            saveProgress(prevIdx);
            readCurrentStep(prevIdx);
        }
    }, [readCurrentStep, saveProgress]);

    // Jump to specific step
    const handleJumpToStep = useCallback((targetStepNumber: number) => {
        const total = stepsRef.current.length;
        if (targetStepNumber >= 1 && targetStepNumber <= total) {
            const idx = targetStepNumber - 1;
            setMode('checklist');
            modeRef.current = 'checklist';
            setCurrentStepIndex(idx);
            currentStepIndexRef.current = idx;
            setSubStep('answer');
            subStepRef.current = 'answer';
            setJumpStepInput('');
            saveProgress(idx);
            setLastHeardCommand(`Jumped to step #${targetStepNumber}`);
            readCurrentStep(idx);
        }
    }, [readCurrentStep, saveProgress]);

    // --- TYRE CHECK ACTIONS ---
    const goToTyre = useCallback((idx: number, sub: TyreSubStep = 'depths') => {
        setCurrentTyreIndex(idx);
        currentTyreIndexRef.current = idx;
        setTyreSubStep(sub);
        tyreSubStepRef.current = sub;
        tyreSubStepStartTimeRef.current = Date.now();
        depthsBufferRef.current = [];
        setDepthsBufferDisplay([]);
        setLiveTranscript('');
        lastCommandTimestampRef.current = Date.now();
    }, []);

    const handleTyreDepthsSubmit = useCallback((outer: number, middle: number, inner: number) => {
        const loc = TYRE_KEYS[currentTyreIndexRef.current];
        const current = tyresRef.current[loc] || { indicator: 'na' };
        const autoStatus = evaluateTyreStatus(outer, middle, inner, current.comments);
        const updated = {
            ...tyresRef.current,
            [loc]: {
                ...current,
                outer,
                middle,
                inner,
                indicator: autoStatus
            }
        };
        saveTyreData(updated);
        setTyreSubStep('comments');
        tyreSubStepRef.current = 'comments';
        tyreSubStepStartTimeRef.current = Date.now();
        depthsBufferRef.current = [];
        setDepthsBufferDisplay([]);
        const statusPhrase = autoStatus === 'ok' ? 'Pass' : autoStatus === 'attention' ? 'Attention required' : 'Urgent replacement';
        setLastHeardCommand(`Depths: O:${outer} M:${middle} I:${inner} mm (${statusPhrase})`);
        speakText(`${TYRE_META[loc].spokenName || TYRE_META[loc].position}: Outer ${outer}, middle ${middle}, inner ${inner} recorded. Status ${statusPhrase}. Any comments for this tyre, or say Continue?`);
    }, [saveTyreData, speakText]);

    const handleTyreCommentSubmit = useCallback((comment: string) => {
        const loc = TYRE_KEYS[currentTyreIndexRef.current];
        const current = tyresRef.current[loc] || { indicator: 'na' };
        const cleanComment = (comment || '').trim();
        const autoStatus = evaluateTyreStatus(current.outer, current.middle, current.inner, cleanComment);
        const updated = {
            ...tyresRef.current,
            [loc]: {
                ...current,
                comments: cleanComment,
                indicator: autoStatus
            }
        };
        saveTyreData(updated);
        setLastHeardCommand(cleanComment ? `Comment: "${cleanComment}"` : 'No comment');

        const nextIdx = currentTyreIndexRef.current + 1;
        if (nextIdx < 4) {
            goToTyre(nextIdx, 'depths');
            const nextLoc = TYRE_KEYS[nextIdx];
            const commentConfirm = cleanComment ? `Comment recorded: ${cleanComment}. ` : '';
            speakText(`${commentConfirm}Moving to ${TYRE_META[nextLoc].spokenName || TYRE_META[nextLoc].position}. Say outer, middle, and inner tread depths.`);
        } else {
            setMode('summary');
            modeRef.current = 'summary';
            const commentConfirm = cleanComment ? `Comment recorded: ${cleanComment}. ` : '';
            speakText(`${commentConfirm}Tyre check report complete! All 4 road tyres and inspection checklist points have been recorded and saved.`);
        }
    }, [saveTyreData, speakText]);

    const handleRetakeTyreDepths = useCallback(() => {
        const loc = TYRE_KEYS[currentTyreIndexRef.current];
        depthsBufferRef.current = [];
        setDepthsBufferDisplay([]);
        const current = tyresRef.current[loc] || { indicator: 'na' };
        const updated = {
            ...tyresRef.current,
            [loc]: {
                ...current,
                outer: undefined,
                middle: undefined,
                inner: undefined,
                indicator: 'na'
            }
        };
        saveTyreData(updated);
        setTyreSubStep('depths');
        setLastHeardCommand("Tread depths cleared for retake");
        speakText(`Tread depths cleared for ${TYRE_META[loc].spokenName || TYRE_META[loc].position}. Please dictate outer, middle, and inner depths.`);
    }, [saveTyreData, speakText]);

    const handleRetakeTyreComment = useCallback(() => {
        const loc = TYRE_KEYS[currentTyreIndexRef.current];
        const current = tyresRef.current[loc] || { indicator: 'na' };
        const updated = {
            ...tyresRef.current,
            [loc]: {
                ...current,
                comments: '',
                indicator: evaluateTyreStatus(current.outer, current.middle, current.inner, '')
            }
        };
        saveTyreData(updated);
        setTyreSubStep('comments');
        tyreSubStepRef.current = 'comments';
        tyreSubStepStartTimeRef.current = Date.now();
        setLastHeardCommand("Comment cleared for retake");
        speakText(`Comment cleared for ${TYRE_META[loc].spokenName || TYRE_META[loc].position}. Dictate comments, or say Continue.`);
    }, [saveTyreData, speakText]);

    const handleNextTyre = useCallback(() => {
        const nextIdx = currentTyreIndexRef.current + 1;
        if (nextIdx < TYRE_KEYS.length) {
            goToTyre(nextIdx, 'depths');
            readCurrentTyre(nextIdx, 'depths');
        } else {
            setMode('summary');
            modeRef.current = 'summary';
            speakText("All tyres recorded. Showing inspection summary.");
        }
    }, [goToTyre, readCurrentTyre, speakText]);

    const handlePreviousTyre = useCallback(() => {
        if (currentTyreIndexRef.current > 0) {
            const prevIdx = currentTyreIndexRef.current - 1;
            goToTyre(prevIdx, 'depths');
            readCurrentTyre(prevIdx, 'depths');
        } else {
            setMode('checklist');
            modeRef.current = 'checklist';
            readCurrentStep(stepsRef.current.length - 1);
        }
    }, [goToTyre, readCurrentTyre, readCurrentStep]);

    const handleJumpToTyre = useCallback((idx: number) => {
        if (idx >= 0 && idx < TYRE_KEYS.length) {
            goToTyre(idx, 'depths');
            readCurrentTyre(idx, 'depths');
        }
    }, [goToTyre, readCurrentTyre]);

    const handleManualTyreUpdate = useCallback((location: TyreLocation, field: keyof TyreData, value: any) => {
        const current = tyresRef.current[location] || { indicator: 'na' };
        const updatedTyre = { ...current, [field]: value };
        if (field === 'outer' || field === 'middle' || field === 'inner' || field === 'comments') {
            updatedTyre.indicator = evaluateTyreStatus(updatedTyre.outer, updatedTyre.middle, updatedTyre.inner, updatedTyre.comments);
        }
        const updated = {
            ...tyresRef.current,
            [location]: updatedTyre
        };
        saveTyreData(updated);
    }, [saveTyreData]);

    // Pause & Save handler
    const handlePauseAndSave = useCallback(() => {
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
        }
        isSpeakingRef.current = false;
        cloudSpeechSynthesis.cancel();
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_) { }
        }
        saveProgress(currentStepIndexRef.current);
        syncToParent(stepsRef.current);
        saveTyreData(tyresRef.current);
        onClose();
    }, [syncToParent, saveProgress, saveTyreData, onClose]);

    // Text normalizer to clean punctuation and abbreviations
    const normalizeSpeechText = (text: string): string => {
        return text
            .toLowerCase()
            .replace(/o\.k\./gi, 'ok')
            .replace(/o\.k/gi, 'ok')
            // Preserve decimal numbers (e.g. 4.5 -> 4xdotx5)
            .replace(/(\d+)\s*\.\s*(\d+)/g, '$1xdotx$2')
            // Remove punctuation other than alphanumeric and whitespace
            .replace(/[^a-z0-9\s]/g, ' ')
            // Restore decimal point
            .replace(/xdotx/g, '.')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Voice Engine Core
    const startRecognitionEngine = useCallback(() => {
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionClass) {
            setVoiceError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (_) { }
            recognitionRef.current = null;
        }

        try {
            const recognition = new SpeechRecognitionClass();
            recognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-GB';

            recognition.onstart = () => {
                setIsListening(true);
                setVoiceError(null);
                setNeedsMicPermission(false);
            };

            recognition.onresult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    const rawTranscript = result[0]?.transcript || '';
                    const cleaned = normalizeSpeechText(rawTranscript);
                    setLiveTranscript(rawTranscript);

                    const now = Date.now();

                    // CRITICAL: Suppress command matching while the host is speaking or during the 400ms room echo settling window.
                    if (isSpeakingRef.current || (now - lastSpeechEndTimeRef.current < 600)) {
                        continue;
                    }

                    // Prevent rapid double triggers within 600ms
                    if (now - lastCommandTimestampRef.current < 600) {
                        continue;
                    }

                    // Check if speech matches user commands
                    const isOk = /\b(ok|okay|o k|pass|passed|good|all good|fine|clear|tick)\b/i.test(cleaned);
                    const isAttention = /\b(attention|amber|monitor|caution|warning|advisory)\b/i.test(cleaned);
                    const isUrgent = /\b(urgent|red|fail|failed|danger|defect|dangerous|broken|replace)\b/i.test(cleaned);
                    const isNa = /\b(not applicable|n a|na|skip)\b/i.test(cleaned);

                    const isRetake = /\b(retake|retake note|retake notes|retake depth|retake depths|clear note|clear notes|clear depths|start over|try again|erase note|delete note)\b/i.test(cleaned);
                    const isResetFinding = /\b(change finding|reset finding|change status|reset status|wrong status)\b/i.test(cleaned);

                    const isPhotoYes = /\b(yes|yeah|yep|photo|take photo|need photo|require photo|true)\b/i.test(cleaned);
                    const isPhotoNo = /\b(no|nope|nah|none|don't|dont|no photo|negative)\b/i.test(cleaned);

                    const isNext = /\b(next|continue|move on|go next|next step|next question|next tyre|forward)\b/i.test(cleaned);
                    const isBack = /\b(back|previous|go back|last step|previous tyre)\b/i.test(cleaned);
                    const isRepeat = /\b(repeat|say again|read again|what was that|pardon)\b/i.test(cleaned);
                    const isPause = /\b(pause|stop|save log|pause inspection|finish inspection)\b/i.test(cleaned);

                    // Interrupt TTS if a definitive command is spoken
                    if (isOk || isAttention || isUrgent || isNa || isRetake || isResetFinding || isPhotoYes || isPhotoNo || isNext || isBack || isRepeat || isPause) {
                        cloudSpeechSynthesis.cancel();
                        isSpeakingRef.current = false;
                        setIsSpeaking(false);
                    }

                    // Retake command
                    if (isRetake) {
                        lastCommandTimestampRef.current = now;
                        if (modeRef.current === 'tyres') {
                            if (tyreSubStepRef.current === 'comments') {
                                handleRetakeTyreComment();
                            } else {
                                handleRetakeTyreDepths();
                            }
                        } else {
                            handleRetakeNotes();
                        }
                        return;
                    }

                    // Reset finding command (checklist mode)
                    if (isResetFinding && modeRef.current === 'checklist') {
                        lastCommandTimestampRef.current = now;
                        handleResetFinding();
                        return;
                    }

                    // Global Navigation
                    if (isRepeat) {
                        lastCommandTimestampRef.current = now;
                        setLastHeardCommand(`Heard: "Repeat" → Replaying Audio`);
                        handleRepeatAudio();
                        return;
                    }

                    if (isPause) {
                        lastCommandTimestampRef.current = now;
                        setLastHeardCommand(`Heard: "Pause" → Pausing & Saving`);
                        handlePauseAndSave();
                        return;
                    }

                    // --- MODE: TYRES VOICE HANDLING ---
                    if (modeRef.current === 'tyres') {
                        const activeLoc = TYRE_KEYS[currentTyreIndexRef.current];
                        const activeSub = tyreSubStepRef.current;

                        if (activeSub === 'depths') {
                            const isJumpNSF = /\b(?:go to|jump to|select)?\s*(near\s*side\s*front|nsf|front\s*left)\b/i.test(cleaned);
                            const isJumpOSF = /\b(?:go to|jump to|select)?\s*(off\s*side\s*front|osf|front\s*right)\b/i.test(cleaned);
                            const isJumpNSR = /\b(?:go to|jump to|select)?\s*(near\s*side\s*rear|nsr|rear\s*left)\b/i.test(cleaned);
                            const isJumpOSR = /\b(?:go to|jump to|select)?\s*(off\s*side\s*rear|osr|rear\s*right)\b/i.test(cleaned);

                            if (isJumpNSF && currentTyreIndexRef.current !== 0) { lastCommandTimestampRef.current = now; handleJumpToTyre(0); return; }
                            if (isJumpOSF && currentTyreIndexRef.current !== 1) { lastCommandTimestampRef.current = now; handleJumpToTyre(1); return; }
                            if (isJumpNSR && currentTyreIndexRef.current !== 2) { lastCommandTimestampRef.current = now; handleJumpToTyre(2); return; }
                            if (isJumpOSR && currentTyreIndexRef.current !== 3) { lastCommandTimestampRef.current = now; handleJumpToTyre(3); return; }

                            if (isNext) {
                                lastCommandTimestampRef.current = now;
                                handleNextTyre();
                                return;
                            }
                            if (isBack) {
                                lastCommandTimestampRef.current = now;
                                handlePreviousTyre();
                                return;
                            }
                            // Try parsing 3 depths or single depth across
                            const { result: parsedResult, newBuffer } = parseSpokenDepths(rawTranscript, result.isFinal, depthsBufferRef.current);
                            depthsBufferRef.current = newBuffer;
                            setDepthsBufferDisplay(newBuffer);
                            if (parsedResult) {
                                lastCommandTimestampRef.current = now;
                                handleTyreDepthsSubmit(parsedResult.outer, parsedResult.middle, parsedResult.inner);
                                return;
                            }
                        } else if (activeSub === 'comments') {
                            // Don't accept comment input until at least 1000ms after entering comments mode
                            if (now - tyreSubStepStartTimeRef.current < 1000) {
                                continue;
                            }

                            if (isBack) {
                                lastCommandTimestampRef.current = now;
                                setTyreSubStep('depths');
                                tyreSubStepRef.current = 'depths';
                                speakText(`Retaking tread depths for ${TYRE_META[activeLoc].spokenName || TYRE_META[activeLoc].position}. Say outer, middle, and inner depths.`);
                                return;
                            }

                            // Filter out acoustic echo of host prompt and previous depth numbers
                            const isHostEcho = /\b(outer|middle|inner|recorded|status pass|status attention|status urgent|any comments|say continue)\b/i.test(cleaned);
                            const isOnlyNumbers = /^[\d\s.,pointdot]+$/.test(cleaned);
                            if (isHostEcho || isOnlyNumbers) {
                                continue;
                            }

                            // User explicitly says "none", "no", "no comment", "continue", "next", "all good", "pass", "skip":
                            if (/\b(none|no|nope|no comment|no comments|all good|pass|good|clear|fine|done|skip|next|continue|proceed)\b/i.test(cleaned)) {
                                lastCommandTimestampRef.current = now;
                                handleTyreCommentSubmit('');
                                return;
                            }

                            // If user dictates a comment, ONLY submit on finalized speech (NEVER on interim!)
                            if (result.isFinal && cleaned.length >= 2) {
                                lastCommandTimestampRef.current = now;
                                handleTyreCommentSubmit(rawTranscript);
                                return;
                            }
                        }
                        continue;
                    }

                    // --- MODE: CHECKLIST VOICE HANDLING ---
                    if (isNext) {
                        const activeSubStep = subStepRef.current;
                        if (activeSubStep === 'findingNotes') {
                            lastCommandTimestampRef.current = now;
                            const stepIdx = currentStepIndexRef.current;
                            handleFindingNotesSubmit(stepsRef.current[stepIdx]?.comment || '');
                            return;
                        } else if (activeSubStep === 'photoNotes') {
                            lastCommandTimestampRef.current = now;
                            const stepIdx = currentStepIndexRef.current;
                            handlePhotoNotesSubmit(stepsRef.current[stepIdx]?.photoNotes || '');
                            return;
                        } else {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "Next" → Next Step`);
                            advanceToNextStep();
                            return;
                        }
                    }

                    if (isBack) {
                        lastCommandTimestampRef.current = now;
                        setLastHeardCommand(`Heard: "Back" → Previous Step`);
                        handlePreviousStep();
                        return;
                    }

                    const activeSubStep = subStepRef.current;

                    if (activeSubStep === 'answer') {
                        if (isOk) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → OK / Pass`);
                            handleSelectStatus('ok');
                            return;
                        } else if (isAttention) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → Attention`);
                            handleSelectStatus('attention');
                            return;
                        } else if (isUrgent) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → Urgent`);
                            handleSelectStatus('urgent');
                            return;
                        } else if (isNa) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → N/A`);
                            handleSelectStatus('na');
                            return;
                        }
                    } else if (activeSubStep === 'findingNotes') {
                        if (/\b(done|save|finish notes|complete notes|continue|skip|proceed)\b/i.test(cleaned)) {
                            lastCommandTimestampRef.current = now;
                            const stepIdx = currentStepIndexRef.current;
                            handleFindingNotesSubmit(stepsRef.current[stepIdx]?.comment || '');
                            return;
                        } else if (result.isFinal) {
                            const stepIdx = currentStepIndexRef.current;
                            const existing = stepsRef.current[stepIdx]?.comment || '';
                            const newComment = existing ? `${existing} ${rawTranscript}` : rawTranscript;
                            setLastHeardCommand(`Dictated: "${rawTranscript}"`);

                            const updated = [...stepsRef.current];
                            updated[stepIdx] = {
                                ...updated[stepIdx],
                                comment: newComment
                            };
                            setSteps(updated);
                            syncToParent(updated);
                        }
                    } else if (activeSubStep === 'photoPrompt') {
                        if (isPhotoYes) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → Photo Required`);
                            handlePhotoChoice(true);
                            return;
                        } else if (isPhotoNo) {
                            lastCommandTimestampRef.current = now;
                            setLastHeardCommand(`Heard: "${rawTranscript}" → No Photo`);
                            handlePhotoChoice(false);
                            return;
                        }
                    } else if (activeSubStep === 'photoNotes') {
                        if (/\b(save|done|finish notes|complete notes)\b/i.test(cleaned)) {
                            lastCommandTimestampRef.current = now;
                            const stepIdx = currentStepIndexRef.current;
                            handlePhotoNotesSubmit(stepsRef.current[stepIdx]?.photoNotes || '');
                            return;
                        } else if (result.isFinal) {
                            const stepIdx = currentStepIndexRef.current;
                            const existing = stepsRef.current[stepIdx]?.photoNotes || '';
                            const newNotes = existing ? `${existing} ${rawTranscript}` : rawTranscript;
                            setLastHeardCommand(`Dictated: "${rawTranscript}"`);

                            const updated = [...stepsRef.current];
                            updated[stepIdx] = {
                                ...updated[stepIdx],
                                photoNotes: newNotes
                            };
                            setSteps(updated);
                        }
                    }
                }
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'no-speech') return;
                if (event.error === 'not-allowed') {
                    setNeedsMicPermission(true);
                    setVoiceError('Microphone permission required. Click "Allow Microphone" to enable hands-free voice.');
                    setIsListening(false);
                    return;
                }
                console.warn('[Speech Recognition notice]:', event.error);
            };

            recognition.onend = () => {
                setIsListening(false);
                if (!isManuallyStoppedRef.current && isOpen) {
                    setTimeout(() => {
                        if (!isManuallyStoppedRef.current && isOpen) {
                            try {
                                recognition.start();
                            } catch (_) { }
                        }
                    }, 200);
                }
            };

            recognition.start();
        } catch (err) {
            console.warn('[Speech Recognition Init Error]:', err);
        }
    }, [advanceToNextStep, handlePreviousStep, handleRepeatAudio, handlePauseAndSave, handleSelectStatus, handleFindingNotesSubmit, handleRetakeNotes, handleResetFinding, handlePhotoChoice, handlePhotoNotesSubmit, handleTyreDepthsSubmit, handleTyreCommentSubmit, handleRetakeTyreDepths, handleRetakeTyreComment, handleNextTyre, handlePreviousTyre, syncToParent, isOpen]);

    // Request Mic Permission & Start
    const handleEnableMicrophone = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            }
            setNeedsMicPermission(false);
            setVoiceError(null);
            isManuallyStoppedRef.current = false;
            setIsVoiceControlActive(true);
            startRecognitionEngine();
        } catch (err: any) {
            console.warn('Microphone permission denied:', err);
            setNeedsMicPermission(true);
            setVoiceError('Microphone access was denied. Please allow microphone permissions in your browser bar.');
        }
    };

    // Toggle voice control listening
    const handleToggleVoiceControl = () => {
        if (isVoiceControlActive) {
            isManuallyStoppedRef.current = true;
            setIsVoiceControlActive(false);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (_) { }
            }
        } else {
            isManuallyStoppedRef.current = false;
            setIsVoiceControlActive(true);
            handleEnableMicrophone();
        }
    };

    // Start recognition automatically on modal open
    useEffect(() => {
        if (!isOpen) return;

        isManuallyStoppedRef.current = false;
        handleEnableMicrophone();

        return () => {
            isManuallyStoppedRef.current = true;
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
            isSpeakingRef.current = false;
            cloudSpeechSynthesis.cancel();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (_) { }
            }
        };
    }, [isOpen]);

    // On modal open: pick up from where left off (resume point)
    useEffect(() => {
        if (!isOpen) {
            hasInitialSpokenRef.current = false;
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
            isSpeakingRef.current = false;
            cloudSpeechSynthesis.cancel();
            return;
        }

        if (hasInitialSpokenRef.current) return;
        hasInitialSpokenRef.current = true;

        const resumeIdx = getInitialResumeIndex();
        setCurrentStepIndex(resumeIdx);
        setSubStep('answer');

        const timer = setTimeout(() => {
            if (resumeIdx > 0) {
                const step = stepsRef.current[resumeIdx];
                speakText(`Resuming inspection at question ${resumeIdx + 1}. ${step?.sectionTitle || ''}. ${step?.itemLabel || ''}.`);
            } else {
                readCurrentStep(0);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [isOpen]);

    if (!isOpen || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;
    const isLastChecklistStep = currentStepIndex === totalSteps - 1;

    const activeTyreLoc = TYRE_KEYS[currentTyreIndex];
    const activeTyreData = tyres[activeTyreLoc] || { indicator: 'na' };

    // Stats
    const recordedChecklistCount = steps.filter(s => s.status === 'ok' || s.status === 'attention' || s.status === 'urgent').length;
    const recordedTyresCount = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].filter(k => {
        const t = tyres[k as TyreLocation];
        return t && (t.outer !== undefined || t.middle !== undefined || t.inner !== undefined);
    }).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30 flex-shrink-0">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-base sm:text-lg tracking-tight">Guided Vehicle Inspection</h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wide">
                                    Hands-Free Voice
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {vehicleRegistration ? `${vehicleRegistration} ${vehicleModel ? `• ${vehicleModel}` : ''}` : 'Step-by-step checklist & tyre inspection walkthrough'}
                            </p>
                        </div>
                    </div>

                    {/* Audio & Mic Controls in Header */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (isTtsEnabled) cloudSpeechSynthesis.cancel();
                                setIsTtsEnabled(!isTtsEnabled);
                            }}
                            className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer ${isTtsEnabled
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 hover:bg-indigo-500/30'
                                    : 'bg-white/10 text-slate-400 hover:text-white'
                                }`}
                            title={isTtsEnabled ? 'Mute Voice Prompts' : 'Enable Voice Prompts'}
                        >
                            {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            <span className="hidden sm:inline">{isTtsEnabled ? 'Voice On' : 'Muted'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleVoiceControl}
                            className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer ${isVoiceControlActive
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-400/30 hover:bg-rose-500/30'
                                }`}
                            title={isVoiceControlActive ? 'Mute Microphone' : 'Enable Microphone'}
                        >
                            {isVoiceControlActive ? <Mic size={16} /> : <MicOff size={16} />}
                            <span className="hidden sm:inline">{isVoiceControlActive ? 'Mic Listening' : 'Mic Muted'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePauseAndSave}
                            className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white ml-1 cursor-pointer"
                            title="Pause & Save"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Inspection Stage Switcher Tabs */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('checklist');
                                readCurrentStep(currentStepIndex);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${mode === 'checklist'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <ListFilter size={14} />
                            <span>Checklist ({recordedChecklistCount}/{totalSteps})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMode('tyres');
                                readCurrentTyre(currentTyreIndex, tyreSubStep);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${mode === 'tyres'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <Disc size={14} />
                            <span>Tyre Report ({recordedTyresCount}/4)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMode('summary');
                                speakText("Inspection and tyre summary report.");
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${mode === 'summary'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <FileText size={14} />
                            <span>Summary & Log</span>
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                        {mode === 'checklist' ? `Question ${currentStepIndex + 1} of ${totalSteps}` : mode === 'tyres' ? `Tyre ${currentTyreIndex + 1} of 4` : 'Review Inspection'}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-1.5">
                    <div
                        className="bg-indigo-600 h-1.5 transition-all duration-300"
                        style={{
                            width: mode === 'checklist'
                                ? `${((currentStepIndex + 1) / totalSteps) * 100}%`
                                : mode === 'tyres'
                                    ? `${((currentTyreIndex + 1) / 4) * 100}%`
                                    : '100%'
                        }}
                    />
                </div>

                {/* Real-time Voice Status Pill / Banner */}
                <div className="bg-slate-900 text-slate-200 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                        {isSpeaking ? (
                            <div className="flex items-center gap-2 text-indigo-400 font-bold animate-pulse">
                                <Volume2 size={15} />
                                <span>Host speaking...</span>
                            </div>
                        ) : isVoiceControlActive && isListening ? (
                            <div className="flex items-center gap-2 text-emerald-400 font-bold truncate">
                                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                {liveTranscript ? (
                                    <span className="text-amber-300 truncate">
                                        🎤 Hearing: &ldquo;{liveTranscript}&rdquo;
                                    </span>
                                ) : (
                                    <span className="truncate">
                                        {mode === 'tyres'
                                            ? tyreSubStep === 'depths'
                                                ? 'Listening for depths... Say 3 numbers, e.g. "6 6 5" or "5 across"'
                                                : 'Listening for tyre comments... Speak comment (e.g. "Nail in tyre") or say "None"'
                                            : subStep === 'findingNotes'
                                                ? 'Listening for observations... Speak notes, or say "Done" / "Retake"'
                                                : subStep === 'photoPrompt'
                                                    ? 'Listening... Say "Yes" or "No" for photo'
                                                    : subStep === 'photoNotes'
                                                        ? 'Listening for photo details... Say notes, or "Done" / "Retake"'
                                                        : 'Listening... Say "OK", "Attention", "Urgent", or "Next"'}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400">
                                <MicOff size={14} />
                                <span>Voice control off. Click the mic button to turn on.</span>
                            </div>
                        )}
                    </div>

                    {lastHeardCommand && (
                        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-full text-[11px] text-emerald-300 border border-slate-700 shrink-0">
                            <CheckCheck size={12} className="text-emerald-400" />
                            <span className="truncate max-w-[200px]">{lastHeardCommand}</span>
                        </div>
                    )}
                </div>

                {/* Mic Permission Banner */}
                {needsMicPermission && (
                    <div className="p-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-400 shrink-0" />
                            <span>Microphone permission required for hands-free voice commands.</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleEnableMicrophone}
                            className="px-3 py-1 bg-amber-500 text-slate-900 rounded-lg text-xs font-bold hover:bg-amber-400 transition"
                        >
                            Allow Microphone
                        </button>
                    </div>
                )}

                {/* --- MODE 1: CHECKLIST QUESTION VIEW --- */}
                {mode === 'checklist' && (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                        {/* Section & Question Badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider">
                                    {currentStep.sectionTitle}
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                    Question {currentStepIndex + 1} of {totalSteps}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleRepeatAudio}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                title="Replay question audio"
                            >
                                <Volume2 size={14} className="text-indigo-600" />
                                <span>Replay Audio</span>
                            </button>
                        </div>

                        {/* Large Primary Question Banner */}
                        <div className="p-5 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-2xl border border-indigo-100/80 shadow-xs space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Active Inspection Step</span>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                                {currentStep.itemLabel}
                            </h2>
                        </div>

                        {/* SUB-STEP A: Mark Status (Pass / Attention / Urgent / NA) */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                <span>Step 1: Record Condition (Say or Click)</span>
                                {currentStep.status && currentStep.status !== 'na' && (
                                    <button
                                        type="button"
                                        onClick={handleResetFinding}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw size={12} />
                                        <span>Change Finding</span>
                                    </button>
                                )}
                            </label>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('ok')}
                                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${currentStep.status === 'ok'
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-[1.02]'
                                        : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-800 hover:border-emerald-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl ${currentStep.status === 'ok' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                                        <Check size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-sm block">Pass / OK</span>
                                        <span className={`text-[10px] ${currentStep.status === 'ok' ? 'text-emerald-100' : 'text-slate-500'}`}>Say &ldquo;OK&rdquo; or &ldquo;Pass&rdquo;</span>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('attention')}
                                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${currentStep.status === 'attention'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-[1.02]'
                                        : 'bg-white hover:bg-amber-50 border-slate-200 text-slate-800 hover:border-amber-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl ${currentStep.status === 'attention' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-sm block">Attention</span>
                                        <span className={`text-[10px] ${currentStep.status === 'attention' ? 'text-amber-100' : 'text-slate-500'}`}>Say &ldquo;Attention&rdquo;</span>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('urgent')}
                                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${currentStep.status === 'urgent'
                                        ? 'bg-red-500 text-white border-red-600 shadow-md scale-[1.02]'
                                        : 'bg-white hover:bg-red-50 border-slate-200 text-slate-800 hover:border-red-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl ${currentStep.status === 'urgent' ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>
                                        <XCircle size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-sm block">Urgent</span>
                                        <span className={`text-[10px] ${currentStep.status === 'urgent' ? 'text-red-100' : 'text-slate-500'}`}>Say &ldquo;Urgent&rdquo; or &ldquo;Fail&rdquo;</span>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('na')}
                                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${currentStep.status === 'na'
                                        ? 'bg-slate-500 text-white border-slate-600 shadow-md scale-[1.02]'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl ${currentStep.status === 'na' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                                        <HelpCircle size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-sm block">N/A</span>
                                        <span className={`text-[10px] ${currentStep.status === 'na' ? 'text-slate-200' : 'text-slate-500'}`}>Say &ldquo;N A&rdquo; or &ldquo;Skip&rdquo;</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* SUB-STEP B: Observation Notes (mandatory on Attention/Urgent) */}
                        {(subStep === 'findingNotes' || (currentStep.status !== 'na' && currentStep.comment)) && (
                            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2.5 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-amber-600" />
                                        <span>Observation Notes</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleRetakeNotes}
                                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded cursor-pointer"
                                        title="Clear notes and speak again"
                                    >
                                        <RotateCcw size={11} />
                                        <span>Retake Note</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={currentStep.comment || ''}
                                        onChange={e => handleCommentChange(e.target.value)}
                                        placeholder="Describe finding or defect..."
                                        className="flex-1 p-2.5 bg-white border border-amber-300 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleFindingNotesSubmit(currentStep.comment || '');
                                        }}
                                    />
                                    <SpeechToTextButton
                                        onTranscript={(text) => {
                                            const existing = currentStep.comment || '';
                                            const newComment = existing ? `${existing} ${text}` : text;
                                            handleCommentChange(newComment);
                                        }}
                                        className="!p-2.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleFindingNotesSubmit(currentStep.comment || '')}
                                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer shrink-0"
                                    >
                                        Save Note
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SUB-STEP C: Photo Prompt */}
                        {(subStep === 'photoPrompt' || subStep === 'photoNotes' || currentStep.photoRequired !== undefined) && (
                            <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                        <Camera size={15} className="text-indigo-600" />
                                        <span>Photo Requirement</span>
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePhotoChoice(true)}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${currentStep.photoRequired
                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'}`}
                                    >
                                        <Camera size={14} />
                                        <span>Yes, Photo Required (Say &ldquo;Yes&rdquo;)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handlePhotoChoice(false)}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${currentStep.photoRequired === false
                                            ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                                    >
                                        <span>No Photo (Say &ldquo;No&rdquo;)</span>
                                    </button>
                                </div>

                                {currentStep.photoRequired && (
                                    <div className="pt-2 flex items-center gap-2 animate-fade-in">
                                        <input
                                            type="text"
                                            value={currentStep.photoNotes || ''}
                                            onChange={e => {
                                                const updated = [...stepsRef.current];
                                                updated[currentStepIndexRef.current] = {
                                                    ...updated[currentStepIndexRef.current],
                                                    photoNotes: e.target.value
                                                };
                                                setSteps(updated);
                                                syncToParent(updated);
                                            }}
                                            placeholder="Photo instructions (e.g. Close-up of damage)..."
                                            className="flex-1 p-2 bg-white border border-indigo-300 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handlePhotoNotesSubmit(currentStep.photoNotes || '');
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRetakeNotes}
                                            className="text-[11px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-2 rounded-xl cursor-pointer"
                                            title="Clear photo notes"
                                        >
                                            <RotateCcw size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* --- MODE 2: TYRE CHECK REPORT VIEW --- */}
                {mode === 'tyres' && (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
                        {/* Tyre Stage Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 block">Tyre Depth & Condition Report</span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                    {TYRE_META[activeTyreLoc].name}
                                </h2>
                                <span className="text-xs text-slate-500 font-medium">Position: {TYRE_META[activeTyreLoc].position}</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleRepeatAudio}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <Volume2 size={14} className="text-indigo-600" />
                                <span>Replay Audio</span>
                            </button>
                        </div>

                        {/* Interactive Vehicle Tyre Formation */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">Select Tyre Location</span>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-md mx-auto">
                                {(['frontLeft', 'frontRight', 'rearLeft', 'rearRight'] as TyreLocation[]).map((locKey, idx) => {
                                    const meta = TYRE_META[locKey];
                                    const data = tyres[locKey];
                                    const isSelected = activeTyreLoc === locKey;
                                    const st = data?.indicator || 'na';
                                    const cfg = statusConfig[st];
                                    return (
                                        <button
                                            key={locKey}
                                            type="button"
                                            onClick={() => handleJumpToTyre(idx)}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-2 cursor-pointer ${isSelected
                                                ? 'bg-indigo-50 border-indigo-600 shadow-md scale-[1.02]'
                                                : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="text-left">
                                                <span className="font-black text-xs block text-slate-900">{meta.short} - {meta.position}</span>
                                                <span className="text-[11px] font-mono text-slate-500">
                                                    {data?.outer !== undefined ? `O:${data.outer} M:${data.middle} I:${data.inner} mm` : 'Not recorded'}
                                                </span>
                                            </div>
                                            <span className={`w-3 h-3 rounded-full ${cfg.bg} shrink-0 ring-2 ring-white`} title={cfg.label} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Tyre Input Card */}
                        <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 rounded-2xl border border-indigo-100 shadow-xs space-y-4">
                            
                            {/* Tread Depth Inputs (Outer, Middle, Inner) */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Gauge size={14} className="text-indigo-600" />
                                        <span>Tread Depths (mm): Outer • Middle • Inner</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleRetakeTyreDepths}
                                        className="text-[11px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded cursor-pointer flex items-center gap-1"
                                    >
                                        <RotateCcw size={11} />
                                        <span>Retake Depths</span>
                                    </button>
                                </div>

                                {depthsBufferDisplay.length > 0 && tyreSubStep === 'depths' && (
                                    <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs text-indigo-800">
                                        <span className="font-semibold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                                            {depthsBufferDisplay.length === 1 && `Recorded Outer: ${depthsBufferDisplay[0]} mm. Say Middle depth (e.g. 4.5)...`}
                                            {depthsBufferDisplay.length === 2 && `Recorded Outer: ${depthsBufferDisplay[0]} mm, Middle: ${depthsBufferDisplay[1]} mm. Say Inner depth...`}
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-white px-2 py-0.5 rounded shadow-xs border border-indigo-100">
                                            {depthsBufferDisplay.length} of 3 recorded
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                                    <div>
                                        <span className="text-[11px] font-bold text-slate-500 block mb-1 text-center">Outer Edge</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="30"
                                            value={activeTyreData.outer ?? (depthsBufferDisplay[0] ?? '')}
                                            onChange={e => handleManualTyreUpdate(activeTyreLoc, 'outer', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                            placeholder="e.g. 5.5"
                                            className={`w-full p-3 border-2 rounded-xl text-center text-lg font-black text-slate-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                activeTyreData.outer !== undefined
                                                    ? activeTyreData.outer <= 1.6 ? 'border-red-400 bg-red-50/30' : activeTyreData.outer < 3.0 ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-400 bg-emerald-50/30'
                                                    : 'border-slate-300'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-bold text-slate-500 block mb-1 text-center">Middle Tread</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="30"
                                            value={activeTyreData.middle ?? (depthsBufferDisplay[1] ?? '')}
                                            onChange={e => handleManualTyreUpdate(activeTyreLoc, 'middle', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                            placeholder="e.g. 5.0"
                                            className={`w-full p-3 border-2 rounded-xl text-center text-lg font-black text-slate-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                activeTyreData.middle !== undefined
                                                    ? activeTyreData.middle <= 1.6 ? 'border-red-400 bg-red-50/30' : activeTyreData.middle < 3.0 ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-400 bg-emerald-50/30'
                                                    : 'border-slate-300'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-bold text-slate-500 block mb-1 text-center">Inner Edge</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="30"
                                            value={activeTyreData.inner ?? (depthsBufferDisplay[2] ?? '')}
                                            onChange={e => handleManualTyreUpdate(activeTyreLoc, 'inner', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                            placeholder="e.g. 4.5"
                                            className={`w-full p-3 border-2 rounded-xl text-center text-lg font-black text-slate-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                activeTyreData.inner !== undefined
                                                    ? activeTyreData.inner <= 1.6 ? 'border-red-400 bg-red-50/30' : activeTyreData.inner < 3.0 ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-400 bg-emerald-50/30'
                                                    : 'border-slate-300'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <span className="text-[11px] text-slate-500 block mt-1.5 text-center">
                                    Legal limit: 1.6mm (Urgent) • Advisory wear: &lt; 3.0mm (Attention) • Good: &ge; 3.0mm (Pass)
                                </span>
                            </div>

                            {/* Status Override Selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Condition Status</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['ok', 'attention', 'urgent', 'na'] as ChecklistItemStatus[]).map(st => {
                                        const cfg = statusConfig[st];
                                        const isSel = activeTyreData.indicator === st;
                                        return (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => handleManualTyreUpdate(activeTyreLoc, 'indicator', st)}
                                                className={`py-2 px-1 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 cursor-pointer ${isSel
                                                    ? `${cfg.bg} text-white ${cfg.border} shadow-xs`
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <cfg.icon size={13} />
                                                <span>{st === 'ok' ? 'Pass' : st === 'attention' ? 'Attention' : st === 'urgent' ? 'Urgent' : 'N/A'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comments / Damage Remarks */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <span>Tyre Comments & Defects</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleTyreCommentSubmit('')}
                                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition"
                                        >
                                            No Comment (Continue)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRetakeTyreComment}
                                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={activeTyreData.comments || ''}
                                        onChange={e => handleManualTyreUpdate(activeTyreLoc, 'comments', e.target.value)}
                                        placeholder="e.g. Nail in outer edge, cuts on sidewall, low pressure..."
                                        className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleTyreCommentSubmit(activeTyreData.comments || '');
                                        }}
                                    />
                                    <SpeechToTextButton
                                        onTranscript={(text) => {
                                            const existing = activeTyreData.comments || '';
                                            const newComment = existing ? `${existing} ${text}` : text;
                                            handleManualTyreUpdate(activeTyreLoc, 'comments', newComment);
                                        }}
                                        className="!p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-indigo-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleTyreCommentSubmit(activeTyreData.comments || '')}
                                        className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                                    >
                                        <span>Save</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>

                                {/* Quick-click Defect Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Tags:</span>
                                    {[
                                        { label: '🔩 Nail in tyre', val: 'Nail in tread' },
                                        { label: '✂️ Sidewall cut', val: 'Cut on sidewall' },
                                        { label: '⚠️ Uneven wear', val: 'Uneven edge wear' },
                                        { label: '📉 Low pressure', val: 'Low tyre pressure' },
                                        { label: '✅ Good condition', val: 'Good condition, no damage' }
                                    ].map(chip => (
                                        <button
                                            key={chip.val}
                                            type="button"
                                            onClick={() => {
                                                const existing = activeTyreData.comments || '';
                                                const newComment = existing ? `${existing}, ${chip.val}` : chip.val;
                                                handleManualTyreUpdate(activeTyreLoc, 'comments', newComment);
                                            }}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-full text-[11px] font-medium text-slate-600 transition cursor-pointer"
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODE 3: INSPECTION & TYRE SUMMARY VIEW --- */}
                {mode === 'summary' && (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block">Complete Record</span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                    Inspection & Tyre Summary Report
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={handlePauseAndSave}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <CheckCheck size={14} />
                                <span>Save & Close</span>
                            </button>
                        </div>

                        {/* Tyre Summary Table */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                            <div className="p-3 bg-slate-100 border-b border-slate-200 font-black text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Disc size={15} className="text-indigo-600" />
                                    <span>Tyre Tread & Damage Log</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMode('tyres')}
                                    className="text-[11px] text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
                                >
                                    Edit Tyres
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                        <tr>
                                            <th className="p-2.5">Tyre Location</th>
                                            <th className="p-2.5 text-center">Outer</th>
                                            <th className="p-2.5 text-center">Middle</th>
                                            <th className="p-2.5 text-center">Inner</th>
                                            <th className="p-2.5 text-center">Status</th>
                                            <th className="p-2.5">Comments & Defects</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'spare'] as TyreLocation[]).map(loc => {
                                            const data = tyres[loc];
                                            const meta = TYRE_META[loc];
                                            const st = data?.indicator || 'na';
                                            const cfg = statusConfig[st];
                                            if (loc === 'spare' && data?.outer === undefined && !data?.comments) return null;
                                            return (
                                                <tr key={loc} className="hover:bg-slate-50/70">
                                                    <td className="p-2.5 font-bold text-slate-900">{meta.name}</td>
                                                    <td className="p-2.5 text-center font-mono font-bold">{data?.outer !== undefined ? `${data.outer} mm` : '-'}</td>
                                                    <td className="p-2.5 text-center font-mono font-bold">{data?.middle !== undefined ? `${data.middle} mm` : '-'}</td>
                                                    <td className="p-2.5 text-center font-mono font-bold">{data?.inner !== undefined ? `${data.inner} mm` : '-'}</td>
                                                    <td className="p-2.5 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${cfg.bg}`}>
                                                            {st.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 text-slate-700 italic">{data?.comments || 'None'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Checklist Items Log */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                            <div className="p-3 bg-slate-100 border-b border-slate-200 font-black text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <ListFilter size={15} className="text-indigo-600" />
                                    <span>Checklist Questions ({recordedChecklistCount}/{totalSteps})</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMode('checklist')}
                                    className="text-[11px] text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
                                >
                                    Edit Checklist
                                </button>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                {steps.map((st, i) => (
                                    <div key={st.itemId} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/70">
                                        <div>
                                            <span className="font-bold text-slate-900">#{i + 1} {st.itemLabel}</span>
                                            {st.comment && <span className="text-slate-500 block text-[11px] italic">&ldquo;{st.comment}&rdquo;</span>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${statusConfig[st.status].bg}`}>
                                            {st.status.toUpperCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePauseAndSave}
                            className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Pause size={13} />
                            <span>Pause & Save</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {mode === 'checklist' && (
                            <>
                                {currentStepIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={handlePreviousStep}
                                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <ArrowLeft size={13} />
                                        <span>Previous</span>
                                    </button>
                                )}
                                {!isLastChecklistStep ? (
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
                                        onClick={() => {
                                            setMode('tyres');
                                            setCurrentTyreIndex(0);
                                            setTyreSubStep('depths');
                                            readCurrentTyre(0, 'depths');
                                        }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>Proceed to Tyre Check</span>
                                        <ArrowRight size={13} />
                                    </button>
                                )}
                            </>
                        )}

                        {mode === 'tyres' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePreviousTyre}
                                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Previous Tyre</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (tyreSubStep === 'comments') {
                                            handleTyreCommentSubmit(activeTyreData.comments || '');
                                        } else {
                                            handleNextTyre();
                                        }
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>
                                        {tyreSubStep === 'comments'
                                            ? currentTyreIndex < 3 ? 'Save & Next Tyre' : 'Save & Finish Tyres'
                                            : currentTyreIndex < 3 ? 'Next Tyre (or say "Next")' : 'Finish Tyres'}
                                    </span>
                                    <ArrowRight size={13} />
                                </button>
                            </>
                        )}

                        {mode === 'summary' && (
                            <button
                                type="button"
                                onClick={handlePauseAndSave}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <CheckCircle2 size={15} />
                                <span>Finish & Close</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GuidedInspectionModal;

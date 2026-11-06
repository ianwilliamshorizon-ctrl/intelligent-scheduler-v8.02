import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChecklistSection, ChecklistItemStatus } from '../types';
import {
    X, Check, AlertTriangle, XCircle, HelpCircle, Camera,
    ArrowRight, ArrowLeft, Pause, Sparkles, CheckCircle2, ListFilter,
    Volume2, VolumeX, Mic, MicOff, RotateCcw, AlertCircle, RefreshCw
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

type InspectionSubStep = 'answer' | 'findingNotes' | 'photoPrompt' | 'photoNotes';

export const GuidedInspectionModal: React.FC<GuidedInspectionModalProps> = ({
    isOpen,
    onClose,
    checklistData,
    onChecklistUpdate,
    vehicleRegistration,
    vehicleModel
}) => {
    // Unique storage key based on registration or checklist id to persist progress
    const storageKey = useMemo(() => {
        const reg = (vehicleRegistration || '').trim().toUpperCase();
        const model = (vehicleModel || '').trim().toLowerCase();
        const firstId = checklistData[0]?.id || 'chk';
        return `guided_inspection_progress_${reg || model || firstId}`;
    }, [vehicleRegistration, vehicleModel, checklistData]);

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

    // Calculate initial resume index (either from saved progress or first unrecorded item)
    const getInitialResumeIndex = useCallback(() => {
        if (!initialSteps || initialSteps.length === 0) return 0;

        // 1. Check if there is a saved step in localStorage
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved !== null) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < initialSteps.length) {
                    return parsed;
                }
            }
        } catch (_) { }

        // 2. Otherwise find the first step that has not been recorded
        const firstUnrecorded = initialSteps.findIndex(s => {
            return (s.status !== 'ok' && s.status !== 'attention' && s.status !== 'urgent' && (!s.comment || s.comment.trim() === ''));
        });

        return firstUnrecorded !== -1 ? firstUnrecorded : 0;
    }, [initialSteps, storageKey]);

    const [steps, setSteps] = useState<FlatInspectionStep[]>(initialSteps);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [subStep, setSubStep] = useState<InspectionSubStep>('answer');
    const [jumpStepInput, setJumpStepInput] = useState<string>('');

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

    // Save current step progress to storage
    const saveProgress = useCallback((stepIdx: number) => {
        try {
            localStorage.setItem(storageKey, stepIdx.toString());
        } catch (_) { }
    }, [storageKey]);

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

    // Text-to-Speech speaking function with strict deduplication
    const speakText = useCallback((text: string, onDone?: () => void) => {
        if (!isTtsEnabled) {
            onDone?.();
            return;
        }

        // Prevent duplicate immediate triggers of the exact same text within 1500ms
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

            // Dynamic safety timeout proportional to length (at least 15s) to avoid getting stuck
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

    // Replay current step audio
    const handleRepeatAudio = useCallback(() => {
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
    }, [readCurrentStep, speakText]);

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

        // If Attention or Urgent, prompt for notes FIRST before asking about photo
        if (status === 'attention' || status === 'urgent') {
            setSubStep('findingNotes');
            speakText(`${statusLabel} recorded. Please describe what you observed, or say Continue.`);
        } else {
            // For OK / Pass or N/A, go directly to photo prompt
            setSubStep('photoPrompt');
            speakText(`${statusLabel} recorded. Do you need a photo for this step? Say Yes or No.`);
        }
    }, [syncToParent, speakText, saveProgress]);

    // Retake Notes handler (clears note and prompts to speak again)
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
        setSubStep('answer');
        setLastHeardCommand("Finding reset to re-record");
        speakText("Finding reset. Say Pass, Attention, or Urgent.");
    }, [speakText]);

    // Advance to next step
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
            speakText("Inspection complete! All items recorded.");
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

    // Finding notes submitted (after attention/urgent), then proceed to photo prompt
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
        // Move to photo prompt after notes are captured
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
            setLastHeardCommand("Photo Flagged: Yes");
            setSubStep('photoNotes');
            speakText("Photo required. Say photo notes, or say Next when ready.");
        } else {
            setLastHeardCommand("Photo Flagged: No");
            speakText("No photo needed. Say Next when ready.");
        }
    }, [syncToParent, speakText, saveProgress]);

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
            saveProgress(prevIdx);
            setLastHeardCommand("Going back to previous step");
            readCurrentStep(prevIdx);
        }
    }, [readCurrentStep, saveProgress]);

    // Jump to specific step
    const handleJumpToStep = useCallback((targetStepNumber: number) => {
        const idx = targetStepNumber - 1;
        const total = stepsRef.current.length;
        if (idx >= 0 && idx < total) {
            setCurrentStepIndex(idx);
            setSubStep('answer');
            setJumpStepInput('');
            saveProgress(idx);
            setLastHeardCommand(`Jumped to step #${targetStepNumber}`);
            readCurrentStep(idx);
        }
    }, [readCurrentStep, saveProgress]);

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
        onClose();
    }, [syncToParent, saveProgress, onClose]);

    // Text normalizer to clean punctuation and abbreviations (e.g. "o.k." -> "ok")
    const normalizeSpeechText = (text: string): string => {
        return text
            .toLowerCase()
            .replace(/o\.k\./gi, 'ok')
            .replace(/o\.k/gi, 'ok')
            .replace(/[^a-z0-9\s]/g, ' ')
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
            recognition.interimResults = true; // Provides instant real-time feedback
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
                    // This prevents the host's own voice from being heard through the microphone, which was cutting off / truncating the speech in mid-sentence.
                    if (isSpeakingRef.current || (now - lastSpeechEndTimeRef.current < 400)) {
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

                    const isRetake = /\b(retake|retake note|retake notes|clear note|clear notes|start over|try again|erase note|delete note|delete notes|scrap note|wipe note)\b/i.test(cleaned);
                    const isResetFinding = /\b(change finding|reset finding|change status|reset status|wrong status)\b/i.test(cleaned);

                    const isPhotoYes = /\b(yes|yeah|yep|photo|take photo|need photo|require photo|true)\b/i.test(cleaned);
                    const isPhotoNo = /\b(no|nope|nah|none|don't|dont|no photo|negative)\b/i.test(cleaned);

                    const isNext = /\b(next|continue|move on|go next|next step|next question|forward)\b/i.test(cleaned);
                    const isBack = /\b(back|previous|go back|last step)\b/i.test(cleaned);
                    const isRepeat = /\b(repeat|say again|read again|what was that|pardon)\b/i.test(cleaned);
                    const isPause = /\b(pause|stop|save log|pause inspection|finish inspection)\b/i.test(cleaned);

                    // Interrupt TTS if a definitive command is spoken
                    if (isOk || isAttention || isUrgent || isNa || isRetake || isResetFinding || isPhotoYes || isPhotoNo || isNext || isBack || isRepeat || isPause) {
                        cloudSpeechSynthesis.cancel();
                        isSpeakingRef.current = false;
                        setIsSpeaking(false);
                    }

                    // Retake command - clears current notes and asks to speak again
                    if (isRetake) {
                        lastCommandTimestampRef.current = now;
                        handleRetakeNotes();
                        return;
                    }

                    // Reset finding command
                    if (isResetFinding) {
                        lastCommandTimestampRef.current = now;
                        handleResetFinding();
                        return;
                    }

                    // Global Navigation
                    if (isNext) {
                        const activeSubStep = subStepRef.current;
                        // If in findingNotes or photoNotes, treat "Next" as save & continue
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

                    // Context-aware Step Commands
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
                        // In findingNotes: if user says done/save/continue, save notes and go to photo prompt
                        if (/\b(done|save|finish notes|complete notes|continue|skip|proceed)\b/i.test(cleaned)) {
                            lastCommandTimestampRef.current = now;
                            const stepIdx = currentStepIndexRef.current;
                            handleFindingNotesSubmit(stepsRef.current[stepIdx]?.comment || '');
                            return;
                        } else if (result.isFinal) {
                            // Dictate observation notes
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
                            // Dictate photo notes on final results
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
                if (event.error === 'no-speech') {
                    // Normal in continuous mode when no speech detected
                    return;
                }
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
                // Automatically restart continuous listening if modal is still open
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
    }, [advanceToNextStep, handlePreviousStep, handleRepeatAudio, handlePauseAndSave, handleSelectStatus, handleFindingNotesSubmit, handleRetakeNotes, handleResetFinding, handlePhotoChoice, handlePhotoNotesSubmit, syncToParent, isOpen]);

    // Request Mic Permission & Start
    const handleEnableMicrophone = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Release audio tracks so SpeechRecognition has full access
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

    // On modal open: pick up from where left off (resume point) - executes ONCE on open
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
                            className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer ${isTtsEnabled
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
                                onClick={handleToggleVoiceControl}
                                className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer ${isVoiceControlActive && isListening
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30'
                                        : 'bg-white/10 text-slate-400 hover:text-white'
                                    }`}
                                title={isVoiceControlActive ? 'Pause Hands-Free Voice' : 'Resume Hands-Free Voice'}
                            >
                                {isVoiceControlActive && isListening ? <Mic size={16} className="text-emerald-400 animate-pulse" /> : <MicOff size={16} />}
                                <span className="hidden sm:inline">{isVoiceControlActive && isListening ? 'Mic Active' : 'Mic Off'}</span>
                            </button>
                        )}

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

                {/* Progress Bar & Status Line */}
                <div className="w-full bg-slate-100 h-2">
                    <div
                        className="bg-indigo-600 h-2 transition-all duration-300"
                        style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Resume Status Notification Banner */}
                {currentStepIndex > 0 && (
                    <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-1.5 flex items-center justify-between text-xs text-indigo-900">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Resume Point</span>
                            <span>Picked up from Question {currentStepIndex + 1} of {totalSteps}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleJumpToStep(1)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer flex items-center gap-1"
                        >
                            <RefreshCw size={11} />
                            <span>Start over from Question #1</span>
                        </button>
                    </div>
                )}

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
                                        {subStep === 'findingNotes'
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

                        {lastHeardCommand && (
                            <span className="hidden sm:inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[11px] text-emerald-300 font-semibold flex-shrink-0">
                                🎯 {lastHeardCommand}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleRepeatAudio}
                            className="p-1 hover:bg-white/10 text-slate-300 hover:text-white rounded flex items-center gap-1 text-[11px] font-bold transition cursor-pointer"
                            title="Repeat Question Audio"
                        >
                            <RotateCcw size={12} />
                            <span>Repeat</span>
                        </button>
                    </div>
                </div>

                {/* Mic Permission Banner if blocked */}
                {needsMicPermission && (
                    <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-bold flex items-center justify-between border-b border-amber-600">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>Microphone access needed for hands-free voice control.</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleEnableMicrophone}
                            className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs hover:bg-slate-800 transition cursor-pointer"
                        >
                            Allow Microphone
                        </button>
                    </div>
                )}

                {voiceError && !needsMicPermission && (
                    <div className="bg-amber-50 text-amber-900 px-4 py-1.5 text-xs font-semibold border-b border-amber-200 flex items-center justify-between">
                        <span>⚠️ {voiceError}</span>
                        <button
                            type="button"
                            onClick={() => setVoiceError(null)}
                            className="text-amber-700 hover:text-amber-950 underline font-bold ml-2 cursor-pointer"
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
                                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-indigo-600 transition shadow-xs flex-shrink-0 cursor-pointer"
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
                                    (Say: &ldquo;OK&rdquo; / &ldquo;Pass&rdquo;, &ldquo;Attention&rdquo;, &ldquo;Urgent&rdquo;)
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleSelectStatus('ok')}
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${currentStep.status === 'ok'
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
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${currentStep.status === 'attention'
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
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${currentStep.status === 'urgent'
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
                                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer ${currentStep.status === 'na'
                                            ? 'bg-slate-500 text-white border-slate-600 shadow-md ring-2 ring-slate-300'
                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <HelpCircle size={18} />
                                    <span>N/A</span>
                                </button>
                            </div>
                        </div>

                        {/* General Finding Notes Field */}
                        {subStep === 'answer' && (
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
                        )}
                    </div>

                    {/* Step: Finding Observation Notes Sub-Step for Attention & Urgent */}
                    {subStep === 'findingNotes' && (
                        <div className={`p-4 rounded-2xl border-2 space-y-3.5 animate-fade-in shadow-sm ${currentStep.status === 'urgent'
                                ? 'bg-red-50 border-red-300'
                                : 'bg-amber-50 border-amber-300'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className={`flex items-center gap-2 font-black text-xs uppercase tracking-wide ${currentStep.status === 'urgent' ? 'text-red-900' : 'text-amber-900'
                                    }`}>
                                    {currentStep.status === 'urgent' ? (
                                        <XCircle size={18} className="text-red-600" />
                                    ) : (
                                        <AlertTriangle size={18} className="text-amber-600" />
                                    )}
                                    <span>
                                        {currentStep.status === 'urgent' ? 'Record Urgent Defect Notes' : 'Record Attention / Advisory Notes'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetFinding}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
                                    >
                                        Change Finding
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    autoFocus
                                    value={currentStep.comment || ''}
                                    onChange={e => handleCommentChange(e.target.value)}
                                    placeholder={
                                        currentStep.status === 'urgent'
                                            ? "Describe urgent issue (e.g. OSF brake pad metal-to-metal, severe coolant leak)..."
                                            : "Describe condition (e.g. inner pad 3mm, slight play in ball joint)..."
                                    }
                                    className={`flex-1 px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-semibold outline-none focus:ring-2 shadow-xs ${currentStep.status === 'urgent'
                                            ? 'border-red-300 focus:ring-red-500 text-red-950'
                                            : 'border-amber-300 focus:ring-amber-500 text-amber-950'
                                        }`}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            handleFindingNotesSubmit(currentStep.comment || '');
                                        }
                                    }}
                                />
                                <SpeechToTextButton
                                    onTranscript={text => {
                                        const existing = currentStep.comment || '';
                                        const updated = existing ? `${existing} ${text}` : text;
                                        handleCommentChange(updated);
                                    }}
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                                <span className={`text-[11px] font-medium ${currentStep.status === 'urgent' ? 'text-red-700' : 'text-amber-700'
                                    }`}>
                                    🎙️ Speak your observations now. If misheard, say &ldquo;Retake&rdquo; or click Retake Note.
                                </span>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    {/* Retake Note Button */}
                                    <button
                                        type="button"
                                        onClick={handleRetakeNotes}
                                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        title="Clear notes and speak again"
                                    >
                                        <RotateCcw size={14} className="text-amber-600" />
                                        <span>Retake Note</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleFindingNotesSubmit(currentStep.comment || '')}
                                        className={`px-4 py-2 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${currentStep.status === 'urgent'
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : 'bg-amber-600 hover:bg-amber-700'
                                            }`}
                                    >
                                        <span>Save Notes & Check Photo</span>
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step: Photo Prompt Sub-Step */}
                    {subStep === 'photoPrompt' && (
                        <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
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
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
                                >
                                    Yes (Require Photo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePhotoChoice(false)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                                >
                                    No (Proceed)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Photo Notes Sub-Step */}
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
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleRetakeNotes}
                                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    title="Clear photo notes and speak again"
                                >
                                    <RotateCcw size={14} className="text-amber-600" />
                                    <span>Retake Note</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePhotoNotesSubmit(currentStep.photoNotes || '')}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex-shrink-0 flex items-center gap-1 cursor-pointer"
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
                                        className={`pt-1.5 flex items-start justify-between gap-2 text-xs transition ${i === currentStepIndex ? 'bg-indigo-50/70 p-2 rounded-lg font-bold text-indigo-950' : 'text-slate-700'
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
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${st.status === 'ok' ? 'bg-emerald-100 text-emerald-800' :
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

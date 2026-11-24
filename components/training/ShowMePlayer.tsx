import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, MousePointer2, Sparkles, CheckCircle2 } from 'lucide-react';
import { TrainingModule } from '../../core/data/trainingModules';
import { ShowMeRealScreen } from './ShowMeRealScreens';

interface ShowMePlayerProps {
    module: TrainingModule;
    onComplete?: () => void;
}

export const ShowMePlayer: React.FC<ShowMePlayerProps> = ({ module, onComplete }) => {
    const steps = module.showMeSteps || [];
    const [stepIndex, setStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speedMs, setSpeedMs] = useState<number>(3200);
    const [pulseActive, setPulseActive] = useState(false);

    useEffect(() => {
        setStepIndex(0);
        setIsPlaying(true);
    }, [module.id]);

    useEffect(() => {
        setPulseActive(false);
        const pulseTimer = setTimeout(() => setPulseActive(true), 450);
        return () => clearTimeout(pulseTimer);
    }, [stepIndex, module.id]);

    useEffect(() => {
        if (!isPlaying || steps.length <= 1) return;
        const timer = setInterval(() => {
            setStepIndex(prev => {
                if (prev + 1 >= steps.length) {
                    setIsPlaying(false);
                    onComplete?.();
                    return prev;
                }
                return prev + 1;
            });
        }, speedMs);
        return () => clearInterval(timer);
    }, [isPlaying, steps.length, speedMs, onComplete]);

    if (steps.length === 0) return null;

    const currentStep = steps[Math.min(stepIndex, steps.length - 1)];

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Player Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        Show Me Replay
                    </span>
                    <span className="text-xs font-bold text-gray-900">
                        {module.title}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setSpeedMs(prev => (prev === 3200 ? 2000 : 3200))}
                        className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-[11px] font-mono text-gray-700 cursor-pointer"
                        title="Toggle playback speed"
                    >
                        {speedMs === 3200 ? '1.0x' : '1.5x'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setStepIndex(prev => Math.max(0, prev - 1));
                            setIsPlaying(false);
                        }}
                        disabled={stepIndex === 0}
                        className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 disabled:opacity-40 cursor-pointer"
                        title="Previous step"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isPlaying && stepIndex >= steps.length - 1) {
                                setStepIndex(0);
                            }
                            setIsPlaying(p => !p);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isPlaying ? 'Pause' : stepIndex >= steps.length - 1 ? 'Replay' : 'Play'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setStepIndex(prev => Math.min(steps.length - 1, prev + 1));
                            setIsPlaying(false);
                        }}
                        disabled={stepIndex >= steps.length - 1}
                        className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 disabled:opacity-40 cursor-pointer"
                        title="Next step"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setStepIndex(0);
                            setIsPlaying(true);
                        }}
                        className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 cursor-pointer"
                        title="Restart animation"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Simulated Screen Stage */}
            <div className="relative p-5 bg-slate-100/80 min-h-[230px] flex flex-col justify-between overflow-hidden">
                {/* Mock App Window Bar */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2.5 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="ml-2 text-xs font-bold text-gray-800">
                            {currentStep.screenTitle}
                        </span>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
                        Step {stepIndex + 1} / {steps.length} • {currentStep.actionType.toUpperCase()}
                    </span>
                </div>

                {/* Real Page Replica */}
                <div className="relative z-10 my-1">
                    <ShowMeRealScreen
                        moduleId={module.id}
                        stepIndex={stepIndex}
                        targetId={currentStep.targetId}
                    />
                </div>

                {/* Toast Preview */}
                {currentStep.toastText && (
                    <div className="mt-3 self-end inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold shadow-sm animate-in fade-in duration-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                        {currentStep.toastText}
                    </div>
                )}

                {/* Animated Cursor */}
                <div
                    className="pointer-events-none absolute z-20 transition-all duration-700 ease-in-out"
                    style={{
                        left: `${currentStep.cursorPos.x}%`,
                        top: `${currentStep.cursorPos.y}%`,
                        transform: 'translate(-20%, -20%)',
                    }}
                >
                    <div className="relative">
                        {pulseActive && (
                            <span className="absolute -inset-2 rounded-full bg-indigo-500/35 animate-ping" />
                        )}
                        <div className="w-7 h-7 rounded-full bg-white/95 border-2 border-indigo-600 flex items-center justify-center shadow-lg">
                            <MousePointer2 className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Caption & Timeline */}
            <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                <div>
                    <div className="text-xs font-bold text-gray-900">{currentStep.title}</div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{currentStep.caption}</p>
                </div>
                <div className="flex gap-1.5">
                    {steps.map((s, idx) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                setStepIndex(idx);
                                setIsPlaying(false);
                            }}
                            className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                                idx === stepIndex
                                    ? 'bg-indigo-600'
                                    : idx < stepIndex
                                        ? 'bg-indigo-300'
                                        : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                            title={s.title}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, MousePointer2, Sparkles, CheckCircle2 } from 'lucide-react';
import { TrainingModule, ShowMeMockElement } from '../../core/data/trainingModules';

interface ShowMePlayerProps {
    module: TrainingModule;
    onComplete?: () => void;
}

const getToneClasses = (tone: ShowMeMockElement['tone'], isTarget: boolean) => {
    const base =
        tone === 'indigo'
            ? 'bg-indigo-950/80 border-indigo-500/60 text-indigo-100'
            : tone === 'emerald'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-100'
                : tone === 'amber'
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-100'
                    : tone === 'rose'
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-100'
                        : 'bg-slate-900 border-slate-700 text-slate-200';

    const ring = isTarget
        ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/20 scale-[1.03]'
        : 'opacity-85';

    return `${base} ${ring}`;
};

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
        <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl overflow-hidden shadow-xl">
            {/* Player Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        Show Me Replay
                    </span>
                    <span className="text-xs font-bold text-white">
                        {module.title}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setSpeedMs(prev => (prev === 3200 ? 2000 : 3200))}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 cursor-pointer"
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
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
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
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
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
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        title="Restart animation"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Simulated Screen Stage */}
            <div className="relative p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 min-h-[230px] flex flex-col justify-between overflow-hidden">
                {/* Mock App Window Bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                            {currentStep.screenTitle}
                        </span>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded">
                        Step {stepIndex + 1} / {steps.length} • {currentStep.actionType.toUpperCase()}
                    </span>
                </div>

                {/* Mock UI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 my-2">
                    {currentStep.elements.map(el => {
                        const isTarget = el.id === currentStep.targetId;
                        return (
                            <div
                                key={el.id}
                                className={`p-3.5 rounded-xl border transition-all duration-500 ${getToneClasses(el.tone, isTarget)}`}
                            >
                                <div className="text-[10px] uppercase tracking-wider font-mono opacity-75 mb-1">
                                    {el.label}
                                </div>
                                <div className="text-xs font-bold leading-snug">
                                    {el.value}
                                </div>
                                {isTarget && (
                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                        {currentStep.targetLabel}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Toast Preview */}
                {currentStep.toastText && (
                    <div className="mt-3 self-end inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold animate-in fade-in duration-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
                            <span className="absolute -inset-2 rounded-full bg-amber-400/40 animate-ping" />
                        )}
                        <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-300 flex items-center justify-center shadow-lg">
                            <MousePointer2 className="w-4 h-4 text-amber-300 fill-amber-300" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Caption & Timeline */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3">
                <div>
                    <div className="text-xs font-bold text-white">{currentStep.title}</div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{currentStep.caption}</p>
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
                                    ? 'bg-amber-400'
                                    : idx < stepIndex
                                        ? 'bg-indigo-500'
                                        : 'bg-slate-800 hover:bg-slate-700'
                            }`}
                            title={s.title}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

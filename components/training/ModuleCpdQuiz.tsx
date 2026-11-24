import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, AlertTriangle, HelpCircle, Send } from 'lucide-react';
import { TrainingModule, getModuleStatusForUser } from '../../core/data/trainingModules';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { TrainingRecord } from '../../types';
import { toast } from 'react-toastify';

interface ModuleCpdQuizProps {
    module: TrainingModule;
}

export const ModuleCpdQuiz: React.FC<ModuleCpdQuizProps> = ({ module }) => {
    const { currentUser } = useApp();
    const { trainingRecords, saveRecord } = useData();

    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [acknowledged, setAcknowledged] = useState(false);
    const [submittedResult, setSubmittedResult] = useState<{
        score: number;
        passed: boolean;
        correctCount: number;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setAnswers({});
        setAcknowledged(false);
        setSubmittedResult(null);
    }, [module.id]);

    if (!currentUser) return null;

    const { status, record } = getModuleStatusForUser(module, trainingRecords, currentUser.id);
    const allAnswered = module.quiz.every(q => answers[q.id] !== undefined);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allAnswered || !acknowledged) return;

        let correctCount = 0;
        for (const q of module.quiz) {
            if (answers[q.id] === q.correctIndex) {
                correctCount++;
            }
        }
        const score = Math.round((correctCount / module.quiz.length) * 100);
        const passed = score >= module.passThreshold;

        setSubmittedResult({ score, passed, correctCount });

        if (!passed) {
            toast.warning(`Scored ${score}% (${correctCount}/${module.quiz.length}). Review the explanations below and retry.`);
            return;
        }

        setIsSaving(true);
        try {
            const existingAny = trainingRecords.find(
                r => r.userId === currentUser.id && r.moduleId === module.id
            );
            const now = new Date().toISOString();
            const newRecord: TrainingRecord = {
                id: `${currentUser.id}__${module.id}`,
                userId: currentUser.id,
                moduleId: module.id,
                completedVersion: module.version,
                score,
                passed: true,
                cpdMinutes: module.cpdMinutes,
                attempts: (existingAny?.attempts || 0) + 1,
                completedAt: now,
                acknowledgedAt: now,
            };
            await saveRecord('trainingRecords', newRecord);
            toast.success(`CPD Completed: ${module.title} (+${module.cpdMinutes} mins)`);
        } catch (err) {
            console.error('Failed to save training record:', err);
            toast.error('Could not save CPD record. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
            {/* Header & Current CPD Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        <Award className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-gray-900">
                            CPD Knowledge Check — {module.title}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            Module v{module.version} • {module.cpdMinutes} CPD mins • Pass mark {module.passThreshold}%
                        </p>
                    </div>
                </div>

                {status === 'current' && record && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Certified v{record.completedVersion} ({record.score}%)
                    </span>
                )}
                {status === 'refresher_due' && record && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Refresher Due (Completed v{record.completedVersion}, Latest v{module.version})
                    </span>
                )}
                {status === 'not_started' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Not Yet Certified
                    </span>
                )}
            </div>

            {/* Scenario Questions */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {module.quiz.map((q, qIdx) => {
                    const chosen = answers[q.id];
                    const showFeedback = submittedResult !== null;
                    const isCorrect = chosen === q.correctIndex;

                    return (
                        <div key={q.id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                            <div className="text-xs font-bold text-gray-900">
                                {qIdx + 1}. {q.question}
                            </div>
                            <div className="space-y-1.5">
                                {q.options.map((opt, optIdx) => {
                                    const selected = chosen === optIdx;
                                    let optStyle = 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300';
                                    if (showFeedback) {
                                        if (optIdx === q.correctIndex) {
                                            optStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold';
                                        } else if (selected && optIdx !== q.correctIndex) {
                                            optStyle = 'bg-rose-50 border-rose-300 text-rose-900';
                                        }
                                    } else if (selected) {
                                        optStyle = 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold';
                                    }

                                    return (
                                        <label
                                            key={optIdx}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${optStyle}`}
                                        >
                                            <input
                                                type="radio"
                                                name={q.id}
                                                checked={selected}
                                                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                                className="mt-0.5 text-indigo-600"
                                            />
                                            <span>{opt}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {showFeedback && (
                                <div className={`text-[11px] px-2.5 py-1.5 rounded-lg ${isCorrect ? 'text-emerald-800 bg-emerald-100/70' : 'text-amber-900 bg-amber-100/70'}`}>
                                    {q.explanation}
                                </div>
                            )}
                        </div>
                    );
                })}

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-gray-800 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={e => setAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600"
                    />
                    <span>
                        I confirm I have reviewed the visual walkthrough / SOP for <strong>{module.title} (v{module.version})</strong> and will follow this workflow.
                    </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    {submittedResult ? (
                        <div className={`text-xs font-bold ${submittedResult.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                            Result: {submittedResult.score}% ({submittedResult.correctCount}/{module.quiz.length}) — {submittedResult.passed ? 'Passed & Logged' : 'Please review and retry'}
                        </div>
                    ) : (
                        <div className="text-[11px] text-gray-500">
                            Answer all {module.quiz.length} questions and tick the confirmation box to log CPD.
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={!allAnswered || !acknowledged || isSaving}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                        <Send className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving CPD...' : status === 'current' ? 'Re-Verify CPD' : 'Submit CPD Check'}
                    </button>
                </div>
            </form>
        </div>
    );
};

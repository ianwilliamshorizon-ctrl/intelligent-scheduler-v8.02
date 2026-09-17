import React, { useState, useMemo } from 'react';
import { X, ArrowRightLeft, Users, CheckCircle, AlertCircle, RefreshCw, Briefcase, UserCheck, ShieldAlert } from 'lucide-react';
import { Engineer, BusinessEntity } from '../../../types';
import { getEngineerTheme } from './ResourceGanttView';

interface TechnicianTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    allEngineers: Engineer[];
    currentEngineers: Engineer[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    onUpdateEngineerTransfer: (engineerId: string, toEntityId: string | null, reason?: string) => Promise<void>;
}

export const TechnicianTransferModal: React.FC<TechnicianTransferModalProps> = ({
    isOpen,
    onClose,
    allEngineers = [],
    currentEngineers = [],
    businessEntities = [],
    selectedEntityId,
    onUpdateEngineerTransfer
}) => {
    const [selectedTechId, setSelectedTechId] = useState<string>('');
    const [targetEntityId, setTargetEntityId] = useState<string>(selectedEntityId !== 'all' ? selectedEntityId : (businessEntities[0]?.id || ''));
    const [transferReason, setTransferReason] = useState<string>('Recovering workshop backlog');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const currentEntity = useMemo(() => {
        return businessEntities.find(b => b.id === (selectedEntityId !== 'all' ? selectedEntityId : targetEntityId));
    }, [businessEntities, selectedEntityId, targetEntityId]);

    // Active transfers currently borrowed into this entity
    const activeBorrowedTechs = useMemo(() => {
        const entityKey = selectedEntityId !== 'all' ? selectedEntityId : targetEntityId;
        return allEngineers.filter(e => e.transferredToEntityId === entityKey && e.entityId !== entityKey);
    }, [allEngineers, selectedEntityId, targetEntityId]);

    // Available technicians from other entities that can be transferred in
    const availableExternalTechs = useMemo(() => {
        const entityKey = selectedEntityId !== 'all' ? selectedEntityId : targetEntityId;
        return allEngineers.filter(e => {
            const homeEntity = e.entityId;
            const currentEffectiveEntity = e.transferredToEntityId || homeEntity;
            return currentEffectiveEntity !== entityKey;
        });
    }, [allEngineers, selectedEntityId, targetEntityId]);

    if (!isOpen) return null;

    const handleConfirmTransfer = async () => {
        if (!selectedTechId || !targetEntityId) return;
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            await onUpdateEngineerTransfer(selectedTechId, targetEntityId, transferReason);
            setStatusMessage({ text: 'Technician successfully transferred to recover backlog.', type: 'success' });
            setSelectedTechId('');
        } catch (err) {
            console.error('Failed to transfer technician:', err);
            setStatusMessage({ text: 'Failed to update technician transfer.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturnToHome = async (engineerId: string) => {
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            await onUpdateEngineerTransfer(engineerId, null);
            setStatusMessage({ text: 'Technician successfully returned to home workshop.', type: 'success' });
        } catch (err) {
            console.error('Failed to return technician to home workshop:', err);
            setStatusMessage({ text: 'Failed to return technician.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/30 border border-indigo-400/40 rounded-xl text-indigo-300">
                            <ArrowRightLeft size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-wider text-white">
                                Technician Workshop Transfer
                            </h2>
                            <p className="text-xs text-indigo-200 font-medium">
                                Temporarily borrow technicians from other workshops to recover backlogs
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Status Alert */}
                    {statusMessage && (
                        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                            statusMessage.type === 'success' 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            {statusMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            <span>{statusMessage.text}</span>
                        </div>
                    )}

                    {/* Workshop Entity Selector if 'all' was selected */}
                    {selectedEntityId === 'all' && (
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                Target Workshop to Receive Tech
                            </label>
                            <select
                                value={targetEntityId}
                                onChange={(e) => setTargetEntityId(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                            >
                                {businessEntities.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* SECTION 1: Active Borrowed Techs */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                                <Users size={14} className="text-indigo-600" />
                                <span>Active Borrowed Techs in {currentEntity?.name || 'Workshop'} ({activeBorrowedTechs.length})</span>
                            </h3>
                        </div>

                        {activeBorrowedTechs.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-500 font-medium">
                                No external technicians are currently transferred to this workshop. All current wrench hours are provided by allotted staff.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeBorrowedTechs.map(tech => {
                                    const theme = getEngineerTheme(tech.id);
                                    const homeEntityName = businessEntities.find(b => b.id === tech.entityId)?.name || 'Other Entity';
                                    return (
                                        <div 
                                            key={tech.id} 
                                            className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: theme.hex }} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-xs text-slate-900 truncate">{tech.name}</span>
                                                        <span className="text-[9px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                                                            Borrowed from {homeEntityName}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                        {tech.transferReason ? `Reason: ${tech.transferReason}` : 'Temporary transfer for backlog recovery'} • £{tech.hourlyRate || 35}/h
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleReturnToHome(tech.id)}
                                                disabled={isSubmitting}
                                                className="shrink-0 px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer"
                                            >
                                                Return to {homeEntityName}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: Transfer a Technician In */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <ArrowRightLeft size={14} className="text-indigo-600" />
                            <span>Borrow a Technician to Help Recover Backlog</span>
                        </h3>

                        {availableExternalTechs.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-500 font-medium">
                                All available technicians across all workshops are already deployed or assigned to this workshop.
                            </div>
                        ) : (
                            <div className="space-y-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                                        Select Technician to Borrow
                                    </label>
                                    <select
                                        value={selectedTechId}
                                        onChange={(e) => setSelectedTechId(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Choose technician from another workshop --</option>
                                        {availableExternalTechs.map(tech => {
                                            const homeEntityName = businessEntities.find(b => b.id === tech.entityId)?.name || 'Home Workshop';
                                            return (
                                                <option key={tech.id} value={tech.id}>
                                                    {tech.name} (Home: {homeEntityName} • £{tech.hourlyRate || 35}/h)
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                                        Transfer Purpose / Backlog Reason
                                    </label>
                                    <input
                                        type="text"
                                        value={transferReason}
                                        onChange={(e) => setTransferReason(e.target.value)}
                                        placeholder="e.g. Recovering major service backlog, emergency holiday cover"
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <button
                                    onClick={handleConfirmTransfer}
                                    disabled={!selectedTechId || isSubmitting}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <ArrowRightLeft size={14} />
                                    <span>Deploy Technician to {currentEntity?.name || 'Workshop'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Transfers update the labour pool immediately on the Resource Gantt.</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

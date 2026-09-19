import React, { useState, useEffect } from 'react';
import { FCSGanttBlock, Lift, Engineer, Job, Customer, Vehicle } from '../../../types';
import { OptimizedAssignment } from './FCSOptimizerModal';
import { Sparkles, Calendar, Wrench, Layers, Clock, X, ChevronLeft, ChevronRight, CheckCircle, FileText, ArrowRightLeft, ExternalLink, User, AlertTriangle } from 'lucide-react';
import { getEngineerTheme } from './ResourceGanttView';
import { formatDate, addDays, getRelativeDate } from '../../../core/utils/dateUtils';

export interface AdjustSuggestedAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    block: FCSGanttBlock;
    job?: Job;
    planItem?: OptimizedAssignment;
    usableRamps: Lift[];
    engineers: Engineer[];
    customers?: Customer[];
    vehicles?: Vehicle[];
    onApply: (jobId: string, newDate: string, newRampId: string, newEngineerId: string) => void | Promise<void>;
    onOpenFullJobCard?: (jobId: string) => void;
}

export const AdjustSuggestedAllocationModal: React.FC<AdjustSuggestedAllocationModalProps> = ({
    isOpen,
    onClose,
    block,
    job,
    planItem,
    usableRamps,
    engineers,
    customers = [],
    vehicles = [],
    onApply,
    onOpenFullJobCard
}) => {
    const isEstimateSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));
    const isSuggested = Boolean(block.isSuggested || block.fcsState === 'SUGGESTED');
    const isSchedUnalloc = Boolean(block.isScheduledUnallocated);

    const initialDate = planItem?.scheduledDate || job?.scheduledDate || block.startDate || formatDate(new Date());
    const initialRampId = planItem?.recommendedRampId || (block.resourceType === 'ramp' ? block.resourceId : (usableRamps[0]?.id || ''));
    const initialEngId = planItem?.recommendedEngineerId || block.engineerId || (engineers[0]?.id || '');

    const [selectedDate, setSelectedDate] = useState<string>(initialDate);
    const [selectedRampId, setSelectedRampId] = useState<string>(initialRampId);
    const [selectedEngineerId, setSelectedEngineerId] = useState<string>(initialEngId);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            const firstSeg = job?.segments?.[0];
            const matchedRamp = usableRamps.find(r => r.name === firstSeg?.allocatedLift || r.id === firstSeg?.allocatedLift);
            const matchedEng = engineers.find(e => e.id === firstSeg?.engineerId || (e.name && e.name.toLowerCase() === firstSeg?.engineerId?.toLowerCase()));

            setSelectedDate(planItem?.scheduledDate || job?.scheduledDate || firstSeg?.date || block.startDate || formatDate(new Date()));
            setSelectedRampId(planItem?.recommendedRampId || matchedRamp?.id || (block.resourceType === 'ramp' ? block.resourceId : (usableRamps[0]?.id || '')));
            setSelectedEngineerId(planItem?.recommendedEngineerId || matchedEng?.id || block.engineerId || (engineers[0]?.id || ''));
        }
    }, [isOpen, block, job, planItem, usableRamps, engineers]);

    if (!isOpen) return null;

    const handleShiftDay = (days: number) => {
        try {
            const current = new Date(selectedDate.includes('T') ? selectedDate : `${selectedDate}T00:00:00`);
            const shifted = addDays(current, days);
            setSelectedDate(formatDate(shifted));
        } catch (e) {
            console.error('Error shifting date:', e);
        }
    };

    const handleQuickPreset = (preset: 'today' | 'tomorrow' | 'nextMonday') => {
        const today = new Date();
        if (preset === 'today') {
            setSelectedDate(formatDate(today));
        } else if (preset === 'tomorrow') {
            setSelectedDate(formatDate(addDays(today, 1)));
        } else if (preset === 'nextMonday') {
            const dayOfWeek = today.getDay();
            const daysUntilNextMonday = ((1 - dayOfWeek + 7) % 7) || 7;
            setSelectedDate(formatDate(addDays(today, daysUntilNextMonday)));
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await onApply(block.jobId, selectedDate, selectedRampId, selectedEngineerId);
            onClose();
        } catch (err) {
            console.error("Failed to move job card:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedTech = engineers.find(e => e.id === selectedEngineerId);
    const techTheme = selectedTech ? getEngineerTheme(selectedTech.id, engineers) : null;
    const selectedRamp = usableRamps.find(r => r.id === selectedRampId);

    const vehicle = vehicles.find(v => v.id === job?.vehicleId) || planItem?.vehicle;
    const customer = customers.find(c => c.id === job?.customerId) || planItem?.customer;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
                {/* Header */}
                <div className={`p-5 relative border-b text-white ${
                    isEstimateSim 
                        ? 'bg-gradient-to-r from-slate-950 via-amber-950 to-slate-900 border-amber-900/50' 
                        : isSuggested
                            ? 'bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950 border-purple-900/50'
                            : 'bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-indigo-900/50'
                }`}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-300">
                        {isEstimateSim ? (
                            <span className="text-amber-400 flex items-center gap-1"><FileText size={13} /> Pipeline Estimate Simulation</span>
                        ) : isSuggested ? (
                            <span className="text-purple-300 flex items-center gap-1"><Sparkles size={13} className="fill-purple-300" /> Proposed Work Allocation</span>
                        ) : isSchedUnalloc ? (
                            <span className="text-amber-300 flex items-center gap-1"><Calendar size={13} /> Scheduled Job Card</span>
                        ) : (
                            <span className="text-emerald-300 flex items-center gap-1"><CheckCircle size={13} /> Workshop Job Card</span>
                        )}
                    </div>

                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <ArrowRightLeft size={18} className="text-indigo-400" />
                        <span>Move & Adjust Job Card</span>
                    </h3>
                    <p className="text-slate-300 text-xs mt-0.5">
                        Reposition this job card across workshop dates, ramp bays, or technicians. Live Gantt updates instantly.
                    </p>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 text-slate-800">
                    {/* Job Card Overview Card */}
                    <div className={`p-3.5 rounded-2xl border ${
                        isEstimateSim 
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                            : isSuggested
                                ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm uppercase bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                                    {block.vehicleRegistration || vehicle?.registration || `#${block.jobId}`}
                                </span>
                                {vehicle?.make && (
                                    <span className="text-xs font-bold text-slate-600">
                                        {vehicle.make} {vehicle.model}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] bg-white border px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs text-slate-800">
                                <Clock size={11} className="text-slate-500" />
                                <span>{block.hours}h Duration</span>
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-2 truncate" title={block.title}>
                            {block.title}
                        </p>
                        {customer && (
                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                Customer: <span className="font-bold text-slate-700">{customer.companyName || `${customer.forename || ''} ${customer.surname || ''}`.trim() || 'Workshop Client'}</span>
                            </p>
                        )}
                    </div>

                    {/* Move Date Controls */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Calendar size={13} className="text-indigo-600" />
                                <span>Scheduled Date</span>
                            </label>
                            {/* Quick presets */}
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => handleQuickPreset('today')}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickPreset('tomorrow')}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
                                >
                                    Tomorrow
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickPreset('nextMonday')}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
                                >
                                    Next Mon
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleShiftDay(-7)}
                                className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black transition-colors cursor-pointer"
                                title="Move back 1 week (-7 days)"
                            >
                                -7d
                            </button>
                            <button
                                type="button"
                                onClick={() => handleShiftDay(-1)}
                                className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                                title="Move back 1 day"
                            >
                                <ChevronLeft size={14} />
                                <span>-1d</span>
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="flex-grow bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftDay(1)}
                                className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                                title="Move forward 1 day"
                            >
                                <span>+1d</span>
                                <ChevronRight size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleShiftDay(7)}
                                className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black transition-colors cursor-pointer"
                                title="Move forward 1 week (+7 days)"
                            >
                                +7d
                            </button>
                        </div>
                    </div>

                    {/* Reassign Ramp Bay */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Layers size={13} className="text-blue-600" />
                            <span>Assigned Ramp / Workshop Bay</span>
                        </label>
                        <select
                            value={selectedRampId}
                            onChange={(e) => setSelectedRampId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            {usableRamps.map(ramp => (
                                <option key={ramp.id} value={ramp.id}>
                                    {ramp.name} {ramp.type ? `(${ramp.type})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Reassign Technician */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Wrench size={13} className="text-purple-600" />
                            <span>Assigned Technician</span>
                        </label>
                        <div className="flex items-center gap-2">
                            {techTheme && (
                                <span 
                                    className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-white"
                                    style={{ backgroundColor: techTheme.hex }}
                                />
                            )}
                            <select
                                value={selectedEngineerId}
                                onChange={(e) => setSelectedEngineerId(e.target.value)}
                                className="flex-grow bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                                {engineers.map(eng => (
                                    <option key={eng.id} value={eng.id}>
                                        {eng.name} {eng.specialization ? `• ${eng.specialization}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <div>
                        {onOpenFullJobCard && !isEstimateSim && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onOpenFullJobCard(block.jobId);
                                }}
                                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <ExternalLink size={13} />
                                <span>Full 360° Job Card</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                            <CheckCircle size={14} />
                            <span>{isSubmitting ? 'Saving...' : 'Apply Move to Gantt'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

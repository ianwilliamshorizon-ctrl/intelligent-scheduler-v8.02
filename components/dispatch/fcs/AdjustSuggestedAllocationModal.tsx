import React, { useState, useEffect } from 'react';
import { FCSGanttBlock, Lift, Engineer } from '../../../types';
import { OptimizedAssignment } from './FCSOptimizerModal';
import { Sparkles, Calendar, Wrench, Layers, Clock, X, ChevronLeft, ChevronRight, CheckCircle, FileText } from 'lucide-react';
import { getEngineerTheme } from './ResourceGanttView';
import { formatDate, addDays } from '../../../core/utils/dateUtils';

export interface AdjustSuggestedAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    block: FCSGanttBlock;
    planItem?: OptimizedAssignment;
    usableRamps: Lift[];
    engineers: Engineer[];
    onApply: (jobId: string, newDate: string, newRampId: string, newEngineerId: string) => void;
}

export const AdjustSuggestedAllocationModal: React.FC<AdjustSuggestedAllocationModalProps> = ({
    isOpen,
    onClose,
    block,
    planItem,
    usableRamps,
    engineers,
    onApply
}) => {
    const isEstimateSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));

    const initialDate = planItem?.scheduledDate || block.startDate || formatDate(new Date());
    const initialRampId = planItem?.recommendedRampId || block.resourceId || (usableRamps[0]?.id || '');
    const initialEngId = planItem?.recommendedEngineerId || block.engineerId || (engineers[0]?.id || '');

    const [selectedDate, setSelectedDate] = useState<string>(initialDate);
    const [selectedRampId, setSelectedRampId] = useState<string>(initialRampId);
    const [selectedEngineerId, setSelectedEngineerId] = useState<string>(initialEngId);

    useEffect(() => {
        if (isOpen) {
            setSelectedDate(planItem?.scheduledDate || block.startDate || formatDate(new Date()));
            setSelectedRampId(planItem?.recommendedRampId || (block.resourceType === 'ramp' ? block.resourceId : (usableRamps[0]?.id || '')));
            setSelectedEngineerId(planItem?.recommendedEngineerId || block.engineerId || (engineers[0]?.id || ''));
        }
    }, [isOpen, block, planItem, usableRamps, engineers]);

    if (!isOpen) return null;

    const handleShiftDay = (direction: -1 | 1) => {
        try {
            const current = new Date(selectedDate.includes('T') ? selectedDate : `${selectedDate}T00:00:00`);
            const shifted = addDays(current, direction);
            setSelectedDate(formatDate(shifted));
        } catch (e) {
            console.error('Error shifting date:', e);
        }
    };

    const handleSave = () => {
        onApply(block.jobId, selectedDate, selectedRampId, selectedEngineerId);
        onClose();
    };

    const selectedTech = engineers.find(e => e.id === selectedEngineerId);
    const techTheme = selectedTech ? getEngineerTheme(selectedTech.id, engineers) : null;
    const selectedRamp = usableRamps.find(r => r.id === selectedRampId);

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
                {/* Header */}
                <div className={`p-5 relative border-b text-white ${
                    isEstimateSim 
                        ? 'bg-gradient-to-r from-slate-950 via-amber-950 to-slate-900 border-amber-900/50' 
                        : 'bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950 border-purple-900/50'
                }`}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-1 text-amber-400">
                        {isEstimateSim ? <FileText size={14} className="text-amber-400" /> : <Sparkles size={14} className="fill-amber-400" />}
                        <span>{isEstimateSim ? 'Pipeline Estimate Simulation' : 'Proposed Work Allocation'}</span>
                    </div>

                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        Move & Adjust Allocation
                    </h3>
                    <p className="text-slate-300 text-xs mt-0.5">
                        Reposition this proposed job across workshop dates, ramps, or technicians. Changes reflect immediately on the Gantt.
                    </p>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 text-slate-800">
                    {/* Job / Estimate Overview Card */}
                    <div className={`p-3.5 rounded-2xl border ${
                        isEstimateSim 
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                            : 'bg-purple-50/70 border-purple-200 text-purple-950'
                    }`}>
                        <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm uppercase">
                                {block.vehicleRegistration || `#${block.jobId}`}
                            </span>
                            <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs">
                                <Clock size={11} className="text-slate-500" />
                                <span>{block.hours}h Duration</span>
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-1 truncate" title={block.title}>
                            {block.title}
                        </p>
                        {planItem?.customer && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Customer: {planItem.customer.companyName || `${planItem.customer.forename || ''} ${planItem.customer.surname || ''}`.trim() || 'Workshop Client'}
                            </p>
                        )}
                    </div>

                    {/* Move Date Controls */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Calendar size={13} className="text-indigo-600" />
                            <span>Scheduled Date</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleShiftDay(-1)}
                                className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                                title="Move to previous day"
                            >
                                <ChevronLeft size={14} />
                                <span>-1 Day</span>
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="flex-grow bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftDay(1)}
                                className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                                title="Move to next day"
                            >
                                <span>+1 Day</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Reassign Ramp */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Layers size={13} className="text-blue-600" />
                            <span>Assigned Ramp / Lift Bay</span>
                        </label>
                        <select
                            value={selectedRampId}
                            onChange={(e) => setSelectedRampId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white"
                                    style={{ backgroundColor: techTheme.hex }}
                                />
                            )}
                            <select
                                value={selectedEngineerId}
                                onChange={(e) => setSelectedEngineerId(e.target.value)}
                                className="flex-grow bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
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
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                        <CheckCircle size={14} />
                        <span>Apply Move to Schedule</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

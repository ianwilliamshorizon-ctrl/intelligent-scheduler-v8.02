import React, { useState, useMemo } from 'react';
import { 
    AlertOctagon, 
    AlertTriangle, 
    Clock, 
    ArrowLeft, 
    CheckCircle2, 
    ArrowRight, 
    Warehouse, 
    UserX, 
    AlertCircle, 
    RotateCcw 
} from 'lucide-react';
import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';
import { findCapacityWarnings } from './capacityUtils';
import { CapacityWarning, WarningSeverity, WarningType } from './capacityTypes';

interface CapacityWarningsPanelProps {
    startDate: Date;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    users?: any[];
    onBackToWeekly: () => void;
    onJumpToDay: (dateStr: string) => void;
    onEditJob?: (jobId: string) => void;
}

export const CapacityWarningsPanel: React.FC<CapacityWarningsPanelProps> = ({
    startDate,
    jobs,
    lifts,
    engineers,
    absences,
    businessEntities,
    selectedEntityId,
    bankHolidays,
    users,
    onBackToWeekly,
    onJumpToDay,
    onEditJob
}) => {
    const [selectedType, setSelectedType] = useState<WarningType | 'all'>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<WarningSeverity | 'all'>('all');

    // Extract ONLY exceptions & risks across next 4 weeks
    const warnings = useMemo(() => {
        return findCapacityWarnings({
            startDate,
            daysToCheck: 28,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays,
            users
        });
    }, [startDate, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays, users]);

    // Filter warnings
    const filteredWarnings = useMemo(() => {
        return warnings.filter(w => {
            if (selectedType !== 'all' && w.type !== selectedType) return false;
            if (selectedSeverity !== 'all' && w.severity !== selectedSeverity) return false;
            return true;
        });
    }, [warnings, selectedType, selectedSeverity]);

    // Counts by type
    const countsByType = useMemo(() => {
        return {
            all: warnings.length,
            overbooked: warnings.filter(w => w.type === 'overbooked').length,
            unassigned_resources: warnings.filter(w => w.type === 'unassigned_resources').length,
            staff_shortage: warnings.filter(w => w.type === 'staff_shortage').length,
            gap_gt_3h: warnings.filter(w => w.type === 'gap_gt_3h').length
        };
    }, [warnings]);

    const renderSeverityBadge = (severity: WarningSeverity) => {
        switch (severity) {
            case 'critical':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                        <AlertOctagon size={12} className="stroke-[2.5]" />
                        <span>Critical</span>
                    </span>
                );
            case 'warning':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle size={12} className="stroke-[2.5]" />
                        <span>Warning</span>
                    </span>
                );
            case 'info':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
                        <Clock size={12} className="stroke-[2.5]" />
                        <span>Optimization</span>
                    </span>
                );
        }
    };

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onBackToWeekly}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Weekly</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <AlertOctagon size={20} className="text-red-600" />
                        <div>
                            <h2 className="text-base font-black text-slate-900 tracking-tight">
                                Workshop Exceptions &amp; Risk Monitor
                            </h2>
                            <p className="text-xs text-slate-500">
                                Only displaying active operational bottlenecks and scheduling risks
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                        warnings.length > 0 
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                        {warnings.length === 0 ? 'All Clear (0 Exceptions)' : `${warnings.length} Exceptions Require Attention`}
                    </span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm mb-5 flex flex-wrap items-center gap-2">
                {[
                    { key: 'all', label: 'All Exceptions', count: countsByType.all },
                    { key: 'overbooked', label: 'Overbooked Days', count: countsByType.overbooked },
                    { key: 'unassigned_resources', label: 'Missing Resources', count: countsByType.unassigned_resources },
                    { key: 'staff_shortage', label: 'Staff Shortages', count: countsByType.staff_shortage },
                    { key: 'gap_gt_3h', label: 'Idle Gaps >3h', count: countsByType.gap_gt_3h }
                ].map(({ key, label, count }) => (
                    <button
                        key={key}
                        onClick={() => setSelectedType(key as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                            selectedType === key
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                        }`}
                    >
                        <span>{label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            selectedType === key ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Exceptions Feed */}
            <div className="space-y-3">
                {filteredWarnings.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
                        <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                        <h3 className="text-base font-black text-slate-800">No Exceptions in this Category</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            The workshop allocation engine reports zero schedule conflicts or resource gaps for the selected criteria.
                        </p>
                    </div>
                ) : (
                    filteredWarnings.map(warning => (
                        <div
                            key={warning.id}
                            className={`p-4 bg-white rounded-2xl border shadow-sm transition hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                warning.severity === 'critical' 
                                    ? 'border-red-200/90 hover:border-red-400' 
                                    : warning.severity === 'warning' 
                                        ? 'border-amber-200/90 hover:border-amber-400' 
                                        : 'border-slate-200/90 hover:border-indigo-300'
                            }`}
                        >
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5">
                                    {renderSeverityBadge(warning.severity)}
                                </div>

                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-black text-slate-900 tracking-tight">
                                            {warning.title}
                                        </h4>
                                        <span className="text-xs font-semibold text-slate-400">
                                            • {warning.formattedDate}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-600 font-medium mt-1">
                                        {warning.message}
                                    </p>

                                    {warning.suggestedAction && (
                                        <p className="text-[11px] text-indigo-700 font-semibold mt-1.5 flex items-center gap-1">
                                            <span>Recommendation:</span>
                                            <span>{warning.suggestedAction}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                                {warning.jobId && onEditJob && (
                                    <button
                                        onClick={() => onEditJob(warning.jobId!)}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                    >
                                        Edit Job
                                    </button>
                                )}

                                <button
                                    onClick={() => onJumpToDay(warning.date)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                                >
                                    <span>Triage Day</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

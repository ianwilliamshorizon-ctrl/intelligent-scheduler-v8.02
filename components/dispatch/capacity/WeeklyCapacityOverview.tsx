import React, { useMemo } from 'react';
import { 
    Calendar, 
    Download, 
    Printer, 
    ChevronLeft, 
    ChevronRight, 
    Gauge, 
    CheckCircle2, 
    AlertTriangle, 
    AlertOctagon, 
    ArrowUpRight, 
    Building2,
    Clock,
    Warehouse,
    Sparkles,
    Plus,
    PhoneCall
} from 'lucide-react';
import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';
import { formatDate, addDays } from '../../../core/utils/dateUtils';
import { 
    calculateWeeklyCapacitySummary, 
    exportWeeklyCapacityCSV, 
    triggerPrintWeeklyDashboard 
} from './capacityUtils';
import { CapacityTrafficLight, DailyCapacitySummary } from './capacityTypes';

interface WeeklyCapacityOverviewProps {
    weekStart: Date;
    setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    onSelectDate: (dateStr: string) => void;
    onBookJobForDate?: (dateStr: string) => void;
    onGoToSpareSearch: () => void;
    onGoToWarnings: () => void;
    warningsCount: number;
}

export const WeeklyCapacityOverview: React.FC<WeeklyCapacityOverviewProps> = ({
    weekStart,
    setWeekStart,
    jobs,
    lifts,
    engineers,
    absences,
    businessEntities,
    selectedEntityId,
    bankHolidays,
    onSelectDate,
    onBookJobForDate,
    onGoToSpareSearch,
    onGoToWarnings,
    warningsCount
}) => {
    // Calculate weekly capacity summary
    const summary = useMemo(() => {
        return calculateWeeklyCapacitySummary({
            weekStart,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays
        });
    }, [weekStart, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays]);

    const handlePrevWeek = () => setWeekStart(prev => addDays(prev, -7));
    const handleNextWeek = () => setWeekStart(prev => addDays(prev, 7));
    const handleTodayWeek = () => {
        const today = new Date();
        const day = today.getUTCDay();
        const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
        const mon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), diff));
        setWeekStart(mon);
    };

    const handleExportCSV = () => {
        exportWeeklyCapacityCSV(summary);
    };

    const handleExportPDF = () => {
        triggerPrintWeeklyDashboard();
    };

    // Helper for traffic light visual tags
    const renderTrafficLightBadge = (status: CapacityTrafficLight, utilization: number) => {
        switch (status) {
            case 'plenty_spare':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                        <CheckCircle2 size={13} className="text-emerald-600 stroke-[2.5]" />
                        <span>PLENTY SPARE</span>
                        <span className="text-[10px] opacity-75 font-normal">({utilization}%)</span>
                    </span>
                );
            case 'getting_busy':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
                        <AlertTriangle size={13} className="text-amber-600 stroke-[2.5]" />
                        <span>GETTING BUSY</span>
                        <span className="text-[10px] opacity-75 font-normal">({utilization}%)</span>
                    </span>
                );
            case 'near_full':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-red-100 text-red-800 border border-red-300 shadow-sm animate-pulse">
                        <AlertOctagon size={13} className="text-red-600 stroke-[2.5]" />
                        <span>{utilization > 100 ? 'OVERBOOKED' : 'NEAR FULL'}</span>
                        <span className="text-[10px] opacity-75 font-normal">({utilization}%)</span>
                    </span>
                );
            case 'closed':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200">
                        <span>OFF / CLOSED</span>
                    </span>
                );
        }
    };

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Toolbar: Week Navigator & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                            onClick={handlePrevWeek}
                            className="p-2 hover:bg-white rounded-lg text-slate-700 transition shadow-none hover:shadow-sm"
                            title="Previous Week"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="px-3 py-1 text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-600" />
                            <span>Week of {summary.weekStartDate} — {summary.weekEndDate}</span>
                        </span>
                        <button
                            onClick={handleNextWeek}
                            className="p-2 hover:bg-white rounded-lg text-slate-700 transition shadow-none hover:shadow-sm"
                            title="Next Week"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleTodayWeek}
                        className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition"
                    >
                        Current Week
                    </button>

                    {warningsCount > 0 && (
                        <button
                            onClick={onGoToWarnings}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
                        >
                            <AlertOctagon size={14} className="text-red-600" />
                            <span>{warningsCount} Workshop Exceptions</span>
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={onGoToSpareSearch}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition"
                    >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>Find 4-Week Free Slots</span>
                    </button>

                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition"
                        title="Export capacity summary to CSV"
                    >
                        <Download size={14} className="text-slate-600" />
                        <span>Export CSV</span>
                    </button>

                    <button
                        onClick={handleExportPDF}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                        title="Print or Save as PDF"
                    >
                        <Printer size={14} />
                        <span>Print / PDF</span>
                    </button>
                </div>
            </div>

            {/* High-Level Weekly Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {/* Available Labour Hours */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Labour</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{summary.totalAvailableHours} hrs</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Across active technicians</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Clock size={24} />
                    </div>
                </div>

                {/* Booked Labour Hours */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hours Booked</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{summary.totalBookedHours} hrs</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{summary.averageUtilizationPercent}% of capacity committed</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Gauge size={24} />
                    </div>
                </div>

                {/* Single Key Metric: Net Spare Hours */}
                <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${
                    summary.totalSpareHours < 0 
                        ? 'bg-red-50/70 border-red-200' 
                        : summary.totalSpareHours < 20 
                            ? 'bg-amber-50/70 border-amber-200' 
                            : 'bg-emerald-50/70 border-emerald-200'
                }`}>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Spare Hours Remaining</p>
                        <p className={`text-2xl font-black mt-1 ${
                            summary.totalSpareHours < 0 
                                ? 'text-red-700' 
                                : summary.totalSpareHours < 20 
                                    ? 'text-amber-700' 
                                    : 'text-emerald-700'
                        }`}>
                            {summary.totalSpareHours > 0 ? `+${summary.totalSpareHours}` : summary.totalSpareHours} hrs
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                            {summary.totalSpareHours > 0 ? 'Capacity ready to sell' : 'Overbooking alert!'}
                        </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                        summary.totalSpareHours < 0 
                            ? 'bg-red-100 text-red-700' 
                            : summary.totalSpareHours < 20 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        <Sparkles size={24} />
                    </div>
                </div>

                {/* Empty Bays Summary */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Free Bays / Day</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{summary.averageEmptyBaysPerDay} Bays</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Physical ramp availability</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Warehouse size={24} />
                    </div>
                </div>
            </div>

            {/* Weekly Capacity Table: Strictly 7 columns, one row per day */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight">Weekly Capacity Planner</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Click any day row to dive into the bay & technician daily breakdown</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">7-Day Overview</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Day</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Available Labour</th>
                                <th className="py-3 px-4">Hours Booked</th>
                                <th className="py-3 px-4 text-center">Spare Hours Remaining</th>
                                <th className="py-3 px-4 text-center">Capacity Status</th>
                                <th className="py-3 px-4 text-center">Empty Bays Free</th>
                                <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {summary.days.map((day: DailyCapacitySummary) => {
                                const isClickable = day.availableHours > 0 || day.bookedHours > 0;
                                return (
                                    <tr 
                                        key={day.date}
                                        onClick={() => isClickable && onSelectDate(day.date)}
                                        className={`group transition-colors ${
                                            day.isWeekend 
                                                ? 'bg-slate-50/40 hover:bg-slate-100/60' 
                                                : 'hover:bg-indigo-50/40 cursor-pointer'
                                        }`}
                                    >
                                        {/* 1. Day Name */}
                                        <td className="py-3.5 px-4 font-bold text-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span>{day.dayName}</span>
                                                {day.isHoliday && (
                                                    <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                                                        {day.holidayName || 'Holiday'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 2. Date */}
                                        <td className="py-3.5 px-4 text-slate-500 text-xs font-semibold whitespace-nowrap">
                                            {day.formattedDate}
                                        </td>

                                        {/* 3. Available Labour */}
                                        <td className="py-3.5 px-4 text-slate-700 font-semibold">
                                            <div className="flex items-center gap-1.5">
                                                <span>{day.availableHours.toFixed(1)} hrs</span>
                                                {day.absentEngineersCount > 0 && (
                                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`${day.absentEngineersCount} tech(s) on approved leave`}>
                                                        -{day.absentEngineersCount} staff
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 4. Booked Labour */}
                                        <td className="py-3.5 px-4 text-slate-700 font-semibold">
                                            <div className="flex items-center gap-2">
                                                <span>{day.bookedHours.toFixed(1)} hrs</span>
                                                {day.jobsCount > 0 && (
                                                    <span className="text-[11px] text-slate-400 font-normal">
                                                        ({day.jobsCount} {day.jobsCount === 1 ? 'job' : 'jobs'})
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. Spare Hours (The Bold Focal Metric) */}
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-block px-3.5 py-1 rounded-xl text-sm font-black tracking-tight border ${
                                                day.spareHours < 0
                                                    ? 'bg-red-50 text-red-700 border-red-200 font-black'
                                                    : day.spareHours === 0 && day.availableHours === 0
                                                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                        : day.spareHours < 5
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                                {day.availableHours === 0 && day.bookedHours === 0 
                                                    ? '0.0 hrs (Closed)' 
                                                    : day.spareHours > 0 
                                                        ? `+${day.spareHours.toFixed(1)} hrs spare` 
                                                        : `${day.spareHours.toFixed(1)} hrs over`}
                                            </span>
                                        </td>

                                        {/* 6. Capacity Status (Traffic Light) */}
                                        <td className="py-3.5 px-4 text-center">
                                            {renderTrafficLightBadge(day.status, day.utilizationPercent)}
                                        </td>

                                        {/* 7. Empty Bays Free */}
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                                                day.emptyBaysCount === 0 && day.totalBaysCount > 0
                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    : day.emptyBaysCount === 1
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}>
                                                <Warehouse size={13} className="text-slate-400" />
                                                <span>
                                                    {day.emptyBaysCount} / {day.totalBaysCount} Free
                                                </span>
                                            </span>
                                        </td>

                                        {/* 8. Quick Book Action */}
                                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            {day.availableHours > 0 ? (
                                                <button
                                                    onClick={() => onBookJobForDate?.(day.date)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.96] text-white rounded-xl text-xs font-black shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                                    title={`Book job directly for ${day.dayName} (${day.formattedDate})`}
                                                >
                                                    <Plus size={13} strokeWidth={3} />
                                                    <span>Book Day</span>
                                                </button>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 font-semibold">Closed</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span className="font-semibold text-slate-600">Green</span>: &le; 75% load
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                            <span className="font-semibold text-slate-600">Amber</span>: 76% – 90% load
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                            <span className="font-semibold text-slate-600">Red</span>: &gt; 90% / Overbooked
                        </span>
                    </div>

                    <span className="italic text-[11px] text-slate-400">
                        Tip: Click on any day to open the detailed Bay &amp; Technician schedule
                    </span>
                </div>
            </div>
        </div>
    );
};

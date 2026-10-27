import React, { useMemo } from 'react';
import { 
    Calendar as CalendarIcon, 
    Download, 
    Printer, 
    ChevronLeft, 
    ChevronRight, 
    Gauge, 
    CheckCircle2, 
    AlertTriangle, 
    AlertOctagon, 
    Clock, 
    Warehouse, 
    Sparkles, 
    Users, 
    Plus, 
    GraduationCap, 
    Palmtree 
} from 'lucide-react';
import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';
import { formatDate, addDays, getRelativeDate } from '../../../core/utils/dateUtils';
import { 
    calculateMonthlyCapacitySummary, 
    exportMonthlyCapacityCSV, 
    triggerPrintWeeklyDashboard 
} from './capacityUtils';
import { CapacityTrafficLight, DailyCapacitySummary } from './capacityTypes';

interface MonthlyCapacityOverviewProps {
    monthDate: Date;
    onMonthChange: (offset: number) => void;
    onSelectDate: (dateStr: string) => void;
    onBookJobForDate?: (dateStr: string) => void;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    users?: any[];
    onGoToSpareSearch: () => void;
    onGoToWarnings: () => void;
    warningsCount: number;
}

export const MonthlyCapacityOverview: React.FC<MonthlyCapacityOverviewProps> = ({
    monthDate,
    onMonthChange,
    onSelectDate,
    onBookJobForDate,
    jobs,
    lifts,
    engineers,
    absences,
    businessEntities,
    selectedEntityId,
    bankHolidays,
    users = [],
    onGoToSpareSearch,
    onGoToWarnings,
    warningsCount
}) => {
    // Calculate full monthly capacity summary strictly based on technicians
    const summary = useMemo(() => {
        return calculateMonthlyCapacitySummary({
            monthDate,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays,
            users
        });
    }, [monthDate, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays, users]);

    const handlePrevMonth = () => onMonthChange(-1);
    const handleNextMonth = () => onMonthChange(1);
    const handleTodayMonth = () => {
        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const currentMonth = today.getUTCMonth();
        const diffMonths = (currentYear - monthDate.getUTCFullYear()) * 12 + (currentMonth - monthDate.getUTCMonth());
        if (diffMonths !== 0) onMonthChange(diffMonths);
    };

    const handleExportCSV = () => {
        exportMonthlyCapacityCSV(summary);
    };

    const handleExportPDF = () => {
        triggerPrintWeeklyDashboard();
    };

    // Calculate Monday-first offset for grid alignment
    const firstDayOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const leadingEmptyCellsCount = (firstDayOfMonth.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
    const todayStr = getRelativeDate(0);

    const renderTrafficLightBadge = (status: CapacityTrafficLight, utilization: number) => {
        switch (status) {
            case 'plenty_spare':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={11} className="text-emerald-600 stroke-[2.5]" />
                        <span>SPARE ({utilization}%)</span>
                    </span>
                );
            case 'getting_busy':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle size={11} className="text-amber-600 stroke-[2.5]" />
                        <span>BUSY ({utilization}%)</span>
                    </span>
                );
            case 'near_full':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-red-100 text-red-800 border border-red-300">
                        <AlertOctagon size={11} className="text-red-600 stroke-[2.5]" />
                        <span>{utilization > 100 ? 'OVERBOOKED' : 'FULL'} ({utilization}%)</span>
                    </span>
                );
            case 'closed':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200">
                        <span>CLOSED</span>
                    </span>
                );
        }
    };

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Toolbar: Month Navigator & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 hover:bg-white rounded-lg text-slate-700 transition shadow-none hover:shadow-sm cursor-pointer"
                            title="Previous Month"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="px-3 py-1 text-sm font-bold text-slate-800 flex items-center gap-2">
                            <CalendarIcon size={16} className="text-indigo-600" />
                            <span>{summary.monthName}</span>
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 hover:bg-white rounded-lg text-slate-700 transition shadow-none hover:shadow-sm cursor-pointer"
                            title="Next Month"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleTodayMonth}
                        className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition cursor-pointer"
                    >
                        Current Month
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition cursor-pointer"
                    >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>Find 4-Week Free Slots</span>
                    </button>

                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition cursor-pointer"
                        title="Export monthly capacity summary to CSV"
                    >
                        <Download size={14} className="text-slate-600" />
                        <span>Export CSV</span>
                    </button>

                    <button
                        onClick={handleExportPDF}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition cursor-pointer"
                        title="Print or Save as PDF"
                    >
                        <Printer size={14} />
                        <span>Print / PDF</span>
                    </button>
                </div>
            </div>

            {/* High-Level Monthly Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {/* Available Labour Hours */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Labour</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{summary.totalAvailableHours} hrs</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Based strictly on active technicians</p>
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

                {/* Net Spare Hours Remaining */}
                <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${
                    summary.totalSpareHours < 0 
                        ? 'bg-red-50/70 border-red-200' 
                        : summary.totalSpareHours < 50 
                            ? 'bg-amber-50/70 border-amber-200' 
                            : 'bg-emerald-50/70 border-emerald-200'
                }`}>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Spare Labour to Sell</p>
                        <p className={`text-2xl font-black mt-1 ${
                            summary.totalSpareHours < 0 
                                ? 'text-red-700' 
                                : summary.totalSpareHours < 50 
                                    ? 'text-amber-700' 
                                    : 'text-emerald-700'
                        }`}>
                            {summary.totalSpareHours > 0 ? `+${summary.totalSpareHours}` : summary.totalSpareHours} hrs
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                            {summary.totalSpareHours > 0 ? 'Month ready for intake' : 'Overbooking alert!'}
                        </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                        summary.totalSpareHours < 0 
                            ? 'bg-red-100 text-red-700' 
                            : summary.totalSpareHours < 50 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        <Sparkles size={24} />
                    </div>
                </div>

                {/* Staffing & Absences (Holiday / Training) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Technicians &amp; Leave</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{summary.activeTechsCount} Techs</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {summary.totalHolidayDays > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold">
                                    <Palmtree size={11} /> {summary.totalHolidayDays}d holiday
                                </span>
                            )}
                            {summary.totalTrainingDays > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-indigo-600 font-bold">
                                    <GraduationCap size={11} /> {summary.totalTrainingDays}d training
                                </span>
                            )}
                            {summary.totalHolidayDays === 0 && summary.totalTrainingDays === 0 && (
                                <span>No leave booked</span>
                            )}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Users size={24} />
                    </div>
                </div>
            </div>

            {/* Monthly Calendar Grid: 7 columns (Mon to Sun) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col flex-grow">
                {/* Header Row: Days of Week */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-center text-xs font-black text-slate-600 uppercase tracking-wider py-2.5">
                    <div>Monday</div>
                    <div>Tuesday</div>
                    <div>Wednesday</div>
                    <div>Thursday</div>
                    <div>Friday</div>
                    <div>Saturday</div>
                    <div>Sunday</div>
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 flex-grow bg-slate-100/30">
                    {/* Leading empty placeholder cells */}
                    {Array.from({ length: leadingEmptyCellsCount }).map((_, index) => (
                        <div key={`empty-lead-${index}`} className="bg-slate-50/50 p-2 min-h-[110px]" />
                    ))}

                    {/* Active Month Days */}
                    {summary.days.map((day: DailyCapacitySummary) => {
                        const isToday = day.date === todayStr;
                        const isClickable = day.availableHours > 0 || day.bookedHours > 0;
                        const hasAbsences = (day.holidayEngineersCount || 0) > 0 || (day.trainingEngineersCount || 0) > 0;

                        return (
                            <div
                                key={day.date}
                                onClick={() => isClickable && onSelectDate(day.date)}
                                className={`group p-2.5 min-h-[115px] flex flex-col justify-between transition-all relative ${
                                    day.isWeekend 
                                        ? 'bg-slate-50/60 hover:bg-slate-100/80' 
                                        : 'bg-white hover:bg-indigo-50/40'
                                } ${isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20' : ''} ${
                                    isClickable ? 'cursor-pointer' : ''
                                }`}
                            >
                                {/* Top: Day Number & Holiday / Today Badge */}
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${isToday ? 'text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-md' : 'text-slate-800'}`}>
                                            {day.date.split('-')[2]}
                                        </span>
                                        {day.isHoliday && (
                                            <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full truncate max-w-[80px]" title={day.holidayName}>
                                                {day.holidayName || 'Holiday'}
                                            </span>
                                        )}
                                    </div>
                                    {renderTrafficLightBadge(day.status, day.utilizationPercent)}
                                </div>

                                {/* Middle: Technician Staffing line & Holiday/Training flags */}
                                <div className="space-y-1 mb-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                        <span className="flex items-center gap-1 text-slate-500">
                                            <Users size={11} className="text-slate-400" />
                                            <span>{day.activeEngineersCount}/{day.totalEngineersCount} Techs</span>
                                        </span>
                                        {day.availableHours > 0 && (
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                {day.bookedHours}h / {day.availableHours}h
                                            </span>
                                        )}
                                    </div>

                                    {/* Absence details flags */}
                                    {hasAbsences && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {day.holidayEngineersCount! > 0 && (
                                                <span 
                                                    className="inline-flex items-center gap-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 px-1 rounded"
                                                    title={day.absentEngineersDetails?.map(d => `${d.engineerName} (${d.type})`).join(', ')}
                                                >
                                                    <Palmtree size={10} /> -{day.holidayEngineersCount} Holiday
                                                </span>
                                            )}
                                            {day.trainingEngineersCount! > 0 && (
                                                <span 
                                                    className="inline-flex items-center gap-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 rounded"
                                                    title={day.absentEngineersDetails?.map(d => `${d.engineerName} (${d.type})`).join(', ')}
                                                >
                                                    <GraduationCap size={10} /> -{day.trainingEngineersCount} Training
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Progress meter */}
                                    {day.availableHours > 0 && (
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${
                                                    day.utilizationPercent > 90 ? 'bg-red-500' : day.utilizationPercent >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${Math.min(100, day.utilizationPercent)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Bottom: Spare Hours Focal Badge & 1-Click Book */}
                                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100/80">
                                    <span className={`text-[11px] font-black tracking-tight ${
                                        day.spareHours < 0 
                                            ? 'text-red-700 font-black' 
                                            : day.spareHours === 0 && day.availableHours === 0
                                                ? 'text-slate-400'
                                                : day.spareHours < 5 
                                                    ? 'text-amber-700' 
                                                    : 'text-emerald-700'
                                    }`}>
                                        {day.availableHours === 0 
                                            ? 'Closed' 
                                            : day.spareHours > 0 
                                                ? `+${day.spareHours}h free` 
                                                : `${day.spareHours}h over`}
                                    </span>

                                    {day.availableHours > 0 && onBookJobForDate && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onBookJobForDate(day.date);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-md text-[10px] font-black cursor-pointer shadow-2xs"
                                            title={`Book job directly for ${day.formattedDate}`}
                                        >
                                            <Plus size={11} strokeWidth={3} />
                                            <span>Book</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Guide & Legend */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span className="font-semibold text-slate-600">Green</span>: &le; 70% load (Plenty spare)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                            <span className="font-semibold text-slate-600">Amber</span>: 70% – 89% load (Getting busy)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                            <span className="font-semibold text-slate-600">Red</span>: &ge; 90% load / Overbooked
                        </span>
                    </div>

                    <span className="italic text-[11px] text-slate-500 text-center sm:text-right">
                        Labour capacity is strictly limited by available technicians (accounting for holidays and training). It is not based on lifts.
                    </span>
                </div>
            </div>
        </div>
    );
};

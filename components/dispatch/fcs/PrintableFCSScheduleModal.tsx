import React, { useState, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, Calendar, Wrench, Layers, Clock, CheckCircle, FileText, User, ChevronLeft, ChevronRight, Sparkles, Filter } from 'lucide-react';
import { calculateFCSMatrix, FCSMatrixResult } from '../../../core/services/fcsSchedulingEngine';
import { Lift, Engineer, Job, Vehicle, Customer, PurchaseOrder, BusinessEntity, FCSGanttBlock } from '../../../types';
import { formatDate, addDays, getTodayISOString, addDaysToDateStr } from '../../../core/utils/dateUtils';
import { ENGINEER_COLOR_PALETTES } from './ResourceGanttView';

interface PrintableFCSScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    matrix?: FCSMatrixResult;
    startDateStr: string;
    windowDays: number;
    businessEntity?: BusinessEntity | null;
    ramps: Lift[];
    engineers: Engineer[];
    jobs: Job[];
    purchaseOrders?: PurchaseOrder[];
    vehicles: Vehicle[];
    customers: Customer[];
}

interface WeekScheduleSegment {
    weekIndex: number;
    weekNumber: number;
    startDateStr: string;
    endDateStr: string;
    timelineDays: {
        dateStr: string;
        dayName: string;
        dayNum: number;
        month: string;
        isToday: boolean;
    }[];
    matrix: FCSMatrixResult;
}

export const PrintableFCSScheduleModal: React.FC<PrintableFCSScheduleModalProps> = ({
    isOpen,
    onClose,
    startDateStr,
    windowDays,
    businessEntity,
    ramps,
    engineers,
    jobs,
    purchaseOrders = [],
    vehicles,
    customers
}) => {
    const printComponentRef = useRef<HTMLDivElement>(null);

    // Number of 7-day weeks to partition the schedule into
    const defaultNumWeeks = Math.max(1, Math.ceil(windowDays / 7));
    const [selectedWeekMode, setSelectedWeekMode] = useState<'all' | number>('all');
    const [showVisualGantt, setShowVisualGantt] = useState<boolean>(true);
    const [showDetailedTable, setShowDetailedTable] = useState<boolean>(true);
    const [totalWeeksToGenerate, setTotalWeeksToGenerate] = useState<number>(defaultNumWeeks);

    // Helper to get engineer theme
    const getEngTheme = (engId: string) => {
        const engIndex = engineers.findIndex(e => e.id === engId);
        const paletteIndex = engIndex >= 0 ? engIndex % ENGINEER_COLOR_PALETTES.length : 0;
        return ENGINEER_COLOR_PALETTES[paletteIndex] || ENGINEER_COLOR_PALETTES[0];
    };

    // Usable ramps
    const usableRamps = useMemo(() => {
        const active = ramps.filter(r => r.type !== 'Virtual' && !r.name.toLowerCase().includes('storage'));
        return active.length > 0 ? active : ramps;
    }, [ramps]);

    // Compute weekly 7-day segments
    const weeklySegments: WeekScheduleSegment[] = useMemo(() => {
        const segments: WeekScheduleSegment[] = [];
        const todayStr = getTodayISOString();

        for (let w = 0; w < totalWeeksToGenerate; w++) {
            const weekStartStr = addDaysToDateStr(startDateStr, w * 7);
            const weekEndStr = addDaysToDateStr(weekStartStr, 6);

            const timelineDays = Array.from({ length: 7 }).map((_, i) => {
                const dayStr = addDaysToDateStr(weekStartStr, i);
                const d = new Date(dayStr + 'T12:00:00'); // noon to avoid DST edge issues in display
                return {
                    dateStr: dayStr,
                    dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                    dayNum: d.getDate(),
                    month: d.toLocaleDateString('en-GB', { month: 'short' }),
                    isToday: dayStr === todayStr
                };
            });

            // Filter jobs to only those relevant to this week's window.
            // Include jobs that are:
            // 1. Actively on a ramp (In Progress, Allocated, Booked In) — always show
            // 2. Have a scheduledDate or segment date that overlaps this week
            const weekEndPlusOneStr = addDaysToDateStr(weekStartStr, 7); // exclusive upper bound
            const weekJobs = jobs.filter(j => {
                // Always include active/in-progress work
                if (j.status === 'In Progress' || j.status === 'Allocated' || j.status === 'Booked In') {
                    // Check if scheduled date overlaps this week, or no date (show in first week)
                    const jDate = j.scheduledDate || (j.segments?.[0]?.date);
                    if (!jDate) return w === 0; // no date = show in first week only
                    // Job starts before week end AND job isn't far past (allow overlap)
                    const estEndDate = addDaysToDateStr(jDate, Math.max(1, Math.ceil((j.estimatedHours || 8) / 8)));
                    return jDate < weekEndPlusOneStr && estEndDate > weekStartStr;
                }
                // For scheduled/queued work, check date overlap
                const jDate = j.scheduledDate || (j.segments?.[0]?.date);
                if (!jDate) return false; // unscheduled jobs don't appear in print
                const estDays = Math.max(1, Math.ceil((j.estimatedHours || (j.segments || []).reduce((a, s) => a + (s.duration || 0), 0) || 2) / 8));
                const estEndDate = addDaysToDateStr(jDate, estDays);
                // Job overlaps this week if it starts before week end AND ends after week start
                return jDate < weekEndPlusOneStr && estEndDate > weekStartStr;
            });

            const weekMatrix = calculateFCSMatrix({
                jobs: weekJobs,
                ramps: usableRamps,
                engineers,
                purchaseOrders,
                vehicles,
                windowDays: 7,
                startDateStr: weekStartStr,
                includeScheduledUnallocated: true
            });

            segments.push({
                weekIndex: w,
                weekNumber: w + 1,
                startDateStr: weekStartStr,
                endDateStr: weekEndStr,
                timelineDays,
                matrix: weekMatrix
            });
        }

        return segments;
    }, [startDateStr, totalWeeksToGenerate, jobs, usableRamps, engineers, purchaseOrders, vehicles]);

    // Segments to display based on user selection (All weeks or Single week)
    const activeSegmentsToPrint = useMemo(() => {
        if (selectedWeekMode === 'all') {
            return weeklySegments;
        }
        return weeklySegments.filter(s => s.weekIndex === selectedWeekMode);
    }, [selectedWeekMode, weeklySegments]);

    const workshopName = businessEntity?.name || 'All Workshops Combined';

    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `FCS_Gantt_7Day_${(businessEntity?.name || 'Workshop').replace(/\s+/g, '_')}_${startDateStr}`
    });

    if (!isOpen) return null;

    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));
    const customersMap = new Map(customers.map(c => [c.id, c]));
    const jobsMap = new Map(jobs.map(j => [j.id, j]));

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
                {/* Modal Global Header */}
                <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-b border-indigo-900/50 flex flex-wrap items-center justify-between text-white shrink-0 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl">
                            <Printer size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Weekly Gantt Review Engine</span>
                                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold">
                                    7-Day Paginated Print
                                </span>
                            </div>
                            <h3 className="text-base font-black tracking-tight text-white">
                                {workshopName} — Finite Capacity Schedule (FCS)
                            </h3>
                        </div>
                    </div>

                    {/* Print Options Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Week Selection Dropdown */}
                        <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs">
                            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Print:</span>
                            <button
                                type="button"
                                onClick={() => setSelectedWeekMode('all')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                                    selectedWeekMode === 'all'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                All Weeks ({weeklySegments.length})
                            </button>
                            {weeklySegments.map((seg) => (
                                <button
                                    key={seg.weekIndex}
                                    type="button"
                                    onClick={() => setSelectedWeekMode(seg.weekIndex)}
                                    className={`px-2 py-1 rounded-lg font-bold text-xs transition-all ${
                                        selectedWeekMode === seg.weekIndex
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                    title={`${seg.startDateStr} to ${seg.endDateStr}`}
                                >
                                    Wk {seg.weekNumber}
                                </button>
                            ))}
                        </div>

                        {/* Weeks Count Stepper */}
                        <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-300 gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Horizon:</span>
                            {[1, 2, 4, 8].map(wCount => (
                                <button
                                    key={wCount}
                                    type="button"
                                    onClick={() => {
                                        setTotalWeeksToGenerate(wCount);
                                        if (typeof selectedWeekMode === 'number' && selectedWeekMode >= wCount) {
                                            setSelectedWeekMode(0);
                                        }
                                    }}
                                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${totalWeeksToGenerate === wCount ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {wCount * 7}d
                                </button>
                            ))}
                        </div>

                        {/* Visual Gantt Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowVisualGantt(prev => !prev)}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                showVisualGantt
                                    ? 'bg-indigo-600/60 border-indigo-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                            title="Toggle visual 7-day Gantt timeline chart in print"
                        >
                            Gantt Chart {showVisualGantt ? '✓' : ''}
                        </button>

                        {/* Detailed Table Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowDetailedTable(prev => !prev)}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                showDetailedTable
                                    ? 'bg-indigo-600/60 border-indigo-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                            title="Toggle technician timetable and job allocation tables"
                        >
                            Table View {showDetailedTable ? '✓' : ''}
                        </button>

                        {/* Trigger Print Button */}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-indigo-500/30 transition-all cursor-pointer active:scale-95"
                        >
                            <Printer size={15} />
                            <span>Print / PDF</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area with Preview */}
                <div className="p-6 overflow-y-auto flex-grow bg-slate-100/70">
                    <div
                        ref={printComponentRef}
                        className="space-y-8 max-w-5xl mx-auto print:space-y-0 print:p-0 print:m-0 print:max-w-none"
                    >
                        {/* Print Media Specific CSS */}
                        <style dangerouslySetInnerHTML={{ __html: `
                            @media print {
                                @page {
                                    size: landscape;
                                    margin: 8mm 10mm;
                                }
                                body {
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                }
                                .fcs-print-page {
                                    page-break-after: always !important;
                                    break-after: page !important;
                                    margin-bottom: 0 !important;
                                    padding: 0 !important;
                                    background: white !important;
                                }
                                .fcs-print-page:last-child {
                                    page-break-after: avoid !important;
                                    break-after: avoid !important;
                                }
                            }
                        `}} />

                        {activeSegmentsToPrint.map((seg, segIdx) => {
                            const segMatrix = seg.matrix;
                            const allRampBlocks = segMatrix.rampRows.flatMap(r => r.blocks);
                            const totalJobsThisWeek = new Set(allRampBlocks.map(b => b.jobId)).size;

                            return (
                                <div
                                    key={seg.weekIndex}
                                    className="fcs-print-page bg-white p-7 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-5 print:rounded-none print:border-none print:shadow-none print:p-4"
                                >
                                    {/* 7-Day Header */}
                                    <div className="border-b-2 border-slate-800 pb-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                                    <span>BROOKSPEED MOTORSPORT & WORKSHOP</span>
                                                    <span>&bull;</span>
                                                    <span>FCS 7-DAY REVIEW</span>
                                                </div>
                                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                                                    <span>Week {seg.weekNumber} Schedule: {seg.startDateStr} &rarr; {seg.endDateStr}</span>
                                                    <span className="text-xs bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-2 py-0.5 rounded-full">
                                                        {totalJobsThisWeek} Jobs Scheduled
                                                    </span>
                                                </h1>
                                                <p className="text-xs font-bold text-slate-600 mt-0.5">
                                                    Department / Workshop: <span className="text-slate-900 font-black">{workshopName}</span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] uppercase font-bold text-slate-500">Review Horizon</div>
                                                <div className="text-xs font-black text-slate-900">
                                                    7-Day Finite Capacity Review
                                                </div>
                                                <div className="text-[9px] text-slate-400 mt-0.5">
                                                    Printed: {formatDate(new Date())} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weekly 4-Metric KPI Bar */}
                                        <div className="grid grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-200">
                                            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                                                <span className="text-[8px] font-black uppercase text-slate-500 block">Total Workshop Backlog</span>
                                                <span className="text-xs font-black text-slate-900">{segMatrix.metrics.totalBacklogHours}h ({segMatrix.metrics.totalBacklogDays}d)</span>
                                            </div>
                                            <div className="bg-indigo-50/70 border border-indigo-200 px-3 py-1.5 rounded-lg">
                                                <span className="text-[8px] font-black uppercase text-indigo-700 block">7-Day Wrench Hours</span>
                                                <span className="text-xs font-black text-indigo-950">{segMatrix.metrics.activeWrenchHours} Hours Allocated</span>
                                            </div>
                                            <div className="bg-blue-50/70 border border-blue-200 px-3 py-1.5 rounded-lg">
                                                <span className="text-[8px] font-black uppercase text-blue-700 block">Ramp Space Utilization</span>
                                                <span className={`text-xs font-black ${segMatrix.metrics.rampUtilizationPercent >= 85 ? 'text-rose-700' : 'text-blue-950'}`}>
                                                    {segMatrix.metrics.rampUtilizationPercent}%
                                                </span>
                                            </div>
                                            <div className="bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 rounded-lg">
                                                <span className="text-[8px] font-black uppercase text-emerald-700 block">Active Technicians</span>
                                                <span className="text-xs font-black text-emerald-950">{segMatrix.engineerRows.length} Assigned</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ======================================================= */}
                                    {/* VISUAL 7-DAY GANTT SCHEDULE CANVAS                     */}
                                    {/* ======================================================= */}
                                    {showVisualGantt && (
                                        <div className="space-y-3.5 border border-slate-300 rounded-xl p-3 bg-slate-50/50">
                                            {/* 7-Day Timeline Column Header */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-36 shrink-0 text-[10px] font-black uppercase text-slate-600 px-2">
                                                    Resource / Bay
                                                </div>
                                                <div className="flex-grow grid grid-cols-7 gap-1">
                                                    {seg.timelineDays.map(td => (
                                                        <div
                                                            key={td.dateStr}
                                                            className={`text-center py-1 rounded border text-[10px] leading-tight ${
                                                                td.isToday
                                                                    ? 'bg-indigo-600 text-white font-black border-indigo-700'
                                                                    : 'bg-white text-slate-700 font-bold border-slate-200'
                                                            }`}
                                                        >
                                                            <span className="block uppercase text-[8px] font-black opacity-80">{td.dayName}</span>
                                                            <span className="text-[11px] font-black">{td.dayNum} {td.month}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* TOP SECTION: RAMP OCCUPANCY ROWS */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-900 border-b border-blue-200 pb-1">
                                                    <Layers size={11} className="text-blue-600" />
                                                    <span>Physical Space: Workshop Ramps & Bays</span>
                                                </div>

                                                {segMatrix.rampRows.map(row => (
                                                    <div key={row.ramp.id} className="flex items-center gap-2">
                                                        <div className="w-36 shrink-0 bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-2xs">
                                                            <span className="font-black text-[11px] text-slate-900 block truncate">{row.ramp.name}</span>
                                                            <span className="text-[8px] text-slate-500 font-semibold">{row.blocks.length} job(s)</span>
                                                        </div>

                                                        {/* 7-Day Track */}
                                                        <div className="relative flex-grow h-10 bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                            {/* Grid Lines */}
                                                            <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                                                {seg.timelineDays.map(td => (
                                                                    <div key={td.dateStr} className={`border-r border-slate-100 ${td.isToday ? 'bg-indigo-50/30' : ''}`} />
                                                                ))}
                                                            </div>

                                                            {/* Blocks */}
                                                            {row.blocks.map(block => {
                                                                const isDeadWeight = block.isDeadWeight;
                                                                const isSchedUnalloc = block.isScheduledUnallocated;

                                                                return (
                                                                    <div
                                                                        key={block.id}
                                                                        style={{
                                                                            left: `${Math.max(0, Math.min(98, block.startPercent))}%`,
                                                                            width: `${Math.max(4, Math.min(100 - block.startPercent, block.durationPercent))}%`
                                                                        }}
                                                                        className={`absolute top-1 bottom-1 rounded px-1.5 py-0.5 flex flex-col justify-center text-[9px] font-bold overflow-hidden shadow-2xs ${
                                                                            isDeadWeight
                                                                                ? 'bg-amber-200 border border-amber-600 text-amber-950'
                                                                                : isSchedUnalloc
                                                                                    ? 'bg-amber-100 border border-dashed border-amber-500 text-amber-900'
                                                                                    : 'bg-slate-900 text-white border border-slate-700'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between font-mono font-black leading-none truncate">
                                                                            <span className="truncate">{block.vehicleRegistration || `#${block.jobId}`}</span>
                                                                            <span className="text-[8px] bg-black/20 px-1 rounded">{block.hours}h</span>
                                                                        </div>
                                                                        <div className="truncate text-[8px] opacity-90 leading-tight">
                                                                            {block.title}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* BOTTOM SECTION: TECHNICIAN WRENCH ROWS */}
                                            <div className="space-y-1.5 pt-2 border-t border-slate-200">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-indigo-900 border-b border-indigo-200 pb-1">
                                                    <Wrench size={11} className="text-indigo-600" />
                                                    <span>Workforce Capacity: Technician Wrench Time</span>
                                                </div>

                                                {segMatrix.engineerRows.map(row => {
                                                    const engTheme = getEngTheme(row.engineer.id);

                                                    return (
                                                        <div key={row.engineer.id} className="flex items-center gap-2">
                                                            <div className="w-36 shrink-0 bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-2xs">
                                                                <span className="font-black text-[11px] text-slate-900 block truncate">{row.engineer.name}</span>
                                                                <span className="text-[8px] text-slate-500 font-semibold">{row.blocks.length} task(s)</span>
                                                            </div>

                                                            {/* 7-Day Track */}
                                                            <div className="relative flex-grow h-10 bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                                {/* Grid Lines */}
                                                                <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                                                    {seg.timelineDays.map(td => (
                                                                        <div key={td.dateStr} className={`border-r border-slate-100 ${td.isToday ? 'bg-indigo-50/30' : ''}`} />
                                                                    ))}
                                                                </div>

                                                                {/* Blocks */}
                                                                {row.blocks.map(block => {
                                                                    const isSchedUnalloc = block.isScheduledUnallocated;

                                                                    return (
                                                                        <div
                                                                            key={block.id}
                                                                            style={{
                                                                            left: `${Math.max(0, Math.min(98, block.startPercent))}%`,
                                                                            width: `${Math.max(4, Math.min(100 - block.startPercent, block.durationPercent))}%`,
                                                                                backgroundColor: isSchedUnalloc ? '#fef3c7' : engTheme.hex,
                                                                                borderColor: isSchedUnalloc ? '#d97706' : engTheme.border,
                                                                                borderStyle: isSchedUnalloc ? 'dashed' : 'solid',
                                                                                borderWidth: '1px',
                                                                                color: isSchedUnalloc ? '#92400e' : '#ffffff'
                                                                            }}
                                                                            className="absolute top-1 bottom-1 rounded px-1.5 py-0.5 flex flex-col justify-center text-[9px] font-bold overflow-hidden shadow-2xs"
                                                                        >
                                                                            <div className="flex items-center justify-between font-mono font-black leading-none truncate">
                                                                                <span className="truncate">{block.vehicleRegistration || `#${block.jobId}`}</span>
                                                                                <span className="text-[8px] bg-black/25 px-1 rounded">{block.hours}h</span>
                                                                            </div>
                                                                            <div className="truncate text-[8px] opacity-90 leading-tight">
                                                                                {block.title}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ======================================================= */}
                                    {/* DETAILED TECHNICIAN ALLOCATION TABLE                   */}
                                    {/* ======================================================= */}
                                    {showDetailedTable && (
                                        <div className="space-y-2 pt-2">
                                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center justify-between border-b pb-1">
                                                <span className="flex items-center gap-1.5">
                                                    <FileText size={12} className="text-slate-600" />
                                                    <span>Week {seg.weekNumber} Scheduled Jobs Breakdown</span>
                                                </span>
                                                <span className="text-[9px] text-slate-500 font-bold">
                                                    {seg.startDateStr} to {seg.endDateStr}
                                                </span>
                                            </h2>

                                            {allRampBlocks.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-slate-200">
                                                    No jobs scheduled within this 7-day week.
                                                </div>
                                            ) : (
                                                <table className="w-full text-left text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                                                    <thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-600 border-b">
                                                        <tr>
                                                            <th className="py-1.5 px-2.5">Date</th>
                                                            <th className="py-1.5 px-2.5">Reg (VRM)</th>
                                                            <th className="py-1.5 px-2.5">Job / Description</th>
                                                            <th className="py-1.5 px-2.5">Assigned Tech</th>
                                                            <th className="py-1.5 px-2.5">Ramp / Bay</th>
                                                            <th className="py-1.5 px-2.5 text-right">Hours</th>
                                                            <th className="py-1.5 px-2.5 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {allRampBlocks
                                                            .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
                                                            .map(block => {
                                                                const job = jobsMap.get(block.jobId);
                                                                const cust = job?.customerId ? customersMap.get(job.customerId) : undefined;

                                                                return (
                                                                    <tr key={block.id} className="hover:bg-slate-50/50">
                                                                        <td className="py-1.5 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                                                                            {block.startDate}
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5 font-mono font-black text-slate-900 uppercase whitespace-nowrap">
                                                                            {block.vehicleRegistration || '—'}
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5">
                                                                            <div className="font-bold text-slate-900 truncate max-w-xs" title={block.title}>
                                                                                {block.title}
                                                                            </div>
                                                                            {cust && (
                                                                                <div className="text-[9px] text-slate-500 truncate">
                                                                                    {cust.companyName || `${cust.forename || ''} ${cust.surname || ''}`.trim()}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                                                                            {block.engineerName || 'Unassigned'}
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                                                            {block.resourceName}
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                                                                            {block.hours}h
                                                                        </td>
                                                                        <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                                                                                block.isScheduledUnallocated
                                                                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                                                            }`}>
                                                                                {block.isScheduledUnallocated ? 'Scheduled' : 'Allocated'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}

                                    {/* Sign-off Block on each Weekly Review Page */}
                                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                                        <div>
                                            <span className="font-bold">Workshop Controller: ___________________________</span>
                                        </div>
                                        <div>
                                            <span className="font-bold">Sign-off / Review Date: ___________________________</span>
                                        </div>
                                        <div className="font-bold text-slate-400">
                                            Page {segIdx + 1} of {activeSegmentsToPrint.length} (Week {seg.weekNumber})
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between shrink-0 gap-3">
                    <span className="text-xs text-slate-500 font-medium">
                        Printing {activeSegmentsToPrint.length} week(s) &bull; A4 Landscape &bull; 7 Days per review sheet
                    </span>
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
                            onClick={handlePrint}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                            <Printer size={15} />
                            <span>Print {activeSegmentsToPrint.length} 7-Day Review {activeSegmentsToPrint.length === 1 ? 'Sheet' : 'Sheets'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

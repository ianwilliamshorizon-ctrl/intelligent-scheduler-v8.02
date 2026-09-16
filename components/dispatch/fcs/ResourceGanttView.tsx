import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job, Lift, Engineer, PurchaseOrder, Vehicle, Customer, User, FCSGanttBlock, FCSDependencyLink } from '../../../types';
import { calculateFCSMatrix, FCSMatrixResult } from '../../../core/services/fcsSchedulingEngine';
import { ServiceAdvisorBookingBufferModal } from './ServiceAdvisorBookingBufferModal';
import { Sparkles, Wrench, Layers, AlertTriangle, CheckCircle, Clock, Calendar, Users, RefreshCw, Plus, ChevronLeft, ChevronRight, Activity, ArrowRight, Zap, Info } from 'lucide-react';
import { getRelativeDate, addDays, formatDate } from '../../../core/utils/dateUtils';

interface ResourceGanttViewProps {
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    vehicles: Vehicle[];
    customers: Customer[];
    currentUser: User;
    onEditJob: (jobId: string, initialTab?: string) => void;
    onSaveJob: (job: Partial<Job>) => void;
}

export const ResourceGanttView: React.FC<ResourceGanttViewProps> = ({
    jobs,
    ramps,
    engineers,
    purchaseOrders,
    vehicles,
    customers,
    currentUser,
    onEditJob,
    onSaveJob
}) => {
    const [windowDays, setWindowDays] = useState<number>(7);
    const [simulateExtraEngineers, setSimulateExtraEngineers] = useState<number>(0);
    const [isBufferModalOpen, setIsBufferModalOpen] = useState<boolean>(false);
    const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [startDateOffset, setStartDateOffset] = useState<number>(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const [blockPositions, setBlockPositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

    const startDateStr = useMemo(() => {
        return getRelativeDate(startDateOffset);
    }, [startDateOffset]);

    // Timeline column headers
    const timelineDays = useMemo(() => {
        const start = new Date(startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00`);
        return Array.from({ length: windowDays }).map((_, i) => {
            const d = addDays(start, i);
            return {
                dateStr: formatDate(d),
                dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                dayNum: d.getDate(),
                month: d.toLocaleDateString('en-GB', { month: 'short' }),
                isToday: formatDate(d) === getRelativeDate(0)
            };
        });
    }, [startDateStr, windowDays]);

    // Calculate FCS matrix
    const matrix: FCSMatrixResult = useMemo(() => {
        return calculateFCSMatrix({
            jobs,
            ramps,
            engineers,
            purchaseOrders,
            vehicles,
            windowDays,
            startDateStr,
            simulateExtraEngineers
        });
    }, [jobs, ramps, engineers, purchaseOrders, vehicles, windowDays, startDateStr, simulateExtraEngineers]);

    // Register block DOM positions for SVG vector linking
    const registerBlockRef = (blockId: string, el: HTMLDivElement | null) => {
        if (!el || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const blockRect = el.getBoundingClientRect();

        setBlockPositions(prev => {
            const next = new Map(prev);
            next.set(blockId, {
                x: blockRect.left - containerRect.left + blockRect.width / 2,
                y: blockRect.top - containerRect.top + blockRect.height / 2,
                width: blockRect.width,
                height: blockRect.height
            });
            return next;
        });
    };

    // Recalculate block positions on resize or data update
    useEffect(() => {
        const updatePositions = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const elements = containerRef.current.querySelectorAll<HTMLDivElement>('[data-block-id]');
            const newMap = new Map<string, { x: number; y: number; width: number; height: number }>();
            elements.forEach(el => {
                const id = el.getAttribute('data-block-id');
                if (id) {
                    const rect = el.getBoundingClientRect();
                    newMap.set(id, {
                        x: rect.left - containerRect.left + rect.width / 2,
                        y: rect.top - containerRect.top + rect.height / 2,
                        width: rect.width,
                        height: rect.height
                    });
                }
            });
            setBlockPositions(newMap);
        };

        const timer = setTimeout(updatePositions, 100);
        window.addEventListener('resize', updatePositions);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePositions);
        };
    }, [matrix, windowDays]);

    return (
        <div className="flex flex-col flex-grow min-h-0 bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
            {/* FCS Engine Global Command Bar */}
            <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
                {/* Left: Branding & Window Navigation */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-indigo-950/80 text-indigo-400 border border-indigo-700/50 px-3 py-1.5 rounded-xl shadow-xs">
                        <Activity size={16} className="text-emerald-400 animate-pulse" />
                        <span className="font-black text-xs uppercase tracking-widest text-white">FCS Split-Row Engine</span>
                    </div>

                    {/* Window Shift */}
                    <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5">
                        <button 
                            onClick={() => setStartDateOffset(prev => prev - windowDays)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Previous window"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setStartDateOffset(0)}
                            className="px-2 py-0.5 text-xs font-bold text-slate-300 hover:text-white"
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setStartDateOffset(prev => prev + windowDays)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Next window"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Window Days Select */}
                    <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5 text-xs font-bold">
                        {[7, 14, 21].map(days => (
                            <button
                                key={days}
                                onClick={() => setWindowDays(days)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${windowDays === days ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                            >
                                {days}d
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center: Live Backlog & Utilization Metrics */}
                <div className="flex items-center gap-3">
                    {/* Backlog hours */}
                    <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl flex items-center gap-2">
                        <Clock size={14} className="text-indigo-400" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Backlog</span>
                            <span className="text-xs font-black text-white">{matrix.metrics.totalBacklogHours}h ({matrix.metrics.totalBacklogDays}d)</span>
                        </div>
                    </div>

                    {/* Ramp Utilization */}
                    <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl flex items-center gap-2">
                        <Layers size={14} className="text-blue-400" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Ramp Space</span>
                            <span className={`text-xs font-black ${matrix.metrics.rampUtilizationPercent >= 85 ? 'text-rose-400' : 'text-blue-300'}`}>
                                {matrix.metrics.rampUtilizationPercent}%
                            </span>
                        </div>
                    </div>

                    {/* Dead Weight Warning */}
                    {matrix.metrics.stalledDeadWeightRampHours > 0 && (
                        <div className="bg-amber-950/60 border border-amber-500/50 px-3 py-1 rounded-xl flex items-center gap-2 animate-pulse" title="Ramp capacity lost while awaiting delivered parts">
                            <AlertTriangle size={14} className="text-amber-400" />
                            <div>
                                <span className="text-[10px] uppercase font-black text-amber-300 block leading-tight">Dead Weight Space</span>
                                <span className="text-xs font-black text-amber-200">{matrix.metrics.stalledDeadWeightRampHours}h locked</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: What-If Capacity Scaler & Booking Buffer */}
                <div className="flex items-center gap-2.5">
                    {/* What-If Scaler Toggle */}
                    <button
                        onClick={() => setSimulateExtraEngineers(prev => prev === 0 ? 1 : 0)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${
                            simulateExtraEngineers > 0
                                ? 'bg-purple-600 border-purple-400 text-white shadow-purple-900/50'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-purple-500 hover:text-purple-300'
                        }`}
                        title="Simulate adding +1 Master Technician to measure backlog reduction"
                    >
                        <Zap size={14} className={simulateExtraEngineers > 0 ? 'text-amber-300 fill-amber-300' : ''} />
                        <span>Simulate +1 Tech</span>
                        {simulateExtraEngineers > 0 && matrix.metrics.simulatedDaysSaved && (
                            <span className="bg-purple-900 text-purple-200 text-[10px] px-1.5 py-0.2 rounded font-black border border-purple-400/30">
                                -{matrix.metrics.simulatedDaysSaved}d Backlog
                            </span>
                        )}
                    </button>

                    {/* Service Advisor Booking Buffer Modal Trigger */}
                    <button
                        onClick={() => setIsBufferModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
                    >
                        <Sparkles size={14} className="text-amber-300" />
                        <span>Booking Buffer</span>
                    </button>
                </div>
            </div>

            {/* Split-Row Gantt Visual Canvas */}
            <div ref={containerRef} className="relative flex-grow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                {/* SVG Vectors Linkage Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <polygon points="0 0, 6 3, 0 6" fill="#818cf8" />
                        </marker>
                    </defs>

                    {matrix.dependencyLinks.map(link => {
                        const rampPos = blockPositions.get(link.rampBlockId);
                        const engPos = blockPositions.get(link.engineerBlockId);
                        if (!rampPos || !engPos) return null;

                        const isHighlighted = hoveredJobId === link.jobId;
                        const strokeColor = isHighlighted ? '#a855f7' : (link.fcsState === 'ACTIVE' ? '#6366f1' : '#475569');
                        const strokeWidth = isHighlighted ? 3 : 1.5;
                        const strokeDash = link.fcsState === 'QUEUED' ? '4 4' : 'none';

                        // Draw smooth bezier vector connecting ramp block to engineer block
                        const x1 = rampPos.x;
                        const y1 = rampPos.y + rampPos.height / 2;
                        const x2 = engPos.x;
                        const y2 = engPos.y - engPos.height / 2;
                        const cY1 = y1 + (y2 - y1) * 0.5;
                        const cY2 = y2 - (y2 - y1) * 0.5;

                        return (
                            <path
                                key={link.id}
                                d={`M ${x1} ${y1} C ${x1} ${cY1}, ${x2} ${cY2}, ${x2} ${y2}`}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray={strokeDash}
                                opacity={hoveredJobId ? (isHighlighted ? 1 : 0.15) : 0.6}
                                className="transition-all duration-300"
                            />
                        );
                    })}
                </svg>

                {/* Header Row: Days of Timeline Window */}
                <div className="grid grid-cols-12 gap-1 px-48 mb-1">
                    {timelineDays.map((td, idx) => (
                        <div 
                            key={td.dateStr} 
                            className={`p-2 rounded-xl text-center border ${td.isToday ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200' : 'bg-slate-950/50 border-slate-800 text-slate-400'}`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider block">{td.dayName}</span>
                            <span className="text-sm font-black text-white">{td.dayNum} {td.month}</span>
                        </div>
                    ))}
                </div>

                {/* ============================================================ */}
                {/* TOP SECTION: PHYSICAL SPACE (RAMP OCCUPANCY ROWS - R)        */}
                {/* ============================================================ */}
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">
                                Physical Space: Heavy-Duty Ramps ($R$)
                            </h3>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 block"></span> Active Space Occupancy
                            </span>
                            <span className="flex items-center gap-1 text-amber-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-400 block" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.2), rgba(245,158,11,0.2) 2px, transparent 2px, transparent 6px)' }}></span> Dead Weight Space (Awaiting Parts)
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {matrix.rampRows.map(row => (
                            <div key={row.ramp.id} className="flex items-center gap-4 group">
                                {/* Row Label */}
                                <div className="w-44 shrink-0 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-white truncate">{row.ramp.name}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-800 px-1.5 py-0.5 rounded">Ramp</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {row.blocks.length} job(s) scheduled
                                    </span>
                                </div>

                                {/* Row Track */}
                                <div className="relative flex-grow h-14 bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                                    {/* Column grid lines */}
                                    <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                        {timelineDays.map(td => (
                                            <div key={td.dateStr} className={`border-r border-slate-800/40 ${td.isToday ? 'bg-indigo-950/10' : ''}`} />
                                        ))}
                                    </div>

                                    {/* Blocks on this Ramp */}
                                    {row.blocks.map(block => {
                                        const isHovered = hoveredJobId === block.jobId;
                                        const isDimmed = hoveredJobId && !isHovered;

                                        return (
                                            <div
                                                key={block.id}
                                                data-block-id={block.id}
                                                ref={(el) => registerBlockRef(block.id, el)}
                                                onMouseEnter={() => setHoveredJobId(block.jobId)}
                                                onMouseLeave={() => setHoveredJobId(null)}
                                                onClick={() => onEditJob(block.jobId)}
                                                style={{
                                                    left: `${block.startPercent}%`,
                                                    width: `${block.durationPercent}%`
                                                }}
                                                className={`absolute top-1.5 bottom-1.5 rounded-lg px-2.5 py-1 flex flex-col justify-center cursor-pointer transition-all duration-200 z-10 ${
                                                    block.isDeadWeight
                                                        ? 'border-2 border-dashed border-amber-500 text-amber-200 shadow-amber-950/30'
                                                        : 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md border border-indigo-400/30'
                                                } ${isHovered ? 'ring-2 ring-purple-400 scale-[1.02] z-20 shadow-lg' : ''} ${isDimmed ? 'opacity-30' : ''}`}
                                                title={`Job #${block.jobId}: ${block.title} (${block.hours}h) - Click to inspect`}
                                            >
                                                {block.isDeadWeight && (
                                                    <div 
                                                        className="absolute inset-0 rounded-lg pointer-events-none opacity-30" 
                                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, transparent 4px, transparent 10px)' }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between text-[10px] font-black leading-tight relative z-10">
                                                    <span className="font-mono uppercase tracking-tight truncate">{block.vehicleRegistration || `#${block.jobId}`}</span>
                                                    <span>{block.hours}h</span>
                                                </div>
                                                <div className="text-[9px] truncate opacity-90 font-medium relative z-10">
                                                    {block.isDeadWeight ? '⚠️ STALLED: Awaiting Parts' : block.title}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* BOTTOM SECTION: LABOUR POOL (ENGINEER WRENCH TIME ROWS - E)  */}
                {/* ============================================================ */}
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <Wrench size={16} className="text-indigo-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">
                                Labour Pool: Engineer Wrench Time ($E$)
                            </h3>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-indigo-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 block"></span> Active Wrench Time
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400">
                                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-emerald-500/50 block"></span> Available / Freed Engineer
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {matrix.engineerRows.map(row => {
                            const isVirtual = row.engineer.id.startsWith('sim_');

                            return (
                                <div key={row.engineer.id} className="flex items-center gap-4 group">
                                    {/* Row Label */}
                                    <div className={`w-44 shrink-0 p-2.5 rounded-xl border shadow-xs ${isVirtual ? 'bg-purple-950/60 border-purple-600 text-purple-200' : 'bg-slate-900 border-slate-800 text-white'}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-xs truncate">{row.engineer.name}</span>
                                            {isVirtual ? (
                                                <span className="text-[8px] font-black uppercase bg-purple-600 text-white px-1 py-0.5 rounded">Simulated</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-800 px-1.5 py-0.5 rounded">Tech</span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {row.blocks.length} wrench task(s)
                                        </span>
                                    </div>

                                    {/* Row Track */}
                                    <div className="relative flex-grow h-14 bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                                        {/* Column grid lines */}
                                        <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                            {timelineDays.map(td => (
                                                <div key={td.dateStr} className={`border-r border-slate-800/40 ${td.isToday ? 'bg-indigo-950/10' : ''}`} />
                                            ))}
                                        </div>

                                        {/* Blocks on this Engineer */}
                                        {row.blocks.map(block => {
                                            const isHovered = hoveredJobId === block.jobId;
                                            const isDimmed = hoveredJobId && !isHovered;

                                            return (
                                                <div
                                                    key={block.id}
                                                    data-block-id={block.id}
                                                    ref={(el) => registerBlockRef(block.id, el)}
                                                    onMouseEnter={() => setHoveredJobId(block.jobId)}
                                                    onMouseLeave={() => setHoveredJobId(null)}
                                                    onClick={() => onEditJob(block.jobId)}
                                                    style={{
                                                        left: `${block.startPercent}%`,
                                                        width: `${block.durationPercent}%`
                                                    }}
                                                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-2.5 py-1 flex flex-col justify-center cursor-pointer transition-all duration-200 z-10 ${
                                                        block.isSimulated
                                                            ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white border border-purple-400 shadow-md'
                                                            : 'bg-gradient-to-r from-indigo-600 to-emerald-600 text-white border border-indigo-400/30 shadow-md'
                                                    } ${isHovered ? 'ring-2 ring-purple-400 scale-[1.02] z-20 shadow-lg' : ''} ${isDimmed ? 'opacity-30' : ''}`}
                                                    title={`Wrench Time for Job #${block.jobId}: ${block.title} (${block.hours}h)`}
                                                >
                                                    <div className="flex items-center justify-between text-[10px] font-black leading-tight">
                                                        <span className="font-mono uppercase tracking-tight truncate">{block.vehicleRegistration || `#${block.jobId}`}</span>
                                                        <span>{block.hours}h</span>
                                                    </div>
                                                    <div className="text-[9px] truncate opacity-90 font-medium">
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
            </div>

            {/* Service Advisor Booking Buffer Modal */}
            {isBufferModalOpen && (
                <ServiceAdvisorBookingBufferModal
                    isOpen={isBufferModalOpen}
                    onClose={() => setIsBufferModalOpen(false)}
                    jobs={jobs}
                    ramps={ramps}
                    engineers={engineers}
                    purchaseOrders={purchaseOrders}
                    customers={customers}
                    vehicles={vehicles}
                    onBookJob={(newJob) => {
                        onSaveJob(newJob);
                    }}
                />
            )}
        </div>
    );
};

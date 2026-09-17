import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job, Lift, Engineer, PurchaseOrder, Vehicle, Customer, User, Estimate, FCSGanttBlock, FCSDependencyLink, BusinessEntity } from '../../../types';
import { calculateFCSMatrix, FCSMatrixResult } from '../../../core/services/fcsSchedulingEngine';
import { ServiceAdvisorBookingBufferModal } from './ServiceAdvisorBookingBufferModal';
import { FCSOptimizerModal, OptimizedAssignment } from './FCSOptimizerModal';
import { TechnicianTransferModal } from './TechnicianTransferModal';
import { AdjustSuggestedAllocationModal } from './AdjustSuggestedAllocationModal';
import { Sparkles, Wrench, Layers, AlertTriangle, CheckCircle, Clock, Calendar, Users, RefreshCw, Plus, ChevronLeft, ChevronRight, Activity, ArrowRight, Zap, Info, Edit3, ArrowRightLeft } from 'lucide-react';
import { getRelativeDate, addDays, formatDate } from '../../../core/utils/dateUtils';
import { isJobAllocated, isJobUnallocated } from '../../../core/utils/jobUtils';

export interface EngineerTheme {
    id: string;
    name: string;
    gradientFrom: string;
    gradientTo: string;
    border: string;
    hex: string;
    lightHex: string;
    badgeBg: string;
    badgeText: string;
}

export const ENGINEER_COLOR_PALETTES: EngineerTheme[] = [
    {
        id: 'cobalt',
        name: 'Cobalt Blue',
        gradientFrom: '#2563eb', // blue-600
        gradientTo: '#1d4ed8',   // blue-700
        border: '#60a5fa',       // blue-400
        hex: '#2563eb',
        lightHex: '#eff6ff',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800'
    },
    {
        id: 'emerald',
        name: 'Emerald Green',
        gradientFrom: '#059669', // emerald-600
        gradientTo: '#047857',   // emerald-700
        border: '#34d399',       // emerald-400
        hex: '#059669',
        lightHex: '#ecfdf5',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800'
    },
    {
        id: 'purple',
        name: 'Royal Purple',
        gradientFrom: '#7c3aed', // violet-600
        gradientTo: '#6d28d9',   // violet-700
        border: '#a78bfa',       // violet-400
        hex: '#7c3aed',
        lightHex: '#f5f3ff',
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-800'
    },
    {
        id: 'amber',
        name: 'Amber Orange',
        gradientFrom: '#d97706', // amber-600
        gradientTo: '#b45309',   // amber-700
        border: '#fbbf24',       // amber-400
        hex: '#d97706',
        lightHex: '#fffbeb',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800'
    },
    {
        id: 'rose',
        name: 'Ruby Rose',
        gradientFrom: '#e11d48', // rose-600
        gradientTo: '#be123c',   // rose-700
        border: '#fb7185',       // rose-400
        hex: '#e11d48',
        lightHex: '#fff1f2',
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-800'
    },
    {
        id: 'cyan',
        name: 'Teal Cyan',
        gradientFrom: '#0891b2', // cyan-600
        gradientTo: '#0e7490',   // cyan-700
        border: '#22d3ee',       // cyan-400
        hex: '#0891b2',
        lightHex: '#ecfeff',
        badgeBg: 'bg-cyan-100',
        badgeText: 'text-cyan-800'
    },
    {
        id: 'fuchsia',
        name: 'Fuchsia Pink',
        gradientFrom: '#c026d3', // fuchsia-600
        gradientTo: '#a21caf',   // fuchsia-700
        border: '#e879f9',       // fuchsia-400
        hex: '#c026d3',
        lightHex: '#fdf4ff',
        badgeBg: 'bg-fuchsia-100',
        badgeText: 'text-fuchsia-800'
    },
    {
        id: 'lime',
        name: 'Vibrant Lime',
        gradientFrom: '#65a30d', // lime-600
        gradientTo: '#4d7c0f',   // lime-700
        border: '#a3e635',       // lime-400
        hex: '#65a30d',
        lightHex: '#f7fee7',
        badgeBg: 'bg-lime-100',
        badgeText: 'text-lime-800'
    },
    {
        id: 'sky',
        name: 'Sky Blue',
        gradientFrom: '#0284c7', // sky-600
        gradientTo: '#0369a1',   // sky-700
        border: '#38bdf8',       // sky-400
        hex: '#0284c7',
        lightHex: '#f0f9ff',
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-800'
    },
    {
        id: 'orange',
        name: 'Sunset Orange',
        gradientFrom: '#ea580c', // orange-600
        gradientTo: '#c2410c',   // orange-700
        border: '#fb923c',       // orange-400
        hex: '#ea580c',
        lightHex: '#fff7ed',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800'
    }
];

export const SIMULATED_TECH_THEME: EngineerTheme = {
    id: 'simulated',
    name: 'Simulated Master Tech',
    gradientFrom: '#9333ea',
    gradientTo: '#6b21a8',
    border: '#c084fc',
    hex: '#9333ea',
    lightHex: '#faf5ff',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800'
};

// Deterministic engineer color theme mapping helper
export const getEngineerTheme = (engId: string, engineersList?: Engineer[]): EngineerTheme => {
    if (!engId) return ENGINEER_COLOR_PALETTES[0];
    if (engId.startsWith('sim_')) return SIMULATED_TECH_THEME;
    if (engineersList && engineersList.length > 0) {
        const idx = engineersList.findIndex(e => e.id === engId);
        if (idx >= 0) {
            return ENGINEER_COLOR_PALETTES[idx % ENGINEER_COLOR_PALETTES.length];
        }
    }
    // Fallback hash by string
    let hash = 0;
    for (let i = 0; i < engId.length; i++) {
        hash = engId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const safeIdx = Math.abs(hash) % ENGINEER_COLOR_PALETTES.length;
    return ENGINEER_COLOR_PALETTES[safeIdx];
};

interface ResourceGanttViewProps {
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    vehicles: Vehicle[];
    customers: Customer[];
    currentUser: User;
    estimates?: Estimate[];
    unallocatedJobs?: Job[];
    allEngineers?: Engineer[];
    businessEntities?: BusinessEntity[];
    selectedEntityId?: string;
    onEditJob: (jobId: string, initialTab?: string) => void;
    onSaveJob: (job: Partial<Job>) => void;
    onSaveEstimate?: (estimate: Partial<Estimate>) => void;
    onSavePurchaseOrder?: (po: Partial<PurchaseOrder>) => void;
    onUpdateEngineer?: (engineerId: string, newName: string) => Promise<void>;
    onUpdateEngineerTransfer?: (engineerId: string, toEntityId: string | null, reason?: string) => Promise<void>;
}

export const ResourceGanttView: React.FC<ResourceGanttViewProps> = ({
    jobs,
    ramps,
    engineers,
    allEngineers = [],
    businessEntities = [],
    selectedEntityId = 'all',
    purchaseOrders,
    vehicles,
    customers,
    currentUser,
    estimates = [],
    unallocatedJobs = [],
    onEditJob,
    onSaveJob,
    onSaveEstimate,
    onSavePurchaseOrder,
    onUpdateEngineer,
    onUpdateEngineerTransfer
}) => {
    const [windowDays, setWindowDays] = useState<number>(7);
    const [simulateExtraEngineers, setSimulateExtraEngineers] = useState<number>(0);
    const [isBufferModalOpen, setIsBufferModalOpen] = useState<boolean>(false);
    const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
    const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [startDateOffset, setStartDateOffset] = useState<number>(0);
    const [editingEngineerId, setEditingEngineerId] = useState<string | null>(null);
    const [editingEngineerName, setEditingEngineerName] = useState<string>('');
    const [isSavingEngineerName, setIsSavingEngineerName] = useState<boolean>(false);

    // Suggested Work Allocations Preview State
    const [showSuggestedGanttPreview, setShowSuggestedGanttPreview] = useState<boolean>(false);
    const [ganttSuggestedPlan, setGanttSuggestedPlan] = useState<OptimizedAssignment[]>([]);
    const [adjustingSuggestedBlock, setAdjustingSuggestedBlock] = useState<FCSGanttBlock | null>(null);

    const usableRamps = useMemo(() => {
        const active = ramps.filter(r => r.type !== 'Virtual' && !r.name.toLowerCase().includes('storage'));
        return active.length > 0 ? active : ramps;
    }, [ramps]);

    // Handle toggling or generating suggested work allocations on the Gantt
    const handleToggleSuggestedPreview = () => {
        if (showSuggestedGanttPreview) {
            setShowSuggestedGanttPreview(false);
            return;
        }

        if (ganttSuggestedPlan.length === 0 && (unallocatedJobs || []).length > 0) {
            const queueToAllocate = [...(unallocatedJobs || [])];
            const daysList = Array.from({ length: windowDays }).map((_, idx) => getRelativeDate(idx));

            const dayRampHours = new Map<string, Map<string, number>>();
            const dayTechHours = new Map<string, Map<string, number>>();

            daysList.forEach(d => {
                dayRampHours.set(d, new Map<string, number>());
                dayTechHours.set(d, new Map<string, number>());
                usableRamps.forEach(r => dayRampHours.get(d)!.set(r.id, 0));
                engineers.forEach(e => dayTechHours.get(d)!.set(e.id, 0));

                const bookedForDate = jobs.filter(j => isJobAllocated(j) && (j.scheduledDate === d || (j.segments || [])[0]?.date === d));
                bookedForDate.forEach(bj => {
                    const bjHours = bj.estimatedHours || 2;
                    const seg = bj.segments?.[0];
                    const matchedRamp = usableRamps.find(r => r.name === seg?.allocatedLift || r.id === seg?.allocatedLift) || usableRamps[0];
                    const matchedTech = engineers.find(e => e.id === seg?.engineerId || (e.name && e.name.toLowerCase() === seg?.engineerId?.toLowerCase())) || engineers[0];
                    if (matchedRamp) {
                        dayRampHours.get(d)!.set(matchedRamp.id, (dayRampHours.get(d)!.get(matchedRamp.id) || 0) + bjHours);
                    }
                    if (matchedTech) {
                        dayTechHours.get(d)!.set(matchedTech.id, (dayTechHours.get(d)!.get(matchedTech.id) || 0) + bjHours);
                    }
                });
            });

            const plan: OptimizedAssignment[] = [];
            queueToAllocate.forEach((job, idx) => {
                const hours = job.estimatedHours || 2;
                let chosenDate = startDateStr;
                let chosenRampId = usableRamps[0]?.id || '';
                let chosenTechId = engineers[0]?.id || '';
                let placed = false;

                for (const day of daysList) {
                    const rMap = dayRampHours.get(day);
                    const tMap = dayTechHours.get(day);
                    if (!rMap || !tMap) continue;

                    let bestRampId: string | null = null;
                    let lowestRamp = Infinity;
                    usableRamps.forEach(r => {
                        const l = rMap.get(r.id) || 0;
                        if (l + hours <= 8.5 && l < lowestRamp) {
                            lowestRamp = l;
                            bestRampId = r.id;
                        }
                    });

                    let bestTechId: string | null = null;
                    let lowestTech = Infinity;
                    engineers.forEach(eng => {
                        const l = tMap.get(eng.id) || 0;
                        if (l + hours <= 8.5 && l < lowestTech) {
                            lowestTech = l;
                            bestTechId = eng.id;
                        }
                    });

                    if (bestRampId && bestTechId) {
                        chosenDate = day;
                        chosenRampId = bestRampId;
                        chosenTechId = bestTechId;
                        rMap.set(bestRampId, (rMap.get(bestRampId) || 0) + hours);
                        tMap.set(bestTechId, (tMap.get(bestTechId) || 0) + hours);
                        placed = true;
                        break;
                    }
                }

                if (!placed) {
                    chosenDate = daysList[daysList.length - 1] || startDateStr;
                    chosenRampId = usableRamps[idx % usableRamps.length]?.id || '';
                    chosenTechId = engineers[idx % engineers.length]?.id || '';
                }

                plan.push({
                    job,
                    vehicle: vehicles.find(v => v.id === job.vehicleId),
                    customer: customers.find(c => c.id === job.customerId),
                    hours,
                    recommendedEngineerId: chosenTechId,
                    recommendedRampId: chosenRampId,
                    scheduledDate: chosenDate,
                    partsLeadDays: 0
                });
            });

            setGanttSuggestedPlan(plan);
        }

        setShowSuggestedGanttPreview(true);
    };

    // Lock and allocate suggested work plan directly into confirmed schedule
    const handleCommitSuggestedPlan = async () => {
        if (!ganttSuggestedPlan || ganttSuggestedPlan.length === 0) return;
        for (const item of ganttSuggestedPlan) {
            const assignedRamp = usableRamps.find(r => r.id === item.recommendedRampId) || usableRamps[0];
            const assignedRampName = assignedRamp?.name || 'Ramp';
            const techName = engineers.find(e => e.id === item.recommendedEngineerId)?.name || 'Tech';

            const isEstimateSim = Boolean(item.isEstimateSimulation || item.job.id.startsWith('sim_est_'));

            if (isEstimateSim) {
                const newJobId = `job_from_est_${item.estimateId || Date.now()}_${Date.now()}`;
                const newJob: Job = {
                    ...item.job,
                    id: newJobId,
                    jobNumber: `JOB-${item.job.jobNumber || newJobId.substring(0, 6)}`,
                    status: 'Allocated',
                    scheduledDate: item.scheduledDate,
                    estimateId: item.estimateId,
                    segments: [
                        {
                            id: `seg_${Date.now()}_${newJobId}`,
                            segmentId: `seg_${Date.now()}_${newJobId}`,
                            description: item.job.description,
                            status: 'Allocated' as const,
                            engineerId: item.recommendedEngineerId,
                            allocatedLift: assignedRampName,
                            duration: item.hours,
                            date: item.scheduledDate,
                            scheduledStartSegment: 1
                        }
                    ],
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Agreed Plan]: Converted from Estimate #${item.job.jobNumber || item.estimateId} and locked to ${assignedRampName} (${techName}) for ${item.scheduledDate}.`
                };
                await onSaveJob(newJob);

                if (item.estimateId && onSaveEstimate) {
                    const origEst = estimates.find(e => e.id === item.estimateId);
                    if (origEst) {
                        await onSaveEstimate({
                            ...origEst,
                            status: 'Converted to Job',
                            jobId: newJobId
                        });
                    }
                }
            } else {
                const updatedJob: Job = {
                    ...item.job,
                    scheduledDate: item.scheduledDate,
                    status: 'Allocated',
                    fcsState: item.partsLeadDays > 0 ? 'STALLED' : 'ACTIVE',
                    materialsStatus: item.partsLeadDays > 0 ? 'Ordered' : 'Delivered',
                    segments: (item.job.segments && item.job.segments.length > 0)
                        ? item.job.segments.map((s, sIdx) => ({
                            ...s,
                            engineerId: item.recommendedEngineerId,
                            allocatedLift: assignedRampName,
                            date: item.scheduledDate,
                            status: 'Allocated' as const,
                            duration: sIdx === 0 ? item.hours : s.duration
                        }))
                        : [
                            {
                                id: `seg_${Date.now()}_${item.job.id}`,
                                segmentId: `seg_${Date.now()}_${item.job.id}`,
                                description: item.job.description,
                                status: 'Allocated' as const,
                                engineerId: item.recommendedEngineerId,
                                allocatedLift: assignedRampName,
                                duration: item.hours,
                                date: item.scheduledDate,
                                scheduledStartSegment: 1
                            }
                        ],
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Agreed Plan]: Locked and allocated to ${assignedRampName} (${techName}) for ${item.scheduledDate}.`
                };
                await onSaveJob(updatedJob);
            }
        }
        setShowSuggestedGanttPreview(false);
        setGanttSuggestedPlan([]);
    };

    // Quick move / adjustment helper for suggested blocks directly on the Gantt
    const handleMoveSuggestedBlock = (jobId: string, newDate: string, newRampId: string, newEngineerId: string) => {
        setGanttSuggestedPlan(prev => prev.map(item => {
            if (item.job.id === jobId) {
                return {
                    ...item,
                    scheduledDate: newDate,
                    recommendedRampId: newRampId,
                    recommendedEngineerId: newEngineerId,
                    isOverridden: true
                };
            }
            return item;
        }));
        setAdjustingSuggestedBlock(null);
    };

    const handleStartRename = (eng: Engineer) => {
        setEditingEngineerId(eng.id);
        setEditingEngineerName(eng.name);
    };

    const handleSaveRename = async (engineerId: string) => {
        const trimmed = editingEngineerName.trim();
        if (!trimmed || !onUpdateEngineer) {
            setEditingEngineerId(null);
            return;
        }
        setIsSavingEngineerName(true);
        try {
            await onUpdateEngineer(engineerId, trimmed);
        } catch (err) {
            console.error("Failed to update engineer name:", err);
        } finally {
            setIsSavingEngineerName(false);
            setEditingEngineerId(null);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const [blockPositions, setBlockPositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

    // Local convenience wrapper for technician theme
    const getTechTheme = (engId: string) => getEngineerTheme(engId, engineers);

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

    // Merge simulated jobs into effectiveJobs so calculateFCSMatrix renders them on the Gantt
    const effectiveJobsForMatrix = useMemo(() => {
        if (!showSuggestedGanttPreview || ganttSuggestedPlan.length === 0) return jobs;
        const existingJobIds = new Set(jobs.map(j => j.id));
        const extraSimJobs = ganttSuggestedPlan
            .filter(item => !existingJobIds.has(item.job.id))
            .map(item => item.job);
        return [...jobs, ...extraSimJobs];
    }, [jobs, showSuggestedGanttPreview, ganttSuggestedPlan]);

    // Calculate FCS matrix
    const matrix: FCSMatrixResult = useMemo(() => {
        return calculateFCSMatrix({
            jobs: effectiveJobsForMatrix,
            ramps,
            engineers,
            purchaseOrders,
            vehicles,
            windowDays,
            startDateStr,
            simulateExtraEngineers,
            includeSuggestedAllocations: showSuggestedGanttPreview,
            suggestedAllocations: ganttSuggestedPlan.map(item => ({
                jobId: item.job.id,
                rampId: item.recommendedRampId,
                engineerId: item.recommendedEngineerId,
                date: item.scheduledDate,
                hours: item.hours
            }))
        });
    }, [effectiveJobsForMatrix, ramps, engineers, purchaseOrders, vehicles, windowDays, startDateStr, simulateExtraEngineers, showSuggestedGanttPreview, ganttSuggestedPlan]);

    // Recalculate block positions for SVG vector linkages on resize or data update
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

        const timer = setTimeout(updatePositions, 80);
        window.addEventListener('resize', updatePositions);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePositions);
        };
    }, [matrix, windowDays, startDateStr]);

    return (
        <div className="flex flex-col flex-grow min-h-0 bg-slate-100 text-slate-800 font-sans select-none overflow-hidden">
            {/* FCS Engine Global Command Bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
                {/* Left: Branding & Window Navigation */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl shadow-xs">
                        <Activity size={16} className="text-emerald-600 animate-pulse" />
                        <span className="font-black text-xs uppercase tracking-widest text-indigo-950">FCS Split-Row Engine</span>
                    </div>

                    {/* Window Shift */}
                    <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5">
                        <button 
                            onClick={() => setStartDateOffset(prev => prev - windowDays)}
                            className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors shadow-xs hover:shadow-xs"
                            title="Previous window"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setStartDateOffset(0)}
                            className="px-2.5 py-0.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setStartDateOffset(prev => prev + windowDays)}
                            className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors shadow-xs hover:shadow-xs"
                            title="Next window"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Window Days Select */}
                    <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5 text-xs font-bold">
                        {[7, 14, 21].map(days => (
                            <button
                                key={days}
                                onClick={() => setWindowDays(days)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${windowDays === days ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                {days}d
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center: Live Backlog & Utilization Metrics */}
                <div className="flex items-center gap-3">
                    {/* Backlog hours */}
                    <div className="bg-indigo-50/80 border border-indigo-200 px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs">
                        <Clock size={14} className="text-indigo-600" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-700 block leading-tight">Backlog</span>
                            <span className="text-xs font-black text-indigo-950">{matrix.metrics.totalBacklogHours}h ({matrix.metrics.totalBacklogDays}d)</span>
                        </div>
                    </div>

                    {/* Ramp Utilization */}
                    <div className="bg-blue-50/80 border border-blue-200 px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs">
                        <Layers size={14} className="text-blue-600" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-blue-700 block leading-tight">Ramp Space</span>
                            <span className={`text-xs font-black ${matrix.metrics.rampUtilizationPercent >= 85 ? 'text-rose-600' : 'text-blue-950'}`}>
                                {matrix.metrics.rampUtilizationPercent}%
                            </span>
                        </div>
                    </div>

                    {/* Dead Weight Warning */}
                    {matrix.metrics.stalledDeadWeightRampHours > 0 && (
                        <div className="bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs animate-pulse" title="Ramp capacity lost while awaiting delivered parts">
                            <AlertTriangle size={14} className="text-amber-600" />
                            <div>
                                <span className="text-[10px] uppercase font-black text-amber-800 block leading-tight">Dead Weight Space</span>
                                <span className="text-xs font-black text-amber-950">{matrix.metrics.stalledDeadWeightRampHours}h locked</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: What-If Capacity Scaler, Unallocated Queue & Optimizer */}
                <div className="flex items-center gap-2.5">
                    {/* Unallocated Queue Chip */}
                    {(unallocatedJobs || []).length > 0 && (
                        <button
                            onClick={() => setIsOptimizerOpen(true)}
                            className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-all hover:shadow-sm group text-left"
                            title="Click to view unallocated jobs and suggested work allocations"
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <div>
                                <span className="text-[10px] uppercase font-bold text-amber-800 block leading-tight">Unallocated Queue</span>
                                <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                                    {(unallocatedJobs || []).length} to allocate
                                    <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform text-amber-700" />
                                </span>
                            </div>
                        </button>
                    )}

                    {/* Preview Suggested Allocations directly on the Gantt */}
                    {(unallocatedJobs || []).length > 0 && (
                        <button
                            onClick={handleToggleSuggestedPreview}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                showSuggestedGanttPreview
                                    ? 'bg-purple-700 border-purple-600 text-white shadow-purple-200'
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 hover:border-purple-400'
                            }`}
                            title="Toggle preview of suggested work allocations directly on the Gantt"
                        >
                            <Sparkles size={13} className={showSuggestedGanttPreview ? 'text-amber-300 fill-amber-300' : 'text-purple-600'} />
                            <span>{showSuggestedGanttPreview ? 'Hide Suggested' : 'Preview Suggested'}</span>
                        </button>
                    )}

                    {/* What-If Scaler Toggle */}
                    <button
                        onClick={() => setSimulateExtraEngineers(prev => prev === 0 ? 1 : 0)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs ${
                            simulateExtraEngineers > 0
                                ? 'bg-purple-600 border-purple-500 text-white shadow-purple-200'
                                : 'bg-white border-slate-300 text-slate-700 hover:border-purple-400 hover:text-purple-700'
                        }`}
                        title="Simulate adding +1 Master Technician to measure backlog reduction"
                    >
                        <Zap size={14} className={simulateExtraEngineers > 0 ? 'text-amber-300 fill-amber-300' : 'text-purple-600'} />
                        <span>Simulate +1 Tech</span>
                        {simulateExtraEngineers > 0 && matrix.metrics.simulatedDaysSaved && (
                            <span className="bg-purple-800 text-purple-100 text-[10px] px-1.5 py-0.2 rounded font-black">
                                -{matrix.metrics.simulatedDaysSaved}d Backlog
                            </span>
                        )}
                    </button>

                    {/* FCS Auto-Optimize Allocations Button */}
                    <button
                        onClick={() => setIsOptimizerOpen(true)}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-purple-400/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        title="Intelligently balance unallocated jobs across all technicians"
                    >
                        <Zap size={14} className="text-amber-300 fill-amber-300" />
                        <span>Auto-Optimize {(unallocatedJobs || []).length > 0 ? `(${(unallocatedJobs || []).length})` : ''}</span>
                    </button>

                    {/* Service Advisor Booking Buffer Modal Trigger */}
                    <button
                        onClick={() => setIsBufferModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-400/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <Sparkles size={14} className="text-amber-300" />
                        <span>Booking Buffer</span>
                    </button>
                </div>
            </div>

            {/* Split-Row Gantt Visual Canvas */}
            <div ref={containerRef} className="relative flex-grow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                {/* Suggested Work Allocation Preview Banner */}
                {showSuggestedGanttPreview && (
                    <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-purple-400/50 flex flex-wrap items-center justify-between gap-4 animate-fade-in shrink-0 z-40">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-600/50 border border-purple-400/40 flex items-center justify-center text-amber-300 shadow-inner">
                                <Sparkles size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                                    <span>Plan Preview & Interactive Moving</span>
                                    <span className="bg-purple-500/50 border border-purple-400/40 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                                        {ganttSuggestedPlan.length || (unallocatedJobs || []).length} Jobs & Estimates
                                    </span>
                                </h4>
                                <p className="text-[11px] text-purple-200 mt-0.5">
                                    Dashed blocks indicate simulated placements. <strong className="text-amber-300">Click any block to adjust/move its date, ramp, or technician</strong>, then lock into an agreed plan when ready.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={handleCommitSuggestedPlan}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                                title="Locks this plan into confirmed workshop bookings. Always editable afterwards."
                            >
                                <CheckCircle size={14} />
                                <span>Lock into Agreed Plan ({ganttSuggestedPlan.length || (unallocatedJobs || []).length})</span>
                            </button>
                            <button
                                onClick={() => setShowSuggestedGanttPreview(false)}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Dismiss Preview
                            </button>
                        </div>
                    </div>
                )}

                {/* SVG Vectors Linkage Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <polygon points="0 0, 6 3, 0 6" fill="#4f46e5" />
                        </marker>
                        <marker id="arrowhead-hover" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <polygon points="0 0, 6 3, 0 6" fill="#9333ea" />
                        </marker>
                    </defs>

                    {matrix.dependencyLinks.map(link => {
                        const rampPos = blockPositions.get(link.rampBlockId);
                        const engPos = blockPositions.get(link.engineerBlockId);
                        if (!rampPos || !engPos) return null;

                        const isHighlighted = hoveredJobId === link.jobId;
                        const isSuggested = link.fcsState === 'SUGGESTED';
                        const engTheme = link.engineerId ? getEngineerTheme(link.engineerId) : null;
                        const strokeColor = isHighlighted ? '#9333ea' : (isSuggested ? '#c084fc' : (engTheme ? engTheme.hex : (link.fcsState === 'ACTIVE' ? '#4f46e5' : '#94a3b8')));
                        const strokeWidth = isHighlighted ? 3.5 : (isSuggested ? 2.5 : 2);
                        const strokeDash = isSuggested ? '6 3' : (link.fcsState === 'QUEUED' ? '4 4' : 'none');

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
                                opacity={hoveredJobId ? (isHighlighted ? 1 : 0.2) : 0.75}
                                markerEnd={isHighlighted ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
                                className="transition-all duration-300"
                            />
                        );
                    })}
                </svg>

                {/* Header Row: Days of Timeline Window (Aligned with row tracks) */}
                <div className="flex items-center gap-4">
                    {/* Spacer matching Row Label width (w-44) */}
                    <div className="w-44 shrink-0 px-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-600">
                        <span>Resource</span>
                        <span>Track</span>
                    </div>

                    {/* Dynamic day columns */}
                    <div 
                        className="flex-grow grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))` }}
                    >
                        {timelineDays.map((td) => (
                            <div 
                                key={td.dateStr} 
                                className={`p-2 rounded-xl text-center border shadow-xs transition-all ${
                                    td.isToday 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' 
                                        : 'bg-white border-slate-200 text-slate-800'
                                }`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${td.isToday ? 'text-indigo-100' : 'text-slate-500'}`}>
                                    {td.dayName}
                                </span>
                                <span className={`text-xs font-black ${td.isToday ? 'text-white' : 'text-slate-900'}`}>
                                    {td.dayNum} {td.month}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* TOP SECTION: PHYSICAL SPACE (RAMP OCCUPANCY ROWS - R)        */}
                {/* ============================================================ */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                                Physical Space: Heavy-Duty Ramps ($R$)
                            </h3>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                            <span className="flex items-center gap-1.5 text-blue-700">
                                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 block"></span> Active Space Occupancy
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-700">
                                <span className="w-2.5 h-2.5 rounded-xs bg-amber-200 border border-amber-500 block" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 2px, transparent 2px, transparent 6px)' }}></span> Dead Weight Space (Awaiting Parts)
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {matrix.rampRows.map(row => (
                            <div key={row.ramp.id} className="flex items-center gap-4 group">
                                {/* Row Label */}
                                <div className="w-44 shrink-0 bg-slate-50 border border-slate-200 p-2.5 rounded-xl shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-slate-900 truncate">{row.ramp.name}</span>
                                        <span className="text-[9px] font-black text-slate-600 uppercase bg-slate-200 px-1.5 py-0.5 rounded">Ramp</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                        {row.blocks.length} job(s) scheduled
                                    </span>
                                </div>

                                {/* Row Track */}
                                <div className="relative flex-grow h-14 bg-slate-100/80 rounded-xl border border-slate-200 overflow-hidden">
                                    {/* Column grid lines */}
                                    <div 
                                        className="absolute inset-0 grid pointer-events-none"
                                        style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))` }}
                                    >
                                        {timelineDays.map(td => (
                                            <div key={td.dateStr} className={`border-r border-slate-200/90 ${td.isToday ? 'bg-indigo-50/60' : ''}`} />
                                        ))}
                                    </div>

                                    {/* Blocks on this Ramp */}
                                    {row.blocks.map(block => {
                                        const isHovered = hoveredJobId === block.jobId;
                                        const isDimmed = hoveredJobId && !isHovered;
                                        const engTheme = block.engineerId ? getEngineerTheme(block.engineerId) : null;
                                        const isSuggested = block.isSuggested || block.fcsState === 'SUGGESTED';
                                        const isEstSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));

                                        return (
                                            <div
                                                key={block.id}
                                                data-block-id={block.id}
                                                onMouseEnter={() => setHoveredJobId(block.jobId)}
                                                onMouseLeave={() => setHoveredJobId(null)}
                                                onClick={() => {
                                                    if (isSuggested || isEstSim) {
                                                        setAdjustingSuggestedBlock(block);
                                                    } else {
                                                        onEditJob(block.jobId);
                                                    }
                                                }}
                                                style={{
                                                    left: `${block.startPercent}%`,
                                                    width: `${block.durationPercent}%`,
                                                    ...(engTheme && !block.isDeadWeight && !isSuggested && !isEstSim ? {
                                                        borderLeft: `5px solid ${engTheme.hex}`
                                                    } : {})
                                                }}
                                                className={`absolute top-1.5 bottom-1.5 rounded-lg px-2.5 py-1 flex flex-col justify-center cursor-pointer transition-all duration-200 z-10 ${
                                                    block.isDeadWeight
                                                        ? 'bg-amber-100 border-2 border-amber-500 text-amber-950 shadow-sm'
                                                        : isEstSim
                                                            ? 'bg-amber-950/90 border-2 border-dashed border-amber-400 text-white shadow-md'
                                                            : isSuggested
                                                                ? 'bg-purple-950/85 border-2 border-dashed border-purple-400 text-white shadow-md'
                                                                : 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md border border-slate-700/60'
                                                } ${isHovered ? 'ring-2 ring-purple-500 scale-[1.02] z-20 shadow-lg' : ''} ${isDimmed ? 'opacity-35' : ''}`}
                                                title={`Job #${block.jobId}: ${block.title} (${block.hours}h)${isEstSim ? ' • [Simulated Estimate - Click to Move/Adjust]' : isSuggested ? ' • [Suggested Allocation - Click to Move/Adjust]' : ''}${block.engineerName ? ` • Assigned Tech: ${block.engineerName}` : ''} - Click to ${isSuggested || isEstSim ? 'adjust / move' : 'inspect'}`}
                                            >
                                                {block.isDeadWeight && (
                                                    <div 
                                                        className="absolute inset-0 rounded-lg pointer-events-none opacity-20" 
                                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #d97706, #d97706 4px, transparent 4px, transparent 10px)' }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between text-[11px] font-black leading-tight relative z-10">
                                                    <span className="font-mono uppercase tracking-tight truncate flex items-center gap-1">
                                                        {(isSuggested || isEstSim) && <Sparkles size={11} className={isEstSim ? "text-amber-400 shrink-0" : "text-purple-300 shrink-0"} />}
                                                        {block.vehicleRegistration || `#${block.jobId}`}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {isEstSim ? (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-600 text-white shadow-2xs font-sans">
                                                                Est Sim
                                                            </span>
                                                        ) : isSuggested ? (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-600 text-white shadow-2xs font-sans">
                                                                Suggested
                                                            </span>
                                                        ) : engTheme && !block.isDeadWeight && (
                                                            <span 
                                                                className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded text-white shadow-2xs"
                                                                style={{ backgroundColor: engTheme.hex }}
                                                                title={`Assigned Tech: ${block.engineerName || 'Tech'}`}
                                                            >
                                                                {block.engineerName?.split(' ')[0] || 'Tech'}
                                                            </span>
                                                        )}
                                                        <span className="font-mono text-[10px] bg-black/25 px-1 rounded">{block.hours}h</span>
                                                    </div>
                                                </div>
                                                <div className={`text-[10px] truncate font-bold relative z-10 ${block.isDeadWeight ? 'text-amber-900' : isEstSim ? 'text-amber-200' : isSuggested ? 'text-purple-200' : 'text-slate-300'}`}>
                                                    {block.isDeadWeight ? '⚠️ STALLED: Awaiting Parts' : isEstSim ? `Estimate: ${block.title}` : (isSuggested ? `Suggested: ${block.title}` : block.title)}
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
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between mb-3 pb-2 border-b border-slate-100 gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-2">
                                <Wrench size={16} className="text-indigo-600" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                                    Labour Pool: Engineer Wrench Time ($E$)
                                </h3>
                            </div>
                            {onUpdateEngineerTransfer && (
                                <button
                                    onClick={() => setIsTransferModalOpen(true)}
                                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                    title="Transfer or borrow technicians from another workshop to recover backlogs"
                                >
                                    <ArrowRightLeft size={11} className="text-indigo-600" />
                                    <span>Transfer / Borrow Tech</span>
                                    {engineers.filter(e => e.isTransferred).length > 0 && (
                                        <span className="bg-amber-500 text-white text-[9px] px-1.5 rounded-full font-black">
                                            {engineers.filter(e => e.isTransferred).length}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Engineer Signature Color Palette Legend */}
                        <div className="flex items-center gap-2 overflow-x-auto max-w-2xl py-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 shrink-0">Tech Colors:</span>
                            {matrix.engineerRows.map(r => {
                                const t = getEngineerTheme(r.engineer.id);
                                return (
                                    <div 
                                        key={r.engineer.id}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 shadow-2xs"
                                        style={{ backgroundColor: t.lightHex, borderColor: `${t.hex}50`, color: t.hex }}
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: t.hex }} />
                                        <span className="truncate max-w-[85px] font-black">{r.engineer.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {matrix.engineerRows.map(row => {
                            const isVirtual = row.engineer.id.startsWith('sim_');
                            const engTheme = getEngineerTheme(row.engineer.id);

                            return (
                                <div key={row.engineer.id} className="flex items-center gap-4 group">
                                    {/* Row Label with Engineer Signature Theme */}
                                    <div className={`w-44 shrink-0 p-2.5 rounded-xl border shadow-xs transition-all ${
                                        isVirtual 
                                            ? 'bg-purple-50 border-purple-200 text-purple-950' 
                                            : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                                    }`}>
                                        {editingEngineerId === row.engineer.id ? (
                                            <div className="flex items-center gap-1 w-full">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editingEngineerName}
                                                    onChange={(e) => setEditingEngineerName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveRename(row.engineer.id);
                                                        if (e.key === 'Escape') setEditingEngineerId(null);
                                                    }}
                                                    className="w-full text-xs font-black bg-white border border-indigo-500 rounded px-1.5 py-0.5 outline-none ring-1 ring-indigo-400"
                                                    disabled={isSavingEngineerName}
                                                />
                                                <button
                                                    onClick={() => handleSaveRename(row.engineer.id)}
                                                    disabled={isSavingEngineerName}
                                                    className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-black px-1.5 py-1 rounded shadow-2xs shrink-0 cursor-pointer"
                                                >
                                                    {isSavingEngineerName ? '...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setEditingEngineerId(null)}
                                                    disabled={isSavingEngineerName}
                                                    className="text-[10px] text-slate-400 hover:text-slate-600 px-0.5 shrink-0 cursor-pointer"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span 
                                                        className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white"
                                                        style={{ backgroundColor: engTheme.hex }}
                                                        title={`Assigned signature color: ${engTheme.name}`}
                                                    />
                                                    <span 
                                                        className="font-black text-xs truncate cursor-pointer hover:text-indigo-700" 
                                                        title={onUpdateEngineer && !isVirtual ? "Click to rename technician" : row.engineer.name}
                                                        onClick={() => {
                                                            if (onUpdateEngineer && !isVirtual) handleStartRename(row.engineer);
                                                        }}
                                                    >
                                                        {row.engineer.name}
                                                    </span>
                                                    {!isVirtual && onUpdateEngineer && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartRename(row.engineer);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 hover:bg-slate-100 p-0.5 rounded text-slate-400 hover:text-indigo-600 transition-all shrink-0 cursor-pointer"
                                                            title="Rename technician"
                                                        >
                                                            <Edit3 size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {row.engineer.isTransferred && (
                                                        <span 
                                                            className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs bg-amber-500 text-white flex items-center gap-1 shrink-0 cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsTransferModalOpen(true);
                                                            }}
                                                            title={`Borrowed technician from another workshop to assist with backlog`}
                                                        >
                                                            <ArrowRightLeft size={8} />
                                                            Borrowed
                                                        </span>
                                                    )}
                                                    {isVirtual ? (
                                                        <span className="text-[8px] font-black uppercase bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-xs">Simulated</span>
                                                    ) : (
                                                        <span 
                                                            className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 shadow-xs text-white"
                                                            style={{ backgroundColor: engTheme.hex }}
                                                        >
                                                            Tech
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                            {row.blocks.length} wrench task(s)
                                        </span>
                                    </div>

                                    {/* Row Track */}
                                    <div className="relative flex-grow h-14 bg-slate-100/80 rounded-xl border border-slate-200 overflow-hidden">
                                        {/* Column grid lines */}
                                        <div 
                                            className="absolute inset-0 grid pointer-events-none"
                                            style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))` }}
                                        >
                                            {timelineDays.map(td => (
                                                <div key={td.dateStr} className={`border-r border-slate-200/90 ${td.isToday ? 'bg-indigo-50/60' : ''}`} />
                                            ))}
                                        </div>

                                        {/* Blocks on this Engineer */}
                                        {row.blocks.map(block => {
                                            const isHovered = hoveredJobId === block.jobId;
                                            const isDimmed = hoveredJobId && !isHovered;
                                            const isSuggested = block.isSuggested || block.fcsState === 'SUGGESTED';
                                            const isEstSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));

                                            return (
                                                <div
                                                    key={block.id}
                                                    data-block-id={block.id}
                                                    onMouseEnter={() => setHoveredJobId(block.jobId)}
                                                    onMouseLeave={() => setHoveredJobId(null)}
                                                    onClick={() => {
                                                        if (isSuggested || isEstSim) {
                                                            setAdjustingSuggestedBlock(block);
                                                        } else {
                                                            onEditJob(block.jobId);
                                                        }
                                                    }}
                                                    style={{
                                                        left: `${block.startPercent}%`,
                                                        width: `${block.durationPercent}%`,
                                                        background: isEstSim
                                                            ? 'linear-gradient(135deg, rgba(120, 53, 15, 0.9), rgba(180, 83, 9, 0.9))'
                                                            : isSuggested
                                                                ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.9), rgba(49, 46, 129, 0.9))'
                                                                : block.isSimulated 
                                                                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                                                                    : `linear-gradient(135deg, ${engTheme.gradientFrom}, ${engTheme.gradientTo})`,
                                                        borderColor: isEstSim ? '#f59e0b' : isSuggested ? '#c084fc' : (block.isSimulated ? '#a78bfa' : engTheme.border),
                                                        borderStyle: (isSuggested || isEstSim) ? 'dashed' : 'solid',
                                                        borderWidth: (isSuggested || isEstSim) ? '2px' : '1px'
                                                    }}
                                                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-2.5 py-1 flex flex-col justify-center cursor-pointer transition-all duration-200 z-10 text-white shadow-md ${
                                                        isHovered ? 'ring-2 ring-white scale-[1.02] z-20 shadow-xl' : ''
                                                    } ${isDimmed ? 'opacity-35' : ''}`}
                                                    title={`Wrench Time for Job #${block.jobId}: ${block.title} (${block.hours}h)${isEstSim ? ' • [Simulated Estimate - Click to Move/Adjust]' : isSuggested ? ' • [Suggested Work Allocation - Click to Move/Adjust]' : ''} • Tech: ${row.engineer.name}`}
                                                >
                                                    <div className="flex items-center justify-between text-[11px] font-black leading-tight">
                                                        <span className="font-mono uppercase tracking-tight truncate flex items-center gap-1">
                                                            {(isSuggested || isEstSim) && <Sparkles size={11} className={isEstSim ? "text-amber-400 shrink-0" : "text-purple-300 shrink-0"} />}
                                                            {block.vehicleRegistration || `#${block.jobId}`}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isEstSim ? (
                                                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-600 text-white font-sans">
                                                                    Est Sim
                                                                </span>
                                                            ) : isSuggested && (
                                                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-purple-500/80 text-white font-sans">
                                                                    Suggested
                                                                </span>
                                                            )}
                                                            <span className="font-mono text-[10px] bg-black/25 px-1 rounded">{block.hours}h</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] truncate opacity-95 font-bold">
                                                        {isEstSim ? `Estimate: ${block.title}` : isSuggested ? `Suggested: ${block.title}` : block.title}
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
                    estimates={estimates}
                    unallocatedJobs={unallocatedJobs}
                    onBookJob={(newJob) => {
                        onSaveJob(newJob);
                    }}
                    onSaveEstimate={(est) => {
                        if (onSaveEstimate) onSaveEstimate(est);
                    }}
                />
            )}

            {/* FCS Schedule Auto-Optimizer Modal */}
            {isOptimizerOpen && (
                <FCSOptimizerModal
                    isOpen={isOptimizerOpen}
                    onClose={() => setIsOptimizerOpen(false)}
                    jobs={jobs}
                    ramps={ramps}
                    engineers={engineers}
                    purchaseOrders={purchaseOrders}
                    vehicles={vehicles}
                    customers={customers}
                    estimates={estimates}
                    windowDays={windowDays}
                    startDateStr={startDateStr}
                    onSaveEstimate={onSaveEstimate}
                    onSavePurchaseOrder={onSavePurchaseOrder}
                    onPreviewOnGantt={(plan) => {
                        setGanttSuggestedPlan(plan);
                        setShowSuggestedGanttPreview(true);
                    }}
                    onApplyOptimizedPlan={async (updatedJobs, convertedEstimates, updatedPos) => {
                        for (const job of updatedJobs) {
                            await onSaveJob(job);
                        }
                        if (convertedEstimates && onSaveEstimate) {
                            for (const est of convertedEstimates) {
                                await onSaveEstimate(est);
                            }
                        }
                        if (updatedPos && onSavePurchaseOrder) {
                            for (const po of updatedPos) {
                                await onSavePurchaseOrder(po);
                            }
                        }
                        if (showSuggestedGanttPreview) {
                            setShowSuggestedGanttPreview(false);
                            setGanttSuggestedPlan([]);
                        }
                    }}
                />
            )}

            {/* Inter-Workshop Technician Transfer Modal */}
            {isTransferModalOpen && onUpdateEngineerTransfer && (
                <TechnicianTransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    allEngineers={allEngineers.length > 0 ? allEngineers : engineers}
                    currentEngineers={engineers}
                    businessEntities={businessEntities}
                    selectedEntityId={selectedEntityId}
                    onUpdateEngineerTransfer={onUpdateEngineerTransfer}
                />
            )}

            {/* Suggested / Simulated Block Move & Adjust Modal */}
            {adjustingSuggestedBlock && (
                <AdjustSuggestedAllocationModal
                    isOpen={Boolean(adjustingSuggestedBlock)}
                    block={adjustingSuggestedBlock}
                    planItem={ganttSuggestedPlan.find(p => p.job.id === adjustingSuggestedBlock.jobId)}
                    usableRamps={usableRamps}
                    engineers={engineers}
                    onClose={() => setAdjustingSuggestedBlock(null)}
                    onApply={handleMoveSuggestedBlock}
                />
            )}
        </div>
    );
};

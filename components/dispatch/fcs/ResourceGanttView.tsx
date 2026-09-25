import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job, Lift, Engineer, PurchaseOrder, Vehicle, Customer, User, Estimate, FCSGanttBlock, FCSDependencyLink, BusinessEntity, JobSegment } from '../../../types';
import { calculateFCSMatrix, FCSMatrixResult } from '../../../core/services/fcsSchedulingEngine';
import { ServiceAdvisorBookingBufferModal } from './ServiceAdvisorBookingBufferModal';
import { FCSOptimizerModal, OptimizedAssignment } from './FCSOptimizerModal';
import { TechnicianTransferModal } from './TechnicianTransferModal';
import { AdjustSuggestedAllocationModal } from './AdjustSuggestedAllocationModal';
import { PrintableFCSScheduleModal } from './PrintableFCSScheduleModal';
import { Sparkles, Wrench, Layers, AlertTriangle, CheckCircle, Clock, Calendar, Users, RefreshCw, Plus, ChevronLeft, ChevronRight, Activity, ArrowRight, Zap, Info, Edit3, ArrowRightLeft, Printer, Move, ExternalLink, GripVertical } from 'lucide-react';
import { getRelativeDate, addDays, formatDate, getWorkingDaySpan, getTodayISOString, addDaysToDateStr } from '../../../core/utils/dateUtils';
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
        border: '#3b82f6',
        hex: '#2563eb',
        lightHex: '#eff6ff',
        badgeBg: 'bg-blue-600',
        badgeText: 'text-white'
    },
    {
        id: 'emerald',
        name: 'Emerald Green',
        gradientFrom: '#059669', // emerald-600
        gradientTo: '#047857',   // emerald-700
        border: '#10b981',
        hex: '#059669',
        lightHex: '#ecfdf5',
        badgeBg: 'bg-emerald-600',
        badgeText: 'text-white'
    },
    {
        id: 'amber',
        name: 'Amber Bronze',
        gradientFrom: '#d97706', // amber-600
        gradientTo: '#b45309',   // amber-700
        border: '#f59e0b',
        hex: '#d97706',
        lightHex: '#fffbeb',
        badgeBg: 'bg-amber-600',
        badgeText: 'text-white'
    },
    {
        id: 'crimson',
        name: 'Crimson Red',
        gradientFrom: '#dc2626', // red-600
        gradientTo: '#b91c1c',   // red-700
        border: '#ef4444',
        hex: '#dc2626',
        lightHex: '#fef2f2',
        badgeBg: 'bg-red-600',
        badgeText: 'text-white'
    },
    {
        id: 'violet',
        name: 'Royal Purple',
        gradientFrom: '#7c3aed', // violet-600
        gradientTo: '#6d28d9',   // violet-700
        border: '#8b5cf6',
        hex: '#7c3aed',
        lightHex: '#f5f3ff',
        badgeBg: 'bg-violet-600',
        badgeText: 'text-white'
    },
    {
        id: 'cyan',
        name: 'Electric Cyan',
        gradientFrom: '#0891b2', // cyan-600
        gradientTo: '#0e7490',   // cyan-700
        border: '#06b6d4',
        hex: '#0891b2',
        lightHex: '#ecfeff',
        badgeBg: 'bg-cyan-600',
        badgeText: 'text-white'
    },
    {
        id: 'indigo',
        name: 'Deep Indigo',
        gradientFrom: '#4f46e5', // indigo-600
        gradientTo: '#4338ca',   // indigo-700
        border: '#6366f1',
        hex: '#4f46e5',
        lightHex: '#eef2ff',
        badgeBg: 'bg-indigo-600',
        badgeText: 'text-white'
    },
    {
        id: 'slate',
        name: 'Gunmetal Slate',
        gradientFrom: '#475569', // slate-600
        gradientTo: '#334155',   // slate-700
        border: '#64748b',
        hex: '#475569',
        lightHex: '#f8fafc',
        badgeBg: 'bg-slate-600',
        badgeText: 'text-white'
    }
];

export const getEngineerTheme = (engineerId: string, engineersList?: Engineer[]): EngineerTheme => {
    if (!engineerId) return ENGINEER_COLOR_PALETTES[0];
    if (engineerId.startsWith('sim_')) {
        return {
            id: 'virtual',
            name: 'Virtual Tech',
            gradientFrom: '#7c3aed',
            gradientTo: '#4f46e5',
            border: '#a78bfa',
            hex: '#7c3aed',
            lightHex: '#f5f3ff',
            badgeBg: 'bg-purple-600',
            badgeText: 'text-white'
        };
    }
    let hash = 0;
    for (let i = 0; i < engineerId.length; i++) {
        hash = (hash << 5) - hash + engineerId.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % ENGINEER_COLOR_PALETTES.length;
    return ENGINEER_COLOR_PALETTES[idx];
};

export interface ResourceGanttViewProps {
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    allEngineers?: Engineer[];
    selectedEntityId?: string;
    purchaseOrders: PurchaseOrder[];
    vehicles?: Vehicle[];
    customers?: Customer[];
    users?: User[];
    currentUser?: User;
    estimates?: Estimate[];
    businessEntities?: BusinessEntity[];
    unallocatedJobs?: Job[];
    onEditJob: (jobId: string, initialTab?: any) => void;
    onSaveJob?: (job: Job) => Promise<void> | void;
    onSaveEstimate?: (est: Partial<Estimate>) => Promise<void> | void;
    onSavePurchaseOrder?: (po: Partial<PurchaseOrder>) => Promise<void> | void;
    onUpdateEngineer?: (engineerId: string, newName: string) => Promise<void> | void;
    onUpdateEngineerTransfer?: (engineerId: string, toEntityId: string | null, reason?: string) => Promise<void> | void;
}

export const ResourceGanttView: React.FC<ResourceGanttViewProps> = ({
    jobs = [],
    ramps = [],
    engineers = [],
    allEngineers = [],
    selectedEntityId = 'all',
    purchaseOrders = [],
    vehicles = [],
    customers = [],
    users = [],
    currentUser,
    estimates = [],
    businessEntities = [],
    unallocatedJobs: passedUnallocatedJobs,
    onEditJob,
    onSaveJob,
    onSaveEstimate,
    onSavePurchaseOrder,
    onUpdateEngineer,
    onUpdateEngineerTransfer
}) => {
    // Interactive state
    const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
    const [windowDays, setWindowDays] = useState<number>(7);
    const [simulateExtraEngineers, setSimulateExtraEngineers] = useState<number>(0);
    const [showScheduledUnallocated, setShowScheduledUnallocated] = useState<boolean>(false);
    const [isAssigningAllTrimming, setIsAssigningAllTrimming] = useState<boolean>(false);
    const [isBufferModalOpen, setIsBufferModalOpen] = useState<boolean>(false);
    const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
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

    // Unallocated jobs pool
    const unallocatedJobs = useMemo(() => {
        if (passedUnallocatedJobs && passedUnallocatedJobs.length > 0) return passedUnallocatedJobs;
        return jobs.filter(j => isJobUnallocated(j));
    }, [passedUnallocatedJobs, jobs]);

    const startDateStr = useMemo(() => {
        return addDaysToDateStr(getTodayISOString(), startDateOffset);
    }, [startDateOffset]);

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
            });

            // Seed with booked jobs
            const bookedJobs = jobs.filter(j => isJobAllocated(j));
            bookedJobs.forEach(bj => {
                const bjHours = bj.estimatedHours || 2;
                if (bj.segments && bj.segments.length > 0 && bj.segments.some(s => !!s.date)) {
                    bj.segments.forEach(s => {
                        if (!s.date || s.status === 'Cancelled') return;
                        const h = s.duration || 2;
                        const rMap = dayRampHours.get(s.date);
                        const tMap = dayTechHours.get(s.date);
                        if (rMap) {
                            const matchedRamp = usableRamps.find(r => r.name === s.allocatedLift || r.id === s.allocatedLift) || usableRamps[0];
                            if (matchedRamp) rMap.set(matchedRamp.id, (rMap.get(matchedRamp.id) || 0) + h);
                        }
                        if (tMap) {
                            const matchedTech = engineers.find(e => e.id === s.engineerId || (e.name && e.name.toLowerCase() === s.engineerId?.toLowerCase())) || engineers[0];
                            if (matchedTech) tMap.set(matchedTech.id, (tMap.get(matchedTech.id) || 0) + h);
                        }
                    });
                } else {
                    const slices = getWorkingDaySpan(bj.scheduledDate || startDateStr, bjHours, 8);
                    const seg = bj.segments?.[0];
                    const matchedRamp = usableRamps.find(r => r.name === seg?.allocatedLift || r.id === seg?.allocatedLift) || usableRamps[0];
                    const matchedTech = engineers.find(e => e.id === seg?.engineerId || (e.name && e.name.toLowerCase() === seg?.engineerId?.toLowerCase())) || engineers[0];
                    slices.forEach(slice => {
                        const rMap = dayRampHours.get(slice.date);
                        const tMap = dayTechHours.get(slice.date);
                        if (rMap && matchedRamp) rMap.set(matchedRamp.id, (rMap.get(matchedRamp.id) || 0) + slice.hours);
                        if (tMap && matchedTech) tMap.set(matchedTech.id, (tMap.get(matchedTech.id) || 0) + slice.hours);
                    });
                }
            });

            const plan: OptimizedAssignment[] = [];
            queueToAllocate.forEach((job) => {
                const hours = job.estimatedHours || 2;
                const slices = getWorkingDaySpan(startDateStr, hours, 8);
                let chosenDate = startDateStr;
                let chosenRampId = usableRamps[0]?.id || '';
                let chosenTechId = engineers[0]?.id || '';
                let placed = false;

                for (const day of daysList) {
                    const candidateSlices = getWorkingDaySpan(day, hours, 8);
                    let bestRampId: string | null = null;
                    let lowestRamp = Infinity;

                    usableRamps.forEach(r => {
                        let canFit = true;
                        let totalLoad = 0;
                        for (const slice of candidateSlices) {
                            const rMap = dayRampHours.get(slice.date);
                            const l = rMap ? (rMap.get(r.id) || 0) : 0;
                            if (l + slice.hours > 8.5) { canFit = false; break; }
                            totalLoad += l;
                        }
                        if (canFit && totalLoad < lowestRamp) {
                            lowestRamp = totalLoad;
                            bestRampId = r.id;
                        }
                    });

                    let bestTechId: string | null = null;
                    let lowestTech = Infinity;
                    engineers.forEach(eng => {
                        let canFit = true;
                        let totalLoad = 0;
                        for (const slice of candidateSlices) {
                            const tMap = dayTechHours.get(slice.date);
                            const l = tMap ? (tMap.get(eng.id) || 0) : 0;
                            if (l + slice.hours > 8.5) { canFit = false; break; }
                            totalLoad += l;
                        }
                        if (canFit && totalLoad < lowestTech) {
                            lowestTech = totalLoad;
                            bestTechId = eng.id;
                        }
                    });

                    if (bestRampId && bestTechId) {
                        chosenDate = day;
                        chosenRampId = bestRampId;
                        chosenTechId = bestTechId;
                        placed = true;
                        candidateSlices.forEach(slice => {
                            const rMap = dayRampHours.get(slice.date);
                            const tMap = dayTechHours.get(slice.date);
                            if (rMap) rMap.set(bestRampId!, (rMap.get(bestRampId!) || 0) + slice.hours);
                            if (tMap) tMap.set(bestTechId!, (tMap.get(bestTechId!) || 0) + slice.hours);
                        });
                        break;
                    }
                }

                if (!placed) {
                    chosenDate = daysList[0] || startDateStr;
                    chosenRampId = usableRamps[plan.length % usableRamps.length]?.id || '';
                    chosenTechId = engineers[plan.length % engineers.length]?.id || '';
                }

                plan.push({
                    job,
                    hours,
                    recommendedEngineerId: chosenTechId,
                    recommendedRampId: chosenRampId,
                    scheduledDate: chosenDate,
                    endDate: slices[slices.length - 1]?.date || chosenDate,
                    totalWorkingDays: Math.round((hours / 8) * 10) / 10,
                    dailyBreakdown: slices,
                    partsLeadDays: 0
                });
            });

            setGanttSuggestedPlan(plan);
        }

        setShowSuggestedGanttPreview(true);
    };

    // Move single suggested block
    const handleMoveSuggestedBlock = (jobId: string, newDate: string, newRampId?: string, newTechId?: string) => {
        setGanttSuggestedPlan(prev => prev.map(p => {
            if (p.job.id !== jobId) return p;
            const updatedBreakdown = getWorkingDaySpan(newDate, p.hours, 8);
            return {
                ...p,
                scheduledDate: newDate,
                endDate: updatedBreakdown[updatedBreakdown.length - 1]?.date || newDate,
                dailyBreakdown: updatedBreakdown,
                recommendedRampId: newRampId || p.recommendedRampId,
                recommendedEngineerId: newTechId || p.recommendedEngineerId
            };
        }));
        setAdjustingSuggestedBlock(null);
    };

    // Lock and allocate suggested work plan directly into confirmed schedule
    const handleCommitSuggestedPlan = async () => {
        if (!ganttSuggestedPlan || ganttSuggestedPlan.length === 0 || !onSaveJob) return;
        for (const item of ganttSuggestedPlan) {
            const assignedRamp = usableRamps.find(r => r.id === item.recommendedRampId) || usableRamps[0];
            const assignedRampName = assignedRamp?.name || 'Ramp';
            const techName = engineers.find(e => e.id === item.recommendedEngineerId)?.name || 'Tech';
            const isEstimateSim = Boolean(item.isEstimateSimulation || item.job.id.startsWith('sim_est_'));

            const slices = item.dailyBreakdown || getWorkingDaySpan(item.scheduledDate, item.hours, 8);

            if (isEstimateSim) {
                const newJobId = `job_from_est_${item.estimateId || Date.now()}_${Date.now()}`;
                const segments: JobSegment[] = (slices.length > 0)
                    ? slices.map((slice, sIdx) => ({
                        id: `seg_${Date.now()}_${newJobId}_${sIdx}`,
                        segmentId: `seg_${Date.now()}_${newJobId}_${sIdx}`,
                        description: slices.length > 1 ? `${item.job.description} (Day ${slice.dayIndex}/${slice.totalDays})` : item.job.description,
                        status: 'Allocated' as const,
                        engineerId: item.recommendedEngineerId,
                        allocatedLift: assignedRampName,
                        duration: slice.hours,
                        date: slice.date,
                        scheduledStartSegment: 1
                    }))
                    : [{
                        id: `seg_${Date.now()}_${newJobId}`,
                        segmentId: `seg_${Date.now()}_${newJobId}`,
                        description: item.job.description,
                        status: 'Allocated' as const,
                        engineerId: item.recommendedEngineerId,
                        allocatedLift: assignedRampName,
                        duration: item.hours,
                        date: item.scheduledDate,
                        scheduledStartSegment: 1
                    }];

                const newJob: Job = {
                    ...item.job,
                    id: newJobId,
                    jobNumber: `JOB-${item.job.jobNumber || newJobId.substring(0, 6)}`,
                    status: 'Allocated',
                    scheduledDate: item.scheduledDate,
                    estimateId: item.estimateId,
                    segments,
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Agreed Plan]: Converted from Estimate #${item.job.jobNumber || item.estimateId} and locked to ${assignedRampName} (${techName}) starting ${item.scheduledDate}.`
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
                const segments: JobSegment[] = (slices.length > 0)
                    ? slices.map((slice, sIdx) => ({
                        id: (item.job.segments && item.job.segments[sIdx]?.id) || `seg_${Date.now()}_${item.job.id}_${sIdx}`,
                        segmentId: (item.job.segments && item.job.segments[sIdx]?.segmentId) || `seg_${Date.now()}_${item.job.id}_${sIdx}`,
                        description: slices.length > 1 ? `${item.job.description} (Day ${slice.dayIndex}/${slice.totalDays})` : item.job.description,
                        status: 'Allocated' as const,
                        engineerId: item.recommendedEngineerId,
                        allocatedLift: assignedRampName,
                        duration: slice.hours,
                        date: slice.date,
                        scheduledStartSegment: 1
                    }))
                    : [{
                        id: `seg_${Date.now()}_${item.job.id}`,
                        segmentId: `seg_${Date.now()}_${item.job.id}`,
                        description: item.job.description,
                        status: 'Allocated' as const,
                        engineerId: item.recommendedEngineerId,
                        allocatedLift: assignedRampName,
                        duration: item.hours,
                        date: item.scheduledDate,
                        scheduledStartSegment: 1
                    }];

                const updatedJob: Job = {
                    ...item.job,
                    scheduledDate: item.scheduledDate,
                    status: 'Allocated',
                    fcsState: item.partsLeadDays > 0 ? 'STALLED' : 'ACTIVE',
                    materialsStatus: item.partsLeadDays > 0 ? 'Ordered' : 'Delivered',
                    segments,
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Agreed Plan]: Locked and allocated to ${assignedRampName} (${techName}) starting ${item.scheduledDate}.`
                };
                await onSaveJob(updatedJob);
            }
        }
        setShowSuggestedGanttPreview(false);
        setGanttSuggestedPlan([]);
    };

    // Drag & Drop State & Ref on Gantt
    const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<{ type: 'ramp' | 'engineer'; resourceId: string; dateStr: string } | null>(null);
    const activeDragDataRef = useRef<{
        jobId: string;
        blockId?: string;
        sourceType: 'ramp' | 'engineer';
        sourceRampId?: string;
        sourceEngineerId?: string;
        hours: number;
        isSuggested?: boolean;
        isEstSim?: boolean;
    } | null>(null);

    // Universal Job Card Move / Adjustment Handler for ALL Gantt Blocks
    const handleQuickAdjustJob = async (jobId: string, newDate: string, newRampId: string, newEngineerId: string) => {
        const planItem = ganttSuggestedPlan.find(p => p.job.id === jobId);
        if (planItem || showSuggestedGanttPreview || jobId.startsWith('sim_est_')) {
            handleMoveSuggestedBlock(jobId, newDate, newRampId, newEngineerId);
            return;
        }

        const job = jobs.find(j => j.id === jobId);
        if (!job || !onSaveJob) return;

        const assignedRamp = usableRamps.find(r => r.id === newRampId) || usableRamps[0];
        const assignedRampName = assignedRamp?.name || 'Ramp Bay';
        const assignedTech = engineers.find(e => e.id === newEngineerId) || engineers[0];

        const jobHours = job.estimatedHours || (job.segments || []).reduce((s, seg) => s + (seg.duration || 0), 0) || 2;
        const slices = getWorkingDaySpan(newDate, jobHours, 8);

        const updatedSegments: JobSegment[] = (slices.length > 0)
            ? slices.map((slice, sIdx) => ({
                id: (job.segments && job.segments[sIdx]?.id) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                segmentId: (job.segments && job.segments[sIdx]?.segmentId) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                description: slices.length > 1 ? `${job.description} (Day ${slice.dayIndex}/${slice.totalDays})` : job.description,
                status: 'Allocated' as const,
                date: slice.date,
                allocatedLift: assignedRampName,
                engineerId: newEngineerId || (assignedTech?.id || ''),
                duration: slice.hours,
                scheduledStartSegment: 1
            }))
            : [{
                id: `seg_${Date.now()}_${job.id}`,
                segmentId: `seg_${Date.now()}_${job.id}`,
                description: job.description,
                status: 'Allocated' as const,
                date: newDate,
                allocatedLift: assignedRampName,
                engineerId: newEngineerId || (assignedTech?.id || ''),
                duration: jobHours,
                scheduledStartSegment: 1
            }];

        const updatedJob: Job = {
            ...job,
            scheduledDate: newDate,
            status: job.status === 'Unallocated' ? 'Allocated' : job.status,
            segments: updatedSegments,
            notes: (job.notes ? `${job.notes}\n` : '') + `[Gantt Adjusted]: Reallocated to ${assignedRampName} (${assignedTech?.name || 'Tech'}) starting ${newDate}.`
        };

        await onSaveJob(updatedJob);
        setAdjustingSuggestedBlock(null);
    };

    // Calculate target date from mouse X coordinate relative to the row track container
    const getTargetDateFromTrackX = (clientX: number, containerEl: HTMLDivElement, days: { dateStr: string }[]): string => {
        const rect = containerEl.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
        const dayIndex = Math.min(days.length - 1, Math.max(0, Math.floor((x / rect.width) * days.length)));
        return days[dayIndex]?.dateStr || days[0]?.dateStr;
    };

    const handleDropOnRamp = async (e: React.DragEvent, targetRampId: string, targetDateStr: string) => {
        try {
            let data = activeDragDataRef.current;
            if (!data) {
                try {
                    const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
                    if (raw) data = JSON.parse(raw);
                } catch {}
            }
            if (!data || !data.jobId) return;

            const { jobId, isSuggested, isEstSim } = data;

            if (isSuggested || isEstSim || showSuggestedGanttPreview || jobId.startsWith('sim_est_')) {
                handleMoveSuggestedBlock(jobId, targetDateStr, targetRampId, data.sourceEngineerId || engineers[0]?.id || '');
                return;
            }

            const job = jobs.find(j => j.id === jobId);
            if (!job || !onSaveJob) return;

            const targetRamp = usableRamps.find(r => r.id === targetRampId) || usableRamps[0];
            const assignedRampName = targetRamp?.name || 'Ramp Bay';
            const defaultTechId = data.sourceEngineerId || job.segments?.[0]?.engineerId || engineers[0]?.id || '';
            const techName = engineers.find(e => e.id === defaultTechId)?.name || 'Tech';

            const jobHours = job.estimatedHours || (job.segments || []).reduce((s, seg) => s + (seg.duration || 0), 0) || 2;
            const slices = getWorkingDaySpan(targetDateStr, jobHours, 8);

            const updatedSegments: JobSegment[] = (slices.length > 0)
                ? slices.map((slice, sIdx) => ({
                    id: (job.segments && job.segments[sIdx]?.id) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                    segmentId: (job.segments && job.segments[sIdx]?.segmentId) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                    description: slices.length > 1 ? `${job.description} (Day ${slice.dayIndex}/${slice.totalDays})` : job.description,
                    status: 'Allocated' as const,
                    date: slice.date,
                    allocatedLift: assignedRampName,
                    engineerId: defaultTechId,
                    duration: slice.hours,
                    scheduledStartSegment: 1
                }))
                : [{
                    id: `seg_${Date.now()}_${job.id}`,
                    segmentId: `seg_${Date.now()}_${job.id}`,
                    description: job.description,
                    status: 'Allocated' as const,
                    date: targetDateStr,
                    allocatedLift: assignedRampName,
                    engineerId: defaultTechId,
                    duration: jobHours,
                    scheduledStartSegment: 1
                }];

            const updatedJob: Job = {
                ...job,
                scheduledDate: targetDateStr,
                status: job.status === 'Unallocated' ? 'Allocated' : job.status,
                segments: updatedSegments,
                notes: (job.notes ? `${job.notes}\n` : '') + `[Gantt Drag-Drop]: Moved to ${assignedRampName} (${techName}) starting ${targetDateStr}.`
            };

            await onSaveJob(updatedJob);
        } catch (err) {
            console.error('Error handling ramp drop:', err);
        } finally {
            activeDragDataRef.current = null;
            setDraggingJobId(null);
            setDragOverTarget(null);
        }
    };

    const handleDropOnEngineer = async (e: React.DragEvent, targetEngineerId: string, targetDateStr: string) => {
        try {
            let data = activeDragDataRef.current;
            if (!data) {
                try {
                    const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
                    if (raw) data = JSON.parse(raw);
                } catch {}
            }
            if (!data || !data.jobId) return;

            const { jobId, isSuggested, isEstSim } = data;

            if (isSuggested || isEstSim || showSuggestedGanttPreview || jobId.startsWith('sim_est_')) {
                handleMoveSuggestedBlock(jobId, targetDateStr, data.sourceRampId || usableRamps[0]?.id || '', targetEngineerId);
                return;
            }

            const job = jobs.find(j => j.id === jobId);
            if (!job || !onSaveJob) return;

            const targetTech = engineers.find(eng => eng.id === targetEngineerId) || engineers[0];
            const defaultRamp = data.sourceRampId 
                ? (usableRamps.find(r => r.id === data.sourceRampId)?.name || 'Ramp Bay') 
                : (job.segments?.[0]?.allocatedLift || usableRamps[0]?.name || 'Ramp Bay');

            const jobHours = job.estimatedHours || (job.segments || []).reduce((s, seg) => s + (seg.duration || 0), 0) || 2;
            const slices = getWorkingDaySpan(targetDateStr, jobHours, 8);

            const updatedSegments: JobSegment[] = (slices.length > 0)
                ? slices.map((slice, sIdx) => ({
                    id: (job.segments && job.segments[sIdx]?.id) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                    segmentId: (job.segments && job.segments[sIdx]?.segmentId) || `seg_${Date.now()}_${job.id}_${sIdx}`,
                    description: slices.length > 1 ? `${job.description} (Day ${slice.dayIndex}/${slice.totalDays})` : job.description,
                    status: 'Allocated' as const,
                    date: slice.date,
                    allocatedLift: defaultRamp,
                    engineerId: targetEngineerId,
                    duration: slice.hours,
                    scheduledStartSegment: 1
                }))
                : [{
                    id: `seg_${Date.now()}_${job.id}`,
                    segmentId: `seg_${Date.now()}_${job.id}`,
                    description: job.description,
                    status: 'Allocated' as const,
                    date: targetDateStr,
                    allocatedLift: defaultRamp,
                    engineerId: targetEngineerId,
                    duration: jobHours,
                    scheduledStartSegment: 1
                }];

            const updatedJob: Job = {
                ...job,
                scheduledDate: targetDateStr,
                status: job.status === 'Unallocated' ? 'Allocated' : job.status,
                segments: updatedSegments,
                notes: (job.notes ? `${job.notes}\n` : '') + `[Gantt Drag-Drop]: Reassigned to ${targetTech.name} (${defaultRamp}) starting ${targetDateStr}.`
            };

            await onSaveJob(updatedJob);
        } catch (err) {
            console.error('Error handling engineer drop:', err);
        }
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

    // Quick 1-click batch allocation for scheduled trimming jobs to Vincent Gibson
    const handleAssignAllToVincent = async () => {
        if (!onSaveJob) return;
        const vincentEng = (engineers || []).find(e => e.id === 'eng_vincent' || (e.name && e.name.toLowerCase().includes('vincent'))) || 
                           (allEngineers || []).find(e => e.id === 'eng_vincent' || (e.name && e.name.toLowerCase().includes('vincent')));
        const targetEngId = vincentEng?.id || 'eng_vincent';
        const defaultRamp = usableRamps[0]?.name || 'Trimming Area 1';

        setIsAssigningAllTrimming(true);
        try {
            const trimmingJobsToAssign = jobs.filter(j => 
                (j.entityId === 'ent_trimming' || selectedEntityId === 'ent_trimming') &&
                isJobUnallocated(j) &&
                Boolean(j.scheduledDate || (j.segments && j.segments.some(s => !!s.date)))
            );

            for (const j of trimmingJobsToAssign) {
                const targetDate = j.scheduledDate || j.segments?.[0]?.date || formatDate(new Date());
                const updatedSegments = (j.segments && j.segments.length > 0)
                    ? j.segments.map(s => ({
                        ...s,
                        engineerId: targetEngId,
                        allocatedLift: s.allocatedLift || defaultRamp,
                        status: 'Allocated' as const,
                        date: s.date || targetDate
                    }))
                    : [{
                        id: `seg_${Date.now()}_${j.id}`,
                        segmentId: `seg_${Date.now()}_${j.id}`,
                        description: j.description,
                        status: 'Allocated' as const,
                        engineerId: targetEngId,
                        allocatedLift: defaultRamp,
                        duration: j.estimatedHours || 4,
                        date: targetDate,
                        scheduledStartSegment: 1
                    }];

                const updatedJob: Job = {
                    ...j,
                    status: 'Allocated',
                    scheduledDate: targetDate,
                    segments: updatedSegments,
                    notes: (j.notes ? `${j.notes}\n` : '') + `[Allocated]: Assigned to Vincent Gibson on ${targetDate}.`
                };

                await onSaveJob(updatedJob);
            }
        } catch (err) {
            console.error("Failed to assign jobs to Vincent:", err);
        } finally {
            setIsAssigningAllTrimming(false);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const [blockPositions, setBlockPositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

    // Local convenience wrapper for technician theme
    const getTechTheme = (engId: string) => getEngineerTheme(engId, engineers);

    // Timeline column headers
    const timelineDays = useMemo(() => {
        const todayStr = getTodayISOString();
        return Array.from({ length: windowDays }).map((_, i) => {
            const dayStr = addDaysToDateStr(startDateStr, i);
            const d = new Date(dayStr + 'T12:00:00'); // noon to avoid DST edge issues in display
            return {
                dateStr: dayStr,
                dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                dayNum: d.getDate(),
                month: d.toLocaleDateString('en-GB', { month: 'short' }),
                isToday: dayStr === todayStr
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
            includeScheduledUnallocated: showScheduledUnallocated,
            suggestedAllocations: ganttSuggestedPlan.map(item => ({
                jobId: item.job.id,
                rampId: item.recommendedRampId,
                engineerId: item.recommendedEngineerId,
                date: item.scheduledDate,
                hours: item.hours
            }))
        });
    }, [effectiveJobsForMatrix, ramps, engineers, purchaseOrders, vehicles, windowDays, startDateStr, simulateExtraEngineers, showSuggestedGanttPreview, showScheduledUnallocated, ganttSuggestedPlan]);

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

                    {/* Window Shift & Direct Date Picker */}
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
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const todayStr = getTodayISOString();
                                const todayDate = new Date(`${todayStr}T00:00:00`);
                                const chosenDate = new Date(`${e.target.value}T00:00:00`);
                                const diffDays = Math.round((chosenDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                                setStartDateOffset(diffDays);
                            }}
                            className="text-xs bg-transparent border-0 px-1 py-0.5 text-slate-700 font-semibold focus:outline-none cursor-pointer hover:bg-white rounded"
                            title="Jump to specific start date"
                        />
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
                        {[7, 14, 30, 60].map(days => (
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
                    {/* Toggle Showing Scheduled Unallocated Jobs */}
                    {(matrix.scheduledUnallocatedCount || 0) > 0 && (
                        <button
                            onClick={() => setShowScheduledUnallocated(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                showScheduledUnallocated
                                    ? 'bg-amber-600 border-amber-500 text-white shadow-amber-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                            title="Toggle showing jobs that have scheduled dates on the Gantt"
                        >
                            <Calendar size={13} className={showScheduledUnallocated ? 'text-amber-200' : 'text-amber-600'} />
                            <span>Scheduled ({matrix.scheduledUnallocatedCount || 0})</span>
                        </button>
                    )}

                    {/* 1-Click Batch Assign Trimming to Vincent Gibson */}
                    {selectedEntityId === 'ent_trimming' && (matrix.scheduledUnallocatedCount || 0) > 0 && (
                        <button
                            onClick={handleAssignAllToVincent}
                            disabled={isAssigningAllTrimming}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Assign all scheduled trimming jobs directly to Vincent Gibson"
                        >
                            <Users size={13} className="text-emerald-200" />
                            <span>{isAssigningAllTrimming ? 'Assigning...' : `Assign All (${matrix.scheduledUnallocatedCount}) to Vincent`}</span>
                        </button>
                    )}

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

                    {/* FCS Print Schedule Button */}
                    <button
                        onClick={() => setIsPrintModalOpen(true)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Print comprehensive FCS workshop schedule"
                    >
                        <Printer size={14} className="text-indigo-600" />
                        <span>Print FCS</span>
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
                                <div 
                                    className="relative flex-grow h-14 bg-slate-100/80 rounded-xl border border-slate-200 overflow-hidden"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        const dateStr = getTargetDateFromTrackX(e.clientX, e.currentTarget, timelineDays);
                                        setDragOverTarget({ type: 'ramp', resourceId: row.ramp.id, dateStr });
                                    }}
                                    onDragLeave={(e) => {
                                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                        setDragOverTarget(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const dateStr = getTargetDateFromTrackX(e.clientX, e.currentTarget, timelineDays);
                                        setDragOverTarget(null);
                                        handleDropOnRamp(e, row.ramp.id, dateStr);
                                    }}
                                >
                                    {/* Column grid drop target cells */}
                                    <div 
                                        className="absolute inset-0 grid"
                                        style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))` }}
                                    >
                                        {timelineDays.map(td => {
                                            const isDragOver = dragOverTarget?.type === 'ramp' && dragOverTarget.resourceId === row.ramp.id && dragOverTarget.dateStr === td.dateStr;
                                            return (
                                                <div 
                                                    key={td.dateStr}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = 'move';
                                                        setDragOverTarget({ type: 'ramp', resourceId: row.ramp.id, dateStr: td.dateStr });
                                                    }}
                                                    onDragLeave={() => {
                                                        setDragOverTarget(null);
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setDragOverTarget(null);
                                                        handleDropOnRamp(e, row.ramp.id, td.dateStr);
                                                    }}
                                                    className={`border-r border-slate-200/90 transition-all ${
                                                        isDragOver 
                                                            ? 'bg-blue-300/40 border-2 border-dashed border-blue-600 shadow-inner' 
                                                            : td.isToday ? 'bg-indigo-50/60' : ''
                                                    }`} 
                                                    title={`Drop job here to assign to ${row.ramp.name} for ${td.dateStr}`}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Blocks on this Ramp */}
                                    {row.blocks.map(block => {
                                        const isHovered = hoveredJobId === block.jobId;
                                        const isDimmed = (hoveredJobId && !isHovered) || (draggingJobId && draggingJobId !== block.jobId);
                                        const isBeingDragged = draggingJobId === block.jobId;
                                        const engTheme = block.engineerId ? getEngineerTheme(block.engineerId) : null;
                                        const isSuggested = block.isSuggested || block.fcsState === 'SUGGESTED';
                                        const isEstSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));
                                        const isSchedUnalloc = Boolean(block.isScheduledUnallocated);

                                        return (
                                            <div
                                                key={block.id}
                                                data-block-id={block.id}
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    const payload = {
                                                        jobId: block.jobId,
                                                        blockId: block.id,
                                                        sourceType: 'ramp' as const,
                                                        sourceRampId: row.ramp.id,
                                                        sourceEngineerId: block.engineerId,
                                                        hours: block.hours,
                                                        isSuggested,
                                                        isEstSim
                                                    };
                                                    activeDragDataRef.current = payload;
                                                    try {
                                                        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                                                        e.dataTransfer.setData('application/json', JSON.stringify(payload));
                                                        e.dataTransfer.effectAllowed = 'move';
                                                    } catch {}
                                                    setDraggingJobId(block.jobId);
                                                }}
                                                onDragEnd={() => {
                                                    activeDragDataRef.current = null;
                                                    setDraggingJobId(null);
                                                    setDragOverTarget(null);
                                                }}
                                                onMouseEnter={(e) => { setHoveredJobId(block.jobId); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                                onMouseLeave={() => { setHoveredJobId(null); setTooltipPos(null); }}
                                                onClick={() => {
                                                    setAdjustingSuggestedBlock(block);
                                                }}
                                                style={{
                                                    left: `${block.startPercent}%`,
                                                    width: `${block.durationPercent}%`,
                                                    ...(engTheme && !block.isDeadWeight && !isSuggested && !isEstSim && !isSchedUnalloc ? {
                                                        borderLeft: `5px solid ${engTheme.hex}`
                                                    } : {})
                                                }}
                                                className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 py-0.5 flex flex-col justify-center cursor-grab active:cursor-grabbing transition-all duration-200 z-10 group/block ${
                                                    isBeingDragged ? 'opacity-40 scale-95 ring-2 ring-indigo-400' : ''
                                                } ${
                                                    draggingJobId && !isBeingDragged ? 'pointer-events-none' : ''
                                                } ${
                                                    block.isDeadWeight
                                                        ? 'bg-amber-100 border-2 border-amber-500 text-amber-950 shadow-sm'
                                                        : isEstSim
                                                            ? 'bg-amber-950/90 border-2 border-dashed border-amber-400 text-white shadow-md'
                                                            : isSuggested
                                                                ? 'bg-purple-950/85 border-2 border-dashed border-purple-400 text-white shadow-md'
                                                                : isSchedUnalloc
                                                                    ? 'bg-amber-950/85 border-2 border-dashed border-amber-400 text-amber-100 shadow-md'
                                                                    : 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md border border-slate-700/60'
                                                } ${isHovered ? 'ring-2 ring-purple-500 scale-[1.02] z-20 shadow-lg' : ''} ${isDimmed ? 'opacity-35' : ''}`}
                                            >

                                                {block.isDeadWeight && (
                                                    <div 
                                                        className="absolute inset-0 rounded-lg pointer-events-none opacity-20" 
                                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #d97706, #d97706 4px, transparent 4px, transparent 10px)' }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between text-[11px] font-black leading-tight relative z-10">
                                                    <span className="font-mono uppercase tracking-tight truncate flex items-center gap-1">
                                                        <GripVertical size={9} className="opacity-60 shrink-0 cursor-grab" />
                                                        {(isSuggested || isEstSim) && <Sparkles size={11} className={isEstSim ? "text-amber-400 shrink-0" : "text-purple-300 shrink-0"} />}
                                                        {block.vehicleRegistration || `#${block.jobId}`}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {isEstSim ? (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-600 text-white shadow-2xs font-sans">
                                                                Est Sim
                                                            </span>
                                                        ) : isSuggested ? (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-600 text-white shadow-2xs font-sans">
                                                                Suggested
                                                            </span>
                                                        ) : isSchedUnalloc ? (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-600 text-white shadow-2xs font-sans">
                                                                Scheduled
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
                                                        
                                                        {/* Quick Adjust & Inspect Buttons on hover */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditJob(block.jobId);
                                                            }}
                                                            className="opacity-0 group-hover/block:opacity-100 p-0.5 hover:bg-white/20 rounded text-slate-300 hover:text-white transition-opacity"
                                                            title="Open full 360° Job Card"
                                                        >
                                                            <ExternalLink size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className={`text-[10px] truncate font-bold relative z-10 ${block.isDeadWeight ? 'text-amber-900' : isEstSim ? 'text-amber-200' : isSuggested ? 'text-purple-200' : isSchedUnalloc ? 'text-amber-200' : 'text-slate-300'}`}>
                                                    {block.isDeadWeight ? '⚠️ STALLED: Awaiting Parts' : isEstSim ? `Estimate: ${block.title}` : (isSuggested ? `Suggested: ${block.title}` : isSchedUnalloc ? `Scheduled: ${block.title}` : block.title)}
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
                                    <div 
                                        className="relative flex-grow h-14 bg-slate-100/80 rounded-xl border border-slate-200 overflow-hidden"
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            const dateStr = getTargetDateFromTrackX(e.clientX, e.currentTarget, timelineDays);
                                            setDragOverTarget({ type: 'engineer', resourceId: row.engineer.id, dateStr });
                                        }}
                                        onDragLeave={(e) => {
                                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                            setDragOverTarget(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const dateStr = getTargetDateFromTrackX(e.clientX, e.currentTarget, timelineDays);
                                            setDragOverTarget(null);
                                            handleDropOnEngineer(e, row.engineer.id, dateStr);
                                        }}
                                    >
                                        {/* Column grid drop target cells */}
                                        <div 
                                            className="absolute inset-0 grid"
                                            style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))` }}
                                        >
                                            {timelineDays.map(td => {
                                                const isDragOver = dragOverTarget?.type === 'engineer' && dragOverTarget.resourceId === row.engineer.id && dragOverTarget.dateStr === td.dateStr;
                                                return (
                                                    <div 
                                                        key={td.dateStr}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = 'move';
                                                            setDragOverTarget({ type: 'engineer', resourceId: row.engineer.id, dateStr: td.dateStr });
                                                        }}
                                                        onDragLeave={() => {
                                                            setDragOverTarget(null);
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setDragOverTarget(null);
                                                            handleDropOnEngineer(e, row.engineer.id, td.dateStr);
                                                        }}
                                                        className={`border-r border-slate-200/90 transition-all ${
                                                            isDragOver 
                                                                ? 'bg-purple-300/40 border-2 border-dashed border-purple-600 shadow-inner' 
                                                                : td.isToday ? 'bg-indigo-50/60' : ''
                                                        }`} 
                                                        title={`Drop job here to assign to ${row.engineer.name} for ${td.dateStr}`}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Blocks on this Engineer */}
                                        {row.blocks.map(block => {
                                            const isHovered = hoveredJobId === block.jobId;
                                            const isDimmed = (hoveredJobId && !isHovered) || (draggingJobId && draggingJobId !== block.jobId);
                                            const isBeingDragged = draggingJobId === block.jobId;
                                            const isSuggested = block.isSuggested || block.fcsState === 'SUGGESTED';
                                            const isEstSim = Boolean(block.isEstimateSimulation || block.jobId.startsWith('sim_est_'));
                                            const isSchedUnalloc = Boolean(block.isScheduledUnallocated);

                                            return (
                                                <div
                                                    key={block.id}
                                                    data-block-id={block.id}
                                                    draggable={true}
                                                    onDragStart={(e) => {
                                                        const payload = {
                                                            jobId: block.jobId,
                                                            blockId: block.id,
                                                            sourceType: 'engineer' as const,
                                                            sourceEngineerId: row.engineer.id,
                                                            sourceRampId: block.resourceId,
                                                            hours: block.hours,
                                                            isSuggested,
                                                            isEstSim
                                                        };
                                                        activeDragDataRef.current = payload;
                                                        try {
                                                            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                                                            e.dataTransfer.setData('application/json', JSON.stringify(payload));
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        } catch {}
                                                        setDraggingJobId(block.jobId);
                                                    }}
                                                    onDragEnd={() => {
                                                        activeDragDataRef.current = null;
                                                        setDraggingJobId(null);
                                                        setDragOverTarget(null);
                                                    }}
                                                    onMouseEnter={(e) => { setHoveredJobId(block.jobId); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                                    onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                                    onMouseLeave={() => { setHoveredJobId(null); setTooltipPos(null); }}
                                                    onClick={() => {
                                                        setAdjustingSuggestedBlock(block);
                                                    }}
                                                    style={{
                                                        left: `${block.startPercent}%`,
                                                        width: `${block.durationPercent}%`,
                                                        background: isEstSim
                                                            ? 'linear-gradient(135deg, rgba(120, 53, 15, 0.9), rgba(180, 83, 9, 0.9))'
                                                            : isSuggested
                                                                ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.9), rgba(49, 46, 129, 0.9))'
                                                                : isSchedUnalloc
                                                                    ? 'linear-gradient(135deg, rgba(146, 64, 14, 0.9), rgba(180, 83, 9, 0.9))'
                                                                    : block.isSimulated 
                                                                        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                                                                        : `linear-gradient(135deg, ${engTheme.gradientFrom}, ${engTheme.gradientTo})`,
                                                        borderColor: isEstSim ? '#f59e0b' : isSuggested ? '#c084fc' : isSchedUnalloc ? '#f59e0b' : (block.isSimulated ? '#a78bfa' : engTheme.border),
                                                        borderStyle: (isSuggested || isEstSim || isSchedUnalloc) ? 'dashed' : 'solid',
                                                        borderWidth: (isSuggested || isEstSim || isSchedUnalloc) ? '2px' : '1px'
                                                    }}
                                                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 py-0.5 flex flex-col justify-center cursor-grab active:cursor-grabbing transition-all duration-200 z-10 text-white shadow-md group/block ${
                                                        isBeingDragged ? 'opacity-40 scale-95 ring-2 ring-indigo-400' : ''
                                                    } ${
                                                        draggingJobId && !isBeingDragged ? 'pointer-events-none' : ''
                                                    } ${
                                                        isHovered ? 'ring-2 ring-white scale-[1.02] z-20 shadow-xl' : ''
                                                    } ${isDimmed ? 'opacity-35' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between text-[11px] font-black leading-tight">
                                                        <span className="font-mono uppercase tracking-tight truncate flex items-center gap-1">
                                                            <GripVertical size={9} className="opacity-60 shrink-0 cursor-grab" />
                                                            {(isSuggested || isEstSim) && <Sparkles size={11} className={isEstSim ? "text-amber-400 shrink-0" : "text-purple-300 shrink-0"} />}
                                                            {block.vehicleRegistration || `#${block.jobId}`}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isEstSim ? (
                                                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-600 text-white font-sans">
                                                                    Est Sim
                                                                </span>
                                                            ) : isSuggested ? (
                                                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-purple-500/80 text-white font-sans">
                                                                    Suggested
                                                                </span>
                                                            ) : isSchedUnalloc ? (
                                                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-600 text-white font-sans">
                                                                    Scheduled
                                                                </span>
                                                            ) : null}
                                                            <span className="font-mono text-[10px] bg-black/25 px-1 rounded">{block.hours}h</span>

                                                            {/* Quick Inspect Button on hover */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditJob(block.jobId);
                                                                }}
                                                                className="opacity-0 group-hover/block:opacity-100 p-0.5 hover:bg-white/20 rounded text-white/80 hover:text-white transition-opacity"
                                                                title="Open full 360° Job Card"
                                                            >
                                                                <ExternalLink size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] truncate opacity-95 font-bold">
                                                        {isEstSim ? `Estimate: ${block.title}` : isSuggested ? `Suggested: ${block.title}` : isSchedUnalloc ? `Scheduled: ${block.title}` : block.title}
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
                        if (onSaveJob && newJob) {
                            onSaveJob(newJob as Job);
                        }
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
                    onUpdateEngineerTransfer={async (engineerId, toEntityId, reason) => {
                        if (onUpdateEngineerTransfer) {
                            await onUpdateEngineerTransfer(engineerId, toEntityId, reason);
                        }
                    }}
                />
            )}

            {/* Move & Adjust Job Card Modal (Universal for ALL Gantt Blocks) */}
            {adjustingSuggestedBlock && (
                <AdjustSuggestedAllocationModal
                    isOpen={Boolean(adjustingSuggestedBlock)}
                    block={adjustingSuggestedBlock}
                    job={jobs.find(j => j.id === adjustingSuggestedBlock.jobId)}
                    planItem={ganttSuggestedPlan.find(p => p.job.id === adjustingSuggestedBlock.jobId)}
                    usableRamps={usableRamps}
                    engineers={engineers}
                    customers={customers}
                    vehicles={vehicles}
                    onClose={() => setAdjustingSuggestedBlock(null)}
                    onApply={handleQuickAdjustJob}
                    onOpenFullJobCard={onEditJob}
                />
            )}

            {/* FCS Printable Schedule Modal */}
            {isPrintModalOpen && (
                <PrintableFCSScheduleModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    matrix={matrix}
                    windowDays={windowDays}
                    startDateStr={startDateStr}
                    businessEntity={businessEntities.find(b => b.id === selectedEntityId) || null}
                    ramps={usableRamps}
                    engineers={engineers}
                    jobs={jobs}
                    purchaseOrders={purchaseOrders}
                    vehicles={vehicles}
                    customers={customers}
                />
            )}

            {/* ============================================================ */}
            {/* GANTT BAR HOVER TOOLTIP                                       */}
            {/* ============================================================ */}
            {(() => {
                if (!hoveredJobId || !tooltipPos) return null;
                const job = jobs.find(j => j.id === hoveredJobId);
                if (!job) return null;
                const customer = customers.find(c => c.id === job.customerId);
                const vehicle = vehicles.find(v => v.id === job.vehicleId ||
                    (job.vehicleRegistration && v.registration?.toLowerCase() === job.vehicleRegistration.toLowerCase()));

                const statusColor = job.status === 'Complete' ? 'bg-green-500'
                    : job.status === 'In Progress' ? 'bg-blue-500'
                    : job.status === 'Awaiting Parts' ? 'bg-amber-500'
                    : job.status === 'Cancelled' ? 'bg-red-500'
                    : 'bg-slate-500';

                // Position: keep inside viewport
                const tipW = 300;
                const tipH = 220;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                let left = tooltipPos.x + 14;
                let top = tooltipPos.y - 10;
                if (left + tipW > vw - 8) left = tooltipPos.x - tipW - 14;
                if (top + tipH > vh - 8) top = vh - tipH - 8;
                if (top < 8) top = 8;

                return (
                    <div
                        className="fixed z-[9999] pointer-events-none"
                        style={{ left, top, width: tipW }}
                    >
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-indigo-950 px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-white font-mono uppercase tracking-wider truncate">
                                    {job.vehicleRegistration || `Job #${job.id.slice(-6)}`}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`w-2 h-2 rounded-full ${statusColor} shrink-0`} />
                                    <span className="text-[10px] font-bold text-slate-300">{job.status}</span>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="px-3 py-2.5 space-y-1.5">
                                {/* Job title */}
                                <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                                    {job.description || 'No description'}
                                </p>

                                {/* Customer */}
                                {customer && (
                                    <div className="flex items-start gap-2 pt-1 border-t border-slate-700/60">
                                        <span className="text-[10px] text-slate-400 w-14 shrink-0 pt-px">Customer</span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-white truncate">{[customer.forename, customer.surname].filter(Boolean).join(' ') || customer.companyName || 'Unknown'}</p>
                                            {customer.phone && (
                                                <p className="text-[10px] text-indigo-300 font-mono">{customer.phone}</p>
                                            )}
                                            {customer.email && (
                                                <p className="text-[10px] text-slate-400 truncate">{customer.email}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Vehicle */}
                                {vehicle && (
                                    <div className="flex items-start gap-2 border-t border-slate-700/60 pt-1">
                                        <span className="text-[10px] text-slate-400 w-14 shrink-0 pt-px">Vehicle</span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-white">
                                                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
                                            </p>
                                            <p className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider">{vehicle.registration}</p>
                                            {vehicle.colour && <p className="text-[10px] text-slate-400">{vehicle.colour}</p>}
                                        </div>
                                    </div>
                                )}

                                {/* Timing & Labour */}
                                <div className="flex items-center gap-3 border-t border-slate-700/60 pt-1.5 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        <Clock size={10} className="text-indigo-400 shrink-0" />
                                        <span className="text-[10px] text-slate-300 font-bold">{job.estimatedHours || '?'}h estimated</span>
                                    </div>
                                    {job.scheduledDate && (
                                        <div className="flex items-center gap-1">
                                            <Calendar size={10} className="text-indigo-400 shrink-0" />
                                            <span className="text-[10px] text-slate-300 font-mono">{job.scheduledDate}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Hint */}
                                <p className="text-[9px] text-slate-500 pt-0.5">
                                    Click to move • Open card for full details
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};

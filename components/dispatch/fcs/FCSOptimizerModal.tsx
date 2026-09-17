import React, { useState, useMemo, useEffect } from 'react';
import { Job, Lift, Engineer, PurchaseOrder, Vehicle, Customer, User, Estimate } from '../../../types';
import { 
    Sparkles, Wrench, Layers, CheckCircle, Clock, AlertTriangle, ArrowRight, X, 
    ChevronRight, RefreshCw, Sliders, Zap, Calendar, PackageCheck, FileText, 
    CheckSquare, Square, Truck, TrendingUp, Filter, Info, Edit3, ShieldAlert,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { getRelativeDate, addDays, formatDate, getNextWorkingDay, formatReadableDate } from '../../../core/utils/dateUtils';
import { getEngineerTheme } from './ResourceGanttView';
import { isJobAllocated, isJobUnallocated } from '../../../core/utils/jobUtils';

export interface FCSOptimizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    vehicles: Vehicle[];
    customers: Customer[];
    estimates?: Estimate[];
    windowDays: number;
    startDateStr: string;
    onApplyOptimizedPlan: (updatedJobs: Job[], convertedEstimates?: Estimate[], updatedPurchaseOrders?: PurchaseOrder[]) => Promise<void> | void;
    onSaveEstimate?: (est: Partial<Estimate>) => Promise<void> | void;
    onSavePurchaseOrder?: (po: Partial<PurchaseOrder>) => Promise<void> | void;
    onPreviewOnGantt?: (plan: OptimizedAssignment[]) => void;
}

export interface OptimizedAssignment {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    hours: number;
    recommendedEngineerId: string;
    recommendedRampId: string;
    scheduledDate: string;
    partsLeadDays: number;
    expectedDeliveryDate?: string;
    isOverridden?: boolean;
    isEstimateSimulation?: boolean;
    estimateId?: string;
    estimateTotal?: number;
}

export interface DailyAllocationSummary {
    dateStr: string;
    dayLabel: string;
    bookedJobs: Job[];
    optimizedJobs: OptimizedAssignment[];
    totalHours: number;
    rampLoad: Map<string, number>; // rampId -> hours
    techLoad: Map<string, number>; // engineerId -> hours
    rampCapacityHours: number;
    techCapacityHours: number;
    efficiencyRating: number; // percentage
}

export const FCSOptimizerModal: React.FC<FCSOptimizerModalProps> = ({
    isOpen,
    onClose,
    jobs = [],
    ramps = [],
    engineers = [],
    purchaseOrders = [],
    vehicles = [],
    customers = [],
    estimates = [],
    windowDays = 7,
    startDateStr = getRelativeDate(0),
    onApplyOptimizedPlan,
    onSaveEstimate,
    onSavePurchaseOrder,
    onPreviewOnGantt
}) => {
    const [activeTab, setActiveTab] = useState<'packing' | 'allocations' | 'estimates' | 'parts'>('packing');
    const [isApplying, setIsApplying] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, { engineerId?: string; rampId?: string; scheduledDate?: string }>>({});
    const [selectedEstimateIds, setSelectedEstimateIds] = useState<Set<string>>(new Set());
    const [convertEstimatesOnApply, setConvertEstimatesOnApply] = useState(false);
    const [expandedDay, setExpandedDay] = useState<string | null>(null);

    // Initialize Purchase Order expected delivery dates defaulting to the NEXT WORKING DAY
    const [poDeliveryDates, setPoDeliveryDates] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!purchaseOrders || purchaseOrders.length === 0) return;

        setPoDeliveryDates(prev => {
            const nextMap = { ...prev };
            purchaseOrders.forEach(po => {
                if (!nextMap[po.id]) {
                    if (po.expectedDeliveryDate) {
                        nextMap[po.id] = po.expectedDeliveryDate.split('T')[0];
                    } else {
                        // Default to the following working day from orderDate, createdAt, or startDateStr
                        const baseDate = po.orderDate || (po as any).createdAt || startDateStr;
                        nextMap[po.id] = getNextWorkingDay(baseDate);
                    }
                }
            });
            return nextMap;
        });
    }, [purchaseOrders, startDateStr]);

    // Lookup caches
    const vehiclesMap = useMemo(() => new Map<string, Vehicle>(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersMap = useMemo(() => new Map<string, Customer>(customers.map(c => [c.id, c])), [customers]);
    const usableRamps = useMemo(() => {
        const active = ramps.filter(r => r.type !== 'Virtual' && !r.name.toLowerCase().includes('storage'));
        return active.length > 0 ? active : ramps;
    }, [ramps]);

    // 1. COMMITTED / BOOKED JOBS (Fixed baseline foundation)
    const { bookedJobs, bookedByDate } = useMemo(() => {
        const booked = jobs.filter(j => isJobAllocated(j));

        const byDate = new Map<string, Job[]>();
        booked.forEach(j => {
            const d = j.scheduledDate || startDateStr;
            if (!byDate.has(d)) byDate.set(d, []);
            byDate.get(d)!.push(j);
        });

        return { bookedJobs: booked, bookedByDate: byDate };
    }, [jobs, startDateStr]);

    // 2. UNALLOCATED QUEUE JOBS
    const unallocatedJobs = useMemo(() => {
        return jobs.filter(j => isJobUnallocated(j));
    }, [jobs]);

    // 3. CANDIDATE ESTIMATES (Pipeline Simulator)
    const candidateEstimates = useMemo(() => {
        return (estimates || []).filter(e => 
            e.status !== 'Converted to Job' && 
            e.status !== 'Closed' && 
            e.status !== 'Rejected'
        );
    }, [estimates]);

    // Transform selected estimates into simulated job objects
    const simulatedJobsFromEstimates = useMemo(() => {
        return candidateEstimates
            .filter(est => selectedEstimateIds.has(est.id))
            .map(est => {
                const laborHours = (est.lineItems || [])
                    .filter(li => li.isLabor)
                    .reduce((sum, li) => sum + (li.quantity || 0), 0) || 2;
                const totalCost = (est.lineItems || []).reduce((sum, li) => sum + ((li.unitPrice || 0) * (li.quantity || 1)), 0);

                return {
                    id: `sim_est_${est.id}`,
                    jobNumber: est.estimateNumber || est.id,
                    description: est.description || `Estimate #${est.estimateNumber || est.id} Pipeline Simulation`,
                    vehicleId: est.vehicleId,
                    customerId: est.customerId,
                    estimatedHours: laborHours,
                    status: 'Unallocated' as const,
                    scheduledDate: est.requestedDate || undefined,
                    priority: est.status === 'Approved' ? 2 : 3,
                    isEstimateSimulation: true,
                    estimateId: est.id,
                    estimateTotal: totalCost,
                    segments: []
                } as Job & { isEstimateSimulation: boolean; estimateId: string; estimateTotal: number };
            });
    }, [candidateEstimates, selectedEstimateIds]);

    // 4. DAY-BY-DAY PLANNING CALENDAR & EFFICIENT SLOT PACKING
    const daysList = useMemo(() => {
        return Array.from({ length: windowDays }).map((_, idx) => getRelativeDate(idx));
    }, [windowDays]);

    // Run the intelligent day-by-day allocation and packing algorithm
    const initialPlan = useMemo<OptimizedAssignment[]>(() => {
        if (engineers.length === 0 || usableRamps.length === 0) return [];

        // All queue jobs to place (unallocated workshop jobs + simulated estimates)
        const queueToAllocate = [...unallocatedJobs, ...simulatedJobsFromEstimates];
        if (queueToAllocate.length === 0) return [];

        // Track day-by-day committed hours per ramp and per tech
        // Map: dateStr -> Map<rampId/techId, hours>
        const dayRampHours = new Map<string, Map<string, number>>();
        const dayTechHours = new Map<string, Map<string, number>>();

        // Seed with BOOKED jobs commitments first!
        daysList.forEach(d => {
            dayRampHours.set(d, new Map<string, number>());
            dayTechHours.set(d, new Map<string, number>());
            usableRamps.forEach(r => dayRampHours.get(d)!.set(r.id, 0));
            engineers.forEach(e => dayTechHours.get(d)!.set(e.id, 0));

            // Load booked jobs for this date
            const bookedForDate = bookedByDate.get(d) || [];
            bookedForDate.forEach(bj => {
                const bjHours = bj.estimatedHours || 2;
                // Find assigned ramp and tech from segments
                const seg = bj.segments?.[0];
                const matchedRamp = usableRamps.find(r => r.name === seg?.allocatedLift || r.id === seg?.allocatedLift) || usableRamps[0];
                const matchedTech = engineers.find(e => e.id === seg?.engineerId || (e.name && e.name.toLowerCase() === seg?.engineerId?.toLowerCase())) || engineers[0];

                if (matchedRamp) {
                    const current = dayRampHours.get(d)!.get(matchedRamp.id) || 0;
                    dayRampHours.get(d)!.set(matchedRamp.id, current + bjHours);
                }
                if (matchedTech) {
                    const current = dayTechHours.get(d)!.get(matchedTech.id) || 0;
                    dayTechHours.get(d)!.set(matchedTech.id, current + bjHours);
                }
            });
        });

        // Sort queue: Highest priority first (1=urgent), then largest jobs first (best fit bin packing)
        const sortedQueue = [...queueToAllocate].sort((a, b) => {
            const prioA = a.priority || 3;
            const prioB = b.priority || 3;
            if (prioA !== prioB) return prioA - prioB;

            const hoursA = a.estimatedHours || 2;
            const hoursB = b.estimatedHours || 2;
            return hoursB - hoursA;
        });

        const assignments: OptimizedAssignment[] = [];

        sortedQueue.forEach((job) => {
            const hours = job.estimatedHours || 2;
            const isSimulated = (job as any).isEstimateSimulation || false;
            const estimateId = (job as any).estimateId;
            const estimateTotal = (job as any).estimateTotal;

            // Find linked POs and calculate earliest parts delivery date
            const linkedPos = purchaseOrders.filter(po => 
                po.jobId === job.id || (job.purchaseOrderIds && job.purchaseOrderIds.includes(po.id))
            );

            let latestPartsDelivery: string | undefined = job.expectedDeliveryDate;
            linkedPos.forEach(po => {
                const poDelivery = poDeliveryDates[po.id] || po.expectedDeliveryDate;
                if (poDelivery && po.status !== 'Received' && po.status !== 'Finalized') {
                    if (!latestPartsDelivery || poDelivery > latestPartsDelivery) {
                        latestPartsDelivery = poDelivery;
                    }
                }
            });

            // Earliest possible scheduling date
            let earliestDateStr = startDateStr;
            if (latestPartsDelivery && latestPartsDelivery > earliestDateStr) {
                earliestDateStr = latestPartsDelivery;
            }
            if (job.scheduledDate && job.scheduledDate > earliestDateStr) {
                earliestDateStr = job.scheduledDate;
            }

            // Calculate parts lead days
            let partsLeadDays = 0;
            if (latestPartsDelivery) {
                const d1 = new Date(startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00`);
                const d2 = new Date(latestPartsDelivery.includes('T') ? latestPartsDelivery : `${latestPartsDelivery}T00:00:00`);
                partsLeadDays = Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
            }

            // Search for optimal day starting at earliestDateStr
            let chosenDate = earliestDateStr;
            let chosenRampId = usableRamps[0].id;
            let chosenEngId = engineers[0].id;
            let placed = false;

            // Is MOT Bay required?
            const isMotJob = (job.description || '').toLowerCase().includes('mot');
            const motBay = usableRamps.find(r => r.type === 'MOT') || usableRamps[0];

            for (const day of daysList) {
                if (day < earliestDateStr) continue;

                const rampMap = dayRampHours.get(day);
                const techMap = dayTechHours.get(day);
                if (!rampMap || !techMap) continue;

                // Check ramp availability (8.5h per ramp limit)
                let bestRampId: string | null = null;
                if (isMotJob && (rampMap.get(motBay.id) || 0) + hours <= 8.5) {
                    bestRampId = motBay.id;
                } else {
                    // Pick ramp with lowest current load that can fit this job
                    let lowestRampLoad = Infinity;
                    usableRamps.forEach(r => {
                        const rLoad = rampMap.get(r.id) || 0;
                        if (rLoad + hours <= 8.5 && rLoad < lowestRampLoad) {
                            lowestRampLoad = rLoad;
                            bestRampId = r.id;
                        }
                    });
                }

                // Check tech availability (8.5h per tech target limit)
                let bestTechId: string | null = null;
                let lowestTechLoad = Infinity;
                engineers.forEach(eng => {
                    const tLoad = techMap.get(eng.id) || 0;
                    if (tLoad + hours <= 8.5 && tLoad < lowestTechLoad) {
                        lowestTechLoad = tLoad;
                        bestTechId = eng.id;
                    }
                });

                if (bestRampId && bestTechId) {
                    chosenDate = day;
                    chosenRampId = bestRampId;
                    chosenEngId = bestTechId;
                    placed = true;

                    // Update day's load
                    rampMap.set(bestRampId, (rampMap.get(bestRampId) || 0) + hours);
                    techMap.set(bestTechId, (techMap.get(bestTechId) || 0) + hours);
                    break;
                }
            }

            // If workshop is completely saturated across all days, overflow to the best balanced day
            if (!placed) {
                chosenDate = daysList[daysList.length - 1] || earliestDateStr;
                chosenRampId = usableRamps[assignments.length % usableRamps.length].id;
                chosenEngId = engineers[assignments.length % engineers.length].id;
            }

            assignments.push({
                job,
                vehicle: vehiclesMap.get(job.vehicleId),
                customer: customersMap.get(job.customerId),
                hours,
                recommendedEngineerId: chosenEngId,
                recommendedRampId: chosenRampId,
                scheduledDate: chosenDate,
                partsLeadDays,
                expectedDeliveryDate: latestPartsDelivery,
                isEstimateSimulation: isSimulated,
                estimateId,
                estimateTotal
            });
        });

        return assignments;
    }, [
        unallocatedJobs, 
        simulatedJobsFromEstimates, 
        bookedByDate, 
        daysList, 
        usableRamps, 
        engineers, 
        purchaseOrders, 
        poDeliveryDates, 
        vehiclesMap, 
        customersMap, 
        startDateStr
    ]);

    // Apply manual overrides
    const optimizedPlan = useMemo<OptimizedAssignment[]>(() => {
        return initialPlan.map(item => {
            const override = overrides[item.job.id];
            if (!override) return item;

            return {
                ...item,
                recommendedEngineerId: override.engineerId || item.recommendedEngineerId,
                recommendedRampId: override.rampId || item.recommendedRampId,
                scheduledDate: override.scheduledDate || item.scheduledDate,
                isOverridden: true
            };
        });
    }, [initialPlan, overrides]);

    // 5. DAILY ALLOCATION SUMMARIES (For Day Packing View)
    const dailySummaries = useMemo<DailyAllocationSummary[]>(() => {
        const rampCap = usableRamps.length * 8;
        const techCap = engineers.length * 8;

        return daysList.map(dateStr => {
            const dayBooked = bookedByDate.get(dateStr) || [];
            const dayOptimized = optimizedPlan.filter(item => item.scheduledDate === dateStr);

            const rLoad = new Map<string, number>();
            const tLoad = new Map<string, number>();
            usableRamps.forEach(r => rLoad.set(r.id, 0));
            engineers.forEach(e => tLoad.set(e.id, 0));

            let totalDayHours = 0;

            // Add booked
            dayBooked.forEach(bj => {
                const h = bj.estimatedHours || 2;
                totalDayHours += h;
                const seg = bj.segments?.[0];
                const r = usableRamps.find(ramp => ramp.name === seg?.allocatedLift || ramp.id === seg?.allocatedLift) || usableRamps[0];
                const t = engineers.find(eng => eng.id === seg?.engineerId || (eng.name && eng.name.toLowerCase() === seg?.engineerId?.toLowerCase())) || engineers[0];
                if (r) rLoad.set(r.id, (rLoad.get(r.id) || 0) + h);
                if (t) tLoad.set(t.id, (tLoad.get(t.id) || 0) + h);
            });

            // Add optimized
            dayOptimized.forEach(opt => {
                totalDayHours += opt.hours;
                rLoad.set(opt.recommendedRampId, (rLoad.get(opt.recommendedRampId) || 0) + opt.hours);
                tLoad.set(opt.recommendedEngineerId, (tLoad.get(opt.recommendedEngineerId) || 0) + opt.hours);
            });

            // Efficiency rating: ratio of balanced utilized capacity without exceeding limits
            const techUtilPct = techCap > 0 ? Math.min(100, Math.round((totalDayHours / techCap) * 100)) : 0;
            const rampUtilPct = rampCap > 0 ? Math.min(100, Math.round((totalDayHours / rampCap) * 100)) : 0;
            const efficiency = Math.round((techUtilPct + rampUtilPct) / 2);

            return {
                dateStr,
                dayLabel: formatReadableDate(dateStr),
                bookedJobs: dayBooked,
                optimizedJobs: dayOptimized,
                totalHours: totalDayHours,
                rampLoad: rLoad,
                techLoad: tLoad,
                rampCapacityHours: rampCap,
                techCapacityHours: techCap,
                efficiencyRating: efficiency
            };
        });
    }, [daysList, bookedByDate, optimizedPlan, usableRamps, engineers]);

    // Workload stats
    const totalAllocatedHours = useMemo(() => {
        return optimizedPlan.reduce((acc, p) => acc + p.hours, 0);
    }, [optimizedPlan]);

    const simulatedEstimateHours = useMemo(() => {
        return optimizedPlan
            .filter(p => p.isEstimateSimulation)
            .reduce((acc, p) => acc + p.hours, 0);
    }, [optimizedPlan]);

    if (!isOpen) return null;

    // Multi-select helpers
    const toggleEstimate = (id: string) => {
        setSelectedEstimateIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllApprovedEstimates = () => {
        const approved = candidateEstimates.filter(e => e.status === 'Approved').map(e => e.id);
        setSelectedEstimateIds(new Set(approved));
    };

    const clearAllEstimates = () => {
        setSelectedEstimateIds(new Set());
    };

    // Apply plan action
    const handleApplyPlan = async () => {
        setIsApplying(true);
        try {
            // 1. Separate actual jobs from simulated estimates
            const realJobsPlan = optimizedPlan.filter(p => !p.isEstimateSimulation);
            const simEstimatesPlan = optimizedPlan.filter(p => p.isEstimateSimulation);

            const updatedJobs: Job[] = realJobsPlan.map(item => {
                const assignedRamp = usableRamps.find(r => r.id === item.recommendedRampId);
                const assignedRampName = assignedRamp?.name || 'Ramp';

                return {
                    ...item.job,
                    scheduledDate: item.scheduledDate,
                    status: 'Allocated',
                    fcsState: item.partsLeadDays > 0 ? 'STALLED' : 'ACTIVE',
                    materialsStatus: item.partsLeadDays > 0 ? 'Ordered' : 'Delivered',
                    segments: item.job.segments && item.job.segments.length > 0
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
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Auto-Optimizer]: Agreed and allocated to ${assignedRampName} (${engineers.find(e => e.id === item.recommendedEngineerId)?.name || 'Tech'}) for ${item.scheduledDate}.`
                };
            });

            // 2. If convertEstimatesOnApply is checked, transform simulated estimates into real Jobs!
            const convertedEstimatesList: Estimate[] = [];
            if (convertEstimatesOnApply && simEstimatesPlan.length > 0) {
                simEstimatesPlan.forEach(sim => {
                    const assignedRamp = usableRamps.find(r => r.id === sim.recommendedRampId);
                    const assignedRampName = assignedRamp?.name || 'Ramp';
                    const newJobId = `job_from_est_${sim.estimateId}_${Date.now()}`;

                    const newJob: Job = {
                        id: newJobId,
                        jobNumber: `JOB-${sim.job.jobNumber || sim.job.id.substring(0, 6)}`,
                        description: sim.job.description,
                        vehicleId: sim.job.vehicleId,
                        customerId: sim.job.customerId,
                        scheduledDate: sim.scheduledDate,
                        status: 'Allocated',
                        estimatedHours: sim.hours,
                        estimateId: sim.estimateId,
                        segments: [
                            {
                                id: `seg_${Date.now()}_${newJobId}`,
                                segmentId: `seg_${Date.now()}_${newJobId}`,
                                description: sim.job.description,
                                status: 'Allocated',
                                engineerId: sim.recommendedEngineerId,
                                allocatedLift: assignedRampName,
                                duration: sim.hours,
                                date: sim.scheduledDate,
                                scheduledStartSegment: 1
                            }
                        ],
                        notes: `[FCS Pipeline Conversion]: Converted from Estimate #${sim.job.jobNumber} on ${sim.scheduledDate}.`
                    };
                    updatedJobs.push(newJob);

                    const origEst = candidateEstimates.find(e => e.id === sim.estimateId);
                    if (origEst) {
                        convertedEstimatesList.push({
                            ...origEst,
                            status: 'Converted to Job',
                            jobId: newJobId
                        });
                    }
                });
            }

            // 3. Collect updated Purchase Orders with new expectedDeliveryDates
            const updatedPos: PurchaseOrder[] = [];
            Object.entries(poDeliveryDates).forEach(([poId, delDate]) => {
                const po = purchaseOrders.find(p => p.id === poId);
                if (po && po.expectedDeliveryDate !== delDate) {
                    updatedPos.push({
                        ...po,
                        expectedDeliveryDate: delDate
                    });
                }
            });

            // 4. Save & commit
            await onApplyOptimizedPlan(updatedJobs, convertedEstimatesList, updatedPos);

            if (onSavePurchaseOrder) {
                for (const po of updatedPos) {
                    await onSavePurchaseOrder(po);
                }
            }
            if (onSaveEstimate) {
                for (const est of convertedEstimatesList) {
                    await onSaveEstimate(est);
                }
            }

            onClose();
        } catch (err) {
            console.error('Error applying optimized schedule plan:', err);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[94vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 relative border-b border-indigo-900/50 shrink-0">
                    <button 
                        onClick={onClose}
                        className="absolute top-5 right-5 text-indigo-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors shadow-xs cursor-pointer"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 text-amber-400 text-[11px] font-black uppercase tracking-widest mb-1">
                        <Zap size={15} className="fill-amber-400" />
                        <span>FCS Intelligent Scheduling & Capacity Engine</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                        Auto-Optimize Workshop Allocation
                    </h2>

                    <p className="text-indigo-200 text-xs mt-1 max-w-3xl leading-relaxed">
                        Committed booked work is locked into the foundation first. Any unallocated jobs are optimized as suggested work allocations to balance technician wrench time and pack ramps. Review the plan and agree to allocate the work.
                    </p>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 text-center">
                            <span className="text-[9px] uppercase font-black text-indigo-200 block">Committed Booked</span>
                            <span className="text-base font-black text-white">{bookedJobs.length} Jobs</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 text-center">
                            <span className="text-[9px] uppercase font-black text-indigo-200 block">Unallocated to Allocate</span>
                            <span className="text-base font-black text-white">{unallocatedJobs.length} Jobs</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 text-center">
                            <span className="text-[9px] uppercase font-black text-indigo-200 block">Estimate Pipeline</span>
                            <span className="text-base font-black text-amber-300">{selectedEstimateIds.size} Simulated</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 text-center">
                            <span className="text-[9px] uppercase font-black text-indigo-200 block">Total Workload</span>
                            <span className="text-base font-black text-emerald-300">{totalAllocatedHours}h {simulatedEstimateHours > 0 ? `(+${simulatedEstimateHours}h sim)` : ''}</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 text-center col-span-2 sm:col-span-1">
                            <span className="text-[9px] uppercase font-black text-indigo-200 block">Capacity Pool</span>
                            <span className="text-base font-black text-white">{engineers.length}T / {usableRamps.length}R</span>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('packing')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                activeTab === 'packing'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Calendar size={13} />
                            <span>Daily Workshop Packing</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('allocations')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                activeTab === 'allocations'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Layers size={13} />
                            <span>Suggested Allocations ({optimizedPlan.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('estimates')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                activeTab === 'estimates'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
                                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <FileText size={13} />
                            <span>Estimate Pipeline Simulator ({selectedEstimateIds.size} selected)</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('parts')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                activeTab === 'parts'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Truck size={13} />
                            <span>Parts & PO Deliveries</span>
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-grow bg-slate-50/50">
                    
                    {/* TAB 1: DAILY WORKSHOP PACKING */}
                    {activeTab === 'packing' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        <Calendar size={15} className="text-indigo-600" />
                                        <span>Day-by-Day Capacity Packing & Balancing</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                        Each day begins with committed booked jobs built first into the model, followed by optimal ramp packing and technician load-balancing.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {dailySummaries.map(day => {
                                    const isExpanded = expandedDay === day.dateStr;
                                    const totalJobs = day.bookedJobs.length + day.optimizedJobs.length;

                                    return (
                                        <div 
                                            key={day.dateStr} 
                                            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                                        >
                                            {/* Day Header Bar */}
                                            <div 
                                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100 cursor-pointer select-none"
                                                onClick={() => setExpandedDay(isExpanded ? null : day.dateStr)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center text-indigo-900 font-black shrink-0">
                                                        <span className="text-[9px] uppercase tracking-tighter text-indigo-500">Day</span>
                                                        <span className="text-sm leading-none">{day.dateStr.split('-')[2]}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                            <span>{day.dayLabel}</span>
                                                            <span className="text-[10px] text-slate-500 font-bold font-mono">({day.dateStr})</span>
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                                                            <span className="font-bold text-slate-700">{totalJobs} Total Jobs</span>
                                                            <span>•</span>
                                                            <span className="text-indigo-700 font-bold">{day.bookedJobs.length} Booked</span>
                                                            <span>•</span>
                                                            <span className="text-emerald-700 font-bold">{day.optimizedJobs.length} Optimized</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* Total Day Hours Gauge */}
                                                    <div className="text-right">
                                                        <span className="text-base font-black text-slate-900 block">{day.totalHours}h</span>
                                                        <span className="text-[10px] font-bold text-slate-400">Total Wrench Time</span>
                                                    </div>

                                                    {/* Efficiency Gauge */}
                                                    <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-right">
                                                        <span className="text-xs font-black block">{day.efficiencyRating}% Capacity</span>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Optimal Pack</span>
                                                    </div>

                                                    <button className="text-slate-400 hover:text-slate-600 p-1">
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Ramps & Technicians Allocation Bars */}
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                                                {/* Ramps Allocation */}
                                                <div>
                                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                                                        <span>Ramp Saturation ({usableRamps.length} Ramps)</span>
                                                        <span>Max 8.5h / ramp</span>
                                                    </h5>
                                                    <div className="space-y-2">
                                                        {usableRamps.map(ramp => {
                                                            const hours = day.rampLoad.get(ramp.id) || 0;
                                                            const pct = Math.min(100, Math.round((hours / 8) * 100));
                                                            const isMot = ramp.type === 'MOT';

                                                            return (
                                                                <div key={ramp.id} className="text-xs">
                                                                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                                                                        <span className="truncate">{ramp.name} {isMot ? '(MOT Bay)' : ''}</span>
                                                                        <span className={hours > 8 ? 'text-rose-600 font-black' : 'text-slate-900 font-black'}>
                                                                            {hours}h / 8h ({pct}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                                hours > 8 ? 'bg-rose-500' : hours >= 6 ? 'bg-indigo-600' : 'bg-blue-500'
                                                                            }`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Technicians Allocation */}
                                                <div>
                                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                                                        <span>Technician Wrench Load ({engineers.length} Techs)</span>
                                                        <span>Max 8h / tech</span>
                                                    </h5>
                                                    <div className="space-y-2">
                                                        {engineers.map(eng => {
                                                            const hours = day.techLoad.get(eng.id) || 0;
                                                            const pct = Math.min(100, Math.round((hours / 8) * 100));
                                                            const theme = getEngineerTheme(eng.id);

                                                            return (
                                                                <div key={eng.id} className="text-xs">
                                                                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.hex }} />
                                                                            <span className="truncate">{eng.name}</span>
                                                                        </div>
                                                                        <span className={hours > 8 ? 'text-rose-600 font-black' : 'text-slate-900 font-black'}>
                                                                            {hours}h / 8h ({pct}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                                        <div 
                                                                            className="h-full rounded-full transition-all duration-300"
                                                                            style={{ width: `${pct}%`, backgroundColor: theme.hex }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Detailed Jobs List for this Day */}
                                            {isExpanded && (
                                                <div className="p-4 bg-slate-50/80 border-t border-slate-200">
                                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-2">
                                                        Jobs Scheduled on {day.dayLabel}
                                                    </h5>
                                                    <div className="space-y-1.5">
                                                        {day.bookedJobs.map(bj => (
                                                            <div key={bj.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                                                        Booked Foundation
                                                                    </span>
                                                                    <span className="font-mono font-bold text-slate-900">{bj.jobNumber || bj.id.substring(0, 8)}</span>
                                                                    <span className="text-slate-600 font-medium truncate max-w-sm">{bj.description}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 font-bold text-slate-700">
                                                                    <span>{bj.segments?.[0]?.allocatedLift || 'Ramp'}</span>
                                                                    <span>•</span>
                                                                    <span>{engineers.find(e => e.id === bj.segments?.[0]?.engineerId)?.name || 'Tech'}</span>
                                                                    <span>•</span>
                                                                    <span className="text-indigo-700">{bj.estimatedHours || 2}h</span>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {day.optimizedJobs.map(opt => (
                                                            <div key={opt.job.id} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                                                opt.isEstimateSimulation 
                                                                    ? 'bg-amber-50/60 border-amber-300' 
                                                                    : 'bg-emerald-50/60 border-emerald-300'
                                                            }`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                                        opt.isEstimateSimulation
                                                                            ? 'bg-amber-200 text-amber-900'
                                                                            : 'bg-purple-200 text-purple-900'
                                                                    }`}>
                                                                        {opt.isEstimateSimulation ? 'Estimate Pipeline Simulation' : 'Suggested Work Allocation'}
                                                                    </span>
                                                                    <span className="font-mono font-bold text-slate-900">
                                                                        {opt.vehicle?.registration || opt.job.jobNumber || opt.job.id.substring(0, 8)}
                                                                    </span>
                                                                    <span className="text-slate-700 font-medium truncate max-w-sm">{opt.job.description}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 font-bold text-slate-800">
                                                                    <span>{usableRamps.find(r => r.id === opt.recommendedRampId)?.name || 'Ramp'}</span>
                                                                    <span>•</span>
                                                                    <span>{engineers.find(e => e.id === opt.recommendedEngineerId)?.name || 'Tech'}</span>
                                                                    <span>•</span>
                                                                    <span className="text-emerald-700">{opt.hours}h</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: ALLOCATIONS TABLE & MANUAL OVERRIDES */}
                    {activeTab === 'allocations' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                    <Layers size={14} className="text-indigo-600" />
                                    <span>Suggested Work Allocations ({optimizedPlan.length})</span>
                                </h3>
                                <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                                    💡 You can manually override the assigned technician, ramp, or scheduled date
                                </span>
                            </div>

                            {optimizedPlan.length === 0 ? (
                                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                                    <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No unallocated jobs to optimize!</p>
                                    <p className="text-xs text-slate-400 mt-1">All workshop jobs are already fully booked or select estimates from the pipeline simulator.</p>
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                                    <div className="max-h-[500px] overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-100/90 text-slate-600 font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                                                <tr>
                                                    <th className="px-3.5 py-3">Type</th>
                                                    <th className="px-3.5 py-3">Vehicle & Customer</th>
                                                    <th className="px-3.5 py-3">Scope & Hours</th>
                                                    <th className="px-3.5 py-3">Scheduled Date</th>
                                                    <th className="px-3.5 py-3">Assigned Ramp</th>
                                                    <th className="px-3.5 py-3">Allocated Tech</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {optimizedPlan.map(item => {
                                                    const engTheme = getEngineerTheme(item.recommendedEngineerId);

                                                    return (
                                                        <tr 
                                                            key={item.job.id} 
                                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                                item.isEstimateSimulation ? 'bg-amber-50/30' : ''
                                                            }`}
                                                        >
                                                            {/* Type Badge */}
                                                            <td className="px-3.5 py-3">
                                                                {item.isEstimateSimulation ? (
                                                                    <span className="bg-amber-100 text-amber-800 border border-amber-200 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                                                                        Estimate Sim
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-purple-100 text-purple-800 border border-purple-200 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                                                                        Unallocated
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Vehicle & Customer */}
                                                            <td className="px-3.5 py-3">
                                                                <div className="font-mono font-black uppercase text-indigo-950 text-xs">
                                                                    {item.vehicle?.registration || `#${item.job.jobNumber || item.job.id.substring(0, 6)}`}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                                                                    {item.customer ? getCustomerDisplayName(item.customer) : 'Customer'}
                                                                </div>
                                                            </td>

                                                            {/* Scope & Hours */}
                                                            <td className="px-3.5 py-3">
                                                                <div className="font-bold text-slate-900 truncate max-w-[160px]" title={item.job.description}>
                                                                    {item.job.description || 'Workshop Service'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                                    <Clock size={10} className="text-slate-400" />
                                                                    <strong className="text-slate-700">{item.hours}h</strong>
                                                                    {item.expectedDeliveryDate ? (
                                                                        <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                                                            🚚 Parts: {item.expectedDeliveryDate}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </td>

                                                            {/* Date Picker / Scheduled Date Override */}
                                                            <td className="px-3.5 py-3">
                                                                <input
                                                                    type="date"
                                                                    value={item.scheduledDate}
                                                                    onChange={(e) => setOverrides(prev => ({
                                                                        ...prev,
                                                                        [item.job.id]: { ...prev[item.job.id], scheduledDate: e.target.value }
                                                                    }))}
                                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                />
                                                            </td>

                                                            {/* Ramp Select */}
                                                            <td className="px-3.5 py-3">
                                                                <select
                                                                    value={item.recommendedRampId}
                                                                    onChange={(e) => setOverrides(prev => ({
                                                                        ...prev,
                                                                        [item.job.id]: { ...prev[item.job.id], rampId: e.target.value }
                                                                    }))}
                                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                                                >
                                                                    {usableRamps.map(r => (
                                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Engineer Select / Reassign */}
                                                            <td className="px-3.5 py-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span 
                                                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                                                                        style={{ backgroundColor: engTheme.hex }} 
                                                                    />
                                                                    <select
                                                                        value={item.recommendedEngineerId}
                                                                        onChange={(e) => setOverrides(prev => ({
                                                                            ...prev,
                                                                            [item.job.id]: { ...prev[item.job.id], engineerId: e.target.value }
                                                                        }))}
                                                                        className="bg-white border rounded-lg px-2 py-1 text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                                                        style={{ borderColor: `${engTheme.hex}70` }}
                                                                    >
                                                                        {engineers.map(eng => (
                                                                            <option key={eng.id} value={eng.id}>
                                                                                {eng.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: ESTIMATE PIPELINE SIMULATOR */}
                    {activeTab === 'estimates' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        <FileText size={15} className="text-amber-600" />
                                        <span>Multi-Select Estimate Pipeline Simulation</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                        Select estimates from your pipeline to simulate the impact on workshop capacity, technician wrench time, and scheduling timelines.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={selectAllApprovedEstimates}
                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Select All Approved ({candidateEstimates.filter(e => e.status === 'Approved').length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearAllEstimates}
                                        disabled={selectedEstimateIds.size === 0}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            </div>

                            {candidateEstimates.length === 0 ? (
                                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                                    <FileText size={32} className="mx-auto text-amber-500 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No active estimates available in pipeline.</p>
                                    <p className="text-xs text-slate-400 mt-1">Create estimates in the Estimates module to simulate pipeline conversions.</p>
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                                    <div className="max-h-[460px] overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-100/90 text-slate-600 font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                                                <tr>
                                                    <th className="px-3.5 py-3 w-10 text-center">Simulate</th>
                                                    <th className="px-3.5 py-3">Estimate #</th>
                                                    <th className="px-3.5 py-3">Customer & Vehicle</th>
                                                    <th className="px-3.5 py-3">Scope Description</th>
                                                    <th className="px-3.5 py-3">Labor Hours</th>
                                                    <th className="px-3.5 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {candidateEstimates.map(est => {
                                                    const isSelected = selectedEstimateIds.has(est.id);
                                                    const vehicle = vehiclesMap.get(est.vehicleId);
                                                    const customer = customersMap.get(est.customerId);
                                                    const laborHours = (est.lineItems || [])
                                                        .filter(li => li.isLabor)
                                                        .reduce((sum, li) => sum + (li.quantity || 0), 0) || 2;

                                                    return (
                                                        <tr 
                                                            key={est.id}
                                                            onClick={() => toggleEstimate(est.id)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <td className="px-3.5 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleEstimate(est.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="px-3.5 py-3 font-mono font-black text-slate-900">
                                                                {est.estimateNumber || est.id}
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <div className="font-mono font-bold text-slate-900 uppercase">
                                                                    {vehicle?.registration || 'Vehicle N/A'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                                                    {customer ? getCustomerDisplayName(customer) : 'Customer N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <div className="font-medium text-slate-800 truncate max-w-xs" title={est.description}>
                                                                    {est.description || 'Estimate Services'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-3 font-bold text-slate-900">
                                                                {laborHours} hrs
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                    est.status === 'Approved'
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                        : est.status === 'Sent'
                                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                                }`}>
                                                                    {est.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Convert to Job Toggle Note */}
                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start gap-3">
                                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-amber-950">
                                        <input
                                            type="checkbox"
                                            checked={convertEstimatesOnApply}
                                            onChange={(e) => setConvertEstimatesOnApply(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-amber-300"
                                        />
                                        <span>Automatically convert selected estimates into active Booked Jobs on Commit</span>
                                    </label>
                                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                        If checked, applying the plan will generate official Job records for the simulated estimates and update the estimate status to "Converted to Job". If left unchecked, estimates only serve as a temporary capacity projection.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: PARTS & PURCHASE ORDERS DELIVERIES */}
                    {activeTab === 'parts' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        <Truck size={15} className="text-blue-600" />
                                        <span>Purchase Orders & Parts Expected Delivery Dates</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                        Each PO defaults to the following working day. Editing any date dynamically recalculates parts readiness and prevents scheduling jobs before parts arrive.
                                    </p>
                                </div>
                            </div>

                            {purchaseOrders.length === 0 ? (
                                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                                    <PackageCheck size={32} className="mx-auto text-blue-500 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No purchase orders linked to current queue.</p>
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                                    <div className="max-h-[460px] overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-100/90 text-slate-600 font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                                                <tr>
                                                    <th className="px-3.5 py-3">PO Number</th>
                                                    <th className="px-3.5 py-3">Vehicle Ref / Job</th>
                                                    <th className="px-3.5 py-3">Order Date</th>
                                                    <th className="px-3.5 py-3">Expected Delivery Date (Editable)</th>
                                                    <th className="px-3.5 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {purchaseOrders.map(po => {
                                                    const deliveryDate = poDeliveryDates[po.id] || po.expectedDeliveryDate || getNextWorkingDay(po.orderDate);
                                                    const isDefaulted = !po.expectedDeliveryDate;

                                                    return (
                                                        <tr key={po.id} className="hover:bg-slate-50">
                                                            <td className="px-3.5 py-3 font-mono font-black text-slate-900">
                                                                {po.id}
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <div className="font-mono font-bold text-indigo-950 uppercase">
                                                                    {po.vehicleRegistrationRef || 'Stock PO'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    Job #{po.jobId || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-3 font-bold text-slate-700">
                                                                {po.orderDate || 'N/A'}
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="date"
                                                                        value={deliveryDate}
                                                                        onChange={(e) => setPoDeliveryDates(prev => ({
                                                                            ...prev,
                                                                            [po.id]: e.target.value
                                                                        }))}
                                                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    />
                                                                    {isDefaulted && (
                                                                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                                                            Next Work Day
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                    po.status === 'Received'
                                                                        ? 'bg-emerald-100 text-emerald-800'
                                                                        : po.status === 'Ordered'
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : 'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {po.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setOverrides({})}
                            disabled={Object.keys(overrides).length === 0}
                            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                            Reset Overrides
                        </button>

                        {onPreviewOnGantt && (
                            <button
                                type="button"
                                onClick={() => {
                                    onPreviewOnGantt(optimizedPlan);
                                    onClose();
                                }}
                                disabled={optimizedPlan.length === 0}
                                className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
                                title="Preview suggested allocations on the Gantt timeline before agreeing"
                            >
                                <Sparkles size={14} className="text-purple-600" />
                                <span>Preview on Gantt</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleApplyPlan}
                            disabled={optimizedPlan.length === 0 || isApplying}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isApplying ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Allocating Work...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={15} className="text-emerald-200" />
                                    <span>Agree & Allocate Work as Suggested ({optimizedPlan.length})</span>
                                    <ChevronRight size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

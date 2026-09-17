import React, { useState, useMemo } from 'react';
import { Job, Lift, Engineer, PurchaseOrder, Vehicle, Customer, User } from '../../../types';
import { Sparkles, Wrench, Layers, CheckCircle, Clock, AlertTriangle, ArrowRight, X, ChevronRight, RefreshCw, Sliders, Zap } from 'lucide-react';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { getRelativeDate, addDays, formatDate } from '../../../core/utils/dateUtils';
import { getEngineerTheme } from './ResourceGanttView';

interface FCSOptimizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    vehicles: Vehicle[];
    customers: Customer[];
    windowDays: number;
    startDateStr: string;
    onApplyOptimizedPlan: (updatedJobs: Job[]) => Promise<void> | void;
}

interface OptimizedAssignment {
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
}

export const FCSOptimizerModal: React.FC<FCSOptimizerModalProps> = ({
    isOpen,
    onClose,
    jobs,
    ramps,
    engineers,
    purchaseOrders,
    vehicles,
    customers,
    windowDays,
    startDateStr,
    onApplyOptimizedPlan
}) => {
    const [isApplying, setIsApplying] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, { engineerId?: string; rampId?: string }>>({});

    // Identify all unallocated jobs (jobs with no assigned engineer on segments, or status Unallocated)
    const unallocatedJobs = useMemo(() => {
        return jobs.filter(j => {
            if (j.status === 'Cancelled' || j.status === 'Complete' || j.status === 'Invoiced' || j.status === 'Closed') {
                return false;
            }
            if (j.status === 'Unallocated') return true;
            if (!j.segments || j.segments.length === 0) return true;
            return j.segments.some(s => !s.engineerId || s.status === 'Unallocated');
        });
    }, [jobs]);

    // Calculate baseline existing load per engineer
    const baselineEngineerLoad = useMemo(() => {
        const loadMap = new Map<string, number>();
        engineers.forEach(e => loadMap.set(e.id, 0));

        jobs.forEach(j => {
            if (j.status === 'Cancelled' || j.status === 'Complete' || j.status === 'Invoiced' || j.status === 'Closed') return;
            j.segments?.forEach(s => {
                if (s.engineerId && s.status !== 'Cancelled' && s.status !== 'Unallocated') {
                    const current = loadMap.get(s.engineerId) || 0;
                    loadMap.set(s.engineerId, current + (s.duration || 2));
                }
            });
        });

        return loadMap;
    }, [jobs, engineers]);

    // Intelligent load-balancing optimization algorithm
    const initialPlan = useMemo<OptimizedAssignment[]>(() => {
        if (engineers.length === 0 || ramps.length === 0 || unallocatedJobs.length === 0) {
            return [];
        }

        // Clone loads so we simulate assigning jobs
        const runningEngineerLoads = new Map<string, number>(baselineEngineerLoad);
        const activeRamps = ramps.filter(r => r.type !== 'Virtual' && !r.name.toLowerCase().includes('storage'));
        const usableRamps = activeRamps.length > 0 ? activeRamps : ramps;

        // Sort unallocated jobs: highest priority first (1=urgent), then largest jobs first (longest wrench time)
        const sortedJobs = [...unallocatedJobs].sort((a, b) => {
            const prioA = a.priority || 3;
            const prioB = b.priority || 3;
            if (prioA !== prioB) return prioA - prioB;

            const hoursA = a.estimatedHours || (a.segments ? a.segments.reduce((acc, s) => acc + (s.duration || 0), 0) : 4);
            const hoursB = b.estimatedHours || (b.segments ? b.segments.reduce((acc, s) => acc + (s.duration || 0), 0) : 4);
            return hoursB - hoursA;
        });

        const assignments: OptimizedAssignment[] = [];

        sortedJobs.forEach((job, idx) => {
            const hours = job.estimatedHours || (job.segments ? job.segments.reduce((acc, s) => acc + (s.duration || 0), 0) : 4);

            // Check linked PO parts lead days and expected delivery dates
            const linkedPos = purchaseOrders.filter(po => 
                po.jobId === job.id || (job.purchaseOrderIds && job.purchaseOrderIds.includes(po.id))
            );
            const hasUndelivered = linkedPos.some(po => po.status !== 'Received' && po.status !== 'Finalized');

            const baseDate = new Date(startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00`);
            let earliestDate = new Date(baseDate.getTime());
            let partsLeadDays = 0;

            // Check if job or linked PO has explicit expectedDeliveryDate
            let latestExpectedDelivery: string | undefined = job.expectedDeliveryDate;
            linkedPos.forEach(po => {
                if (po.expectedDeliveryDate && po.status !== 'Received' && po.status !== 'Finalized') {
                    if (!latestExpectedDelivery || po.expectedDeliveryDate > latestExpectedDelivery) {
                        latestExpectedDelivery = po.expectedDeliveryDate;
                    }
                }
            });

            if (latestExpectedDelivery) {
                const delD = new Date(latestExpectedDelivery.includes('T') ? latestExpectedDelivery : `${latestExpectedDelivery}T00:00:00`);
                if (!isNaN(delD.getTime())) {
                    if (delD > earliestDate) {
                        earliestDate = delD;
                    }
                    const diffDays = Math.max(0, Math.ceil((delD.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
                    partsLeadDays = diffDays;
                }
            } else if (hasUndelivered) {
                partsLeadDays = 2;
                earliestDate = addDays(baseDate, 2);
            }

            const targetDate = earliestDate;
            const scheduledDate = job.scheduledDate && new Date(job.scheduledDate) >= targetDate 
                ? job.scheduledDate 
                : formatDate(targetDate);

            // Pick the engineer with the lowest running load
            let bestEngId = engineers[0].id;
            let lowestLoad = Infinity;
            engineers.forEach(eng => {
                const currentLoad = runningEngineerLoads.get(eng.id) || 0;
                if (currentLoad < lowestLoad) {
                    lowestLoad = currentLoad;
                    bestEngId = eng.id;
                }
            });

            // Update running load
            runningEngineerLoads.set(bestEngId, (runningEngineerLoads.get(bestEngId) || 0) + hours);

            // Pick ramp (either existing segment ramp or round-robin)
            const existingRampName = job.segments?.[0]?.allocatedLift;
            const matchingRamp = usableRamps.find(r => r.name === existingRampName);
            const recommendedRampId = matchingRamp ? matchingRamp.id : usableRamps[idx % usableRamps.length].id;

            assignments.push({
                job,
                vehicle: vehicles.find(v => v.id === job.vehicleId),
                customer: customers.find(c => c.id === job.customerId),
                hours,
                recommendedEngineerId: bestEngId,
                recommendedRampId,
                scheduledDate,
                partsLeadDays,
                expectedDeliveryDate: latestExpectedDelivery
            });
        });

        return assignments;
    }, [unallocatedJobs, baselineEngineerLoad, engineers, ramps, purchaseOrders, vehicles, customers, startDateStr]);

    // Computed plan reflecting manual user overrides
    const optimizedPlan = useMemo(() => {
        return initialPlan.map(item => {
            const override = overrides[item.job.id];
            if (!override) return item;

            return {
                ...item,
                recommendedEngineerId: override.engineerId || item.recommendedEngineerId,
                recommendedRampId: override.rampId || item.recommendedRampId,
                isOverridden: true
            };
        });
    }, [initialPlan, overrides]);

    // Projected loads per engineer after optimization
    const projectedEngineerLoads = useMemo(() => {
        const map = new Map<string, number>(baselineEngineerLoad);
        optimizedPlan.forEach(p => {
            const current = map.get(p.recommendedEngineerId) || 0;
            map.set(p.recommendedEngineerId, current + p.hours);
        });
        return map;
    }, [baselineEngineerLoad, optimizedPlan]);

    // Workload variance stats
    const totalAllocatedHours = useMemo(() => {
        return optimizedPlan.reduce((acc, p) => acc + p.hours, 0);
    }, [optimizedPlan]);

    const averageLoadPerTech = useMemo(() => {
        if (engineers.length === 0) return 0;
        let total = 0;
        projectedEngineerLoads.forEach(hrs => total += hrs);
        return Math.round((total / engineers.length) * 10) / 10;
    }, [engineers, projectedEngineerLoads]);

    if (!isOpen) return null;

    const handleApplyPlan = async () => {
        setIsApplying(true);
        try {
            const updatedJobs: Job[] = optimizedPlan.map(item => {
                const assignedRamp = ramps.find(r => r.id === item.recommendedRampId);
                const assignedRampName = assignedRamp?.name || 'Ramp';

                return {
                    ...item.job,
                    scheduledDate: item.scheduledDate,
                    status: 'Booked In',
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
                    notes: (item.job.notes ? `${item.job.notes}\n` : '') + `[FCS Auto-Optimizer]: Allocated to ${engineers.find(e => e.id === item.recommendedEngineerId)?.name || 'Tech'} on ${assignedRampName} for ${item.scheduledDate}.`
                };
            });

            await onApplyOptimizedPlan(updatedJobs);
            onClose();
        } catch (err) {
            console.error('Error applying optimized schedule plan:', err);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 relative border-b border-indigo-900/50 shrink-0">
                    <button 
                        onClick={onClose}
                        className="absolute top-5 right-5 text-indigo-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors shadow-xs"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest mb-1.5">
                        <Zap size={14} className="fill-amber-400" />
                        <span>FCS Intelligent Scheduling Engine</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                        Auto-Optimize Workshop Allocation
                    </h2>
                    <p className="text-indigo-200 text-xs mt-1 max-w-2xl">
                        Instantly balances the {unallocatedJobs.length} unallocated jobs in queue across all active technicians based on capacity, ramp constraints, and parts lead times.
                    </p>

                    {/* Quick Stats Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-center">
                            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Queue to Allocate</span>
                            <span className="text-lg font-black text-white">{unallocatedJobs.length} Jobs</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-center">
                            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Total Workload</span>
                            <span className="text-lg font-black text-amber-300">{totalAllocatedHours} hrs</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-center">
                            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Active Technicians</span>
                            <span className="text-lg font-black text-white">{engineers.length} Techs</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-center">
                            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Balanced Target Avg</span>
                            <span className="text-lg font-black text-emerald-300">{averageLoadPerTech}h / tech</span>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-5 text-slate-800 flex-grow">
                    {/* Technicians Workload Balance Projection Cards */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Wrench size={14} className="text-indigo-600" />
                                <span>Projected Workload Distribution</span>
                            </h3>
                            <span className="text-[10px] font-bold text-slate-500">
                                Total window target: ~{windowDays * 8}h capacity per tech
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                            {engineers.map(eng => {
                                const theme = getEngineerTheme(eng.id);
                                const load = projectedEngineerLoads.get(eng.id) || 0;
                                const maxCap = windowDays * 8;
                                const pct = Math.min(100, Math.round((load / Math.max(1, maxCap)) * 100));

                                return (
                                    <div 
                                        key={eng.id}
                                        className="p-3 rounded-xl border shadow-xs transition-all bg-white"
                                        style={{ borderColor: `${theme.hex}50` }}
                                    >
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.hex }} />
                                            <span className="font-black text-xs text-slate-900 truncate">{eng.name}</span>
                                        </div>
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className="text-base font-black text-slate-900">{load}h</span>
                                            <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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

                    {/* Proposed Job Allocation Table */}
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Layers size={14} className="text-blue-600" />
                                <span>Proposed Job Allocations ({optimizedPlan.length})</span>
                            </h3>
                            <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                💡 You can manually override any technician before committing
                            </span>
                        </div>

                        {optimizedPlan.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                                <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                                <p className="text-sm font-bold text-slate-700">All workshop jobs are already fully allocated!</p>
                                <p className="text-xs text-slate-400 mt-1">No unallocated jobs requiring engineer assignment.</p>
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100/90 text-slate-600 font-black uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                                            <tr>
                                                <th className="px-3 py-2.5">Vehicle & Customer</th>
                                                <th className="px-3 py-2.5">Scope & Hours</th>
                                                <th className="px-3 py-2.5">Assigned Ramp</th>
                                                <th className="px-3 py-2.5">Scheduled Date</th>
                                                <th className="px-3 py-2.5">Allocated Tech</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {optimizedPlan.map(item => {
                                                const engTheme = getEngineerTheme(item.recommendedEngineerId);

                                                return (
                                                    <tr key={item.job.id} className="hover:bg-slate-50/80 transition-colors">
                                                        {/* Vehicle & Customer */}
                                                        <td className="px-3 py-2.5">
                                                            <div className="font-mono font-black uppercase text-indigo-950 text-xs">
                                                                {item.vehicle?.registration || `#${item.job.jobNumber || item.job.id.substring(0, 6)}`}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                                                                {item.customer ? getCustomerDisplayName(item.customer) : 'Customer'}
                                                            </div>
                                                        </td>

                                                        {/* Scope & Hours */}
                                                        <td className="px-3 py-2.5">
                                                            <div className="font-bold text-slate-900 truncate max-w-[170px]" title={item.job.description}>
                                                                {item.job.description || 'Workshop Service'}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <Clock size={10} className="text-slate-400" />
                                                                <strong className="text-slate-700">{item.hours}h</strong>
                                                                {item.expectedDeliveryDate ? (
                                                                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                                        🚚 Due {item.expectedDeliveryDate}
                                                                    </span>
                                                                ) : item.partsLeadDays > 0 ? (
                                                                    <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded text-[9px] font-bold">
                                                                        +{item.partsLeadDays}d parts
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>

                                                        {/* Ramp Select */}
                                                        <td className="px-3 py-2.5">
                                                            <select
                                                                value={item.recommendedRampId}
                                                                onChange={(e) => setOverrides(prev => ({
                                                                    ...prev,
                                                                    [item.job.id]: { ...prev[item.job.id], rampId: e.target.value }
                                                                }))}
                                                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                {ramps.map(r => (
                                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>

                                                        {/* Scheduled Date */}
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className="font-bold text-slate-900 block text-xs">
                                                                {item.scheduledDate}
                                                            </span>
                                                            <span className="text-[10px] text-emerald-600 font-bold">
                                                                Optimal slot
                                                            </span>
                                                        </td>

                                                        {/* Engineer Select / Reassign */}
                                                        <td className="px-3 py-2.5">
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
                                                                    className="bg-white border rounded-lg px-2 py-1 text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-500"
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
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setOverrides({})}
                            disabled={Object.keys(overrides).length === 0}
                            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40"
                        >
                            Reset Overrides
                        </button>

                        <button
                            type="button"
                            onClick={handleApplyPlan}
                            disabled={optimizedPlan.length === 0 || isApplying}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isApplying ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Applying Plan...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} className="text-amber-300" />
                                    <span>Commit & Apply Optimized Plan</span>
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

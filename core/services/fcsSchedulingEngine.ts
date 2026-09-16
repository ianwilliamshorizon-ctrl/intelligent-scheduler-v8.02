import { Job, JobSegment, Lift, Engineer, PurchaseOrder, Vehicle, FCSState, MaterialsStatus, FCSGanttBlock, FCSDependencyLink, FCSSimulationMetrics } from '../../types';
import { TIME_SEGMENTS } from '../../constants';
import { addDays, formatDate, getRelativeDate } from '../utils/dateUtils';

export interface FCSJobPlan {
    job: Job;
    vehicle?: Vehicle;
    fcsState: FCSState;
    materialsStatus: MaterialsStatus;
    totalHours: number;
    remainingHours: number;
    priority: number; // 1 (Highest) to 5 (Lowest)
    isMovable: boolean;
    assignedRampId: string | null;
    assignedEngineerId: string | null;
    scheduledStartDate: string;
    scheduledEndDate: string;
    rampBlock?: FCSGanttBlock;
    engineerBlock?: FCSGanttBlock;
}

export interface FCSMatrixResult {
    rampRows: {
        ramp: Lift;
        blocks: FCSGanttBlock[];
    }[];
    engineerRows: {
        engineer: Engineer;
        blocks: FCSGanttBlock[];
        idleSlots: { startDate: string; startTime: string; hours: number }[];
    }[];
    dependencyLinks: FCSDependencyLink[];
    metrics: FCSSimulationMetrics;
    activeJobPlans: FCSJobPlan[];
    queuedJobPlans: FCSJobPlan[];
    stalledJobPlans: FCSJobPlan[];
}

/**
 * Derives materials status from linked purchase orders or job fields
 */
export function deriveMaterialsStatus(job: Job, purchaseOrders: PurchaseOrder[]): MaterialsStatus {
    if (job.materialsStatus) return job.materialsStatus;

    const linkedPos = (purchaseOrders || []).filter(po => 
        (job.purchaseOrderIds && job.purchaseOrderIds.includes(po.id)) || po.jobId === job.id
    );

    if (linkedPos.length === 0) {
        if (job.partsStatus === 'Awaiting Order') return 'Not Ordered';
        if (job.partsStatus === 'Ordered') return 'Ordered';
        return 'Delivered'; // No parts needed
    }

    const hasDeliveredOnly = linkedPos.every(po => po.status === 'Received' || po.status === 'Finalized');
    if (hasDeliveredOnly) return 'Delivered';

    const hasOrdered = linkedPos.some(po => po.status === 'Ordered' || po.status === 'Partially Received');
    if (hasOrdered) return 'Ordered';

    return 'Not Ordered';
}

/**
 * Derives the FCS State (ACTIVE, STALLED, QUEUED) based on materials, ramps, and status
 */
export function deriveFCSState(job: Job, materialsStatus: MaterialsStatus): FCSState {
    if (job.fcsState) return job.fcsState;

    if (materialsStatus === 'Ordered' || job.status === 'Paused' || job.status === 'Awaiting Parts') {
        return 'STALLED';
    }

    if (materialsStatus === 'Delivered') {
        if (job.status === 'In Progress' || job.status === 'Allocated') {
            return 'ACTIVE';
        }
        return 'QUEUED';
    }

    if (job.status === 'In Progress') return 'ACTIVE';
    return 'QUEUED';
}

/**
 * Runs the Finite Capacity Scheduling and cascade matrix
 */
export function calculateFCSMatrix({
    jobs,
    ramps,
    engineers,
    purchaseOrders,
    vehicles = [],
    windowDays = 7,
    startDateStr = getRelativeDate(0),
    simulateExtraEngineers = 0
}: {
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    vehicles?: Vehicle[];
    windowDays?: number;
    startDateStr?: string;
    simulateExtraEngineers?: number;
}): FCSMatrixResult {
    const vehiclesMap = new Map<string, Vehicle>();
    vehicles.forEach(v => vehiclesMap.set(v.id, v));

    // Build active engineers pool, appending virtual engineers if simulation active
    const activeEngineers: Engineer[] = [...engineers];
    for (let i = 1; i <= simulateExtraEngineers; i++) {
        activeEngineers.push({
            id: `sim_engineer_${i}`,
            name: `Virtual Tech (+${i})`,
            hourlyRate: 35
        });
    }

    // Ensure effective ramps and engineers fallbacks so empty entity selections never divide by zero or index with NaN
    const effectiveRamps: Lift[] = (ramps && ramps.length > 0) ? ramps : [{ id: 'bay_default', name: 'Workshop Bay 1', type: 'Standard' as const }];
    const effectiveEngineers: Engineer[] = activeEngineers.length > 0 ? activeEngineers : [{ id: 'tech_default', name: 'Technician 1', hourlyRate: 35 }];

    // Filter relevant non-completed jobs
    const eligibleJobs = jobs.filter(j => 
        !['Closed', 'Invoiced', 'Cancelled', 'Archived'].includes(j.status) &&
        j.vehicleStatus !== 'Collected'
    );

    // Map each job to its initial FCS profile
    const jobPlans: FCSJobPlan[] = eligibleJobs.map(job => {
        const materialsStatus = deriveMaterialsStatus(job, purchaseOrders);
        const fcsState = deriveFCSState(job, materialsStatus);
        const vehicle = job.vehicleId ? vehiclesMap.get(job.vehicleId) : undefined;
        const totalHours = job.estimatedHours || 
            (job.segments || []).reduce((acc, s) => acc + (s.duration || 0), 0) || 2;
        const workedHours = (job.segments || [])
            .filter(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')
            .reduce((acc, s) => acc + (s.duration || 0), 0);
        const remainingHours = Math.max(0.5, totalHours - workedHours);

        // Find existing assigned ramp & engineer from segments
        const firstSegment = (job.segments || [])[0];
        const assignedRamp = firstSegment?.allocatedLift ? effectiveRamps.find(r => r.name === firstSegment.allocatedLift || r.id === firstSegment.allocatedLift) : undefined;
        const assignedEngineerId = firstSegment?.engineerId || null;

        return {
            job,
            vehicle,
            fcsState,
            materialsStatus,
            totalHours,
            remainingHours,
            priority: job.priority || 3,
            isMovable: job.isMovable ?? false,
            assignedRampId: assignedRamp?.id || effectiveRamps[0]?.id || null,
            assignedEngineerId,
            scheduledStartDate: job.scheduledDate || startDateStr,
            scheduledEndDate: job.scheduledDate || addDaysToDateStr(startDateStr, Math.ceil(remainingHours / 8))
        };
    });

    // 1. Separate into STALLED, ACTIVE, and QUEUED
    const stalledPlans = jobPlans.filter(p => p.fcsState === 'STALLED');
    const activePlans = jobPlans.filter(p => p.fcsState === 'ACTIVE');
    const queuedPlans = jobPlans.filter(p => p.fcsState === 'QUEUED')
        .sort((a, b) => (a.priority - b.priority) || (b.remainingHours - a.remainingHours));

    // DYNAMIC CASCADE:
    // When stalled: The job's physical ramp is locked (unless movable), but its engineer is immediately released.
    // Scan queued plans with Delivered materials and pull forward into any freed engineer + available ramp.
    const freedEngineerIds = new Set<string>();
    stalledPlans.forEach(sp => {
        if (sp.assignedEngineerId) {
            freedEngineerIds.add(sp.assignedEngineerId);
            // Release engineer from stalled job
            sp.assignedEngineerId = null;
        }
    });

    // Match freed engineers to top priority queued jobs with Delivered parts
    queuedPlans.forEach(qp => {
        if (qp.materialsStatus === 'Delivered' && freedEngineerIds.size > 0) {
            const availableEngId = Array.from(freedEngineerIds)[0];
            freedEngineerIds.delete(availableEngId);
            qp.assignedEngineerId = availableEngId;
            qp.fcsState = 'ACTIVE';
            qp.scheduledStartDate = startDateStr; // Pull forward to Right Now
            activePlans.push(qp);
        }
    });

    // Initialize row blocks
    const rampBlocksMap = new Map<string, FCSGanttBlock[]>();
    effectiveRamps.forEach(r => rampBlocksMap.set(r.id, []));

    const engineerBlocksMap = new Map<string, FCSGanttBlock[]>();
    effectiveEngineers.forEach(e => engineerBlocksMap.set(e.id, []));

    const dependencyLinks: FCSDependencyLink[] = [];

    let stalledDeadWeightHours = 0;
    let activeWrenchHours = 0;

    // Place STALLED jobs on Ramps (Dead Weight Space, 0 Engineer wrench time)
    stalledPlans.forEach((sp, idx) => {
        const rampId = sp.assignedRampId || effectiveRamps[idx % effectiveRamps.length]?.id;
        if (!rampId) return;

        const blockId = `ramp_block_stalled_${sp.job.id}`;
        stalledDeadWeightHours += sp.remainingHours;

        const rampBlock: FCSGanttBlock = {
            id: blockId,
            jobId: sp.job.id,
            resourceType: 'ramp',
            resourceId: rampId,
            resourceName: effectiveRamps.find(r => r.id === rampId)?.name || 'Ramp',
            title: sp.job.description || 'Stalled Job',
            vehicleRegistration: sp.vehicle?.registration,
            fcsState: 'STALLED',
            startDate: sp.scheduledStartDate,
            startTime: '08:30',
            endDate: addDaysToDateStr(sp.scheduledStartDate, Math.max(1, Math.ceil(sp.remainingHours / 8))),
            endTime: '17:30',
            startPercent: calculatePercentOffset(sp.scheduledStartDate, startDateStr, windowDays),
            durationPercent: calculatePercentDuration(sp.remainingHours, windowDays),
            hours: sp.remainingHours,
            isDeadWeight: true
        };

        sp.rampBlock = rampBlock;
        if (!rampBlocksMap.has(rampId)) rampBlocksMap.set(rampId, []);
        rampBlocksMap.get(rampId)!.push(rampBlock);
    });

    // Place ACTIVE jobs (Consumes 1 Ramp AND 1 Engineer, draws interactive linkage)
    activePlans.forEach((ap, idx) => {
        const rampId = ap.assignedRampId || effectiveRamps[idx % effectiveRamps.length]?.id;
        const engineerId = ap.assignedEngineerId || effectiveEngineers[idx % effectiveEngineers.length]?.id;

        if (!rampId || !engineerId) return;

        const isSim = engineerId.startsWith('sim_');
        activeWrenchHours += ap.remainingHours;

        const rampBlockId = `ramp_block_active_${ap.job.id}`;
        const engBlockId = `eng_block_active_${ap.job.id}`;

        const startPct = calculatePercentOffset(ap.scheduledStartDate, startDateStr, windowDays);
        const durationPct = calculatePercentDuration(ap.remainingHours, windowDays);

        const rampBlock: FCSGanttBlock = {
            id: rampBlockId,
            jobId: ap.job.id,
            resourceType: 'ramp',
            resourceId: rampId,
            resourceName: ramps.find(r => r.id === rampId)?.name || 'Ramp',
            title: ap.job.description || 'Active Job',
            vehicleRegistration: ap.vehicle?.registration,
            fcsState: 'ACTIVE',
            startDate: ap.scheduledStartDate,
            startTime: '08:30',
            endDate: addDaysToDateStr(ap.scheduledStartDate, Math.max(1, Math.ceil(ap.remainingHours / 8))),
            endTime: '17:30',
            startPercent: startPct,
            durationPercent: durationPct,
            hours: ap.remainingHours,
            isDeadWeight: false,
            isSimulated: isSim,
            linkedBlockId: engBlockId
        };

        const engBlock: FCSGanttBlock = {
            id: engBlockId,
            jobId: ap.job.id,
            resourceType: 'engineer',
            resourceId: engineerId,
            resourceName: activeEngineers.find(e => e.id === engineerId)?.name || 'Engineer',
            title: ap.job.description || 'Wrench Time',
            vehicleRegistration: ap.vehicle?.registration,
            fcsState: 'ACTIVE',
            startDate: ap.scheduledStartDate,
            startTime: '08:30',
            endDate: addDaysToDateStr(ap.scheduledStartDate, Math.max(1, Math.ceil(ap.remainingHours / 8))),
            endTime: '17:30',
            startPercent: startPct,
            durationPercent: durationPct,
            hours: ap.remainingHours,
            isDeadWeight: false,
            isSimulated: isSim,
            linkedBlockId: rampBlockId
        };

        ap.rampBlock = rampBlock;
        ap.engineerBlock = engBlock;

        if (!rampBlocksMap.has(rampId)) rampBlocksMap.set(rampId, []);
        rampBlocksMap.get(rampId)!.push(rampBlock);

        if (!engineerBlocksMap.has(engineerId)) engineerBlocksMap.set(engineerId, []);
        engineerBlocksMap.get(engineerId)!.push(engBlock);

        // Vector linkage connecting Ramp space block to Engineer wrench time block
        dependencyLinks.push({
            id: `link_${ap.job.id}`,
            jobId: ap.job.id,
            rampBlockId,
            engineerBlockId: engBlockId,
            fcsState: 'ACTIVE'
        });
    });

    // Place Remaining QUEUED jobs sequentially onto the earliest available slots
    let rollingOffsetHours = activeWrenchHours / Math.max(1, effectiveEngineers.length);
    queuedPlans.filter(qp => qp.fcsState === 'QUEUED').forEach((qp, idx) => {
        const rampId = effectiveRamps[idx % effectiveRamps.length]?.id;
        const engineerId = effectiveEngineers[idx % effectiveEngineers.length]?.id;
        if (!rampId || !engineerId) return;

        const estimatedStartDays = Math.floor(rollingOffsetHours / 8);
        const queuedStartDate = addDaysToDateStr(startDateStr, estimatedStartDays);
        rollingOffsetHours += qp.remainingHours;
        const isSim = engineerId.startsWith('sim_');

        const rampBlockId = `ramp_block_queued_${qp.job.id}`;
        const engBlockId = `eng_block_queued_${qp.job.id}`;

        const startPct = calculatePercentOffset(queuedStartDate, startDateStr, windowDays);
        const durationPct = calculatePercentDuration(qp.remainingHours, windowDays);

        const rampBlock: FCSGanttBlock = {
            id: rampBlockId,
            jobId: qp.job.id,
            resourceType: 'ramp',
            resourceId: rampId,
            resourceName: effectiveRamps.find(r => r.id === rampId)?.name || 'Ramp',
            title: qp.job.description || 'Queued Job',
            vehicleRegistration: qp.vehicle?.registration,
            fcsState: 'QUEUED',
            startDate: queuedStartDate,
            startTime: '08:30',
            endDate: addDaysToDateStr(queuedStartDate, Math.max(1, Math.ceil(qp.remainingHours / 8))),
            endTime: '17:30',
            startPercent: startPct,
            durationPercent: durationPct,
            hours: qp.remainingHours,
            isDeadWeight: false,
            isSimulated: isSim,
            linkedBlockId: engBlockId
        };

        const engBlock: FCSGanttBlock = {
            id: engBlockId,
            jobId: qp.job.id,
            resourceType: 'engineer',
            resourceId: engineerId,
            resourceName: effectiveEngineers.find(e => e.id === engineerId)?.name || 'Engineer',
            title: qp.job.description || 'Queued Wrench Time',
            vehicleRegistration: qp.vehicle?.registration,
            fcsState: 'QUEUED',
            startDate: queuedStartDate,
            startTime: '08:30',
            endDate: addDaysToDateStr(queuedStartDate, Math.max(1, Math.ceil(qp.remainingHours / 8))),
            endTime: '17:30',
            startPercent: startPct,
            durationPercent: durationPct,
            hours: qp.remainingHours,
            isDeadWeight: false,
            isSimulated: isSim,
            linkedBlockId: rampBlockId
        };

        qp.rampBlock = rampBlock;
        qp.engineerBlock = engBlock;

        rampBlocksMap.get(rampId)?.push(rampBlock);
        engineerBlocksMap.get(engineerId)?.push(engBlock);

        dependencyLinks.push({
            id: `link_${qp.job.id}`,
            jobId: qp.job.id,
            rampBlockId,
            engineerBlockId: engBlockId,
            fcsState: 'QUEUED'
        });
    });

    // Compute metrics
    const totalBacklogHours = jobPlans.reduce((acc, p) => acc + p.remainingHours, 0);
    const totalDailyCapacity = effectiveEngineers.length * 8;
    const totalBacklogDays = totalDailyCapacity > 0 ? parseFloat((totalBacklogHours / totalDailyCapacity).toFixed(1)) : 0;
    const earliestBacklogClearDate = addDaysToDateStr(startDateStr, Math.ceil(totalBacklogDays));

    const totalWindowHours = windowDays * 8;
    const engineerUtilizationPercent = Math.min(100, Math.round((activeWrenchHours / (effectiveEngineers.length * totalWindowHours || 1)) * 100));
    const totalRampCapacityHours = effectiveRamps.length * totalWindowHours;
    const rampUtilizationPercent = Math.min(100, Math.round(((activeWrenchHours + stalledDeadWeightHours) / (totalRampCapacityHours || 1)) * 100));

    // Compute simulation difference if extra engineer is simulated
    let simulatedHoursSaved: number | undefined;
    let simulatedDaysSaved: number | undefined;
    if (simulateExtraEngineers > 0 && engineers.length > 0) {
        const baseCapacity = engineers.length * 8;
        const simCapacity = effectiveEngineers.length * 8;
        const baseDays = totalBacklogHours / baseCapacity;
        const simDays = totalBacklogHours / simCapacity;
        simulatedDaysSaved = parseFloat(Math.max(0, baseDays - simDays).toFixed(1));
        simulatedHoursSaved = parseFloat((simulatedDaysSaved * 8).toFixed(1));
    }

    return {
        rampRows: effectiveRamps.map(r => ({
            ramp: r,
            blocks: rampBlocksMap.get(r.id) || []
        })),
        engineerRows: effectiveEngineers.map(e => ({
            engineer: e,
            blocks: engineerBlocksMap.get(e.id) || [],
            idleSlots: []
        })),
        dependencyLinks,
        metrics: {
            totalBacklogHours,
            totalBacklogDays,
            earliestBacklogClearDate,
            stalledDeadWeightRampHours: stalledDeadWeightHours,
            activeWrenchHours,
            engineerUtilizationPercent,
            rampUtilizationPercent,
            simulatedHoursSaved,
            simulatedDaysSaved
        },
        activeJobPlans: activePlans,
        queuedJobPlans: queuedPlans,
        stalledJobPlans: stalledPlans
    };
}

/**
 * Service Advisor Booking Buffer Simulation:
 * Calculates the exact earliest realistic start date for complex jobs based on in-flight ramp & engineer constraints
 */
export function calculateEarliestRealisticStart({
    estimatedHours,
    preferredRampId,
    partsLeadDays = 0,
    jobs,
    ramps,
    engineers,
    purchaseOrders,
    startDateStr = getRelativeDate(0)
}: {
    estimatedHours: number;
    preferredRampId?: string;
    partsLeadDays?: number;
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    startDateStr?: string;
}): {
    earliestStartDate: string;
    earliestStartTime: string;
    projectedCompletionDate: string;
    bottleneckReason: 'NONE' | 'RAMP_OCCUPIED' | 'ENGINEER_UNAVAILABLE' | 'PARTS_HOLD';
    explanation: string;
    compatibleRampName: string;
    recommendedEngineerName?: string;
} {
    // Run baseline FCS simulation
    const matrix = calculateFCSMatrix({
        jobs,
        ramps,
        engineers,
        purchaseOrders,
        windowDays: 21,
        startDateStr
    });

    const minDaysFromParts = partsLeadDays > 0 ? partsLeadDays : 0;

    // Look for ramp with the least load
    let targetRamp = ramps.find(r => r.id === preferredRampId);
    if (!targetRamp) {
        // Choose the ramp with the fewest committed hours
        const sortedRamps = [...matrix.rampRows].sort((a, b) => {
            const hoursA = a.blocks.reduce((acc, blk) => acc + blk.hours, 0);
            const hoursB = b.blocks.reduce((acc, blk) => acc + blk.hours, 0);
            return hoursA - hoursB;
        });
        targetRamp = sortedRamps[0]?.ramp || ramps[0];
    }

    // Determine bottleneck factor
    const totalBacklogDays = matrix.metrics.totalBacklogDays;
    const requiredDays = Math.ceil(estimatedHours / 8);

    let bottleneckReason: 'NONE' | 'RAMP_OCCUPIED' | 'ENGINEER_UNAVAILABLE' | 'PARTS_HOLD' = 'NONE';
    let delayDays = minDaysFromParts;

    if (partsLeadDays > 0 && partsLeadDays >= totalBacklogDays) {
        bottleneckReason = 'PARTS_HOLD';
        delayDays = partsLeadDays;
    } else if (matrix.metrics.rampUtilizationPercent >= 85) {
        bottleneckReason = 'RAMP_OCCUPIED';
        delayDays = Math.max(delayDays, Math.ceil(totalBacklogDays * 0.75));
    } else if (matrix.metrics.engineerUtilizationPercent >= 85) {
        bottleneckReason = 'ENGINEER_UNAVAILABLE';
        delayDays = Math.max(delayDays, Math.ceil(totalBacklogDays));
    }

    const calculatedStart = addDaysToDateStr(startDateStr, delayDays);
    const calculatedCompletion = addDaysToDateStr(calculatedStart, requiredDays);

    let explanation = `Earliest slot starts on ${calculatedStart} with ${requiredDays} working day(s) required.`;
    if (bottleneckReason === 'PARTS_HOLD') {
        explanation = `Parts delivery lead time of ${partsLeadDays} day(s) dictates earliest start date.`;
    } else if (bottleneckReason === 'RAMP_OCCUPIED') {
        explanation = `Heavy-duty ramps are at ${matrix.metrics.rampUtilizationPercent}% capacity. Earliest continuous bay opens on ${calculatedStart}.`;
    } else if (bottleneckReason === 'ENGINEER_UNAVAILABLE') {
        explanation = `Labour pool is heavily booked (${matrix.metrics.totalBacklogHours}h backlog). First matching technician frees up on ${calculatedStart}.`;
    }

    return {
        earliestStartDate: calculatedStart,
        earliestStartTime: '08:30',
        projectedCompletionDate: calculatedCompletion,
        bottleneckReason,
        explanation,
        compatibleRampName: targetRamp?.name || 'Heavy Duty Bay 1',
        recommendedEngineerName: engineers[0]?.name
    };
}

// Helper calculation utilities
function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
    if (!dateStr) return getRelativeDate(daysToAdd);
    try {
        const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
        const result = addDays(d, daysToAdd);
        return formatDate(result);
    } catch {
        return getRelativeDate(daysToAdd);
    }
}

function calculatePercentOffset(targetDateStr: string, baseDateStr: string, windowDays: number): number {
    try {
        const target = new Date(targetDateStr.includes('T') ? targetDateStr : `${targetDateStr}T00:00:00`).getTime();
        const base = new Date(baseDateStr.includes('T') ? baseDateStr : `${baseDateStr}T00:00:00`).getTime();
        const diffDays = (target - base) / (1000 * 60 * 60 * 24);
        const percent = (diffDays / Math.max(1, windowDays)) * 100;
        return Math.max(0, Math.min(100, percent));
    } catch {
        return 0;
    }
}

function calculatePercentDuration(hours: number, windowDays: number): number {
    const totalWindowHours = windowDays * 8;
    const percent = (hours / Math.max(1, totalWindowHours)) * 100;
    return Math.max(2, Math.min(100, percent));
}

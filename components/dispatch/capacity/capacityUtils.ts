import { Job, JobSegment, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';
import { formatDate, dateStringToDate, addDays, formatReadableDate } from '../../../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';
import { 
    DailyCapacitySummary, 
    WeeklyCapacityTotals, 
    FreeCapacitySlot, 
    CapacityWarning, 
    CapacityTrafficLight 
} from './capacityTypes';

/**
 * Calculates capacity and bookings for a single calendar day.
 */
export const calculateDailyCapacity = (params: {
    date: Date;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
}): DailyCapacitySummary => {
    const {
        date,
        jobs,
        lifts,
        engineers,
        absences,
        businessEntities,
        selectedEntityId,
        bankHolidays
    } = params;

    const dateStr = formatDate(date);
    const dayOfWeek = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isWeekend = isSunday || isSaturday;

    // Check holiday status
    const holidays = bankHolidays?.get(dateStr) || [];
    const isHoliday = holidays.length > 0;
    const holidayName = holidays[0];

    // Determine entity config
    const targetEntity = businessEntities.find(e => e.id === selectedEntityId);
    const workingHours = targetEntity?.workingHours || {
        startHour: 8.5,
        endHour: 17.5,
        isOpenSaturday: true,
        saturdayStartHour: 8.5,
        saturdayEndHour: 12.5,
        isOpenSunday: false
    };

    // Filter relevant lifts and engineers for this entity
    const entityLifts = lifts.filter(l => selectedEntityId === 'all' || l.entityId === selectedEntityId);
    const entityEngineers = engineers.filter(e => {
        if (selectedEntityId === 'all') return true;
        if (e.isTransferred && e.transferredToEntityId === selectedEntityId) return true;
        if (e.isTransferred && e.transferredToEntityId && e.transferredToEntityId !== selectedEntityId) return false;
        return e.entityId === selectedEntityId;
    });

    // Check which technicians have approved absences on this date
    const absentEngineerIds = new Set<string>();
    absences.forEach(req => {
        if (req.status === 'Approved' && req.startDate <= dateStr && req.endDate >= dateStr) {
            absentEngineerIds.add(req.userId);
        }
    });

    const activeEngineers = entityEngineers.filter(e => !absentEngineerIds.has(e.id));
    const absentEngineersCount = entityEngineers.length - activeEngineers.length;

    // Calculate daily base hours per technician
    let hoursPerTech = 0;
    if (isHoliday) {
        hoursPerTech = 0;
    } else if (isSunday) {
        hoursPerTech = workingHours.isOpenSunday ? Math.max(0, (workingHours.endHour || 17.5) - (workingHours.startHour || 8.5)) : 0;
    } else if (isSaturday) {
        if (workingHours.isOpenSaturday) {
            const start = workingHours.saturdayStartHour || workingHours.startHour || 8.5;
            const end = workingHours.saturdayEndHour || 12.5;
            hoursPerTech = Math.max(0, end - start);
        } else {
            hoursPerTech = 0;
        }
    } else {
        // Standard weekday
        const start = workingHours.startHour || 8.5;
        const end = workingHours.endHour || 17.5;
        hoursPerTech = Math.max(0, end - start);
    }

    // Fallback if entity has flat dailyCapacityHours defined
    let availableHours = 0;
    if (hoursPerTech === 0) {
        availableHours = 0;
    } else if (activeEngineers.length > 0) {
        availableHours = activeEngineers.length * hoursPerTech;
    } else if (targetEntity?.dailyCapacityHours && !isSunday && !isHoliday) {
        // Fallback to configured entity capacity if no engineers mapped yet
        availableHours = isSaturday ? targetEntity.dailyCapacityHours * 0.4 : targetEntity.dailyCapacityHours;
    } else {
        // Standard workshop baseline (6 techs * 8 hrs = 48)
        availableHours = isSaturday ? 16 : 40;
    }

    // Calculate booked hours from non-cancelled jobs
    let bookedHours = 0;
    const occupiedLiftIds = new Set<string>();
    let jobsCount = 0;

    const liftHoursMap = new Map<string, number>();
    entityLifts.forEach(l => liftHoursMap.set(l.id, 0));

    jobs.forEach(job => {
        if (job.status === 'Cancelled') return;
        if (selectedEntityId !== 'all' && job.entityId && job.entityId !== selectedEntityId) return;

        let hasSegmentOnDate = false;
        (job.segments || []).forEach(segment => {
            if (segment.date === dateStr && segment.status !== 'Cancelled') {
                const duration = Number(segment.duration) || 0;
                bookedHours += duration;
                hasSegmentOnDate = true;

                if (segment.allocatedLift) {
                    occupiedLiftIds.add(segment.allocatedLift);
                    liftHoursMap.set(
                        segment.allocatedLift,
                        (liftHoursMap.get(segment.allocatedLift) || 0) + duration
                    );
                }
            }
        });

        if (hasSegmentOnDate) {
            jobsCount++;
        }
    });

    // Empty bays = bays with < 1.0 hour of total booked work that day
    let emptyBaysCount = 0;
    entityLifts.forEach(l => {
        const hours = liftHoursMap.get(l.id) || 0;
        if (hours < 1.0) {
            emptyBaysCount++;
        }
    });

    const spareHours = Number((availableHours - bookedHours).toFixed(1));
    const utilizationPercent = availableHours > 0 
        ? Math.round((bookedHours / availableHours) * 100) 
        : (bookedHours > 0 ? 100 : 0);

    // Determine Traffic Light Status
    let status: CapacityTrafficLight = 'plenty_spare';
    if (availableHours <= 0) {
        status = 'closed';
    } else if (bookedHours > availableHours || utilizationPercent >= 90) {
        status = 'near_full'; // Red
    } else if (utilizationPercent >= 70) {
        status = 'getting_busy'; // Amber
    } else {
        status = 'plenty_spare'; // Green
    }

    const dayName = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    const dayShortName = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

    return {
        date: dateStr,
        dayName,
        dayShortName,
        formattedDate,
        availableHours: Number(availableHours.toFixed(1)),
        bookedHours: Number(bookedHours.toFixed(1)),
        spareHours,
        utilizationPercent,
        status,
        emptyBaysCount,
        totalBaysCount: entityLifts.length,
        activeEngineersCount: activeEngineers.length,
        totalEngineersCount: entityEngineers.length,
        absentEngineersCount,
        isWeekend,
        isHoliday,
        holidayName,
        jobsCount
    };
};

/**
 * Calculates complete weekly capacity overview across 7 days.
 */
export const calculateWeeklyCapacitySummary = (params: {
    weekStart: Date;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
}): WeeklyCapacityTotals => {
    const { weekStart } = params;
    const days: DailyCapacitySummary[] = [];

    for (let i = 0; i < 7; i++) {
        const dayDate = addDays(weekStart, i);
        days.push(calculateDailyCapacity({
            ...params,
            date: dayDate
        }));
    }

    const totalAvailableHours = Number(days.reduce((sum, d) => sum + d.availableHours, 0).toFixed(1));
    const totalBookedHours = Number(days.reduce((sum, d) => sum + d.bookedHours, 0).toFixed(1));
    const totalSpareHours = Number((totalAvailableHours - totalBookedHours).toFixed(1));
    const averageUtilizationPercent = totalAvailableHours > 0 
        ? Math.round((totalBookedHours / totalAvailableHours) * 100) 
        : 0;

    // Average free bays on working days
    const workingDays = days.filter(d => !d.isHoliday && d.availableHours > 0);
    const averageEmptyBaysPerDay = workingDays.length > 0 
        ? Number((workingDays.reduce((sum, d) => sum + d.emptyBaysCount, 0) / workingDays.length).toFixed(1))
        : 0;

    return {
        weekStartDate: formatDate(weekStart),
        weekEndDate: formatDate(addDays(weekStart, 6)),
        totalAvailableHours,
        totalBookedHours,
        totalSpareHours,
        averageUtilizationPercent,
        averageEmptyBaysPerDay,
        days
    };
};

/**
 * Scans upcoming weeks (default: 4 weeks) to locate all free capacity blocks.
 */
export const findSpareCapacitySlots = (params: {
    startDate: Date;
    horizonWeeks?: number;
    minDurationHours?: number;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    onlyMot?: boolean;
}): FreeCapacitySlot[] => {
    const {
        startDate,
        horizonWeeks = 4,
        minDurationHours = 1.0,
        jobs,
        lifts,
        engineers,
        absences,
        businessEntities,
        selectedEntityId,
        bankHolidays,
        onlyMot
    } = params as typeof params & { onlyMot?: boolean };

    const slots: FreeCapacitySlot[] = [];
    const totalDaysToScan = horizonWeeks * 7;
    const minSegmentsRequired = Math.ceil(minDurationHours * (60 / SEGMENT_DURATION_MINUTES));

    const isMotOrLift7 = (l: Lift) => {
        const name = (l.name || '').toLowerCase();
        const type = (l.type || '').toLowerCase();
        return name.includes('mot') || type.includes('mot') || name.includes('lift 7') || name.includes('bay 7');
    };

    const entityLifts = lifts
        .filter(l => selectedEntityId === 'all' || l.entityId === selectedEntityId)
        .filter(l => !onlyMot || isMotOrLift7(l));
    const entityEngineers = engineers.filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId);

    for (let dayOffset = 0; dayOffset < totalDaysToScan; dayOffset++) {
        const checkDate = addDays(startDate, dayOffset);
        const dateStr = formatDate(checkDate);
        const dayOfWeek = checkDate.getUTCDay();

        // Skip Sundays or Bank holidays
        if (dayOfWeek === 0) continue;
        if (bankHolidays?.get(dateStr)?.length) continue;

        // Maximum segments for this day
        const maxSegmentsToday = (dayOfWeek === 6) ? 8 : TIME_SEGMENTS.length; // Half-day Saturday vs Full Weekday

        // Build occupancy map for each lift on this date
        entityLifts.forEach(lift => {
            const occupiedSegments = new Array(maxSegmentsToday).fill(false);

            jobs.forEach(job => {
                if (job.status === 'Cancelled') return;
                (job.segments || []).forEach(seg => {
                    if (seg.date === dateStr && seg.allocatedLift === lift.id && seg.status !== 'Cancelled') {
                        if (seg.scheduledStartSegment !== null && seg.scheduledStartSegment !== undefined) {
                            const segDuration = Number(seg.duration) || 1;
                            const slotCount = Math.ceil(segDuration * (60 / SEGMENT_DURATION_MINUTES));
                            for (let s = 0; s < slotCount; s++) {
                                const idx = seg.scheduledStartSegment + s;
                                if (idx < maxSegmentsToday) {
                                    occupiedSegments[idx] = true;
                                }
                            }
                        }
                    }
                });
            });

            // Find contiguous available blocks
            let blockStart: number | null = null;
            for (let i = 0; i < maxSegmentsToday; i++) {
                if (!occupiedSegments[i]) {
                    if (blockStart === null) blockStart = i;
                } else {
                    if (blockStart !== null) {
                        const blockLength = i - blockStart;
                        if (blockLength >= minSegmentsRequired) {
                            const durationHours = blockLength * (SEGMENT_DURATION_MINUTES / 60);
                            const startTime = TIME_SEGMENTS[blockStart] || '08:30 AM';
                            const endTime = TIME_SEGMENTS[i] || '05:30 PM';
                            
                            // Candidate engineer: pick an engineer mapped to this entity without absence today
                            const absentIds = new Set(
                                absences
                                    .filter(a => a.status === 'Approved' && a.startDate <= dateStr && a.endDate >= dateStr)
                                    .map(a => a.userId)
                            );
                            const candidateTech = entityEngineers.find(e => !absentIds.has(e.id));

                            slots.push({
                                id: `slot_${dateStr}_${lift.id}_${blockStart}_${i}`,
                                date: dateStr,
                                dayName: checkDate.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
                                formattedDate: checkDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
                                startSegmentIndex: blockStart,
                                endSegmentIndex: i,
                                startTime,
                                endTime,
                                durationHours: Number(durationHours.toFixed(1)),
                                liftId: lift.id,
                                liftName: lift.name,
                                liftType: lift.type || 'Standard Bay',
                                liftColor: lift.color,
                                engineerId: candidateTech?.id,
                                engineerName: candidateTech?.name || 'Available Tech'
                            });
                        }
                        blockStart = null;
                    }
                }
            }

            // Tail check at the end of the day
            if (blockStart !== null) {
                const blockLength = maxSegmentsToday - blockStart;
                if (blockLength >= minSegmentsRequired) {
                    const durationHours = blockLength * (SEGMENT_DURATION_MINUTES / 60);
                    const startTime = TIME_SEGMENTS[blockStart] || '08:30 AM';
                    const endTime = (dayOfWeek === 6) ? '12:30 PM' : '05:30 PM';

                    const absentIds = new Set(
                        absences
                            .filter(a => a.status === 'Approved' && a.startDate <= dateStr && a.endDate >= dateStr)
                            .map(a => a.userId)
                    );
                    const candidateTech = entityEngineers.find(e => !absentIds.has(e.id));

                    slots.push({
                        id: `slot_${dateStr}_${lift.id}_${blockStart}_${maxSegmentsToday}`,
                        date: dateStr,
                        dayName: checkDate.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
                        formattedDate: checkDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
                        startSegmentIndex: blockStart,
                        endSegmentIndex: maxSegmentsToday,
                        startTime,
                        endTime,
                        durationHours: Number(durationHours.toFixed(1)),
                        liftId: lift.id,
                        liftName: lift.name,
                        liftType: lift.type || 'Standard Bay',
                        liftColor: lift.color,
                        engineerId: candidateTech?.id,
                        engineerName: candidateTech?.name || 'Available Tech'
                    });
                }
            }
        });
    }

    return slots;
};

/**
 * Analyzes workshop schedules to extract ONLY actionable warnings and exceptions.
 */
export const findCapacityWarnings = (params: {
    startDate: Date;
    daysToCheck?: number;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
}): CapacityWarning[] => {
    const {
        startDate,
        daysToCheck = 28,
        jobs,
        lifts,
        engineers,
        absences,
        businessEntities,
        selectedEntityId,
        bankHolidays
    } = params;

    const warnings: CapacityWarning[] = [];
    const liftsById = new Map(lifts.map(l => [l.id, l]));
    const engineersById = new Map(engineers.map(e => [e.id, e]));

    // 1. Check for Overbooked Days
    for (let i = 0; i < daysToCheck; i++) {
        const dateObj = addDays(startDate, i);
        const daySummary = calculateDailyCapacity({
            date: dateObj,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays
        });

        if (daySummary.availableHours > 0 && daySummary.bookedHours > daySummary.availableHours) {
            const excess = Number((daySummary.bookedHours - daySummary.availableHours).toFixed(1));
            warnings.push({
                id: `warn_overbooked_${daySummary.date}`,
                type: 'overbooked',
                severity: 'critical',
                title: `Overbooked Day: ${daySummary.dayName}`,
                message: `${daySummary.bookedHours}h booked against ${daySummary.availableHours}h total capacity (+${excess}h over limit).`,
                date: daySummary.date,
                formattedDate: daySummary.formattedDate,
                excessHours: excess,
                suggestedAction: 'Rebalance or shift jobs to a less busy day'
            });
        }
    }

    // 2. Check for Jobs with Missing / Unassigned Resources (scheduled date but no bay or engineer)
    const upcomingDateLimit = formatDate(addDays(startDate, daysToCheck));
    const startStr = formatDate(startDate);

    jobs.forEach(job => {
        if (job.status === 'Cancelled' || job.status === 'Invoiced' || job.status === 'Complete') return;
        if (selectedEntityId !== 'all' && job.entityId && job.entityId !== selectedEntityId) return;

        (job.segments || []).forEach(seg => {
            if (seg.status === 'Cancelled') return;
            if (seg.date && seg.date >= startStr && seg.date <= upcomingDateLimit) {
                const missingRamp = !seg.allocatedLift;
                const missingTech = !seg.engineerId;

                if (missingRamp || missingTech) {
                    warnings.push({
                        id: `warn_unassigned_${job.id}_${seg.segmentId}`,
                        type: 'unassigned_resources',
                        severity: 'warning',
                        title: `Unassigned Resource on Job #${job.id.slice(-4)}`,
                        message: `Scheduled for ${seg.date} (${seg.duration || 1}h) but missing ${missingRamp && missingTech ? 'both Ramp and Technician' : missingRamp ? 'assigned Ramp/Bay' : 'assigned Technician'}.`,
                        date: seg.date,
                        formattedDate: formatReadableDate(seg.date),
                        jobId: job.id,
                        jobRef: job.id,
                        jobDescription: job.description || 'Workshop Job',
                        suggestedAction: missingRamp ? 'Assign Workshop Bay' : 'Assign Technician'
                    });
                }
            }
        });
    });

    // 3. Check for Staff Shortages & Conflicting Absences (tech is on leave but has scheduled jobs)
    absences.forEach(abs => {
        if (abs.status !== 'Approved') return;
        if (abs.endDate < startStr || abs.startDate > upcomingDateLimit) return;

        const engineer = engineersById.get(abs.userId);
        if (!engineer) return;

        // Check if any job segments are still assigned to this absent engineer during the leave period
        let conflictedHours = 0;
        let conflictDate = '';

        jobs.forEach(job => {
            if (job.status === 'Cancelled' || job.status === 'Complete') return;
            (job.segments || []).forEach(seg => {
                if (seg.engineerId === abs.userId && seg.date && seg.date >= abs.startDate && seg.date <= abs.endDate && seg.status !== 'Cancelled') {
                    conflictedHours += Number(seg.duration) || 1;
                    conflictDate = seg.date;
                }
            });
        });

        if (conflictedHours > 0) {
            warnings.push({
                id: `warn_absence_conflict_${abs.id}`,
                type: 'staff_shortage',
                severity: 'critical',
                title: `Staff Absence Conflict: ${engineer.name}`,
                message: `${engineer.name} has approved ${abs.type} leave (${abs.startDate} to ${abs.endDate}), but still has ${conflictedHours.toFixed(1)}h of allocated work.`,
                date: conflictDate || abs.startDate,
                formattedDate: formatReadableDate(conflictDate || abs.startDate),
                engineerId: engineer.id,
                engineerName: engineer.name,
                excessHours: conflictedHours,
                suggestedAction: `Reassign ${engineer.name}'s jobs to available team members`
            });
        }
    });

    // 4. Check for Long Idle Gaps (> 3 hours) on Scheduled Days for Technicians
    const daysToScanGaps = Math.min(14, daysToCheck); // Check next 2 weeks for gaps
    for (let dayOffset = 0; dayOffset < daysToScanGaps; dayOffset++) {
        const checkDate = addDays(startDate, dayOffset);
        const dateStr = formatDate(checkDate);
        if (checkDate.getUTCDay() === 0) continue; // Skip Sunday

        engineers.forEach(tech => {
            // Check if tech is on leave
            const isAbsent = absences.some(a => a.userId === tech.id && a.status === 'Approved' && a.startDate <= dateStr && a.endDate >= dateStr);
            if (isAbsent) return;

            // Find tech's segments on this date
            const techSegments: { start: number; duration: number; liftId?: string }[] = [];
            jobs.forEach(job => {
                if (job.status === 'Cancelled') return;
                (job.segments || []).forEach(seg => {
                    if (seg.engineerId === tech.id && seg.date === dateStr && seg.scheduledStartSegment !== null && seg.scheduledStartSegment !== undefined && seg.status !== 'Cancelled') {
                        techSegments.push({
                            start: seg.scheduledStartSegment,
                            duration: Math.ceil((Number(seg.duration) || 1) * 2),
                            liftId: seg.allocatedLift
                        });
                    }
                });
            });

            if (techSegments.length > 0) {
                // Sort segments by start time
                techSegments.sort((a, b) => a.start - b.start);

                // Check gap between consecutive segments
                for (let k = 0; k < techSegments.length - 1; k++) {
                    const currentEnd = techSegments[k].start + techSegments[k].duration;
                    const nextStart = techSegments[k + 1].start;
                    const gapSegments = nextStart - currentEnd;
                    const gapHours = gapSegments * 0.5;

                    if (gapHours >= 3.0) {
                        const startTimeStr = TIME_SEGMENTS[currentEnd] || '11:00 AM';
                        const endTimeStr = TIME_SEGMENTS[nextStart] || '02:00 PM';
                        warnings.push({
                            id: `warn_gap_${tech.id}_${dateStr}_${k}`,
                            type: 'gap_gt_3h',
                            severity: 'info',
                            title: `Idle Gap >3h: ${tech.name}`,
                            message: `${gapHours.toFixed(1)}h idle gap between ${startTimeStr} and ${endTimeStr} on ${formatReadableDate(dateStr)}.`,
                            date: dateStr,
                            formattedDate: formatReadableDate(dateStr),
                            engineerId: tech.id,
                            engineerName: tech.name,
                            gapDurationHours: gapHours,
                            suggestedAction: 'Fill gap with an unallocated job or maintenance task'
                        });
                    }
                }
            }
        });
    }

    return warnings;
};

/**
 * Exports Weekly Capacity Summary to a formatted CSV string and triggers client download.
 */
export const exportWeeklyCapacityCSV = (weeklySummary: WeeklyCapacityTotals): void => {
    const headers = [
        'Day',
        'Date',
        'Available Labour Hours',
        'Hours Booked',
        'Spare Hours Remaining',
        'Utilization (%)',
        'Capacity Status',
        'Empty Bays Free',
        'Total Bays',
        'Active Technicians',
        'Jobs Count'
    ];

    const rows = weeklySummary.days.map(d => [
        `"${d.dayName}"`,
        `"${d.date}"`,
        d.availableHours.toFixed(1),
        d.bookedHours.toFixed(1),
        d.spareHours.toFixed(1),
        `${d.utilizationPercent}%`,
        `"${d.status.toUpperCase().replace('_', ' ')}"`,
        d.emptyBaysCount,
        d.totalBaysCount,
        d.activeEngineersCount,
        d.jobsCount
    ]);

    // Summary row
    const summaryRow = [
        '"WEEK TOTAL"',
        `"${weeklySummary.weekStartDate} to ${weeklySummary.weekEndDate}"`,
        weeklySummary.totalAvailableHours.toFixed(1),
        weeklySummary.totalBookedHours.toFixed(1),
        weeklySummary.totalSpareHours.toFixed(1),
        `${weeklySummary.averageUtilizationPercent}%`,
        `"${weeklySummary.averageUtilizationPercent > 90 ? 'HIGH LOAD' : 'HEALTHY'}"`,
        weeklySummary.averageEmptyBaysPerDay.toFixed(1),
        '-',
        '-',
        '-'
    ];

    const csvContent = [headers.join(','), ...rows.map(r => r.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `workshop_capacity_${weeklySummary.weekStartDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Triggers a landscape print stylesheet for saving as PDF or direct printing.
 */
export const triggerPrintWeeklyDashboard = (): void => {
    document.body.classList.add('print-capacity-dashboard');
    const style = document.createElement('style');
    style.id = 'capacity-print-style';
    style.innerHTML = `
        @media print {
            @page { size: landscape; margin: 10mm; }
            .no-print { display: none !important; }
            body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-capacity-dashboard');
        const el = document.getElementById('capacity-print-style');
        if (el) document.head.removeChild(el);
    }, 1000);
};

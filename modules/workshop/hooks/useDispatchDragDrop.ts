import React from 'react';
import { useRef, useCallback } from 'react';
import { DraggedSegmentData, Job, JobSegment, Lift, BusinessEntity } from '../../../types';
import { calculateJobStatus } from '../../../core/utils/jobUtils';
import { getNextValidWorkingDate, dateStringToDate, formatDate } from '../../../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';
import { getHolidaysForRegion } from '../../../services/bankHolidayService';

interface UseDispatchDragDropProps {
    jobs: Job[];
    lifts: Lift[];
    businessEntities: BusinessEntity[];
    currentDate: string;
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    setAssignModalData: (data: { job: Job, segment: JobSegment, lift: Lift, startSegmentIndex: number, currentEngineerId?: string | null } | null) => void;
    bankHolidays: Map<string, string[]>;
}

export const useDispatchDragDrop = ({
    jobs,
    lifts,
    businessEntities,
    currentDate,
    setJobs,
    setAssignModalData,
    bankHolidays
}: UseDispatchDragDropProps) => {
    
    const draggedItemRef = useRef<DraggedSegmentData | null>(null);
    const dropResultRef = useRef<{ type: 'TIMELINE', liftId: string, startSegmentIndex: number } | { type: 'UNALLOCATED' } | null>(null);
    const dragImageRef = useRef<HTMLElement | null>(null);

    // Helper: Get Entity Config
    const getEntityConfig = useCallback((liftId: string) => {
        const lift = lifts.find(l => l.id === liftId);
        const entity = businessEntities.find(e => e.id === lift?.entityId);
        
        // Default to standard UK hours if no config
        return entity?.workingHours || {
            startHour: 8.5,
            endHour: 17.5,
            isOpenSaturday: true,
            saturdayStartHour: 8.5,
            saturdayEndHour: 12.5,
            isOpenSunday: false,
            region: 'england-and-wales' as const
        };
    }, [lifts, businessEntities]);

    // Helper: Calculate Max Slots for a specific date and entity
    // Returns the number of segments available (from 8:30 onwards)
    const getMaxSlotsForDate = useCallback((dateStr: string, config: any) => {
        const dateObj = dateStringToDate(dateStr);
        const dayOfWeek = dateObj.getUTCDay(); // 0=Sun, 6=Sat
        const holidays = getHolidaysForRegion(config.region, bankHolidays);

        if (holidays.includes(dateStr)) return 0; // Closed on Bank Holiday

        if (dayOfWeek === 0) { // Sunday
            return config.isOpenSunday ? Math.floor((config.endHour - config.startHour) * (60/SEGMENT_DURATION_MINUTES)) : 0;
        }
        if (dayOfWeek === 6) { // Saturday
            if (!config.isOpenSaturday) return 0;
            const start = config.saturdayStartHour || config.startHour;
            const end = config.saturdayEndHour || config.endHour;
            // Map actual hours to 0-based grid index relative to standard grid start (08:30 = 8.5)
            const gridStart = 8.5; 
            const endIndex = (end - gridStart) * 2; 
            return Math.max(0, Math.floor(endIndex));
        }

        // Weekday
        const gridStart = 8.5; 
        const end = config.endHour;
        const endIndex = (end - gridStart) * 2;
        // Clamp to grid size
        return Math.min(TIME_SEGMENTS.length, Math.floor(endIndex));

    }, [bankHolidays]);

    const checkCollisionOnDate = useCallback((date: string, liftId: string, startSegmentIndex: number, durationInSegments: number, draggedSegmentId?: string) => {
        const segmentsOnLiftAndDate = jobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === date && s.allocatedLift === liftId && s.segmentId !== draggedSegmentId);
    
        const config = getEntityConfig(liftId);
        const maxSlotsForDate = getMaxSlotsForDate(date, config);

        // Check if job extends past working hours for THIS specific day
        if (startSegmentIndex < 0 || startSegmentIndex + durationInSegments > maxSlotsForDate) {
            return true;
        }

        for (let i = 0; i < durationInSegments; i++) {
            const timeSlotIndex = startSegmentIndex + i;
            const isOccupied = segmentsOnLiftAndDate.some(s => {
                if (s.scheduledStartSegment === null) return false;
                const sEndIndex = s.scheduledStartSegment + (s.duration * (60 / SEGMENT_DURATION_MINUTES));
                return timeSlotIndex >= s.scheduledStartSegment && timeSlotIndex < sEndIndex;
            });
            if (isOccupied) return true;
        }
        return false;
    }, [jobs, getEntityConfig, getMaxSlotsForDate]);

    // NEW: Logic separated from drop handler to allow modal confirmation
    const confirmJobSchedule = useCallback((jobId: string, segmentId: string, liftId: string, engineerId: string, startSegmentIndex: number) => {
        const job = jobs.find(j => j.id === jobId);
        const originalSegment = job?.segments.find(s => s.segmentId === segmentId);
        const lift = lifts.find(l => l.id === liftId);

        if (!job || !originalSegment || !lift) return;
        
        // 1. Calculate Total Job Requirements
        const estHours = Number(job.estimatedHours) || 1;
        const totalDurationInSegments = Math.ceil(estHours * (60 / SEGMENT_DURATION_MINUTES));
        const entityConfig = getEntityConfig(liftId);
        const regionHolidays = getHolidaysForRegion(entityConfig.region as any, bankHolidays);

        // 2. Logic to flow segments across days, respecting weekends and holidays
        const newSegments: JobSegment[] = [];
        let remainingSegmentsToBook = totalDurationInSegments;
        
        let currentBookingDate = currentDate;
        let currentStartIndex = startSegmentIndex;

        // Safety break to prevent infinite loops
        let loopCount = 0;
        const MAX_LOOPS = 50; 

        while (remainingSegmentsToBook > 0 && loopCount < MAX_LOOPS) {
            loopCount++;

            // Get dynamic capacity for this specific day based on entity config & holidays
            const maxSlotsToday = getMaxSlotsForDate(currentBookingDate, entityConfig);
            
            // Calculate space remaining on this specific day
            const safeStartIndex = Math.max(0, Math.min(currentStartIndex, maxSlotsToday));
            const slotsAvailableToday = Math.max(0, maxSlotsToday - safeStartIndex);
            
            // Determine how much of the job fits today
            const segmentsForThisDay = Math.min(remainingSegmentsToBook, slotsAvailableToday);

            if (segmentsForThisDay > 0) {
                // Check collision for this specific chunk
                // Only check strictly on the *first* day where user explicitly dropped/confirmed it.
                if (loopCount === 1 && checkCollisionOnDate(currentBookingDate, liftId, safeStartIndex, segmentsForThisDay, segmentId)) {
                    alert("Collision detected on start day. Please choose a clear time slot.");
                    return; 
                }

                const hoursForThisDay = segmentsForThisDay * (SEGMENT_DURATION_MINUTES / 60);

                newSegments.push({
                    segmentId: loopCount === 1 ? segmentId : crypto.randomUUID(), // Keep original ID for first segment
                    date: currentBookingDate,
                    scheduledStartSegment: safeStartIndex,
                    duration: hoursForThisDay,
                    allocatedLift: liftId,
                    engineerId: engineerId,
                    status: 'Allocated'
                });

                remainingSegmentsToBook -= segmentsForThisDay;
            }

            // If we still have time left, move to the next valid working day
            if (remainingSegmentsToBook > 0) {
                currentBookingDate = getNextValidWorkingDate(currentBookingDate, regionHolidays);
                currentStartIndex = 0; // Always start at 08:30 on subsequent days
            }
        }

        if (remainingSegmentsToBook > 0) {
            alert("Could not schedule full duration within a reasonable timeframe (30 days).");
            return;
        }

        // 3. Update Job State
        setJobs(prev => prev.map(j => {
            if (j.id === jobId) {
                return { 
                    ...j, 
                    scheduledDate: newSegments[0]?.date || j.scheduledDate, 
                    segments: newSegments, 
                    status: calculateJobStatus(newSegments) 
                };
            }
            return j;
        }));

    }, [jobs, lifts, currentDate, bankHolidays, getEntityConfig, getMaxSlotsForDate, checkCollisionOnDate, setJobs]);

    const handleDragStart = useCallback((e: React.DragEvent, parentJobId: string, segmentId: string) => {
        const job = jobs.find(j => j.id === parentJobId);
        const segment = job?.segments.find(s => s.segmentId === segmentId);
        if (segment) {
            const dragData = { parentJobId, segmentId, duration: segment.duration };
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            draggedItemRef.current = dragData;
        }
        e.dataTransfer.effectAllowed = 'move';
        dropResultRef.current = null;
        
        const sourceElement = e.currentTarget as HTMLElement;
        sourceElement.classList.add('is-dragging-source');
        
        if (dragImageRef.current) document.body.removeChild(dragImageRef.current);
        const clone = sourceElement.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.width = `${sourceElement.offsetWidth}px`;
        clone.style.transform = 'rotate(2deg)';
        document.body.appendChild(clone);
        dragImageRef.current = clone;
        e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2);
    }, [jobs]);

    const handleTimelineDragOver = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        if (!draggedItemRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const segmentHeight = rect.height / TIME_SEGMENTS.length;
        const hoverSegmentIndex = Math.floor(offsetY / segmentHeight);
        
        dropResultRef.current = { type: 'TIMELINE', liftId, startSegmentIndex: hoverSegmentIndex };
        
        document.querySelectorAll('.timeline-column-over').forEach(el => el.classList.remove('timeline-column-over'));
        e.currentTarget.classList.add('timeline-column-over');
    }, []);

    const handleTimelineDrop = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        e.currentTarget.classList.remove('timeline-column-over');
        
        if (dropResultRef.current?.type === 'TIMELINE' && draggedItemRef.current) {
            const { startSegmentIndex } = dropResultRef.current;
            const { parentJobId, segmentId } = draggedItemRef.current;
            
            const job = jobs.find(j => j.id === parentJobId);
            const originalSegment = job?.segments.find(s => s.segmentId === segmentId);
            const lift = lifts.find(l => l.id === liftId);

            if (!job || !originalSegment || !lift) return;
            
            // Pop the modal instead of scheduling immediately
            setAssignModalData({
                job,
                segment: originalSegment,
                lift,
                startSegmentIndex,
                currentEngineerId: originalSegment.engineerId
            });
        }
        draggedItemRef.current = null;
    }, [jobs, lifts, setAssignModalData]);

    const handleUnallocatedDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const unallocatedZone = e.currentTarget;
        unallocatedZone.classList.remove('is-over');
        
        if (dropResultRef.current?.type === 'UNALLOCATED' && draggedItemRef.current) {
            const { parentJobId } = draggedItemRef.current;
            
             setJobs(prev => prev.map(job => {
                if (job.id === parentJobId) {
                    // Reset to a clean unallocated state
                    // We consolidate multi-day segments back into one block for the unallocated list
                    const newSegments: JobSegment[] = [{
                         segmentId: crypto.randomUUID(),
                         date: null,
                         duration: job.estimatedHours,
                         status: 'Unallocated',
                         allocatedLift: null,
                         scheduledStartSegment: null,
                         engineerId: null // Clear engineer when moving back to unallocated pool
                    }];

                    return { 
                        ...job, 
                        scheduledDate: null,
                        segments: newSegments, 
                        status: 'Unallocated' 
                    };
                }
                return job;
            }));
        }
        draggedItemRef.current = null;
    }, [setJobs]);
    
    const handleDragEnd = useCallback((e: React.DragEvent) => {
        const sourceElement = e.currentTarget as HTMLElement;
        sourceElement.classList.remove('is-dragging-source');
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
        }
        draggedItemRef.current = null;
        dropResultRef.current = null;
    }, []);

    return {
        handleDragStart,
        handleTimelineDragOver,
        handleTimelineDrop,
        handleUnallocatedDrop,
        handleDragEnd,
        checkCollisionOnDate,
        confirmJobSchedule,
        draggedItemRef,
        dropResultRef
    };
};

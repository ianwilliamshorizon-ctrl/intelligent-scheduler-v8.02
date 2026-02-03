import React from 'react';
import { useRef, useCallback } from 'react';
import { DraggedSegmentData, Job, JobSegment, Lift, BusinessEntity } from '../../../types';
import { calculateJobStatus } from '../../../core/utils/jobUtils';
import { getNextValidWorkingDate, dateStringToDate, formatDate } from '../../../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';
import { getHolidaysForRegion } from '../../../services/bankHolidayService';
import { saveDocument } from '../../../core/db/index'; // Using your standard save function

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

    const getEntityConfig = useCallback((liftId: string) => {
        const lift = lifts.find(l => l.id === liftId);
        const entity = businessEntities.find(e => e.id === lift?.entityId);
        return entity?.workingHours || {
            startHour: 8.5, endHour: 17.5, isOpenSaturday: true,
            saturdayStartHour: 8.5, saturdayEndHour: 12.5, isOpenSunday: false,
            region: 'england-and-wales' as const
        };
    }, [lifts, businessEntities]);

    const getMaxSlotsForDate = useCallback((dateStr: string, config: any) => {
        const dateObj = dateStringToDate(dateStr);
        const dayOfWeek = dateObj.getUTCDay();
        const holidays = getHolidaysForRegion(config.region, bankHolidays);
        if (holidays.includes(dateStr)) return 0;
        if (dayOfWeek === 0) return config.isOpenSunday ? Math.floor((config.endHour - config.startHour) * (60/SEGMENT_DURATION_MINUTES)) : 0;
        if (dayOfWeek === 6) {
            if (!config.isOpenSaturday) return 0;
            const start = config.saturdayStartHour || config.startHour;
            const end = config.saturdayEndHour || config.endHour;
            return Math.max(0, Math.floor((end - 8.5) * 2));
        }
        return Math.min(TIME_SEGMENTS.length, Math.floor((config.endHour - 8.5) * 2));
    }, [bankHolidays]);

    const checkCollisionOnDate = useCallback((date: string, liftId: string, startSegmentIndex: number, durationInSegments: number, draggedSegmentId?: string) => {
        const segmentsOnLiftAndDate = jobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === date && s.allocatedLift === liftId && s.segmentId !== draggedSegmentId);
        const config = getEntityConfig(liftId);
        const maxSlotsForDate = getMaxSlotsForDate(date, config);
        if (startSegmentIndex < 0 || startSegmentIndex + durationInSegments > maxSlotsForDate) return true;
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

    const confirmJobSchedule = useCallback(async (jobId: string, segmentId: string, liftId: string, engineerId: string, startSegmentIndex: number) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;
        
        const estHours = Number(job.estimatedHours) || 1;
        const totalDurationInSegments = Math.ceil(estHours * (60 / SEGMENT_DURATION_MINUTES));
        const entityConfig = getEntityConfig(liftId);
        const regionHolidays = getHolidaysForRegion(entityConfig.region as any, bankHolidays);

        const newSegments: JobSegment[] = [];
        let remainingSegmentsToBook = totalDurationInSegments;
        let currentBookingDate = currentDate;
        let currentStartIndex = startSegmentIndex;
        let loopCount = 0;

        while (remainingSegmentsToBook > 0 && loopCount < 50) {
            loopCount++;
            const maxSlotsToday = getMaxSlotsForDate(currentBookingDate, entityConfig);
            const safeStartIndex = Math.max(0, Math.min(currentStartIndex, maxSlotsToday));
            const slotsAvailableToday = Math.max(0, maxSlotsToday - safeStartIndex);
            const segmentsForThisDay = Math.min(remainingSegmentsToBook, slotsAvailableToday);

            if (segmentsForThisDay > 0) {
                if (loopCount === 1 && checkCollisionOnDate(currentBookingDate, liftId, safeStartIndex, segmentsForThisDay, segmentId)) {
                    alert("Collision detected on start day.");
                    return; 
                }
                newSegments.push({
                    segmentId: loopCount === 1 ? segmentId : crypto.randomUUID(),
                    date: currentBookingDate,
                    scheduledStartSegment: safeStartIndex,
                    duration: segmentsForThisDay * (SEGMENT_DURATION_MINUTES / 60),
                    allocatedLift: liftId,
                    engineerId: engineerId,
                    status: 'Allocated'
                });
                remainingSegmentsToBook -= segmentsForThisDay;
            }
            if (remainingSegmentsToBook > 0) {
                currentBookingDate = getNextValidWorkingDate(currentBookingDate, regionHolidays);
                currentStartIndex = 0;
            }
        }

        const updatedJob: Job = { 
            ...job,
            scheduledDate: newSegments[0]?.date || job.scheduledDate, 
            segments: newSegments, 
            status: calculateJobStatus(newSegments) 
        };

        // 1. Update UI
        setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j));

        // 2. Persist using your standard save function
        try {
            await saveDocument('brooks_jobs', updatedJob);
        } catch (err) {
            console.error("Save failed:", err);
        }

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
        
        const sourceElement = e.currentTarget as HTMLElement;
        if (sourceElement?.classList) sourceElement.classList.add('is-dragging-source');
        
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
        }

        const clone = sourceElement.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.width = `${sourceElement.offsetWidth}px`;
        document.body.appendChild(clone);
        dragImageRef.current = clone;
        e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2);
    }, [jobs]);

    const handleTimelineDragOver = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        if (!draggedItemRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const hoverSegmentIndex = Math.floor((e.clientY - rect.top) / (rect.height / TIME_SEGMENTS.length));
        dropResultRef.current = { type: 'TIMELINE', liftId, startSegmentIndex: hoverSegmentIndex };
        
        document.querySelectorAll('.timeline-column-over').forEach(el => el.classList.remove('timeline-column-over'));
        if (e.currentTarget?.classList) e.currentTarget.classList.add('timeline-column-over');
    }, []);

    const handleTimelineDrop = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        if (e.currentTarget?.classList) e.currentTarget.classList.remove('timeline-column-over');
        
        if (dropResultRef.current?.type === 'TIMELINE' && draggedItemRef.current) {
            const { startSegmentIndex } = dropResultRef.current;
            const { parentJobId, segmentId } = draggedItemRef.current;
            const job = jobs.find(j => j.id === parentJobId);
            const originalSegment = job?.segments.find(s => s.segmentId === segmentId);
            const lift = lifts.find(l => l.id === liftId);

            if (job && originalSegment && lift) {
                setAssignModalData({
                    job, segment: originalSegment, lift,
                    startSegmentIndex, currentEngineerId: originalSegment.engineerId
                });
            }
        }
        draggedItemRef.current = null;
    }, [jobs, lifts, setAssignModalData]);

    const handleUnallocatedDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.currentTarget?.classList) e.currentTarget.classList.remove('is-over');
        
        if (dropResultRef.current?.type === 'UNALLOCATED' && draggedItemRef.current) {
            const { parentJobId } = draggedItemRef.current;
            const job = jobs.find(j => j.id === parentJobId);
            if (!job) return;

            const updatedJob: Job = { 
                ...job,
                scheduledDate: null,
                segments: [{
                    segmentId: crypto.randomUUID(),
                    date: null,
                    duration: job.estimatedHours,
                    status: 'Unallocated',
                    allocatedLift: null,
                    scheduledStartSegment: null,
                    engineerId: null
                }],
                status: 'Unallocated' 
            };

            setJobs(prev => prev.map(j => j.id === parentJobId ? updatedJob : j));
            
            try {
                await saveDocument('brooks_jobs', updatedJob);
            } catch (err) {
                console.error("Unallocate failed:", err);
            }
        }
        draggedItemRef.current = null;
    }, [jobs, setJobs]);
    
    const handleDragEnd = useCallback((e: React.DragEvent) => {
        const sourceElement = e.currentTarget as HTMLElement;
        if (sourceElement?.classList) sourceElement.classList.remove('is-dragging-source');
        
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
            dragImageRef.current = null;
        }
        draggedItemRef.current = null;
        dropResultRef.current = null;
    }, []);

    return {
        handleDragStart, handleTimelineDragOver, handleTimelineDrop,
        handleUnallocatedDrop, handleDragEnd, checkCollisionOnDate,
        confirmJobSchedule, draggedItemRef, dropResultRef
    };
};
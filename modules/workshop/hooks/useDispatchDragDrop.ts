
import { useRef, useCallback } from 'react';
import { DraggedSegmentData, Job, JobSegment, Lift } from '../../../types';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';

interface UseDispatchDragDropProps {
    jobs: Job[];
    lifts: Lift[];
    currentDate: string;
    setAssignModalData: (data: { job: Job, segment: JobSegment, lift: Lift, startSegmentIndex: number, currentEngineerId?: string | null } | null) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void; // <-- ADDED THIS PROP
}

export const useDispatchDragDrop = ({
    jobs,
    lifts,
    currentDate,
    setAssignModalData,
    onUnscheduleSegment // <-- ADDED THIS PROP
}: UseDispatchDragDropProps) => {
    
    const draggedItemRef = useRef<DraggedSegmentData & { from: 'unallocated' | 'timeline' } | null>(null);
    const dropResultRef = useRef<{ type: 'TIMELINE', liftId: string, startSegmentIndex: number } | { type: 'UNALLOCATED' } | null>(null);
    const dragImageRef = useRef<HTMLElement | null>(null);

    const checkCollisionOnDate = useCallback((date: string, liftId: string, startSegmentIndex: number, durationInSegments: number, draggedSegmentId?: string) => {
        const segmentsOnLiftAndDate = jobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === date && s.allocatedLift === liftId && s.segmentId !== draggedSegmentId);
    
        if (startSegmentIndex < 0 || startSegmentIndex + durationInSegments > TIME_SEGMENTS.length) {
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
    }, [jobs]);

    const handleDragStart = useCallback((e: React.DragEvent, parentJobId: string, segmentId: string, from: 'unallocated' | 'timeline') => {
        const job = jobs.find(j => j.id === parentJobId);
        const segment = job?.segments.find(s => s.segmentId === segmentId);
        if (segment) {
            const dragData = { parentJobId, segmentId, duration: segment.duration, from };
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

    const handleUnallocatedDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (draggedItemRef.current?.from === 'timeline') {
            e.currentTarget.classList.add('is-over');
            dropResultRef.current = { type: 'UNALLOCATED' };
        }
    }, []);

    const handleUnallocatedDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('is-over');
    }, []);

    const handleTimelineDrop = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        document.querySelectorAll('.timeline-column-over').forEach(el => el.classList.remove('timeline-column-over'));
        
        if (dropResultRef.current?.type === 'TIMELINE' && draggedItemRef.current) {
            const { startSegmentIndex } = dropResultRef.current;
            const { parentJobId, segmentId, duration } = draggedItemRef.current;
            const durationInSegments = duration * (60 / SEGMENT_DURATION_MINUTES);

            let finalStartIndex = startSegmentIndex;
            if (checkCollisionOnDate(currentDate, liftId, finalStartIndex, durationInSegments, segmentId)) {
                let found = false;
                for (let i = 0; i < TIME_SEGMENTS.length - durationInSegments; i++) {
                    if (!checkCollisionOnDate(currentDate, liftId, i, durationInSegments, segmentId)) {
                        finalStartIndex = i;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    alert("No space available on this lift for the entire duration.");
                    return;
                }
            }
            
            const job = jobs.find(j => j.id === parentJobId);
            const segment = job?.segments.find(s => s.segmentId === segmentId);
            const lift = lifts.find(l => l.id === liftId);

            if (job && segment && lift) {
                setAssignModalData({ job, segment, lift, startSegmentIndex: finalStartIndex, currentEngineerId: segment.engineerId });
            }
        }
        draggedItemRef.current = null;
    }, [jobs, lifts, currentDate, checkCollisionOnDate, setAssignModalData]);

    const handleUnallocatedDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('is-over');
        
        if (dropResultRef.current?.type === 'UNALLOCATED' && draggedItemRef.current) {
            const { parentJobId, segmentId } = draggedItemRef.current;
            // UPDATED: Call the function to persist the change
            onUnscheduleSegment(parentJobId, segmentId);
        }
        draggedItemRef.current = null;
    }, [onUnscheduleSegment]); // DEPENDENCY ARRAY UPDATED
    
    const handleDragEnd = useCallback((e: React.DragEvent) => {
        const sourceElement = document.querySelector('.is-dragging-source');
        if (sourceElement) sourceElement.classList.remove('is-dragging-source');
        
        document.querySelectorAll('.timeline-column-over').forEach(el => el.classList.remove('timeline-column-over'));
        document.querySelectorAll('.is-over').forEach(el => el.classList.remove('is-over'));

        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
            dragImageRef.current = null;
        }
        draggedItemRef.current = null;
        dropResultRef.current = null;
    }, []);

    return {
        handleDragStart,
        handleTimelineDragOver,
        handleTimelineDrop,
        handleUnallocatedDragOver,
        handleUnallocatedDragLeave,
        handleUnallocatedDrop,
        handleDragEnd,
        checkCollisionOnDate,
        draggedItemRef,
        dropResultRef
    };
};

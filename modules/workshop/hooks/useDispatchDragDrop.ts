
import React, { useRef, useCallback } from 'react';
import { DraggedSegmentData, Job, JobSegment, Lift, BusinessEntity, Estimate, EstimateLineItem, PurchaseOrder, Part, Vehicle, User } from '../../../types';
import { calculateJobStatus } from '../../../core/utils/jobUtils';
import { getNextValidWorkingDate, dateStringToDate, formatDate } from '../../../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';
import { getHolidaysForRegion } from '../../../services/bankHolidayService';
import { generateSequenceId } from '../../../core/db';

interface UseDispatchDragDropProps {
    jobs: Job[];
    lifts: Lift[];
    businessEntities: BusinessEntity[];
    currentDate: string;
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    setAssignModalData: (data: { job: Job, segment: JobSegment, lift: Lift, startSegmentIndex: number, currentEngineerId?: string | null } | null) => void;
    bankHolidays: Map<string, string[]>;
    parts: Part[];
    vehicles: Vehicle[];
    currentUser: User;
    handleSavePurchaseOrder: (po: PurchaseOrder) => Promise<void>;
    estimates: Estimate[];
}

export const useDispatchDragDrop = ({
    jobs,
    lifts,
    businessEntities,
    currentDate,
    setJobs,
    setAssignModalData,
    bankHolidays,
    parts,
    vehicles,
    currentUser,
    handleSavePurchaseOrder,
    estimates
}: UseDispatchDragDropProps) => {
    
    const draggedItemRef = useRef<DraggedSegmentData | null>(null);
    const dropResultRef = useRef<{ type: 'TIMELINE', liftId: string, startSegmentIndex: number } | { type: 'UNALLOCATED' } | null>(null);
    const dragImageRef = useRef<HTMLElement | null>(null);
    const lastActiveLiftIdRef = useRef<string | null>(null);

    const getEntityConfig = useCallback((liftId: string) => {
        const lift = lifts.find(l => l.id === liftId);
        const entity = businessEntities.find(e => e.id === lift?.entityId);
        
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

    const getMaxSlotsForDate = useCallback((dateStr: string, config: any) => {
        const dateObj = dateStringToDate(dateStr);
        const dayOfWeek = dateObj.getUTCDay();
        const holidays = getHolidaysForRegion(config.region, bankHolidays);

        if (holidays.includes(dateStr)) return 0;

        if (dayOfWeek === 0) {
            return config.isOpenSunday ? Math.floor((config.endHour - config.startHour) * (60/SEGMENT_DURATION_MINUTES)) : 0;
        }
        if (dayOfWeek === 6) {
            if (!config.isOpenSaturday) return 0;
            const start = config.saturdayStartHour || config.startHour;
            const end = config.saturdayEndHour || config.endHour;
            const gridStart = 8.5; 
            const endIndex = (end - gridStart) * 2; 
            return Math.max(0, Math.floor(endIndex));
        }

        const gridStart = 8.5; 
        const end = config.endHour;
        const endIndex = (end - gridStart) * 2;
        return Math.min(TIME_SEGMENTS.length, Math.floor(endIndex));

    }, [bankHolidays]);

    const checkCollisionOnDate = useCallback((date: string, liftId: string, startSegmentIndex: number, durationInSegments: number, draggedSegmentId?: string) => {
        const segmentsOnLiftAndDate = jobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === date && s.allocatedLift === liftId && s.segmentId !== draggedSegmentId);
    
        const config = getEntityConfig(liftId);
        const maxSlotsForDate = getMaxSlotsForDate(date, config);

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

    const createPOs = async (job: Job, entityCode: string, itemsForPO: EstimateLineItem[]) => {
        const partItems = itemsForPO.filter(li => !li.isLabor && li.partId);
        const poIds: string[] = [];
        if (partItems.length > 0) {
            const partsBySupplier: Record<string, EstimateLineItem[]> = {};
            partItems.forEach(item => {
                const partDef = parts.find(p => p.id === item.partId);
                const sId = partDef?.defaultSupplierId || 'PENDING_SUPPLIER';
                if (!partsBySupplier[sId]) partsBySupplier[sId] = [];
                partsBySupplier[sId].push(item);
            });

            for (const [supplierId, items] of Object.entries(partsBySupplier)) {
                const newPOId = await generateSequenceId('944', entityCode);
                const vehicle = vehicles.find(v => v.id === job.vehicleId);
                const newPO: PurchaseOrder = {
                    id: newPOId, 
                    entityId: job.entityId, 
                    supplierId: supplierId === 'PENDING_SUPPLIER' ? '' : supplierId, 
                    vehicleRegistrationRef: vehicle?.registration || 'N/A',
                    orderDate: formatDate(new Date()), 
                    status: 'Draft', 
                    jobId: job.id,
                    createdByUserId: currentUser.id,
                    lineItems: items.map(item => ({ 
                        id: crypto.randomUUID(), 
                        partNumber: item.partNumber || '', 
                        description: item.description || '', 
                        quantity: item.quantity, 
                        receivedQuantity: 0, 
                        unitPrice: item.unitCost || 0, 
                        taxCodeId: item.taxCodeId || '' 
                    }))
                };
                await handleSavePurchaseOrder(newPO);
                poIds.push(newPOId);
            }
        }
        return poIds;
    };

    const confirmJobSchedule = useCallback(async (jobId: string, segmentId: string, liftId: string, engineerId: string, startSegmentIndex: number) => {
        const job = jobs.find(j => j.id === jobId);
        const originalSegment = job?.segments.find(s => s.segmentId === segmentId);
        const lift = lifts.find(l => l.id === liftId);

        if (!job || !originalSegment || !lift) return;
        
        const estHours = Number(job.estimatedHours) || 1;
        const totalDurationInSegments = Math.ceil(estHours * (60 / SEGMENT_DURATION_MINUTES));
        const entityConfig = getEntityConfig(liftId);
        const regionHolidays = getHolidaysForRegion(entityConfig.region as any, bankHolidays);

        const newSegments: JobSegment[] = [];
        let remainingSegmentsToBook = totalDurationInSegments;
        let currentBookingDate = currentDate;
        let currentStartIndex = startSegmentIndex;
        let loopCount = 0;
        const MAX_LOOPS = 50; 

        while (remainingSegmentsToBook > 0 && loopCount < MAX_LOOPS) {
            loopCount++;

            const maxSlotsToday = getMaxSlotsForDate(currentBookingDate, entityConfig);
            const safeStartIndex = Math.max(0, Math.min(currentStartIndex, maxSlotsToday));
            const slotsAvailableToday = Math.max(0, maxSlotsToday - safeStartIndex);
            const segmentsForThisDay = Math.min(remainingSegmentsToBook, slotsAvailableToday);

            if (segmentsForThisDay > 0) {
                if (loopCount === 1 && checkCollisionOnDate(currentBookingDate, liftId, safeStartIndex, segmentsForThisDay, segmentId)) {
                    alert("Collision detected on start day. Please choose a clear time slot.");
                    return; 
                }

                const hoursForThisDay = segmentsForThisDay * (SEGMENT_DURATION_MINUTES / 60);

                newSegments.push({
                    segmentId: loopCount === 1 ? segmentId : crypto.randomUUID(),
                    date: currentBookingDate,
                    scheduledStartSegment: safeStartIndex,
                    duration: hoursForThisDay,
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

        if (remainingSegmentsToBook > 0) {
            alert("Could not schedule full duration within a reasonable timeframe (30 days).");
            return;
        }
        
        let poIds: string[] = [];
        if (job.estimateId) {
            const estimate = estimates.find(e => e.id === job.estimateId);
            if (estimate) {
                const entity = businessEntities.find(e => e.id === job.entityId);
                poIds = await createPOs(job, entity?.shortCode || 'UNK', estimate.lineItems);
            }
        }

        setJobs(prev => prev.map(j => {
            if (j.id === jobId) {
                return { 
                    ...j, 
                    scheduledDate: newSegments[0]?.date || j.scheduledDate, 
                    segments: newSegments, 
                    status: calculateJobStatus(newSegments), 
                    purchaseOrderIds: [...(j.purchaseOrderIds || []), ...poIds]
                };
            }
            return j;
        }));

    }, [jobs, lifts, currentDate, bankHolidays, getEntityConfig, getMaxSlotsForDate, checkCollisionOnDate, setJobs, createPOs, estimates]);

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
        document.body.classList.add('dragging-active');
        
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
        }
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
        
        if (lastActiveLiftIdRef.current !== liftId) {
             document.querySelectorAll('.timeline-column-over').forEach(el => el.classList.remove('timeline-column-over'));
             e.currentTarget.classList.add('timeline-column-over');
             lastActiveLiftIdRef.current = liftId;
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const segmentHeight = rect.height / TIME_SEGMENTS.length;
        const hoverSegmentIndex = Math.floor(offsetY / segmentHeight);
        
        dropResultRef.current = { type: 'TIMELINE', liftId, startSegmentIndex: hoverSegmentIndex };
    }, []);

    const handleTimelineDrop = useCallback((e: React.DragEvent, liftId: string) => {
        e.preventDefault();
        e.currentTarget.classList.remove('timeline-column-over');
        lastActiveLiftIdRef.current = null;
        
        if (dropResultRef.current?.type === 'TIMELINE' && draggedItemRef.current) {
            const { startSegmentIndex } = dropResultRef.current;
            const { parentJobId, segmentId } = draggedItemRef.current;
            
            const job = jobs.find(j => j.id === parentJobId);
            const originalSegment = job?.segments.find(s => s.segmentId === segmentId);
            const lift = lifts.find(l => l.id === liftId);

            if (!job || !originalSegment || !lift) return;
            
            setAssignModalData({
                job,
                segment: originalSegment,
                lift,
                startSegmentIndex,
                currentEngineerId: originalSegment.engineerId
            });
        }
    }, [jobs, lifts, setAssignModalData]);

    const handleUnallocatedDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedItemRef.current) return;
        e.currentTarget.classList.add('is-over');
        dropResultRef.current = { type: 'UNALLOCATED' };
    }, []);
    
    const handleUnallocatedDragLeave = useCallback((e: React.DragEvent) => {
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
        }
        e.currentTarget.classList.remove('is-over');
    }, []);

    const handleUnallocatedDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const unallocatedZone = e.currentTarget;
        unallocatedZone.classList.remove('is-over');
        
        if (dropResultRef.current?.type === 'UNALLOCATED' && draggedItemRef.current) {
            const { parentJobId } = draggedItemRef.current;
            
             setJobs(prev => prev.map(job => {
                if (job.id === parentJobId) {
                    const newSegments: JobSegment[] = [{
                         segmentId: crypto.randomUUID(),
                         date: null,
                         duration: job.estimatedHours,
                         status: 'Unallocated',
                         allocatedLift: null,
                         scheduledStartSegment: null,
                         engineerId: null
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
    }, [setJobs]);
    
    const handleDragEnd = useCallback((e: React.DragEvent) => {
        const sourceElement = e.currentTarget as HTMLElement;
        sourceElement.classList.remove('is-dragging-source');
        document.body.classList.remove('dragging-active');
        
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
        }
        dragImageRef.current = null;
        draggedItemRef.current = null;
        dropResultRef.current = null;
        
        document.querySelectorAll('.timeline-column-over, .is-over').forEach(el => {
            el.classList.remove('timeline-column-over');
            el.classList.remove('is-over');
        });
        lastActiveLiftIdRef.current = null;
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
        confirmJobSchedule,
        draggedItemRef,
        dropResultRef
    };
};
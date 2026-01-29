
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { ChevronLeft, ChevronRight, Clock, PlusCircle } from 'lucide-react';
import { DraggedSegmentData, Job, JobSegment, Lift, PurchaseOrder } from '../../types';
import { formatDate, dateStringToDate, getRelativeDate, formatReadableDate, addDays, getStartOfWeek } from '../../core/utils/dateUtils';
import { calculateJobStatus } from '../../core/utils/jobUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';
import DatePickerModal from '../../components/DatePickerModal';
import { BookingCalendarView } from '../../components/BookingCalendarView';
import AssignEngineerModal from '../../components/AssignEngineerModal';
import { TimelineView } from '../../components/dispatch/TimelineView';
import { WeeklyView } from '../../components/dispatch/WeeklyView';

interface DispatchViewProps {
    setDefaultDateForModal: (date: string | null) => void;
    setIsSmartCreateOpen: (isOpen: boolean) => void;
    setSmartCreateMode: (mode: 'job' | 'estimate') => void;
    setSelectedJobId: (id: string | null) => void;
    setIsEditModalOpen: (isOpen: boolean) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassignEngineer: (jobId: string, segmentId: string, newEngineerId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
}

const DispatchView: React.FC<DispatchViewProps> = ({ setDefaultDateForModal, setIsSmartCreateOpen, setSmartCreateMode, setSelectedJobId, setIsEditModalOpen, onOpenPurchaseOrder, onPause, onRestart, onReassignEngineer, onCheckIn, onOpenAssistant, onUnscheduleSegment }) => {
    const { jobs, setJobs, lifts, engineers, customers, vehicles, purchaseOrders, absenceRequests, businessEntities } = useData();
    const { currentUser, selectedEntityId, setCheckingInJobId, setIsCheckInOpen } = useApp();
    
    const [viewMode, setViewMode] = useState<'timeline' | 'week' | 'calendar'>('timeline');
    const [currentDate, setCurrentDate] = useState(getRelativeDate(0));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [unallocatedDateFilter, setUnallocatedDateFilter] = useState<'all' | 'today' | '7days' | '14days'>('all');
    const [showOnSiteOnly, setShowOnSiteOnly] = useState(false);
    const [currentMonthDate, setCurrentMonthDate] = useState(dateStringToDate(getRelativeDate(0)));
    const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
    
    const [assignModalData, setAssignModalData] = useState<{ job: Job, segment: JobSegment, lift: Lift, startSegmentIndex: number, currentEngineerId?: string | null } | null>(null);
    const [reassignModalData, setReassignModalData] = useState<{ jobId: string; segmentId: string; liftName: string; startSegmentIndex: number; currentEngineerId?: string | null; } | null>(null);

    const draggedItemRef = useRef<DraggedSegmentData | null>(null);
    const dropResultRef = useRef<{ type: 'TIMELINE', liftId: string, startSegmentIndex: number } | { type: 'UNALLOCATED' } | null>(null);
    const dragImageRef = useRef<HTMLElement | null>(null);

    const entityEngineers = useMemo(() => engineers.filter(e => e.entityId === selectedEntityId), [engineers, selectedEntityId]);
    
    const { unallocatedJobs, allocatedSegmentsByLift } = useMemo(() => {
        const today = getRelativeDate(0);
        const allPotentialUnallocated = jobs.filter(job => (selectedEntityId === 'all' || job.entityId === selectedEntityId) && (job.segments || []).some(s => s.status === 'Unallocated'));
        const siteFilteredJobs = showOnSiteOnly ? allPotentialUnallocated.filter(job => job.vehicleStatus === 'On Site') : allPotentialUnallocated;
        const dateFilteredJobs = siteFilteredJobs.filter(job => {
            if (unallocatedDateFilter === 'all') return true;
            const firstUnallocatedSegment = (job.segments || []).find(s => s.status === 'Unallocated');
            if (!firstUnallocatedSegment?.date) return false;
            const jobDate = firstUnallocatedSegment.date;
            if (unallocatedDateFilter === 'today') return jobDate === today;
            if (unallocatedDateFilter === '7days') return jobDate >= today && jobDate <= getRelativeDate(6);
            if (unallocatedDateFilter === '14days') return jobDate >= today && jobDate <= getRelativeDate(13);
            return false;
        });
        const finalUnallocated = dateFilteredJobs;
        const allocated = new Map<string, (JobSegment & { parentJobId: string })[]>();
        jobs.forEach(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
            (job.segments || []).forEach(segment => {
                if (segment.date === currentDate && segment.allocatedLift && segment.status !== 'Unallocated') {
                    if (!allocated.has(segment.allocatedLift)) allocated.set(segment.allocatedLift, []);
                    allocated.get(segment.allocatedLift)!.push({ ...segment, parentJobId: job.id });
                }
            });
        });
        return { unallocatedJobs: finalUnallocated, allocatedSegmentsByLift: allocated };
    }, [jobs, currentDate, selectedEntityId, unallocatedDateFilter, showOnSiteOnly]);

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
    }, [jobs, lifts, currentDate, checkCollisionOnDate]);

    const handleUnallocatedDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const unallocatedZone = e.currentTarget;
        unallocatedZone.classList.remove('is-over');
        
        if (dropResultRef.current?.type === 'UNALLOCATED' && draggedItemRef.current) {
            const { parentJobId, segmentId } = draggedItemRef.current;
            
             setJobs(prev => prev.map(job => {
                if (job.id === parentJobId) {
                    const newSegments = job.segments.map(s => 
                        s.segmentId === segmentId ? { ...s, status: 'Unallocated' as const, allocatedLift: null, scheduledStartSegment: null, engineerId: null } : s
                    );
                    return { ...job, segments: newSegments, status: calculateJobStatus(newSegments) };
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

    const handleAssignConfirm = (engineerId: string, startSegmentIndex: number) => {
        if (!assignModalData) return;
        const { job, segment, lift } = assignModalData;

        const durationInSegments = segment.duration * (60 / SEGMENT_DURATION_MINUTES);
         if (checkCollisionOnDate(currentDate, lift.id, startSegmentIndex, durationInSegments, segment.segmentId)) {
            alert("Slot is no longer available.");
            return;
        }

        setJobs(prev => prev.map(j => {
            if (j.id === job.id) {
                const newSegments = j.segments.map(s => 
                    s.segmentId === segment.segmentId ? { 
                        ...s, 
                        status: 'Allocated' as const, 
                        allocatedLift: lift.id, 
                        scheduledStartSegment: startSegmentIndex, 
                        date: currentDate,
                        engineerId: engineerId
                    } : s
                );
                return { ...j, segments: newSegments, status: calculateJobStatus(newSegments) };
            }
            return j;
        }));
        setAssignModalData(null);
    };

    const handleMonthChange = (offset: number) => {
        setCurrentMonthDate(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };

    const handleToday = () => {
        const today = dateStringToDate(getRelativeDate(0));
        setCurrentDate(formatDate(today));
        setCurrentMonthDate(today);
        setWeekStart(getStartOfWeek(today));
    };

    const absencesByDate = useMemo(() => {
        const map = new Map<string, number>();
        absenceRequests.forEach(req => {
            if (req.status === 'Approved' || req.status === 'Pending') {
                 let curr = dateStringToDate(req.startDate);
                 const end = dateStringToDate(req.endDate);
                 while(curr <= end) {
                    const dateStr = formatDate(curr);
                    map.set(dateStr, (map.get(dateStr) || 0) + 8);
                    curr = addDays(curr, 1);
                }
            }
        });
        return map;
    }, [absenceRequests]);
    
    const dailyCapacity = useMemo(() => {
        return businessEntities.find(e => e.id === selectedEntityId)?.dailyCapacityHours || 40;
    }, [businessEntities, selectedEntityId]);

    const handlePrevDay = () => {
        const d = dateStringToDate(currentDate);
        setCurrentDate(formatDate(addDays(d, -1)));
    };

    const handleNextDay = () => {
         const d = dateStringToDate(currentDate);
         setCurrentDate(formatDate(addDays(d, 1)));
    };
    
    const handleReassignClick = (jobId: string, segmentId: string) => {
        const job = jobs.find(j => j.id === jobId);
        const segment = job?.segments.find(s => s.segmentId === segmentId);
        const lift = lifts.find(l => l.id === segment?.allocatedLift);

        if (job && segment && lift && segment.scheduledStartSegment !== null) {
            setReassignModalData({
                jobId,
                segmentId,
                liftName: lift.name,
                startSegmentIndex: segment.scheduledStartSegment,
                currentEngineerId: segment.engineerId
            });
        }
    };
    
    const handleReassignConfirm = (engineerId: string) => {
        if (!reassignModalData) return;
        
        onReassignEngineer(reassignModalData.jobId, reassignModalData.segmentId, engineerId);
        setReassignModalData(null);
    };

    return (
        <div className="w-full h-full flex flex-col">
            <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-30">
                <div className="flex items-center gap-4">
                     <div className="flex bg-gray-200 rounded-lg p-1">
                        <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'timeline' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Day Timeline</button>
                        <button onClick={() => setViewMode('week')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'week' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Week View</button>
                        <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Month Calendar</button>
                    </div>

                    <div className="flex items-center gap-2">
                        {viewMode === 'timeline' && (
                             <>
                                <button onClick={handlePrevDay} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                                <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700">
                                    <Clock size={18} />
                                    <span>{formatReadableDate(currentDate)}</span>
                                </button>
                                <button onClick={handleNextDay} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                             </>
                        )}
                         {viewMode === 'week' && (
                             <>
                                <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                                <span className="font-semibold px-2">Week of {formatReadableDate(formatDate(weekStart))}</span>
                                <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                             </>
                        )}
                         {viewMode === 'calendar' && (
                             <>
                                <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                                <span className="font-semibold px-2">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                                <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                             </>
                        )}
                        <button onClick={handleToday} className="text-sm font-semibold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded">Today</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setIsSmartCreateOpen(true); setSmartCreateMode('job'); setDefaultDateForModal(currentDate); }} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                        <PlusCircle size={20}/> Smart Create Job
                    </button>
                </div>
            </header>
            
            {viewMode === 'timeline' && (
                <TimelineView
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onTimelineDragEnter={(e) => { e.preventDefault(); }}
                    onTimelineDragLeave={(e) => { e.currentTarget.classList.remove('timeline-column-over'); }}
                    onTimelineDragOver={handleTimelineDragOver}
                    onTimelineDrop={handleTimelineDrop}
                    onDragOverUnallocated={(e) => { e.preventDefault(); dropResultRef.current = { type: 'UNALLOCATED' }; e.currentTarget.classList.add('is-over'); }}
                    onDropOnUnallocated={handleUnallocatedDrop}
                    onDragEnterUnallocated={(e) => e.currentTarget.classList.add('is-over')}
                    onDragLeaveUnallocated={(e) => e.currentTarget.classList.remove('is-over')}
                    unallocatedJobs={unallocatedJobs}
                    allocatedSegmentsByLift={allocatedSegmentsByLift}
                    unallocatedDateFilter={unallocatedDateFilter}
                    setUnallocatedDateFilter={setUnallocatedDateFilter}
                    showOnSiteOnly={showOnSiteOnly}
                    setShowOnSiteOnly={setShowOnSiteOnly}
                    onEditJob={(id) => { setSelectedJobId(id); setIsEditModalOpen(true); }}
                    onCheckIn={onCheckIn}
                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                    onPause={onPause}
                    onRestart={onRestart}
                    onReassign={handleReassignClick}
                    onUnscheduleSegment={onUnscheduleSegment}
                    onOpenAssistant={onOpenAssistant}
                />
            )}
            
            {viewMode === 'calendar' && (
                <div className="flex-grow p-4 min-h-0 bg-gray-100">
                    <BookingCalendarView
                        jobs={jobs.filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId)}
                        vehicles={vehicles}
                        customers={customers}
                        onAddJob={(date) => { setDefaultDateForModal(date); setIsSmartCreateOpen(true); setSmartCreateMode('job'); }}
                        onDragStart={() => {}} // No drag in month view
                        maxDailyCapacityHours={dailyCapacity}
                        absencesByDate={absencesByDate}
                        onDayClick={(date) => { setCurrentDate(date); setViewMode('timeline'); }}
                        onEditJob={(id) => { setSelectedJobId(id); setIsEditModalOpen(true); }}
                        currentMonthDate={currentMonthDate}
                        selectedDate={currentDate}
                    />
                </div>
            )}
            
            {viewMode === 'week' && (
                <WeeklyView 
                    weekStart={weekStart}
                    onEditJob={(id) => { setSelectedJobId(id); setIsEditModalOpen(true); }}
                    onOpenAssistant={onOpenAssistant}
                />
            )}
            
            {isDatePickerOpen && (
                <DatePickerModal
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    onSelectDate={(date) => { setCurrentDate(date); setIsDatePickerOpen(false); }}
                    currentDate={currentDate}
                    jobs={jobs}
                    maxDailyCapacityHours={dailyCapacity}
                    absencesByDate={absencesByDate}
                />
            )}
            
            {assignModalData && (
                <AssignEngineerModal
                    isOpen={!!assignModalData}
                    onClose={() => setAssignModalData(null)}
                    onAssign={handleAssignConfirm}
                    engineers={entityEngineers}
                    jobInfo={{ resourceName: assignModalData.lift.name }}
                    initialStartSegmentIndex={assignModalData.startSegmentIndex}
                    initialEngineerId={assignModalData.currentEngineerId}
                    timeSegments={TIME_SEGMENTS}
                />
            )}

            {reassignModalData && (
                <AssignEngineerModal
                    isOpen={!!reassignModalData}
                    onClose={() => setReassignModalData(null)}
                    onAssign={(engId) => handleReassignConfirm(engId)}
                    engineers={entityEngineers}
                    jobInfo={{ resourceName: reassignModalData.liftName }}
                    initialStartSegmentIndex={reassignModalData.startSegmentIndex}
                    initialEngineerId={reassignModalData.currentEngineerId}
                    timeSegments={TIME_SEGMENTS}
                />
            )}
        </div>
    );
};

export default DispatchView;

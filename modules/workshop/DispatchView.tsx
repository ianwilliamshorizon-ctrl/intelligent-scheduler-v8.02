import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, JobSegment, Lift, PurchaseOrder } from '../../types';
import { dateStringToDate, getRelativeDate, addDays, getStartOfWeek, formatDate } from '../../core/utils/dateUtils';
import { calculateJobStatus } from '../../core/utils/jobUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';
import DatePickerModal from '../../components/DatePickerModal';
import { BookingCalendarView } from '../../components/BookingCalendarView';
import AssignEngineerModal from '../../components/AssignEngineerModal';
import { TimelineView } from '../../components/dispatch/TimelineView';
import { WeeklyView } from '../../components/dispatch/WeeklyView';
import { fetchBankHolidays } from '../../services/bankHolidayService';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';

// New Refactored Hooks & Components
import { useDispatchFilters } from './hooks/useDispatchFilters';
import { useDispatchDragDrop } from './hooks/useDispatchDragDrop';
import { DispatchHeader } from './components/DispatchHeader';

interface DispatchViewProps {
    setDefaultDateForModal: (date: Date | null) => void;
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
    onStartWork: (jobId: string, segmentId: string) => void;
}

const DispatchView: React.FC<DispatchViewProps> = ({ 
    setDefaultDateForModal, 
    setIsSmartCreateOpen, 
    setSmartCreateMode, 
    setSelectedJobId, 
    setIsEditModalOpen, 
    onOpenPurchaseOrder, 
    onPause, 
    onRestart, 
    onReassignEngineer, 
    onCheckIn, 
    onOpenAssistant, 
    onUnscheduleSegment, 
    onStartWork 
}) => {
    const { jobs, setJobs, lifts, engineers, customers, vehicles, purchaseOrders, absenceRequests, businessEntities, estimates, parts, forceRefresh } = useData();
    
    // Auto-refresh data every 30 seconds to keep all users in sync
    useEffect(() => {
        const interval = setInterval(() => {
            // We refresh the core entities used in this view
            forceRefresh('brooks_jobs' as any);
            forceRefresh('brooks_vehicles' as any);
            forceRefresh('brooks_customers' as any);
        }, 30000); 
        return () => clearInterval(interval);
    }, [forceRefresh]);
    const { selectedEntityId, currentUser, users } = useApp();
    
    // -- View State --
    const [viewMode, setViewMode] = useState<'timeline' | 'week' | 'calendar'>('timeline');
    const [currentDate, setCurrentDate] = useState(getRelativeDate(0));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [unallocatedDateFilter, setUnallocatedDateFilter] = useState<'all' | 'today' | '7days' | '14days'>('all');
    const [showOnSiteOnly, setShowOnSiteOnly] = useState(false);
    
    // -- Date Navigation State --
    const [currentMonthDate, setCurrentMonthDate] = useState(dateStringToDate(getRelativeDate(0)));
    const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
    
    // -- Modal State --
    const [assignModalData, setAssignModalData] = useState<{ job: Job, segment: JobSegment, lift: Lift, startSegmentIndex: number, currentEngineerId?: string | null } | null>(null);
    const [reassignModalData, setReassignModalData] = useState<{ jobId: string; segmentId: string; liftName: string; startSegmentIndex: number; currentEngineerId?: string | null; } | null>(null);

    // -- Bank Holidays State --
    const [bankHolidays, setBankHolidays] = useState<Map<string, string[]>>(new Map());

    useEffect(() => {
        fetchBankHolidays().then(setBankHolidays);
    }, []);

    // -- Derived Data via Hooks --
    const { 
        entityEngineers, 
        entityLifts,
        unallocatedJobs, 
        allocatedSegmentsByLift 
    } = useDispatchFilters({
        jobs: jobs.filter(job => job.status !== 'Cancelled'), 
        lifts, 
        engineers, 
        businessEntities, 
        selectedEntityId, 
        currentDate, 
        unallocatedDateFilter, 
        showOnSiteOnly,
        users
    });

    const { handleSavePurchaseOrder } = useWorkshopActions();

    // -- Drag & Drop Logic via Hook --
    const {
        handleDragStart,
        handleTimelineDragOver,
        handleTimelineDrop,
        handleUnallocatedDragOver,
        handleUnallocatedDragLeave,
        handleUnallocatedDrop,
        handleDragEnd,
        confirmJobSchedule
    } = useDispatchDragDrop({
        jobs, lifts, businessEntities, currentDate, setJobs, setAssignModalData, bankHolidays, estimates, parts, vehicles, currentUser, handleSavePurchaseOrder
    });

    const handleAssignConfirm = (engineerId: string, startSegmentIndex: number) => {
        if (!assignModalData) return;
        const { job, segment, lift } = assignModalData;
        confirmJobSchedule(job.id, segment.segmentId, lift.id, engineerId, startSegmentIndex);
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
            <DispatchHeader
                viewMode={viewMode}
                setViewMode={setViewMode}
                currentDate={currentDate}
                setCurrentDate={(date) => setCurrentDate(date)}
                weekStart={weekStart}
                setWeekStart={setWeekStart}
                currentMonthDate={currentMonthDate}
                handleMonthChange={handleMonthChange}
                handleToday={handleToday}
                setIsDatePickerOpen={setIsDatePickerOpen}
                setIsSmartCreateOpen={setIsSmartCreateOpen}
                setSmartCreateMode={setSmartCreateMode}
                setDefaultDateForModal={setDefaultDateForModal}
            />
            
            {viewMode === 'timeline' && (
                <TimelineView
                    lifts={entityLifts}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onTimelineDragOver={handleTimelineDragOver}
                    onTimelineDrop={handleTimelineDrop}
                    onDragOverUnallocated={handleUnallocatedDragOver}
                    onDropOnUnallocated={handleUnallocatedDrop}
                    onDragLeaveUnallocated={handleUnallocatedDragLeave}
                    unallocatedJobs={unallocatedJobs}
                    allocatedSegmentsByLift={allocatedSegmentsByLift}
                    unallocatedDateFilter={unallocatedDateFilter}
                    setUnallocatedDateFilter={setUnallocatedDateFilter}
                    showOnSiteOnly={showOnSiteOnly}
                    setShowOnSiteOnly={setShowOnSiteOnly}
                    onEditJob={(id) => { setSelectedJobId(id); setIsEditModalOpen(true); }}
                    onCheckIn={(id) => { setSelectedJobId(id); onCheckIn(id); }}
                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                    onStartWork={onStartWork}
                    onPause={onPause}
                    onRestart={onRestart}
                    onReassign={handleReassignClick}
                    onUnscheduleSegment={onUnscheduleSegment}
                    onOpenAssistant={(id) => { setSelectedJobId(id); onOpenAssistant(id); }}
                />
            )}
            
            {viewMode === 'calendar' && (
                <div className="flex-grow p-4 min-h-0 bg-gray-100">
                    <BookingCalendarView
                        jobs={jobs.filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId)}
                        vehicles={vehicles}
                        customers={customers}
                        onAddJob={(date) => { setDefaultDateForModal(dateStringToDate(date)); setIsSmartCreateOpen(true); setSmartCreateMode('job'); }}
                        onDragStart={() => {}} 
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
                    onOpenAssistant={(id) => { setSelectedJobId(id); onOpenAssistant(id); }}
                    onCheckIn={(id) => { setSelectedJobId(id); onCheckIn(id); }}
                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                    onStartWork={onStartWork}
                    onPause={onPause}
                    onRestart={onRestart}
                    onQcApprove={() => {}} // Not applicable in this view
                    onEngineerComplete={() => {}} // Not applicable in this view
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
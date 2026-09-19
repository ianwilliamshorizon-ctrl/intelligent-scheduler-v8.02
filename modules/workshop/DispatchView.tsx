import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, JobSegment, Lift, PurchaseOrder, Estimate, Engineer } from '../../types';
import { saveDocument } from '../../core/db';
import { dateStringToDate, getRelativeDate, addDays, getStartOfWeek, formatDate } from '../../core/utils/dateUtils';
import { calculateJobStatus } from '../../core/utils/jobUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';
import DatePickerModal from '../../components/DatePickerModal';
import { BookingCalendarView } from '../../components/BookingCalendarView';
import AssignEngineerModal from '../../components/AssignEngineerModal';
import { TimelineView } from '../../components/dispatch/TimelineView';
import { WeeklyView } from '../../components/dispatch/WeeklyView';
import { ResourceGanttView } from '../../components/dispatch/fcs/ResourceGanttView';
import { fetchBankHolidays } from '../../services/bankHolidayService';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';

// New Refactored Hooks & Components
import { useDispatchFilters, isTechRole } from './hooks/useDispatchFilters';
import { useDispatchDragDrop } from './hooks/useDispatchDragDrop';
import { DispatchHeader } from './components/DispatchHeader';
import MonthlyLaborTallyModal from '../../components/jobs/MonthlyLaborTallyModal';

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
    onSendOffsite: (jobId: string, segmentId: string) => void;
    onPassToSales: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    setEditJobInitialTab?: (tab: string | null) => void;
    onCreateInvoice?: (job: Job) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
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
    onSendOffsite,
    onPassToSales,
    onStartWork,
    setEditJobInitialTab,
    onCreateInvoice,
    onEngineerComplete
}) => {
    const { jobs, setJobs, lifts, engineers, setEngineers, customers, vehicles, purchaseOrders, setPurchaseOrders, absenceRequests, businessEntities, estimates, setEstimates, parts, forceRefresh, saveRecord } = useData();
    
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
    const { selectedEntityId, currentUser, users, setUsers } = useApp();
    
    // -- View State --
    const [viewMode, setViewMode] = useState<'timeline' | 'week' | 'calendar' | 'fcs-gantt'>('timeline');
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
    const [isLaborTallyModalOpen, setIsLaborTallyModalOpen] = useState(false);

    // -- Bank Holidays State --
    const [bankHolidays, setBankHolidays] = useState<Map<string, string[]>>(new Map());

    useEffect(() => {
        fetchBankHolidays().then(setBankHolidays);
    }, []);

    // -- Derived Data via Hooks --
    const { 
        entityEngineers, 
        allValidEngineers,
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

    const { handleSavePurchaseOrder, handleSaveItem } = useWorkshopActions();

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
        jobs, lifts, businessEntities, currentDate, setJobs, setAssignModalData, bankHolidays, estimates, parts, vehicles, currentUser, handleSavePurchaseOrder, handleSaveItem
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

    const handleEditJob = (id: string, initialTab?: string) => {
        setSelectedJobId(id);
        setEditJobInitialTab?.(initialTab || null);
        setIsEditModalOpen(true);
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
                onOpenLaborTally={() => setIsLaborTallyModalOpen(true)}
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
                    onEditJob={handleEditJob}
                    onCheckIn={(id) => { setSelectedJobId(id); onCheckIn(id); }}
                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                    onStartWork={onStartWork}
                    onPause={onPause}
                    onRestart={onRestart}
                    onReassign={handleReassignClick}
                    onUnscheduleSegment={onUnscheduleSegment}
                    onSendOffsite={onSendOffsite}
                    onPassToSales={onPassToSales}
                    onOpenAssistant={(id) => { setSelectedJobId(id); onOpenAssistant(id); }}
                    onCreateInvoice={onCreateInvoice}
                    onEngineerComplete={onEngineerComplete}
                />
            )}
            
            {viewMode === 'calendar' && (
                <div className="flex-grow p-4 min-h-0 bg-gray-100 print:bg-white print:p-0">
                    <BookingCalendarView
                        jobs={jobs.filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId)}
                        vehicles={vehicles}
                        customers={customers}
                        onAddJob={(date) => { setDefaultDateForModal(dateStringToDate(date)); setIsSmartCreateOpen(true); setSmartCreateMode('job'); }}
                        onDragStart={() => {}} 
                        maxDailyCapacityHours={dailyCapacity}
                        absencesByDate={absencesByDate}
                        onDayClick={(date) => { setCurrentDate(date); setViewMode('timeline'); }}
                        onEditJob={handleEditJob}
                        currentMonthDate={currentMonthDate}
                        selectedDate={currentDate}
                    />
                </div>
            )}
            
            {viewMode === 'week' && (
                <WeeklyView 
                    weekStart={weekStart}
                    onAddJob={(date) => { setDefaultDateForModal(dateStringToDate(date)); setIsSmartCreateOpen(true); setSmartCreateMode('job'); }}
                    onEditJob={handleEditJob}
                    onOpenAssistant={(id) => { setSelectedJobId(id); onOpenAssistant(id); }}
                    onCheckIn={(id) => { setSelectedJobId(id); onCheckIn(id); }}
                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                    onStartWork={onStartWork}
                    onPause={onPause}
                    onRestart={onRestart}
                    onQcApprove={() => {}} // Not applicable in this view
                    onEngineerComplete={onEngineerComplete}
                />
            )}
            
            {viewMode === 'fcs-gantt' && (
                <ResourceGanttView
                    jobs={jobs.filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId)}
                    ramps={entityLifts}
                    engineers={entityEngineers}
                    allEngineers={allValidEngineers}
                    businessEntities={businessEntities}
                    selectedEntityId={selectedEntityId}
                    purchaseOrders={purchaseOrders || []}
                    vehicles={vehicles || []}
                    customers={customers || []}
                    currentUser={currentUser}
                    estimates={estimates || []}
                    unallocatedJobs={unallocatedJobs || []}
                    onEditJob={handleEditJob}
                    onSaveJob={async (jobData) => {
                        const savedJob = {
                            id: jobData.id || `job_${Date.now()}`,
                            ...jobData
                        } as Job;
                        setJobs(prev => [...prev.filter(j => j.id !== savedJob.id), savedJob]);
                        if (saveRecord) {
                            await saveRecord('jobs', savedJob);
                        }
                    }}
                    onSaveEstimate={async (estData) => {
                        if (estData.id) {
                            setEstimates(prev => prev.map(e => e.id === estData.id ? { ...e, ...estData } as any : e));
                            if (saveRecord) {
                                await saveRecord('estimates', estData as { id: string } & Partial<Estimate>);
                            }
                        }
                    }}
                    onSavePurchaseOrder={async (poData) => {
                        if (poData.id) {
                            if (setPurchaseOrders) {
                                setPurchaseOrders(prev => prev.map(p => p.id === poData.id ? { ...p, ...poData } as any : p));
                            }
                            if (saveRecord) {
                                await saveRecord('purchaseOrders', poData as { id: string } & Partial<PurchaseOrder>);
                            }
                        }
                    }}
                    onUpdateEngineer={async (engineerId: string, newName: string) => {
                        // 1. Resolve real engineer ID if dummy fallback or virtual
                        const targetEng = (engineers || []).find(e => e.id === engineerId) || (entityEngineers || []).find(e => e.id === engineerId);
                        
                        let actualEngineerId = engineerId;
                        if (engineerId === 'tech_default' || engineerId.startsWith('sim_')) {
                            const matchingUser = (users || []).find(u => 
                                (u.name && u.name.trim().toLowerCase() === newName.trim().toLowerCase()) ||
                                (selectedEntityId !== 'all' && u.preferredEntityId === selectedEntityId && isTechRole(u.role))
                            );
                            if (matchingUser) {
                                actualEngineerId = matchingUser.engineerId || `eng_${matchingUser.id}`;
                            } else {
                                actualEngineerId = `eng_${Date.now()}`;
                            }
                        }

                        const targetEntity = targetEng?.entityId || (selectedEntityId === 'all' ? '' : selectedEntityId);
                        const updatedEng: Engineer = {
                            ...(targetEng || { id: actualEngineerId, hourlyRate: 35, entityId: targetEntity }),
                            id: actualEngineerId,
                            name: newName,
                            entityId: targetEntity
                        };

                        if (setEngineers) {
                            setEngineers(prev => [...(prev || []).filter(e => e.id !== engineerId && e.id !== actualEngineerId), updatedEng]);
                        }
                        if (saveRecord) {
                            await saveRecord('engineers', updatedEng);
                        } else {
                            await saveDocument('brooks_engineers', updatedEng);
                        }

                        // 2. Also update corresponding user profile in users if exists
                        const matchingUser = (users || []).find(u => 
                            u.engineerId === engineerId || 
                            u.engineerId === actualEngineerId ||
                            u.id === engineerId || 
                            u.id === actualEngineerId ||
                            (targetEng && targetEng.name && u.name?.trim().toLowerCase() === targetEng.name.trim().toLowerCase()) ||
                            (u.name && u.name.trim().toLowerCase() === newName.trim().toLowerCase()) ||
                            (selectedEntityId !== 'all' && u.preferredEntityId === selectedEntityId && isTechRole(u.role))
                        );
                        if (matchingUser && setUsers) {
                            const updatedUser = { ...matchingUser, name: newName, engineerId: actualEngineerId };
                            setUsers(prev => (prev || []).map(u => u.id === matchingUser.id ? updatedUser : u));
                            await saveDocument('brooks_users', updatedUser);
                        }
                    }}
                    onUpdateEngineerTransfer={async (engineerId: string, toEntityId: string | null, reason?: string) => {
                        // 1. Update in engineers state and persist to brooks_engineers
                        const targetEng = (engineers || []).find(e => e.id === engineerId);
                        if (!targetEng) return;
                        const updatedEng: Engineer = {
                            ...targetEng,
                            transferredToEntityId: toEntityId || null,
                            transferReason: toEntityId ? (reason || 'Recovering workshop backlog') : undefined,
                            transferredAt: toEntityId ? new Date().toISOString() : undefined,
                            isTransferred: !!toEntityId && toEntityId !== targetEng.entityId
                        };
                        if (setEngineers) {
                            setEngineers(prev => (prev || []).map(e => e.id === engineerId ? updatedEng : e));
                        }
                        if (saveRecord) {
                            await saveRecord('engineers', updatedEng);
                        } else {
                            await saveDocument('brooks_engineers', updatedEng);
                        }

                        // 2. Synchronize user profile
                        const matchingUser = (users || []).find(u => 
                            u.engineerId === engineerId || 
                            u.id === engineerId || 
                            (targetEng.name && u.name?.trim().toLowerCase() === targetEng.name.trim().toLowerCase())
                        );
                        if (matchingUser && setUsers) {
                            const updatedUser = { 
                                ...matchingUser, 
                                transferredToEntityId: toEntityId || null 
                            };
                            setUsers(prev => (prev || []).map(u => u.id === matchingUser.id ? updatedUser : u));
                            await saveDocument('brooks_users', updatedUser);
                        }
                    }}
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

            {isLaborTallyModalOpen && (
                <MonthlyLaborTallyModal
                    isOpen={isLaborTallyModalOpen}
                    onClose={() => setIsLaborTallyModalOpen(false)}
                    jobs={jobs}
                    engineers={engineers}
                    businessEntities={businessEntities}
                    vehicles={vehicles}
                    selectedEntityId={selectedEntityId}
                    onOpenJob={(id) => {
                        setIsLaborTallyModalOpen(false);
                        handleEditJob(id, 'segments');
                    }}
                />
            )}
        </div>
    );
};

export default DispatchView;
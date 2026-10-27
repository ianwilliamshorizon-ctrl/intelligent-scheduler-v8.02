import React, { useMemo, useState } from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    ArrowLeft, 
    Warehouse, 
    Clock, 
    Sparkles, 
    GripVertical,
    Search
} from 'lucide-react';
import { 
    Job, 
    JobSegment, 
    Lift, 
    Engineer, 
    AbsenceRequest, 
    BusinessEntity, 
    Vehicle, 
    Customer,
    PurchaseOrder,
    StorageLocation
} from '../../../types';
import { formatDate, addDays, dateStringToDate } from '../../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { TIME_SEGMENTS } from '../../../constants';
import { calculateDailyCapacity } from './capacityUtils';
import { DraggableJobCard } from '../DraggableJobCard';
import { AllocatedJobCard } from '../AllocatedJobCard';
import { SummaryJobCard } from '../../shared/SummaryJobCard';
import LiveAssistant from '../../LiveAssistant';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';

interface DailyBreakdownCapacityViewProps {
    currentDate: string;
    setCurrentDate: (date: string) => void;
    onBackToWeekly: () => void;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    vehicles: Vehicle[];
    customers: Customer[];
    unallocatedJobs: Job[];
    allocatedSegmentsByLift?: Map<string, (JobSegment & { parentJobId: string; })[]>;
    bankHolidays?: Map<string, string[]>;
    // Drag & Drop Handlers from existing Dispatch matching engine
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTimelineDragOver: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onTimelineDrop: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onDragOverUnallocated?: (e: React.DragEvent) => void;
    onDropOnUnallocated?: (e: React.DragEvent) => void;
    onDragLeaveUnallocated?: (e: React.DragEvent) => void;
    unallocatedDateFilter?: 'all' | 'today' | '7days' | '14days';
    setUnallocatedDateFilter?: React.Dispatch<React.SetStateAction<'all' | 'today' | '7days' | '14days'>>;
    showOnSiteOnly?: boolean;
    setShowOnSiteOnly?: React.Dispatch<React.SetStateAction<boolean>>;
    // Job Action Handlers
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn?: (jobId: string) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onStartWork?: (jobId: string, segmentId: string) => void;
    onPause?: (jobId: string, segmentId: string) => void;
    onRestart?: (jobId: string, segmentId: string) => void;
    onReassign?: (jobId: string, segmentId: string) => void;
    onUnscheduleSegment?: (jobId: string, segmentId: string) => void;
    onSendOffsite?: (jobId: string, segmentId: string) => void;
    onPassToSales?: (jobId: string) => void;
    onOpenAssistant?: (jobId: string) => void;
    onFindSpareSlot?: (jobId: string) => void;
    onCreateInvoice?: (job: Job) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
    purchaseOrders?: PurchaseOrder[];
    storageLocations?: StorageLocation[];
}

export const DailyBreakdownCapacityView: React.FC<DailyBreakdownCapacityViewProps> = (props) => {
    const {
        currentDate,
        setCurrentDate,
        onBackToWeekly,
        jobs,
        lifts,
        engineers,
        absences,
        businessEntities,
        selectedEntityId,
        vehicles,
        customers,
        unallocatedJobs,
        allocatedSegmentsByLift,
        bankHolidays,
        onDragStart,
        onDragEnd,
        onTimelineDragOver,
        onTimelineDrop,
        onDragOverUnallocated,
        onDropOnUnallocated,
        onDragLeaveUnallocated,
        showOnSiteOnly,
        setShowOnSiteOnly,
        onEditJob,
        onCheckIn,
        onOpenPurchaseOrder,
        onStartWork,
        onPause,
        onRestart,
        onReassign,
        onUnscheduleSegment,
        onSendOffsite,
        onPassToSales,
        onOpenAssistant,
        onFindSpareSlot,
        onCreateInvoice,
        onEngineerComplete,
        purchaseOrders = [],
        storageLocations = []
    } = props;

    const [unallocatedSearch, setUnallocatedSearch] = useState('');
    const [viewMode, setViewMode] = useState<'standard' | 'summary'>('summary');
    const [assistantJobId, setAssistantJobId] = useState<string | null>(null);

    const { currentUser, users, roles } = useApp();
    const { saveRecord } = useData();

    const handleOpenAssistant = (jobId: string) => {
        if (onOpenAssistant) {
            onOpenAssistant(jobId);
        } else {
            setAssistantJobId(jobId);
        }
    };

    const handleCloseAssistant = () => setAssistantJobId(null);

    const handleAddNoteFromAssistant = (note: string) => {
        if (!assistantJobId) return;
        const job = jobs.find(j => j.id === assistantJobId);
        if (job) {
            const newNotes = `${job.notes || ''}\n\n--- Assistant Note ---\n${note}`;
            saveRecord('jobs', { ...job, notes: newNotes });
        }
    };

    const currentDateObj = useMemo(() => dateStringToDate(currentDate), [currentDate]);

    // Daily summary calculation
    const daySummary = useMemo(() => {
        return calculateDailyCapacity({
            date: currentDateObj,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays
        });
    }, [currentDateObj, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays]);

    // Sort lifts: Lift 7 and MOT bays always on the far right
    const isMotOrLift7 = (l: Lift) => {
        const name = (l.name || '').toLowerCase();
        const type = (l.type || '').toLowerCase();
        return name.includes('mot') || type.includes('mot') || name.includes('lift 7') || name.includes('bay 7');
    };

    const entityLifts = useMemo(() => {
        const filtered = lifts.filter(l => selectedEntityId === 'all' || l.entityId === selectedEntityId);
        return [...filtered].sort((a, b) => {
            const isMotA = isMotOrLift7(a);
            const isMotB = isMotOrLift7(b);
            if (isMotA && !isMotB) return 1;
            if (!isMotA && isMotB) return -1;
            const valA = parseInt((a.name || '').replace(/\D/g, '')) || 0;
            const valB = parseInt((b.name || '').replace(/\D/g, '')) || 0;
            return valA !== valB ? valA - valB : (a.name || '').localeCompare(b.name || '');
        });
    }, [lifts, selectedEntityId]);

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    
    const engineersById = useMemo(() => {
        const map = new Map<string, any>(engineers.map(e => [e.id, e]));
        users.filter(u => u.role === 'Dispatcher').forEach(u => {
            if (!map.has(u.id)) {
                map.set(u.id, { 
                    id: u.id, 
                    name: u.name || u.email || 'Dispatcher',
                    specialization: 'Dispatcher'
                });
            }
        });
        return map;
    }, [engineers, users]);

    const handlePrevDay = () => {
        const prev = addDays(currentDateObj, -1);
        setCurrentDate(formatDate(prev));
    };

    const handleNextDay = () => {
        const next = addDays(currentDateObj, 1);
        setCurrentDate(formatDate(next));
    };

    // Filter unallocated jobs
    const filteredUnallocatedJobs = useMemo(() => {
        if (!unallocatedSearch.trim()) return unallocatedJobs;
        const q = unallocatedSearch.toLowerCase();
        return unallocatedJobs.filter(j => {
            const vehicle = vehiclesById.get(j.vehicleId);
            const customer = customersById.get(j.customerId);
            const custName = customer ? getCustomerDisplayName(customer).toLowerCase() : '';
            return (
                j.id.toLowerCase().includes(q) ||
                (j.description && j.description.toLowerCase().includes(q)) ||
                (vehicle?.registration && vehicle.registration.toLowerCase().includes(q)) ||
                (vehicle?.model && vehicle.model.toLowerCase().includes(q)) ||
                (j.keyNumber != null && String(j.keyNumber).toLowerCase().includes(q)) ||
                custName.includes(q)
            );
        });
    }, [unallocatedJobs, unallocatedSearch, vehiclesById, customersById]);

    const totalUnallocatedHours = useMemo(() => {
        return Number(filteredUnallocatedJobs.reduce((sum, j) => sum + (j.estimatedHours || 1), 0).toFixed(1));
    }, [filteredUnallocatedJobs]);

    // Fallback allocated segments if allocatedSegmentsByLift map is not passed
    const getSegmentsForLift = (liftId: string) => {
        if (allocatedSegmentsByLift) {
            return allocatedSegmentsByLift.get(liftId) || [];
        }
        const segs: (JobSegment & { parentJobId: string })[] = [];
        jobs.forEach(job => {
            if (job.status === 'Cancelled' || job.status === 'Invoiced' || job.status === 'Closed') return;
            (job.segments || []).forEach(segment => {
                if (segment.date === currentDate && segment.allocatedLift === liftId && segment.status !== 'Unallocated') {
                    segs.push({ ...segment, parentJobId: job.id });
                }
            });
        });
        return segs;
    };

    const totalSegmentsCount = TIME_SEGMENTS.length;
    const slotRowHeightPx = 44; // Height per 30-min segment

    return (
        <div className="flex-grow flex flex-col p-3 sm:p-5 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Bar: Navigation & Day Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onBackToWeekly}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Weekly</span>
                    </button>

                    {/* Day Navigator */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/80">
                        <button
                            onClick={handlePrevDay}
                            className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition"
                            title="Previous Day"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="px-3 py-1 text-sm font-black text-slate-800">
                            {daySummary.dayName}, {daySummary.formattedDate}
                        </span>
                        <button
                            onClick={handleNextDay}
                            className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition"
                            title="Next Day"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {daySummary.isHoliday && (
                        <span className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-800 rounded-xl">
                            {daySummary.holidayName || 'Public Holiday'}
                        </span>
                    )}
                </div>

                {/* Day Summary Badges */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                        <Clock size={14} className="text-blue-600" />
                        <span>Capacity: <b>{daySummary.availableHours}h</b></span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                        <span>Booked: <b>{daySummary.bookedHours}h</b></span>
                    </div>

                    {/* Single Spare Hours Focal Metric */}
                    <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black border ${
                        daySummary.spareHours < 0 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : daySummary.spareHours < 5 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                        <Sparkles size={14} />
                        <span>
                            {daySummary.spareHours > 0 ? `+${daySummary.spareHours}h Spare Remaining` : `${daySummary.spareHours}h Overbooked`}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
                        <Warehouse size={14} />
                        <span>{daySummary.emptyBaysCount} / {daySummary.totalBaysCount} Bays Free</span>
                    </div>
                </div>
            </div>

            {/* Status Legend */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Slot Indicators:</span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-blue-600"></span>
                        <span className="text-slate-700">Booked</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-purple-600"></span>
                        <span className="text-slate-700">Reserved (MOT)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-emerald-500"></span>
                        <span className="text-slate-700">Available Slot</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-amber-500"></span>
                        <span className="text-slate-700">On-hold / Paused</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-rose-600"></span>
                        <span className="text-slate-700">Sick-leave / Absence</span>
                    </span>
                </div>
                <span className="text-[11px] text-slate-400 italic">
                    Drag unallocated jobs into any vertical bay slot
                </span>
            </div>

            {/* Main Layout: UNALLOCATED ON THE LEFT + VERTICAL RAMPS ON THE RIGHT */}
            <div className="flex flex-col lg:flex-row gap-4 flex-grow min-h-0">
                {/* 1. UNALLOCATED QUEUE COLUMN (ON THE LEFT) */}
                <div 
                    className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-2xl shadow-inner unallocated-drop-zone min-h-[320px] lg:min-h-0 overflow-hidden"
                    onDragOver={(e) => {
                        e.preventDefault();
                        onDragOverUnallocated?.(e);
                    }}
                    onDrop={onDropOnUnallocated}
                    onDragLeave={onDragLeaveUnallocated}
                >
                    <div className="p-3 border-b bg-white/70">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <GripVertical size={16} className="text-slate-400" />
                                <span>Unallocated Jobs</span>
                            </h3>
                            <span className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full" title="Total hours">
                                <Clock size={12} />
                                {totalUnallocatedHours.toFixed(1)}h
                            </span>
                        </div>

                        {/* Mode switcher: Standard / Summary */}
                        <div className="flex bg-slate-200/80 rounded-lg p-0.5 mb-2">
                            {(['standard', 'summary'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`w-full py-1 rounded-md font-black uppercase text-[9px] tracking-widest transition-all ${viewMode === mode ? 'bg-indigo-600 shadow text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {/* On-site only checkbox */}
                        {setShowOnSiteOnly && (
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="show-on-site-capacity"
                                    checked={showOnSiteOnly}
                                    onChange={(e) => setShowOnSiteOnly(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="show-on-site-capacity" className="text-xs text-slate-600 font-medium cursor-pointer">
                                    Show 'On Site' vehicles only
                                </label>
                            </div>
                        )}

                        {/* Quick Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search unallocated..."
                                value={unallocatedSearch}
                                onChange={(e) => setUnallocatedSearch(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-grow p-3 space-y-3 overflow-y-auto lg:max-h-full max-h-[420px]">
                        {filteredUnallocatedJobs.map(job => {
                            const commonProps = {
                                job,
                                vehicle: vehiclesById.get(job.vehicleId),
                                customer: customersById.get(job.customerId),
                                purchaseOrders: purchaseOrders || [],
                                engineers: engineers,
                                storageLocations: storageLocations || [],
                                currentUser,
                                onEdit: onEditJob,
                                onOpenAssistant: handleOpenAssistant,
                                onOpenPurchaseOrder: onOpenPurchaseOrder || (() => {}),
                                onStartWork: onStartWork || (() => {}),
                                onPause: onPause || (() => {}),
                                onRestart: onRestart || (() => {}),
                                onCheckIn: onCheckIn || (() => {}),
                                onPassToSales: onPassToSales || (() => {}),
                                onQcApprove: () => {},
                                onCreateInvoice,
                            };

                            if (viewMode === 'summary') {
                                const unallocatedSegments = (job.segments || []).filter(s => s.status === 'Unallocated');
                                if (unallocatedSegments.length === 0) return null;
                                const segmentToDrag = unallocatedSegments[0];
                                const userRoleObj = roles.find(r => r.name === currentUser.role);
                                const baseRole = userRoleObj ? userRoleObj.baseRole : currentUser.role;
                                const canDrag = baseRole === 'Admin' || baseRole === 'Dispatcher';

                                return (
                                    <div key={job.id} className="relative group">
                                        <div 
                                            draggable={canDrag}
                                            onDragStart={(e) => canDrag && onDragStart(e, job.id, segmentToDrag.segmentId)}
                                            onDragEnd={onDragEnd}
                                            className={`${canDrag ? 'cursor-grab' : 'cursor-default'} draggable-job transition-transform hover:scale-[1.01] active:scale-95`}
                                        >
                                            <SummaryJobCard {...commonProps} />
                                        </div>
                                        {onFindSpareSlot && (
                                            <button
                                                type="button"
                                                onClick={() => onFindSpareSlot(job.id)}
                                                className="w-full mt-1.5 py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                                title="Find matching spare capacity slots for this job"
                                            >
                                                <Sparkles size={11} className="text-amber-600" />
                                                <span>Find Spare Slot for #{job.id}</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div key={job.id} className="relative group">
                                    <DraggableJobCard
                                        {...commonProps}
                                        onDragStart={onDragStart}
                                        onDragEnd={onDragEnd}
                                    />
                                    {onFindSpareSlot && (
                                        <button
                                            type="button"
                                            onClick={() => onFindSpareSlot(job.id)}
                                            className="w-full mt-1.5 py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                            title="Find matching spare capacity slots for this job"
                                        >
                                            <Sparkles size={11} className="text-amber-600" />
                                            <span>Find Spare Slot for #{job.id}</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. TIMELINE SECTION (ON THE RIGHT: VERTICAL RAMPS WITH VERTICAL TIMELINE) */}
                <div className="flex-grow flex bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-auto min-w-0 min-h-[450px]">
                    {/* Sticky Vertical Time Column */}
                    <div className="flex-shrink-0 border-r border-slate-200 flex flex-col bg-white sticky left-0 z-20">
                        <div className="p-2.5 border-b border-slate-200 sticky top-0 bg-slate-50/95 backdrop-blur-xs z-30 h-16 flex items-center justify-center font-black text-[11px] text-slate-400 uppercase tracking-wider">
                            Time
                        </div>
                        <div className="flex-grow flex flex-col">
                            {TIME_SEGMENTS.map(time => (
                                <div 
                                    key={time} 
                                    style={{ height: `${slotRowHeightPx}px` }}
                                    className="text-[11px] text-right pr-2.5 text-slate-400 border-b border-slate-100 flex items-center justify-end font-semibold whitespace-nowrap"
                                >
                                    {time}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Vertical Ramp Columns (Arranged side-by-side, MOT Bay & Lift 7 sorted to far right) */}
                    <div className="flex-grow flex min-w-[700px]">
                        {entityLifts.map(lift => {
                            const allocatedSegments = getSegmentsForLift(lift.id);
                            const bookedHours = allocatedSegments.reduce((sum, seg) => sum + (Number(seg.duration) || 1), 0);
                            const isBayEmpty = allocatedSegments.length === 0;

                            return (
                                <div 
                                    key={lift.id} 
                                    className="min-w-[190px] flex-1 border-r border-slate-200 flex flex-col bg-white last:border-r-0"
                                >
                                    {/* Vertical Ramp Header (Engineers are allocated to jobs, not ramps) */}
                                    <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 p-2.5 h-16 flex flex-col justify-center">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span 
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: lift.color || '#4f46e5' }}
                                                />
                                                <span className="font-black text-slate-900 text-xs truncate" title={lift.name}>
                                                    {lift.name}
                                                </span>
                                            </div>
                                            {isMotOrLift7(lift) && (
                                                <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 flex-shrink-0">
                                                    MOT
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mt-1">
                                            <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[100px]">
                                                {lift.type || (isMotOrLift7(lift) ? 'MOT Bay' : 'Workshop Bay')}
                                            </span>
                                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                                                isBayEmpty 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {isBayEmpty ? 'Free' : `${bookedHours.toFixed(1)}h`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Vertical Slots Drop Zone */}
                                    <div 
                                        className="flex-grow relative flex flex-col"
                                        style={{ height: `${totalSegmentsCount * slotRowHeightPx}px` }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            onTimelineDragOver(e, lift.id);
                                        }}
                                        onDrop={(e) => onTimelineDrop(e, lift.id)}
                                    >
                                        {/* Background Slot Grid Lines */}
                                        {TIME_SEGMENTS.map((_, index) => (
                                            <div 
                                                key={index} 
                                                style={{ height: `${slotRowHeightPx}px` }}
                                                className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors" 
                                            />
                                        ))}

                                        {/* Allocated Job Cards with full features intact (Reassign, Check-in number, POs, etc.) */}
                                        {allocatedSegments.map((segment, index) => {
                                            const job = jobs.find(j => j.id === segment.parentJobId);
                                            if (!job) return null;
                                            return (
                                                <AllocatedJobCard 
                                                    key={segment.segmentId || segment.id || index}
                                                    job={job}
                                                    segment={segment}
                                                    vehicle={vehiclesById.get(job.vehicleId)}
                                                    customer={customersById.get(job.customerId)}
                                                    engineer={segment.engineerId ? engineersById.get(segment.engineerId) : undefined}
                                                    purchaseOrders={purchaseOrders}
                                                    onDragStart={onDragStart}
                                                    onDragEnd={onDragEnd}
                                                    onEdit={onEditJob}
                                                    onStartWork={onStartWork}
                                                    onPause={onPause || (() => {})}
                                                    onRestart={onRestart || (() => {})}
                                                    onReassign={onReassign || (() => {})}
                                                    onOpenPurchaseOrder={onOpenPurchaseOrder || (() => {})}
                                                    onUnscheduleSegment={onUnscheduleSegment || (() => {})}
                                                    onSendOffsite={onSendOffsite || (() => {})}
                                                    onPassToSales={onPassToSales || (() => {})}
                                                    currentUser={currentUser}
                                                    onOpenAssistant={handleOpenAssistant}
                                                    onCreateInvoice={onCreateInvoice}
                                                    onEngineerComplete={onEngineerComplete}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Live Assistant Modal */}
            <LiveAssistant 
                isOpen={!!assistantJobId} 
                onClose={handleCloseAssistant} 
                jobId={assistantJobId} 
                onAddNote={handleAddNoteFromAssistant} 
            />
        </div>
    );
};

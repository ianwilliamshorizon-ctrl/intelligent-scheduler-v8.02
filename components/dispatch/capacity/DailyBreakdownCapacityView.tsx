import React, { useMemo, useState } from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    ArrowLeft, 
    Warehouse, 
    Clock, 
    User as UserIcon, 
    Sparkles, 
    CheckCircle2, 
    AlertCircle, 
    AlertTriangle,
    Layers,
    GripVertical,
    ChevronDown,
    ChevronUp
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
    PurchaseOrder 
} from '../../../types';
import { formatDate, addDays, dateStringToDate, formatReadableDate } from '../../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../../constants';
import { calculateDailyCapacity } from './capacityUtils';
import { SlotVisualStatus } from './capacityTypes';

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
    bankHolidays?: Map<string, string[]>;
    // Drag & Drop Handlers from existing Dispatch matching engine
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTimelineDragOver: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onTimelineDrop: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onEditJob: (jobId: string, initialTab?: string) => void;
}

export const DailyBreakdownCapacityView: React.FC<DailyBreakdownCapacityViewProps> = ({
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
    bankHolidays,
    onDragStart,
    onDragEnd,
    onTimelineDragOver,
    onTimelineDrop,
    onEditJob
}) => {
    const [isUnallocatedOpen, setIsUnallocatedOpen] = useState(true);

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

    const entityLifts = useMemo(() => {
        return lifts.filter(l => selectedEntityId === 'all' || l.entityId === selectedEntityId);
    }, [lifts, selectedEntityId]);

    const entityEngineers = useMemo(() => {
        return engineers.filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId);
    }, [engineers, selectedEntityId]);

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const engineersById = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers]);

    // Engineers on sick-leave or absence today
    const absentEngineerMap = useMemo(() => {
        const map = new Map<string, AbsenceRequest>();
        absences.forEach(req => {
            if (req.status === 'Approved' && req.startDate <= currentDate && req.endDate >= currentDate) {
                map.set(req.userId, req);
            }
        });
        return map;
    }, [absences, currentDate]);

    const handlePrevDay = () => {
        const prev = addDays(currentDateObj, -1);
        setCurrentDate(formatDate(prev));
    };

    const handleNextDay = () => {
        const next = addDays(currentDateObj, 1);
        setCurrentDate(formatDate(next));
    };

    // Build timeline blocks per lift for this date
    const liftSchedules = useMemo(() => {
        const maxSlots = currentDateObj.getUTCDay() === 6 ? 8 : TIME_SEGMENTS.length;

        return entityLifts.map(lift => {
            // Find default or assigned engineer for this lift if mapped
            const assignedTech = entityEngineers.find(e => e.specialization?.toLowerCase().includes(lift.type?.toLowerCase() || '')) || entityEngineers[0];

            // Segments allocated to this lift on this day
            const allocatedSegments: {
                segment: JobSegment;
                parentJob: Job;
                startSlot: number;
                slotSpan: number;
                statusLabel: SlotVisualStatus;
                colorClass: string;
            }[] = [];

            jobs.forEach(job => {
                if (job.status === 'Cancelled') return;
                (job.segments || []).forEach(seg => {
                    if (seg.date === currentDate && seg.allocatedLift === lift.id && seg.status !== 'Cancelled') {
                        const start = seg.scheduledStartSegment ?? 0;
                        const duration = Number(seg.duration) || 1;
                        const span = Math.max(1, Math.ceil(duration * (60 / SEGMENT_DURATION_MINUTES)));

                        // Determine Visual Status Label
                        let statusLabel: SlotVisualStatus = 'Booked';
                        let colorClass = 'bg-blue-600 border-blue-700 text-white';

                        if (seg.status === 'Paused') {
                            statusLabel = 'On-hold';
                            colorClass = 'bg-amber-500 border-amber-600 text-white';
                        } else if (job.jobType === 'MOT' || seg.description?.toLowerCase().includes('mot') || job.notes?.toLowerCase().includes('reserved')) {
                            statusLabel = 'Reserved';
                            colorClass = 'bg-purple-600 border-purple-700 text-white';
                        } else if (seg.engineerId && absentEngineerMap.has(seg.engineerId)) {
                            statusLabel = 'Sick-leave';
                            colorClass = 'bg-rose-600 border-rose-700 text-white';
                        }

                        allocatedSegments.push({
                            segment: seg,
                            parentJob: job,
                            startSlot: start,
                            slotSpan: span,
                            statusLabel,
                            colorClass
                        });
                    }
                });
            });

            return {
                lift,
                assignedTech,
                allocatedSegments,
                maxSlots
            };
        });
    }, [entityLifts, entityEngineers, jobs, currentDate, currentDateObj, absentEngineerMap]);

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Bar: Navigation & Day Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onBackToWeekly}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Weekly</span>
                    </button>

                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
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

                    {/* Single Spare Hours Focal Tag */}
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
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 mb-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
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

            {/* Main Daily Grid & Optional Unallocated Drawer */}
            <div className="flex flex-col lg:flex-row gap-5 flex-grow min-h-0">
                {/* Visual Bay Matrix */}
                <div className="flex-grow bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={14} className="text-indigo-600" />
                            <span>Workshop Bay &amp; Technician Matrix</span>
                        </h3>
                        <span className="text-[11px] text-slate-400">
                            Drop unallocated jobs onto empty slots (Auto-checks collisions)
                        </span>
                    </div>

                    <div className="flex-grow overflow-x-auto overflow-y-auto">
                        <div className="min-w-[900px] divide-y divide-slate-100">
                            {/* Time Header */}
                            <div className="grid grid-cols-12 bg-slate-100/70 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase py-2">
                                <div className="col-span-3 px-4">Bay &amp; Primary Technician</div>
                                <div className="col-span-9 grid grid-cols-6 text-center">
                                    <span>08:30 - 10:00</span>
                                    <span>10:00 - 11:30</span>
                                    <span>11:30 - 13:00</span>
                                    <span>13:00 - 14:30</span>
                                    <span>14:30 - 16:00</span>
                                    <span>16:00 - 17:30</span>
                                </div>
                            </div>

                            {/* Lift Rows */}
                            {liftSchedules.map(({ lift, assignedTech, allocatedSegments, maxSlots }) => {
                                const totalLiftHours = allocatedSegments.reduce((sum, s) => sum + (Number(s.segment.duration) || 1), 0);
                                const isBayEmpty = allocatedSegments.length === 0;

                                return (
                                    <div
                                        key={lift.id}
                                        onDragOver={(e) => onTimelineDragOver(e, lift.id)}
                                        onDrop={(e) => onTimelineDrop(e, lift.id)}
                                        className={`grid grid-cols-12 py-3 px-2 transition-colors hover:bg-slate-50/70 ${
                                            isBayEmpty ? 'bg-emerald-50/20' : ''
                                        }`}
                                    >
                                        {/* Bay + Tech Metadata Column */}
                                        <div className="col-span-3 px-3 flex flex-col justify-center border-r border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: lift.color || '#4f46e5' }}
                                                />
                                                <span className="font-bold text-slate-900 text-sm">{lift.name}</span>
                                            </div>

                                            <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                {lift.type || 'Standard Lift'}
                                            </span>

                                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                                                <UserIcon size={12} className="text-slate-400" />
                                                <span>{assignedTech?.name || 'Open Tech Pool'}</span>
                                            </div>

                                            <div className="mt-1 flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                    isBayEmpty 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {isBayEmpty ? 'Available All Day' : `${totalLiftHours.toFixed(1)}h booked`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Timeline Slot Grid for this Bay */}
                                        <div className="col-span-9 relative flex items-center px-2 py-1 min-h-[70px]">
                                            {/* Background slot grid */}
                                            <div className="absolute inset-0 grid grid-cols-6 divide-x divide-slate-100 pointer-events-none opacity-40">
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <div key={i} className="h-full bg-slate-50/40" />
                                                ))}
                                            </div>

                                            {/* Allocated Job Blocks */}
                                            {allocatedSegments.length === 0 ? (
                                                <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/30 text-emerald-700 text-xs font-bold">
                                                    <Sparkles size={14} className="mr-1.5 text-emerald-600" />
                                                    <span>Available Free Capacity (Drag job here)</span>
                                                </div>
                                            ) : (
                                                <div className="w-full flex flex-wrap gap-2 z-10">
                                                    {allocatedSegments.map(({ segment, parentJob, statusLabel, colorClass }) => {
                                                        const vehicle = vehiclesById.get(parentJob.vehicleId);
                                                        const customer = customersById.get(parentJob.customerId);

                                                        return (
                                                            <div
                                                                key={segment.segmentId || segment.id}
                                                                draggable
                                                                onDragStart={(e) => onDragStart(e, parentJob.id, segment.segmentId || '')}
                                                                onDragEnd={onDragEnd}
                                                                onClick={() => onEditJob(parentJob.id)}
                                                                className={`px-3 py-2 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all flex flex-col justify-between max-w-[260px] min-w-[150px] ${colorClass}`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1 text-[10px] font-black uppercase tracking-wider mb-1">
                                                                    <span className="bg-black/20 px-1.5 py-0.5 rounded">
                                                                        {statusLabel}
                                                                    </span>
                                                                    <span>{segment.duration || 1} hrs</span>
                                                                </div>

                                                                <p className="font-black text-xs truncate">
                                                                    {vehicle?.model || vehicle?.make || parentJob.description || 'Workshop Job'}
                                                                </p>

                                                                <div className="text-[10px] opacity-90 truncate mt-0.5">
                                                                    {vehicle?.registration && <b className="mr-1">{vehicle.registration}</b>}
                                                                    {customer ? getCustomerDisplayName(customer) : ''}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Collapsible Unallocated Jobs Drawer */}
                <div className={`flex-shrink-0 transition-all ${
                    isUnallocatedOpen ? 'w-full lg:w-80' : 'w-full lg:w-12'
                }`}>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 h-full flex flex-col">
                        <div 
                            onClick={() => setIsUnallocatedOpen(!isUnallocatedOpen)}
                            className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition rounded-t-2xl"
                        >
                            <div className="flex items-center gap-2">
                                <GripVertical size={16} className="text-slate-400" />
                                {isUnallocatedOpen && (
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        Unallocated Queue ({unallocatedJobs.length})
                                    </span>
                                )}
                            </div>
                            <button className="text-slate-500">
                                {isUnallocatedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>

                        {isUnallocatedOpen && (
                            <div className="p-3 space-y-2.5 flex-grow overflow-y-auto max-h-[600px]">
                                {unallocatedJobs.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-slate-400">
                                        <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                                        <span>No unallocated jobs waiting</span>
                                    </div>
                                ) : (
                                    unallocatedJobs.map(job => {
                                        const vehicle = vehiclesById.get(job.vehicleId);
                                        const customer = customersById.get(job.customerId);
                                        const segment = job.segments?.[0];

                                        return (
                                            <div
                                                key={job.id}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, job.id, segment?.segmentId || '')}
                                                onDragEnd={onDragEnd}
                                                onClick={() => onEditJob(job.id)}
                                                className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 shadow-sm cursor-grab active:cursor-grabbing transition"
                                            >
                                                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                                                    <span>{vehicle?.registration || `#${job.id.slice(-4)}`}</span>
                                                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                                                        {job.estimatedHours || 1} hrs
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-600 font-medium truncate mt-1">
                                                    {vehicle?.model || vehicle?.make || job.description || 'Job'}
                                                </p>

                                                <p className="text-[10px] text-slate-400 truncate">
                                                    {customer ? getCustomerDisplayName(customer) : ''}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

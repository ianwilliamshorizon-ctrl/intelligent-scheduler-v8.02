import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    Calendar, 
    Warehouse, 
    Clock, 
    User, 
    ArrowRight, 
    CheckCircle2, 
    Sparkles, 
    ArrowLeft,
    Car,
    AlertTriangle,
    KeyRound,
    Tag,
    X,
    CalendarCheck,
    Wrench,
    PhoneCall
} from 'lucide-react';
import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity, Vehicle, Customer } from '../../../types';
import { findSpareCapacitySlots } from './capacityUtils';
import { FreeCapacitySlot } from './capacityTypes';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { getWheelbaseAlertInfo } from '../../../core/utils/vehicleUtils';

interface SpareCapacitySearchViewProps {
    startDate: Date;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    vehicles?: Vehicle[];
    customers?: Customer[];
    unallocatedJobs?: Job[];
    initialJobId?: string | null;
    onSelectJob?: (jobId: string | null) => void;
    onSelectSlotDate: (dateStr: string) => void;
    onBookJobForDate?: (dateStr: string) => void;
    onScheduleJobIntoSlot?: (job: Job, slot: FreeCapacitySlot) => void;
    onBackToWeekly: () => void;
}

export const SpareCapacitySearchView: React.FC<SpareCapacitySearchViewProps> = ({
    startDate,
    jobs,
    lifts,
    engineers,
    absences,
    businessEntities,
    selectedEntityId,
    bankHolidays,
    vehicles = [],
    customers = [],
    unallocatedJobs = [],
    initialJobId = null,
    onSelectJob,
    onSelectSlotDate,
    onBookJobForDate,
    onScheduleJobIntoSlot,
    onBackToWeekly
}) => {
    // Selected Job to Schedule
    const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);

    // Sync with initialJobId prop if it changes
    useEffect(() => {
        if (initialJobId !== undefined) {
            setSelectedJobId(initialJobId);
        }
    }, [initialJobId]);

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    // Active Target Job Details
    const targetJob = useMemo(() => {
        if (!selectedJobId) return null;
        return jobs.find(j => j.id === selectedJobId) || unallocatedJobs.find(j => j.id === selectedJobId) || null;
    }, [selectedJobId, jobs, unallocatedJobs]);

    const targetVehicle = useMemo(() => {
        if (!targetJob) return null;
        return vehiclesById.get(targetJob.vehicleId) || null;
    }, [targetJob, vehiclesById]);

    const targetCustomer = useMemo(() => {
        if (!targetJob) return null;
        return customersById.get(targetJob.customerId) || null;
    }, [targetJob, customersById]);

    // Detect if target job is MOT
    const isTargetJobMot = useMemo(() => {
        if (!targetJob) return false;
        return (
            targetJob.jobType === 'MOT' ||
            /\bmot\b/i.test(targetJob.description || '') ||
            (targetJob.segments || []).some(s => /\bmot\b/i.test(s.description || ''))
        );
    }, [targetJob]);

    // Required duration for the target job
    const targetJobDurationHours = useMemo(() => {
        if (!targetJob) return 1.0;
        const unallocatedSeg = (targetJob.segments || []).find(s => s.status === 'Unallocated');
        if (unallocatedSeg?.duration) return Number(unallocatedSeg.duration);
        return Number(targetJob.estimatedHours) || 1.0;
    }, [targetJob]);

    // Quick filter states
    const [horizonWeeks, setHorizonWeeks] = useState<number>(4);
    const [minDurationHours, setMinDurationHours] = useState<number>(1.0);
    const [motOnlyFilter, setMotOnlyFilter] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<'day' | 'technician' | 'bay'>('day');
    const [searchQuery, setSearchQuery] = useState('');

    // Automatically adapt duration and MOT requirements when a job is selected
    useEffect(() => {
        if (targetJob) {
            setMinDurationHours(targetJobDurationHours);
            if (isTargetJobMot) {
                setMotOnlyFilter(true);
            }
        }
    }, [targetJob, targetJobDurationHours, isTargetJobMot]);

    const handleJobChange = (newJobId: string) => {
        const id = newJobId === 'generic' ? null : newJobId;
        setSelectedJobId(id);
        onSelectJob?.(id);
    };

    // Locate free capacity slots across the selected horizon
    const slots = useMemo(() => {
        return findSpareCapacitySlots({
            startDate,
            horizonWeeks,
            minDurationHours,
            jobs,
            lifts,
            engineers,
            absences,
            businessEntities,
            selectedEntityId,
            bankHolidays,
            onlyMot: motOnlyFilter
        });
    }, [startDate, horizonWeeks, minDurationHours, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays, motOnlyFilter]);

    // Apply search filter and sorting
    const filteredAndSortedSlots = useMemo(() => {
        let result = slots.filter(slot => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                slot.date.toLowerCase().includes(q) ||
                slot.dayName.toLowerCase().includes(q) ||
                slot.liftName.toLowerCase().includes(q) ||
                (slot.liftType && slot.liftType.toLowerCase().includes(q)) ||
                (slot.engineerName && slot.engineerName.toLowerCase().includes(q))
            );
        });

        if (sortBy === 'day') {
            result.sort((a, b) => a.date.localeCompare(b.date) || a.startSegmentIndex - b.startSegmentIndex);
        } else if (sortBy === 'technician') {
            result.sort((a, b) => (a.engineerName || '').localeCompare(b.engineerName || '') || a.date.localeCompare(b.date));
        } else if (sortBy === 'bay') {
            result.sort((a, b) => a.liftName.localeCompare(b.liftName) || a.date.localeCompare(b.date));
        }

        return result;
    }, [slots, searchQuery, sortBy]);

    // Grouping by selected pivot
    const groupedSlots = useMemo(() => {
        const groups = new Map<string, FreeCapacitySlot[]>();
        filteredAndSortedSlots.forEach(slot => {
            let key = '';
            if (sortBy === 'day') {
                key = `${slot.dayName}, ${slot.formattedDate}`;
            } else if (sortBy === 'technician') {
                key = slot.engineerName || 'Open Tech Pool';
            } else {
                key = `${slot.liftName} (${slot.liftType || 'Standard'})`;
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(slot);
        });
        return groups;
    }, [filteredAndSortedSlots, sortBy]);

    const totalFreeHours = useMemo(() => {
        return Number(filteredAndSortedSlots.reduce((sum, s) => sum + s.durationHours, 0).toFixed(1));
    }, [filteredAndSortedSlots]);

    const targetWheelbaseInfo = targetVehicle ? getWheelbaseAlertInfo(targetVehicle.wheelbaseType) : null;
    const targetPartsReady = targetJob ? (targetJob.partsStatus === 'Fully Received' || targetJob.partsStatus === 'Not Required') : true;

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Bar: Navigation & Horizon Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onBackToWeekly}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Weekly</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                                Spare Slot Finder
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Intelligent capacity & ramp slot matching
                            </p>
                        </div>
                    </div>
                </div>

                {/* Horizon Quick Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 px-2 uppercase">Horizon:</span>
                        {[
                            { label: 'Next 7 Days', weeks: 1 },
                            { label: 'Next 14 Days', weeks: 2 },
                            { label: 'Next 4 Weeks', weeks: 4 }
                        ].map(({ label, weeks }) => (
                            <button
                                key={weeks}
                                onClick={() => setHorizonWeeks(weeks)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    horizonWeeks === weeks
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 1. HERO SECTION: TARGET JOB SELECTION & REQUIREMENT MATCHER */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Car size={18} className="text-indigo-600" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Target Job to Schedule
                        </h3>
                    </div>

                    {/* Job Dropdown Selector */}
                    <div className="flex items-center gap-2 flex-grow md:max-w-md">
                        <select
                            value={selectedJobId || 'generic'}
                            onChange={(e) => handleJobChange(e.target.value)}
                            className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                        >
                            <option value="generic">-- Search generic slots (no job selected) --</option>
                            {unallocatedJobs.map(job => {
                                const v = vehiclesById.get(job.vehicleId);
                                const c = customersById.get(job.customerId);
                                const custName = c ? getCustomerDisplayName(c) : '';
                                return (
                                    <option key={job.id} value={job.id}>
                                        {v?.registration ? `[${v.registration}] ` : ''}
                                        {v?.model || job.description || 'Job'} • {job.estimatedHours || 1}h
                                        {custName ? ` • ${custName}` : ''} (#{job.id})
                                    </option>
                                );
                            })}
                        </select>

                        {selectedJobId && (
                            <button
                                onClick={() => handleJobChange('generic')}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                                title="Clear selected job"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Display Context when Job is Selected */}
                {targetJob ? (
                    <div className="mt-4 pt-1 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <div className="flex flex-wrap items-center gap-4">
                            <div>
                                <span className="font-mono text-xs font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs">
                                    #{targetJob.id}
                                </span>
                            </div>

                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-slate-900 tracking-tight">
                                        {targetVehicle?.registration || 'Unknown Reg'}
                                    </span>
                                    {targetWheelbaseInfo && (
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${targetWheelbaseInfo.badgeClass}`}>
                                            {targetWheelbaseInfo.label}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 font-medium">
                                    {targetVehicle?.make} {targetVehicle?.model} ({targetVehicle?.year || 'Year N/A'})
                                </p>
                            </div>

                            <div className="h-8 w-px bg-indigo-200/80 hidden sm:block"></div>

                            <div>
                                <p className="text-xs font-bold text-slate-800">
                                    {targetCustomer ? getCustomerDisplayName(targetCustomer) : 'Customer'}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                                    {targetJob.description || 'Workshop Job'}
                                </p>
                            </div>
                        </div>

                        {/* Match Requirements Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-2xs">
                                <Clock size={12} />
                                <span>{targetJobDurationHours.toFixed(1)}h Required</span>
                            </span>

                            {isTargetJobMot ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-600 text-white shadow-2xs">
                                    <Wrench size={12} />
                                    <span>MOT Bay Required</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200">
                                    <span>Standard Bay OK</span>
                                </span>
                            )}

                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                targetPartsReady
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                                <span>{targetPartsReady ? 'Parts Ready' : 'Parts Pending'}</span>
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                        <span>
                            Select an unallocated job above to auto-match required hours, vehicle lift clearance, and MOT bay requirements, or browse general free workshop slots below.
                        </span>
                    </div>
                )}
            </div>

            {/* 2. FILTER & SORT BAR */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by bay, tech, date..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                    </div>

                    {/* Minimum Duration */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">Min Duration:</span>
                        <select
                            value={minDurationHours}
                            onChange={(e) => setMinDurationHours(Number(e.target.value))}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={0.5}>&ge; 30 mins</option>
                            <option value={1.0}>&ge; 1.0 hour</option>
                            <option value={1.5}>&ge; 1.5 hours</option>
                            <option value={2.0}>&ge; 2.0 hours</option>
                            <option value={3.0}>&ge; 3.0 hours</option>
                            <option value={4.0}>Half-Day (&ge; 4.0 hours)</option>
                            <option value={8.0}>Full Day (8.0 hours)</option>
                        </select>
                    </div>

                    {/* MOT Only Checkbox Filter */}
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        <input
                            type="checkbox"
                            checked={motOnlyFilter}
                            onChange={(e) => setMotOnlyFilter(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>MOT Bays Only</span>
                    </label>

                    {/* Group / Sort By */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">Group:</span>
                        <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                            {[
                                { key: 'day', label: 'Day' },
                                { key: 'technician', label: 'Tech' },
                                { key: 'bay', label: 'Bay' }
                            ].map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSortBy(key as any)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        sortBy === key 
                                            ? 'bg-indigo-600 text-white shadow-2xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary Tally */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500">
                        <b>{filteredAndSortedSlots.length}</b> slots found
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                        +{totalFreeHours}h Total Spare
                    </span>
                </div>
            </div>

            {/* 3. RESULTS LIST */}
            <div className="space-y-4">
                {filteredAndSortedSlots.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
                        <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-500" />
                        <h3 className="text-base font-black text-slate-800">No Free Slots Matching Requirements</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            {targetJob 
                                ? `No available slot could accommodate ${targetJobDurationHours}h ${isTargetJobMot ? 'on MOT bays' : ''} in the next ${horizonWeeks} weeks. Try broadening the horizon or adjusting duration.`
                                : 'All bays are booked for the selected criteria. Try lowering the minimum duration filter or extending the horizon.'}
                        </p>
                    </div>
                ) : (
                    Array.from(groupedSlots.entries()).map(([groupTitle, slotList]) => (
                        <div key={groupTitle} className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                    <span>{groupTitle}</span>
                                </h3>
                                <span className="text-[11px] font-bold text-slate-500">
                                    {slotList.length} {slotList.length === 1 ? 'Slot Available' : 'Slots Available'}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {slotList.map(slot => (
                                    <div 
                                        key={slot.id}
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-indigo-50/30 transition group"
                                    >
                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                            {/* Date Pill */}
                                            <div className="min-w-[120px]">
                                                <p className="font-black text-slate-900 text-sm leading-tight">{slot.dayName}</p>
                                                <p className="text-xs text-slate-500 font-medium">{slot.formattedDate}</p>
                                            </div>

                                            {/* Time Window */}
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                                                <Clock size={13} className="text-indigo-600" />
                                                <span>{slot.startTime} – {slot.endTime}</span>
                                            </div>

                                            {/* Duration Available */}
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                +{slot.durationHours.toFixed(1)}h Free
                                            </span>

                                            {/* Bay */}
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                <Warehouse size={14} className="text-slate-400" />
                                                <span>{slot.liftName}</span>
                                                <span className="text-[10px] text-slate-400 font-semibold">({slot.liftType})</span>
                                            </div>

                                            {/* Engineer */}
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <User size={13} className="text-slate-400" />
                                                <span>{slot.engineerName || 'Open Tech Pool'}</span>
                                            </div>
                                        </div>

                                        {/* Action: If Job Selected -> "Schedule Job Here", else "Open in Daily Breakdown" */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {targetJob && onScheduleJobIntoSlot ? (
                                                <button
                                                    onClick={() => onScheduleJobIntoSlot(targetJob, slot)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-100 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                                                >
                                                    <CalendarCheck size={14} />
                                                    <span>Schedule #{targetJob.id} Here</span>
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    {onBookJobForDate && (
                                                        <button
                                                            onClick={() => onBookJobForDate(slot.date)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white rounded-xl font-black text-xs shadow-xs transition cursor-pointer"
                                                            title={`Book a job directly for ${slot.dayName} (${slot.formattedDate})`}
                                                        >
                                                            <PhoneCall size={12} className="text-indigo-200" />
                                                            <span>Book Job</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => onSelectSlotDate(slot.date)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                                                    >
                                                        <span>Open in Daily View</span>
                                                        <ArrowRight size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

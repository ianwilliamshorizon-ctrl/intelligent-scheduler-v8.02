import React, { useState, useMemo } from 'react';
import { 
    Search, 
    Calendar, 
    Filter, 
    Warehouse, 
    Clock, 
    User, 
    ArrowRight, 
    CheckCircle2, 
    Sparkles, 
    ArrowLeft 
} from 'lucide-react';
import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';
import { findSpareCapacitySlots } from './capacityUtils';
import { FreeCapacitySlot } from './capacityTypes';

interface SpareCapacitySearchViewProps {
    startDate: Date;
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    absences: AbsenceRequest[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    bankHolidays?: Map<string, string[]>;
    onSelectSlotDate: (dateStr: string) => void;
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
    onSelectSlotDate,
    onBackToWeekly
}) => {
    // Quick filter states
    const [horizonWeeks, setHorizonWeeks] = useState<number>(4);
    const [minDurationHours, setMinDurationHours] = useState<number>(2.0);
    const [sortBy, setSortBy] = useState<'day' | 'technician' | 'bay'>('day');
    const [searchQuery, setSearchQuery] = useState('');

    // Locate all free capacity slots across the selected horizon
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
            bankHolidays
        });
    }, [startDate, horizonWeeks, minDurationHours, jobs, lifts, engineers, absences, businessEntities, selectedEntityId, bankHolidays]);

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

    return (
        <div className="flex-grow flex flex-col p-4 sm:p-6 bg-slate-50 min-h-0 overflow-y-auto">
            {/* Top Bar: Navigation & Quick Filter Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onBackToWeekly}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Weekly</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-500" />
                        <h2 className="text-base font-black text-slate-900 tracking-tight">
                            Spare-Capacity Search Finder
                        </h2>
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
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
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

            {/* Filter & Sort Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search Input */}
                    <div className="relative min-w-[220px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by bay, tech, or date..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                    </div>

                    {/* Minimum Duration */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Min Duration:</span>
                        <select
                            value={minDurationHours}
                            onChange={(e) => setMinDurationHours(Number(e.target.value))}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={0.5}>Any free block (&ge; 30m)</option>
                            <option value={1.0}>At least 1 hour</option>
                            <option value={2.0}>At least 2 hours</option>
                            <option value={4.0}>Half-Day (&ge; 4 hours)</option>
                            <option value={8.0}>Full Day (8 hours)</option>
                        </select>
                    </div>

                    {/* Group / Sort By */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Group By:</span>
                        <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                            {[
                                { key: 'day', label: 'Day' },
                                { key: 'technician', label: 'Technician' },
                                { key: 'bay', label: 'Bay' }
                            ].map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSortBy(key as any)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                        sortBy === key 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
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
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">
                        Found <b className="text-slate-900">{filteredAndSortedSlots.length}</b> free slots
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                        +{totalFreeHours} hrs Total Spare
                    </span>
                </div>
            </div>

            {/* Results List Grouped */}
            <div className="space-y-5">
                {filteredAndSortedSlots.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
                        <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-500" />
                        <h3 className="text-base font-black text-slate-800">No Free Slots Matching Filter</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            The workshop is fully utilized for the criteria selected, or try lowering the minimum duration filter.
                        </p>
                    </div>
                ) : (
                    Array.from(groupedSlots.entries()).map(([groupTitle, slotList]) => (
                        <div key={groupTitle} className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                    <span>{groupTitle}</span>
                                </h3>
                                <span className="text-xs font-bold text-slate-500">
                                    {slotList.length} {slotList.length === 1 ? 'Slot Available' : 'Slots Available'}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {slotList.map(slot => (
                                    <div 
                                        key={slot.id}
                                        onClick={() => onSelectSlotDate(slot.date)}
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-indigo-50/40 transition cursor-pointer group"
                                    >
                                        <div className="flex flex-wrap items-center gap-4">
                                            {/* Date Pill */}
                                            <div className="min-w-[120px]">
                                                <p className="font-bold text-slate-900 text-sm">{slot.dayName}</p>
                                                <p className="text-xs text-slate-500">{slot.formattedDate}</p>
                                            </div>

                                            {/* Time Window */}
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                                                <Clock size={14} className="text-indigo-600" />
                                                <span>{slot.startTime} – {slot.endTime}</span>
                                            </div>

                                            {/* Duration */}
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                +{slot.durationHours.toFixed(1)} hrs Free
                                            </span>

                                            {/* Bay */}
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Warehouse size={14} className="text-slate-400" />
                                                <span>{slot.liftName}</span>
                                                <span className="text-[10px] text-slate-400">({slot.liftType})</span>
                                            </div>

                                            {/* Suggested Tech */}
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <User size={13} className="text-slate-400" />
                                                <span>{slot.engineerName || 'Open Tech Pool'}</span>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                                                <span>Open in Daily Breakdown</span>
                                                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                                            </span>
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

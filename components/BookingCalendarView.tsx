
import React, { useMemo } from 'react';
import { PlusCircle, Car, Gauge } from 'lucide-react';
import { Job, Vehicle, Customer, JobSegment, AbsenceRequest, RentalBooking } from '../types';
import { formatDate, dateStringToDate, getRelativeDate, addDays } from '../core/utils/dateUtils';
import { CAPACITY_THRESHOLD_WARNING } from '../constants';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

const getCapacityInfo = (totalHours: number, maxHours: number) => {
    if (maxHours <= 0) return { status: 'Normal', classes: 'bg-gray-100 text-gray-800' };
    const loadPercentage = totalHours / maxHours;
    if (totalHours > maxHours) {
        return { status: 'OVERLOADED', classes: 'bg-red-100 text-red-800 font-bold' };
    }
    if (loadPercentage >= CAPACITY_THRESHOLD_WARNING) {
        return { status: 'High Load', classes: 'bg-amber-100 text-amber-800' };
    }
    return { status: 'Normal', classes: 'bg-green-100 text-green-800' };
};

interface DraggableJobItemProps {
    job: Job;
    segment: JobSegment;
    vehicle?: Vehicle;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, parentJobId: string, segmentId: string) => void;
    onEditJob: (jobId: string) => void;
}

const DraggableJobItem: React.FC<DraggableJobItemProps> = ({ job, segment, vehicle, onDragStart, onEditJob }) => {
    const isAllocated = segment.status !== 'Unallocated';
    const cursorClass = isAllocated ? 'cursor-pointer' : 'cursor-grab';
    const baseClasses = `p-1.5 rounded-md ${cursorClass} text-xs transition-colors`;
    const colorClasses = isAllocated 
        ? "bg-indigo-200 text-indigo-800"
        : "bg-gray-200 text-gray-800 hover:bg-gray-300";

    return (
        <div
            draggable={!isAllocated}
            onDragStart={(e) => onDragStart(e, job.id, segment.segmentId)}
            onClick={(e) => { e.stopPropagation(); onEditJob(job.id); }}
            className={`${baseClasses} ${colorClasses}`}
            title={isAllocated ? `View job details: ${job.description}` : `Drag to schedule: ${job.description} for ${vehicle?.registration}`}
        >
            <p className="font-semibold truncate flex items-center gap-1.5">
                <Car size={12} /> {vehicle?.registration}
            </p>
            <p className="truncate">{job.description}</p>
        </div>
    );
};


export interface BookingCalendarViewProps {
  jobs: Job[];
  vehicles: Vehicle[];
  customers: Customer[];
  onAddJob: (date: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, parentJobId: string, segmentId: string) => void;
  maxDailyCapacityHours: number;
  absencesByDate: Map<string, number>;
  onDayClick: (date: string) => void;
  onEditJob: (jobId: string) => void;
  currentMonthDate: Date;
  selectedDate?: string;
}

export const BookingCalendarView: React.FC<BookingCalendarViewProps> = ({ jobs, vehicles, customers, onAddJob, onDragStart, maxDailyCapacityHours, absencesByDate, onDayClick, onEditJob, currentMonthDate, selectedDate }) => {
    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const segmentsByDate = useMemo(() => {
        const map = new Map<string, { job: Job, segment: JobSegment }[]>();
        jobs.forEach(job => {
            job.segments.forEach(segment => {
                if (segment.date) {
                    if (!map.has(segment.date)) {
                        map.set(segment.date, []);
                    }
                    map.get(segment.date)!.push({ job, segment });
                }
            });
        });
        // Sort items within each day: allocated first, then by registration
        map.forEach((value, key) => {
            value.sort((a, b) => {
                const aAllocated = a.segment.status !== 'Unallocated';
                const bAllocated = b.segment.status !== 'Unallocated';
                if (aAllocated && !bAllocated) return -1;
                if (!aAllocated && bAllocated) return 1;
                const regA = vehiclesById.get(a.job.vehicleId)?.registration || '';
                const regB = vehiclesById.get(b.job.vehicleId)?.registration || '';
                return regA.localeCompare(regB);
            });
        });
        return map;
    }, [jobs, vehiclesById]);
    
    const calendarDays = useMemo(() => {
        const start = new Date(Date.UTC(currentMonthDate.getUTCFullYear(), currentMonthDate.getUTCMonth(), 1));
        const end = new Date(Date.UTC(currentMonthDate.getUTCFullYear(), currentMonthDate.getUTCMonth() + 1, 0));
        const days = [];
        const todayString = getRelativeDate(0);

        for (let i = 0; i < start.getUTCDay(); i++) {
            days.push({ key: `empty-start-${i}`, isPlaceholder: true });
        }
        
        for (let day = 1; day <= end.getUTCDate(); day++) {
            const date = new Date(Date.UTC(currentMonthDate.getUTCFullYear(), currentMonthDate.getUTCMonth(), day));
            const dateString = formatDate(date);
            const dailySegments = segmentsByDate.get(dateString) || [];
            const totalHours = dailySegments.reduce((sum, item) => sum + item.segment.duration, 0);
            const isSunday = date.getUTCDay() === 0;

            days.push({ 
                key: dateString, 
                isPlaceholder: false, 
                day, 
                dateString, 
                isToday: dateString === todayString, 
                segments: dailySegments,
                totalHours,
                isSunday
            });
        }
        
        const totalCells = start.getUTCDay() + end.getUTCDate();
        const numRows = totalCells > 35 ? 42 : 35;

        while (days.length < numRows) {
             days.push({ key: `empty-end-${days.length}`, isPlaceholder: true });
        }
        return days;
    }, [currentMonthDate, segmentsByDate]);
    
    const gridRowsClass = calendarDays.length > 35 ? 'grid-rows-6' : 'grid-rows-5';

    return (
        <div className="flex flex-col h-full bg-white rounded-lg p-4 shadow">
            <div className="grid grid-cols-7 text-xs font-bold text-center text-gray-500 border-b pb-2 mb-2 flex-shrink-0">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="flex-grow min-h-0">
                <div className={`grid grid-cols-7 ${gridRowsClass} gap-2 h-full`}>
                    {calendarDays.map(dayInfo => {
                        if (dayInfo.isPlaceholder) {
                            return <div key={dayInfo.key} className="bg-gray-50 rounded-lg"></div>;
                        }
                        const absenceHours = absencesByDate.get(dayInfo.dateString) || 0;
                        const effectiveCapacity = Math.max(0, maxDailyCapacityHours - absenceHours);
                        const capacity = getCapacityInfo(dayInfo.totalHours, effectiveCapacity);
                        const dayJobs = dayInfo.segments;
                        const isSelected = dayInfo.dateString === selectedDate;

                        return (
                            <div 
                                key={dayInfo.key} 
                                onClick={() => !dayInfo.isSunday && onDayClick(dayInfo.dateString)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { !dayInfo.isSunday && onDayClick(dayInfo.dateString) }}}
                                role={dayInfo.isSunday ? undefined : "button"}
                                tabIndex={dayInfo.isSunday ? undefined : 0}
                                className={`group border rounded-lg p-2 flex flex-col relative transition duration-200 h-full
                                    ${isSelected ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500 ring-offset-1 z-10' : dayInfo.isToday ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}
                                    ${dayInfo.isSunday ? 'bg-gray-100' : 'hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400'}
                                `}>
                                <div className="flex justify-between items-start flex-shrink-0">
                                    <span className={`text-sm font-semibold ${isSelected || dayInfo.isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{dayInfo.day}</span>
                                    <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs ${capacity.classes}`}>
                                        <Gauge size={12} />
                                        <span className="font-semibold">{dayInfo.totalHours.toFixed(1)}h</span>
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-h-0 overflow-y-auto mt-1 space-y-1 pr-1">
                                    {dayJobs.map(({ job, segment }) => (
                                        <DraggableJobItem
                                            key={segment.segmentId}
                                            job={job}
                                            segment={segment}
                                            vehicle={vehiclesById.get(job.vehicleId)}
                                            onDragStart={onDragStart}
                                            onEditJob={onEditJob}
                                        />
                                    ))}
                                    {dayJobs.length === 0 && !dayInfo.isSunday && (
                                        <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                            <span>No jobs scheduled.</span>
                                        </div>
                                    )}
                                </div>

                                {!dayInfo.isSunday && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onAddJob(dayInfo.dateString); }} 
                                        className="absolute bottom-1 left-1 p-1 text-indigo-500 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition opacity-0 group-hover:opacity-100"
                                    >
                                        <PlusCircle size={20} />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

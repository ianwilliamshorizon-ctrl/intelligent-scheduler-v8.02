
import React, { useMemo } from 'react';
import { Job } from '../../types';
import { Gauge } from 'lucide-react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { addDays, formatDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { CAPACITY_THRESHOLD_WARNING } from '../../constants';

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

export const WeeklyView: React.FC<{
    weekStart: Date;
    onEditJob: (jobId: string) => void;
    onOpenAssistant: (jobId: string) => void;
}> = ({ weekStart, onEditJob, onOpenAssistant }) => {
    const { jobs, vehicles, customers, businessEntities } = useData();
    const { selectedEntityId } = useApp();
    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

    const dailyCapacityHours = useMemo(() => {
        return businessEntities.find(e => e.id === selectedEntityId)?.dailyCapacityHours || 0;
    }, [businessEntities, selectedEntityId]);

    const allocatedHoursByDay = useMemo(() => {
        const map = new Map<string, number>();
        days.forEach(day => {
            const dateStr = formatDate(day);
            let totalHours = 0;
            jobs.forEach(job => {
                if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
                job.segments.forEach(segment => {
                    if (segment.date === dateStr && segment.status !== 'Unallocated') {
                        totalHours += segment.duration;
                    }
                });
            });
            map.set(dateStr, totalHours);
        });
        return map;
    }, [jobs, days, selectedEntityId]);

    const jobsByDay = useMemo(() => {
        const map = new Map<string, Job[]>();
        days.forEach(day => {
            const dateStr = formatDate(day);
            map.set(dateStr, []);
        });

        jobs.forEach(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
            const uniqueDates = new Set(job.segments.map(s => s.date).filter(Boolean));
            uniqueDates.forEach(date => {
                if(date && map.has(date)) {
                    map.get(date)!.push(job);
                }
            });
        });
        return map;
    }, [jobs, days, selectedEntityId]);
    
    return (
        <div className="flex-grow flex flex-col p-4 bg-gray-100">
            <div className="grid grid-cols-7 text-xs font-bold text-center text-gray-500 border-b pb-2 mb-2 flex-shrink-0 bg-white sticky top-0 py-2 rounded-t-lg">
                {days.map(day => {
                    const dateStr = formatDate(day);
                    const allocatedHours = allocatedHoursByDay.get(dateStr) || 0;
                    const capacityInfo = getCapacityInfo(allocatedHours, dailyCapacityHours);

                    return (
                        <div key={day.toISOString()} className="flex flex-col items-center justify-start gap-1">
                            <span className="font-bold text-gray-700">
                                {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                                <span className="text-gray-500 font-medium ml-1">{day.getUTCDate()}</span>
                            </span>
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${capacityInfo.classes}`}>
                                <Gauge size={12} />
                                <span className="font-semibold">{allocatedHours.toFixed(1)}h / {dailyCapacityHours}h</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-7 gap-2 flex-grow min-h-0">
                {days.map(day => {
                    const dateStr = formatDate(day);
                    const dailyJobs = jobsByDay.get(dateStr) || [];
                    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;

                    return (
                        <div key={dateStr} className={`rounded-lg p-2 space-y-2 overflow-y-auto ${isWeekend ? 'bg-gray-200' : 'bg-white shadow-inner'}`}>
                            {dailyJobs.map(job => {
                                const vehicle = vehiclesById.get(job.vehicleId);
                                const customer = customersById.get(job.customerId);
                                return (
                                    <div
                                        key={job.id}
                                        onClick={() => onEditJob(job.id)}
                                        className="p-2 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 text-xs animate-fade-in"
                                        title={`${job.description}\nCustomer: ${getCustomerDisplayName(customer)}`}
                                    >
                                        <p className="font-bold truncate">{vehicle?.registration}</p>
                                        <p className="text-gray-700 truncate">{job.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

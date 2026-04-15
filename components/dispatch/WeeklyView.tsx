
import React, { useMemo, useState } from 'react';
import { Job, PurchaseOrder, Vehicle, Customer, Engineer, User } from '../../types';
import { Gauge, Settings2 } from 'lucide-react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { addDays, formatDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { CAPACITY_THRESHOLD_WARNING } from '../../constants';
import { SummaryJobCard } from '../shared/SummaryJobCard';

import { JobHoverPopout } from '../shared/JobHoverPopout';

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

interface WeeklyViewProps {
    weekStart: Date;
    onEditJob: (jobId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onQcApprove: (jobId: string) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
}

export const WeeklyView: React.FC<WeeklyViewProps> = (props) => {
    const { 
        weekStart, onEditJob, onOpenAssistant, onCheckIn, 
        onOpenPurchaseOrder, onStartWork, onPause, onRestart, 
        onQcApprove, onEngineerComplete 
    } = props;

    const { jobs, vehicles, customers, businessEntities, engineers, purchaseOrders } = useData();
    const { selectedEntityId, currentUser } = useApp();
    const [viewMode, setViewMode] = useState<'standard' | 'summary'>('standard');

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
                if (job.status === 'Cancelled') return;
                if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
                (job.segments || []).forEach(segment => {
                    if (segment.date === dateStr && segment.status !== 'Unallocated') {
                        totalHours += segment.duration || 0;
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
            if (job.status === 'Cancelled') return;
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
            const uniqueDates = new Set((job.segments || []).map(s => s.date).filter(Boolean));
            uniqueDates.forEach(date => {
                if(date && typeof date === 'string' && map.has(date)) {
                    map.get(date)!.push(job);
                }
            });
        });
        return map;
    }, [jobs, days, selectedEntityId]);
    
    return (
        <div className="flex-grow flex flex-col p-4 bg-gray-100 min-h-0">
            <div className="flex justify-between items-center bg-white p-2 mb-2 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                    <span className="text-sm font-bold uppercase tracking-tight ml-2">Weekly View</span>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1 w-48">
                    {(['standard', 'summary'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`w-full py-1.5 rounded-md font-black uppercase text-[10px] tracking-widest transition-all ${viewMode === mode ? 'bg-indigo-600 shadow-md text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-7 text-xs font-bold text-center text-gray-500 border-b pb-2 mb-2 flex-shrink-0 bg-white sticky top-0 py-2 rounded-t-lg z-10 shadow-sm">
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
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${capacityInfo.classes} border border-black/10`}>
                                <Gauge size={10} />
                                <span className="font-bold">{allocatedHours.toFixed(1)}h</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-7 gap-3 flex-grow min-h-0">
                {days.map(day => {
                    const dateStr = formatDate(day);
                    const dailyJobs = jobsByDay.get(dateStr) || [];
                    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;

                    return (
                        <div key={dateStr} className={`rounded-xl p-2 space-y-3 overflow-y-auto ${isWeekend ? 'bg-gray-200/50' : 'bg-white shadow-inner border border-gray-200'}`}>
                            {dailyJobs.map(job => {
                                const vehicle = vehiclesById.get(job.vehicleId);
                                const customer = customersById.get(job.customerId);

                                if (viewMode === 'summary') {
                                    return (
                                        <SummaryJobCard 
                                            key={job.id}
                                            job={job}
                                            vehicle={vehicle}
                                            customer={customer}
                                            purchaseOrders={purchaseOrders || []}
                                            engineers={engineers}
                                            currentUser={currentUser}
                                            onEdit={onEditJob}
                                            onCheckIn={onCheckIn}
                                            onOpenPurchaseOrder={onOpenPurchaseOrder}
                                            onOpenAssistant={onOpenAssistant}
                                            onStartWork={onStartWork}
                                            onPause={onPause}
                                            onRestart={onRestart}
                                            onQcApprove={onQcApprove}
                                            onEngineerComplete={onEngineerComplete}
                                        />
                                    );
                                }

                                return (
                                    <JobHoverPopout
                                        key={job.id}
                                        job={job}
                                        vehicle={vehicle}
                                        customer={customer}
                                        purchaseOrders={purchaseOrders || []}
                                        engineers={engineers}
                                        currentUser={currentUser}
                                        onEdit={onEditJob}
                                        onCheckIn={onCheckIn}
                                        onOpenPurchaseOrder={onOpenPurchaseOrder}
                                        onOpenAssistant={onOpenAssistant}
                                        onStartWork={onStartWork}
                                        onPause={onPause}
                                        onRestart={onRestart}
                                        onQcApprove={onQcApprove}
                                        onEngineerComplete={onEngineerComplete}
                                    >
                                        <div
                                            onClick={() => onEditJob(job.id)}
                                            className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                            <p className="font-black text-xs text-gray-900 mb-1 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{vehicle?.registration}</p>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight uppercase font-medium">{job.description}</p>
                                            <div className="mt-2 text-[9px] text-gray-400 font-bold uppercase truncate">
                                                {getCustomerDisplayName(customer)}
                                            </div>
                                        </div>
                                    </JobHoverPopout>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

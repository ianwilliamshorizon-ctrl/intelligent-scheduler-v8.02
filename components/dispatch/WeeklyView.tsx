
import React, { useMemo, useState } from 'react';
import { Job, PurchaseOrder, Vehicle, Customer, Engineer, User } from '../../types';
import { Gauge, Settings2, Warehouse, Plus } from 'lucide-react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { addDays, formatDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { CAPACITY_THRESHOLD_WARNING } from '../../constants';
import { SummaryJobCard } from '../shared/SummaryJobCard';
import { JobHoverPopout } from '../shared/JobHoverPopout';

const getCapacityInfo = (totalHours: number, maxHours: number) => {
    if (maxHours <= 0) return { status: 'CLOSED', classes: 'bg-gray-100 text-gray-500' };
    const loadPercentage = totalHours / maxHours;
    if (totalHours > maxHours) {
        return { status: 'OVERLOADED', classes: 'bg-red-100 text-red-800 font-bold border border-red-300 shadow-sm' };
    }
    if (loadPercentage >= CAPACITY_THRESHOLD_WARNING) {
        return { status: 'HIGH LOAD', classes: 'bg-amber-100 text-amber-800 font-bold border border-amber-300 shadow-sm' };
    }
    return { status: 'AVAILABLE', classes: 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 shadow-sm' };
};

interface WeeklyViewProps {
    weekStart: Date;
    onAddJob?: (date: string) => void;
    onEditJob: (jobId: string, initialTab?: string) => void;
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
        weekStart, onAddJob, onEditJob, onOpenAssistant, onCheckIn, 
        onOpenPurchaseOrder, onStartWork, onPause, onRestart, 
        onQcApprove, onEngineerComplete 
    } = props;

    const { jobs, vehicles, customers, businessEntities, engineers, purchaseOrders, storageLocations, saveRecord } = useData();
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
                    if (segment.date === dateStr) {
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
        <div className="flex-grow flex flex-col p-4 bg-gray-100 print:bg-white print:p-0 min-h-0">
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

            <div className="flex bg-white sticky top-0 py-2 rounded-t-lg z-10 shadow-sm border-b mb-2 overflow-x-auto print:overflow-visible no-scrollbar">
                <div className="grid grid-cols-7 min-w-[700px] lg:min-w-0 print:min-w-0 w-full text-xs font-bold text-center text-gray-500 pb-2">
                    {days.map(day => {
                        const dateStr = formatDate(day);
                        const allocatedHours = allocatedHoursByDay.get(dateStr) || 0;
                        const capacityInfo = getCapacityInfo(allocatedHours, dailyCapacityHours);

                        return (
                            <div key={day.toISOString()} className="flex flex-col items-center justify-start gap-1 group relative">
                                <span className="font-bold text-gray-700 flex items-center justify-center gap-1 w-full">
                                    {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                                    <span className="text-gray-500 font-medium">{day.getUTCDate()}</span>
                                    {onAddJob && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onAddJob(dateStr); }}
                                            className="ml-1 p-0.5 rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Add job on this day"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                        </button>
                                    )}
                                </span>
                                <div className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md w-full border border-black/10 shadow-sm ${capacityInfo.classes}`}>
                                    <span className="text-[10px] uppercase font-black tracking-widest leading-none text-center">
                                        {capacityInfo.status}
                                    </span>
                                    <span className="text-xs font-bold whitespace-nowrap flex items-center gap-1 opacity-80">
                                        <Gauge size={10} />
                                        {allocatedHours.toFixed(1)}h / {dailyCapacityHours}h
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 print:grid-cols-7 gap-3 print:gap-1 flex-grow min-h-0 print:min-h-full">
                {days.map(day => {
                    const dateStr = formatDate(day);
                    const dailyJobs = jobsByDay.get(dateStr) || [];
                    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;

                    return (
                        <div key={dateStr} className={`rounded-xl p-2 space-y-3 overflow-y-auto print:overflow-visible ${isWeekend ? 'bg-gray-200/50' : 'bg-white shadow-inner border border-gray-200'}`}>
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
                                            storageLocations={storageLocations}
                                            onUpdateJob={(updatedJob) => saveRecord('jobs', updatedJob)}
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
                                            className={`p-3 border rounded-lg cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group relative overflow-hidden ${
                                                job.vehicleStatus === 'Off-Site (Partner)' 
                                                    ? 'bg-gray-100 border-gray-300 opacity-80' 
                                                    : job.partsStatus === 'Awaiting Order'
                                                        ? 'bg-rose-50 border-rose-200' 
                                                        : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            <div className={`absolute top-0 left-0 w-1 h-full ${
                                                job.vehicleStatus === 'Off-Site (Partner)' 
                                                    ? 'bg-gray-400' 
                                                    : job.partsStatus === 'Awaiting Order'
                                                        ? 'bg-rose-500' 
                                                        : 'bg-indigo-500'
                                            }`} />
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

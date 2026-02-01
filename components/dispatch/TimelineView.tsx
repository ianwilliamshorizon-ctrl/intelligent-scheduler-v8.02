
import React, { useMemo } from 'react';
import { Job, JobSegment, PurchaseOrder } from '../../types';
import { Clock } from 'lucide-react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { DraggableJobCard } from './DraggableJobCard';
import { AllocatedJobCard } from './AllocatedJobCard';
import { TIME_SEGMENTS } from '../../constants';

const liftColorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-200 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    pink: 'bg-pink-100 text-pink-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
};

interface TimelineViewProps {
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTimelineDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
    onTimelineDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    onTimelineDragOver: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onTimelineDrop: (e: React.DragEvent<HTMLDivElement>, liftId: string) => void;
    onDragOverUnallocated: (e: React.DragEvent) => void;
    onDropOnUnallocated: (e: React.DragEvent) => void;
    onDragEnterUnallocated: (e: React.DragEvent) => void;
    onDragLeaveUnallocated: (e: React.DragEvent) => void;
    unallocatedJobs: Job[];
    allocatedSegmentsByLift: Map<string, (JobSegment & { parentJobId: string; })[]>;
    unallocatedDateFilter: 'all' | 'today' | '7days' | '14days';
    setUnallocatedDateFilter: React.Dispatch<React.SetStateAction<'all' | 'today' | '7days' | '14days'>>;
    showOnSiteOnly: boolean;
    setShowOnSiteOnly: React.Dispatch<React.SetStateAction<boolean>>;
    onEditJob: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassign: (jobId: string, segmentId: string) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
    onOpenAssistant: (jobId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = (props) => {
    const { 
        onDragStart, onDragEnd, onTimelineDragEnter, onTimelineDragLeave, onTimelineDragOver, onTimelineDrop,
        onDragOverUnallocated, onDropOnUnallocated, onDragEnterUnallocated, onDragLeaveUnallocated,
        unallocatedJobs, allocatedSegmentsByLift, unallocatedDateFilter, setUnallocatedDateFilter, showOnSiteOnly,
        setShowOnSiteOnly, onEditJob, onCheckIn, onOpenPurchaseOrder, onPause, onRestart, onReassign, 
        onUnscheduleSegment, onOpenAssistant
    } = props;
    
    const { jobs, lifts, engineers, customers, vehicles, purchaseOrders } = useData();
    const { currentUser, selectedEntityId } = useApp();

    const entityLifts = useMemo(() => lifts.filter(l => l.entityId === selectedEntityId), [lifts, selectedEntityId]);
    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const engineersById = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers]);

    const totalUnallocatedHours = useMemo(() => {
        return unallocatedJobs.reduce((sum, job) => sum + job.estimatedHours, 0);
    }, [unallocatedJobs]);
    
    return (
        <div className="flex-grow flex p-4 gap-4 min-h-0">
             <div
                className="w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-lg shadow-inner unallocated-drop-zone min-h-0"
                onDragOver={onDragOverUnallocated}
                onDrop={onDropOnUnallocated}
                onDragEnter={onDragEnterUnallocated}
                onDragLeave={onDragLeaveUnallocated}
            >
                 <div className="p-3 border-b">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-gray-800">Unallocated Jobs</h3>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-gray-200 px-2 py-1 rounded-full" title="Total hours for filtered unallocated jobs">
                            <Clock size={14} />
                            {totalUnallocatedHours.toFixed(1)}h
                        </span>
                    </div>
                    <div className="flex gap-1 p-1 bg-gray-200 rounded-lg mt-2">
                        {(['all', 'today', '7days', '14days'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setUnallocatedDateFilter(opt)}
                                className={`w-full py-1 rounded-md font-semibold text-xs transition capitalize ${unallocatedDateFilter === opt ? 'bg-white shadow' : 'text-gray-600'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                     <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="show-on-site"
                            checked={showOnSiteOnly}
                            onChange={(e) => setShowOnSiteOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="show-on-site" className="text-sm text-gray-700">
                            Show 'On Site' vehicles only
                        </label>
                    </div>
                </div>
                <div className="flex-grow p-3 space-y-3 overflow-y-auto">
                    {unallocatedJobs.map(job => (
                        <DraggableJobCard
                            key={job.id}
                            job={job}
                            vehicle={vehiclesById.get(job.vehicleId)}
                            customer={customersById.get(job.customerId)}
                            purchaseOrders={purchaseOrders}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onEdit={onEditJob}
                            onCheckIn={onCheckIn}
                            onOpenPurchaseOrder={onOpenPurchaseOrder}
                            currentUser={currentUser}
                            onOpenAssistant={onOpenAssistant}
                        />
                    ))}
                </div>
            </div>
            <div
                className="flex-grow flex bg-white rounded-lg shadow-md overflow-x-auto min-w-0"
            >
                <div className="flex-shrink-0 border-r flex flex-col bg-white sticky left-0 z-20">
                    <h4 className="flex items-center justify-center font-bold p-2 border-b sticky top-0 bg-white z-30 text-transparent select-none h-16">&nbsp;</h4>
                    {TIME_SEGMENTS.map(time => <div key={time} className="flex-1 text-xs text-right pr-2 text-gray-500 border-b flex items-center justify-end">{time}</div>)}
                </div>
                <div className="flex-grow flex">
                    {entityLifts.map(lift => {
                        const allocatedSegments = allocatedSegmentsByLift.get(lift.id);
                        return (
                        <div key={lift.id} className="min-w-[140px] flex-1 border-r flex flex-col">
                            <h4 className={`flex items-center justify-center text-center font-bold p-2 border-b sticky top-0 z-10 h-16 ${liftColorClasses[lift.color || 'gray']}`}>{lift.name}</h4>
                            <div 
                                className="flex-grow relative flex flex-col"
                                onDragEnter={onTimelineDragEnter}
                                onDragLeave={onTimelineDragLeave}
                                onDragOver={(e) => onTimelineDragOver(e, lift.id)}
                                onDrop={(e) => onTimelineDrop(e, lift.id)}
                            >
                                {TIME_SEGMENTS.map((_, index) => <div key={index} className="flex-1 border-b border-gray-200"></div>)}
                                {allocatedSegments?.map(segment => {
                                    const job = jobs.find(j => j.id === segment.parentJobId);
                                    const vehicle = job ? vehiclesById.get(job.vehicleId) : undefined;
                                    const engineer = segment.engineerId ? engineersById.get(segment.engineerId) : undefined;
                                    const customer = job ? customersById.get(job.customerId) : undefined;
                                    if (!job) return null;
                                    return <AllocatedJobCard 
                                        key={segment.segmentId}
                                        job={job}
                                        segment={segment}
                                        vehicle={vehicle}
                                        customer={customer}
                                        engineer={engineer}
                                        purchaseOrders={purchaseOrders}
                                        onDragStart={onDragStart}
                                        onDragEnd={onDragEnd}
                                        onEdit={onEditJob}
                                        onPause={onPause}
                                        onRestart={onRestart}
                                        onReassign={onReassign}
                                        onOpenPurchaseOrder={onOpenPurchaseOrder}
                                        onUnscheduleSegment={onUnscheduleSegment}
                                        currentUser={currentUser}
                                        onOpenAssistant={onOpenAssistant}
                                    />;
                                })}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
};

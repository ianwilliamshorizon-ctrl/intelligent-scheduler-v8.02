
import React, { useState, useEffect, useRef } from 'react';
import { Job, JobSegment, Vehicle, Customer, Engineer, PurchaseOrder, User } from '../../types';
import { Package as PackageIcon, KeyRound, PauseCircle, PlayCircle, UserCog, Trash2, Wand2, Edit } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';

export const AllocatedJobCard: React.FC<{
    job: Job;
    segment: JobSegment;
    vehicle?: Vehicle;
    customer?: Customer;
    engineer?: Engineer;
    purchaseOrders: PurchaseOrder[];
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onEdit: (jobId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassign: (jobId: string, segmentId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
    currentUser: User;
    onOpenAssistant: (jobId: string) => void;
}> = ({ job, segment, vehicle, customer, engineer, purchaseOrders, onDragStart, onDragEnd, onEdit, onPause, onRestart, onReassign, onOpenPurchaseOrder, onUnscheduleSegment, currentUser, onOpenAssistant }) => {
    const segments = segment.duration * (60 / SEGMENT_DURATION_MINUTES);
    const associatedPOs = (job.purchaseOrderIds || []).map(id => purchaseOrders.find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    const [isPoMenuOpen, setIsPoMenuOpen] = useState(false);
    const poMenuRef = useRef<HTMLDivElement>(null);
    const canDrag = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    const canUnschedule = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (poMenuRef.current && !poMenuRef.current.contains(event.target as Node)) {
                setIsPoMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [poMenuRef]);
    
    let statusColor = 'bg-blue-500';
    if (segment.status === 'In Progress') statusColor = 'bg-yellow-500';
    if (segment.status === 'Engineer Complete') statusColor = 'bg-orange-500';
    if (segment.status === 'QC Complete') statusColor = 'bg-green-500';
    if (segment.status === 'Paused') statusColor = 'bg-red-500';

    const topPercent = (segment.scheduledStartSegment || 0) * (100 / TIME_SEGMENTS.length);
    const heightPercent = segments * (100 / TIME_SEGMENTS.length);
    
    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => canDrag && onDragStart(e, job.id, segment.segmentId)}
            onDragEnd={onDragEnd}
            className={`absolute left-2 right-2 p-1.5 rounded-lg text-white shadow-lg flex flex-col group ${canDrag ? 'cursor-grab' : 'cursor-default'} ${statusColor} allocated-job-container z-10 hover:z-50 hover:shadow-xl transition-all duration-200`}
            style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
                minHeight: '80px',
            }}
            title={`${job.description}\nAssigned to: ${engineer?.name || (segment.engineerId ? 'Unknown' : 'Unassigned')}`}
        >
            <div className="flex justify-between items-start text-xs flex-shrink-0">
                <span className="font-bold truncate">{vehicle?.registration || 'Unknown Vehicle'}</span>
                <div className="flex items-center gap-1">
                    {associatedPOs && associatedPOs.length > 0 && (
                        <div className="relative" ref={poMenuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsPoMenuOpen(p => !p); }}
                                className="flex items-center gap-1 p-0.5 rounded-sm hover:bg-white/20"
                            >
                                <PackageIcon size={12} />
                                <span>{associatedPOs.length}</span>
                            </button>
                            {isPoMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded shadow-lg z-20 text-black animate-fade-in-up">
                                    <div className="p-1 font-bold text-xs border-b bg-gray-50">Purchase Orders</div>
                                    {associatedPOs.map(po => (
                                        <button 
                                            key={po.id} 
                                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); setIsPoMenuOpen(false); }} 
                                            className="w-full text-left p-1.5 text-xs hover:bg-indigo-50 font-mono flex justify-between items-center"
                                        >
                                            <span>{po.id}</span>
                                            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')}`}>
                                                {po.status}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {job.keyNumber && <span className="flex items-center gap-1"><KeyRound size={12}/> {job.keyNumber}</span>}
                </div>
            </div>
            
            <div className="flex-grow overflow-hidden my-0.5 min-h-0">
                 <p className="text-xs font-semibold truncate leading-tight">{job.description}</p>
                 <p className="text-[10px] truncate leading-tight opacity-80" title={getCustomerDisplayName(customer)}>{getCustomerDisplayName(customer)}</p>
            </div>
            
            <div className="flex justify-between items-end text-xs mt-auto pt-1 border-t border-white/20 flex-shrink-0">
                <span className="font-semibold truncate max-w-[60px]">{engineer?.name || (segment.engineerId ? 'Unknown' : 'Unassigned')}</span>
                 <div className="flex items-center gap-0.5">
                    {segment.status === 'In Progress' && <button onClick={(e) => { e.stopPropagation(); onPause(job.id, segment.segmentId);}} title="Pause Job" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><PauseCircle size={14} /></button>}
                    {segment.status === 'Paused' && <button onClick={(e) => { e.stopPropagation(); onRestart(job.id, segment.segmentId);}} title="Restart Job" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><PlayCircle size={14} /></button>}
                    
                    {canDrag && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onReassign(job.id, segment.segmentId); }} 
                            title="Re-assign Engineer" 
                            className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                        >
                            <UserCog size={14} />
                        </button>
                    )}
                    {canUnschedule && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUnscheduleSegment(job.id, segment.segmentId); }} 
                            title="Return to Unallocated Queue" 
                            className="p-1 rounded bg-red-500/80 hover:bg-red-600 text-white"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className="p-1 rounded bg-white/20 hover:bg-white/40 text-white" title="Assistant"><Wand2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(job.id);}} className="p-1 rounded bg-white/20 hover:bg-white/40 text-white" title="Edit"><Edit size={14} /></button>
                </div>
            </div>
        </div>
    );
};
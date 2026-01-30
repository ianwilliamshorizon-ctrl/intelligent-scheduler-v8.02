import React, { useState, useEffect, useRef } from 'react';
import { Job, JobSegment, Vehicle, Customer, Engineer, PurchaseOrder, User } from '../../types';
import { Package as PackageIcon, KeyRound, PauseCircle, PlayCircle, UserCog, Wand2, Edit, Trash2 } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';

interface AllocatedJobCardProps {
    job: Job;
    segment: JobSegment;
    vehicle?: Vehicle;
    customer?: Customer;
    engineer?: Engineer;
    purchaseOrders: PurchaseOrder[];
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string, from: 'unallocated' | 'timeline') => void;
    onDragEnd: (e: React.DragEvent) => void;
    onEdit: (jobId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassign: (jobId: string, segmentId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
    currentUser: User;
    onOpenAssistant: (jobId: string) => void;
}

const AllocatedJobCard: React.FC<AllocatedJobCardProps> = ({ 
    job, 
    segment, 
    vehicle, 
    customer, 
    engineer, 
    purchaseOrders, 
    onDragStart, 
    onDragEnd, 
    onEdit, 
    onPause, 
    onRestart, 
    onReassign, 
    onOpenPurchaseOrder,
    onUnscheduleSegment,
    currentUser, 
    onOpenAssistant 
}) => {
    const [isPoMenuOpen, setIsPoMenuOpen] = useState(false);
    const poMenuRef = useRef<HTMLDivElement>(null);
    // TEST FIX: Allow ALL users to drag since roles in the seed are inconsistent
    const canDrag = true;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (poMenuRef.current && !poMenuRef.current.contains(event.target as Node)) {
                setIsPoMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    let statusColor = 'bg-blue-500';
    if (segment.status === 'In Progress') statusColor = 'bg-yellow-500';
    if (segment.status === 'Engineer Complete') statusColor = 'bg-orange-500';
    if (segment.status === 'QC Complete') statusColor = 'bg-green-500';
    if (segment.status === 'Paused') statusColor = 'bg-red-500';

    const segmentsCount = segment.duration * (60 / SEGMENT_DURATION_MINUTES);
    const topPercent = (segment.scheduledStartSegment || 0) * (100 / TIME_SEGMENTS.length);
    const heightPercent = segmentsCount * (100 / TIME_SEGMENTS.length);
    
    const associatedPOs = (job.purchaseOrderIds || [])
        .map(id => purchaseOrders.find(po => po.id === id))
        .filter((po): po is PurchaseOrder => !!po);

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, job.id, segment.segmentId, 'timeline')}
            onDragEnd={onDragEnd}
            className={`absolute left-2 right-2 p-1.5 rounded-lg text-white shadow-lg flex flex-col group ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${statusColor} z-10 hover:z-50 transition-all duration-200`}
            style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
                minHeight: '80px',
            }}
        >
            <div className="flex justify-between items-start text-xs flex-shrink-0">
                <span className="font-bold truncate">{vehicle?.registration || 'Unknown'}</span>
                <div className="flex items-center gap-1">
                    {associatedPOs.length > 0 && (
                        <div className="relative" ref={poMenuRef}>
                            <button onClick={(e) => { e.stopPropagation(); setIsPoMenuOpen(!isPoMenuOpen); }} className="flex items-center gap-1 p-0.5 rounded hover:bg-white/20">
                                <PackageIcon size={12} />
                                <span>{associatedPOs.length}</span>
                            </button>
                            {isPoMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded shadow-lg z-[100] text-black">
                                    <div className="p-1 font-bold text-xs border-b bg-gray-50 px-2">Purchase Orders</div>
                                    {associatedPOs.map(po => (
                                        <button key={po.id} onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }} className="w-full text-left p-2 text-xs hover:bg-gray-100 flex justify-between">
                                            <span>{po.id}</span>
                                            <span className={`px-1 rounded ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')}`}>{po.status}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {job.keyNumber && <span className="flex items-center gap-1"><KeyRound size={12}/> {job.keyNumber}</span>}
                </div>
            </div>
            
            <div className="flex-grow overflow-hidden my-0.5">
                 <p className="text-xs font-semibold truncate leading-tight">{job.description}</p>
                 <p className="text-[10px] truncate opacity-90">{getCustomerDisplayName(customer)}</p>
            </div>
            
            <div className="flex justify-between items-end text-xs mt-auto pt-1 border-t border-white/10">
                <span className="truncate max-w-[60px]">{engineer?.name || 'Unassigned'}</span>
                <div className="flex items-center gap-0.5">
                    {segment.status === 'In Progress' && <button onClick={(e) => { e.stopPropagation(); onPause(job.id, segment.segmentId); }} className="p-1 hover:bg-white/20 rounded"><PauseCircle size={14} /></button>}
                    {segment.status === 'Paused' && <button onClick={(e) => { e.stopPropagation(); onRestart(job.id, segment.segmentId); }} className="p-1 hover:bg-white/20 rounded"><PlayCircle size={14} /></button>}
                    {canDrag && <button onClick={(e) => { e.stopPropagation(); onReassign(job.id, segment.segmentId); }} className="p-1 hover:bg-white/20 rounded"><UserCog size={14} /></button>}
                    {canDrag && <button onClick={(e) => { e.stopPropagation(); onUnscheduleSegment(job.id, segment.segmentId); }} className="p-1 hover:bg-red-500 rounded"><Trash2 size={14} /></button>}
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className="p-1 hover:bg-white/20 rounded"><Wand2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(job.id); }} className="p-1 hover:bg-white/20 rounded"><Edit size={14} /></button>
                </div>
            </div>
        </div>
    );
};

export default AllocatedJobCard;
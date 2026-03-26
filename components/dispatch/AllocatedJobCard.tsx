import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Job, JobSegment, Vehicle, Customer, Engineer, PurchaseOrder, User } from '../../types';
import { Package as PackageIcon, KeyRound, PauseCircle, PlayCircle, UserCog, Trash2, Wand2, Edit, User as UserIcon, UserPlus } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';
import { HoverInfo } from '../shared/HoverInfo';

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
    onStartWork?: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassign: (jobId: string, segmentId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
    currentUser: User;
    onOpenAssistant: (jobId: string) => void;
}> = ({ job, segment, vehicle, customer, engineer, purchaseOrders, onDragStart, onDragEnd, onEdit, onStartWork, onPause, onRestart, onReassign, onOpenPurchaseOrder, onUnscheduleSegment, currentUser, onOpenAssistant }) => {
    
    const segments = segment.duration * (60 / SEGMENT_DURATION_MINUTES);
    const maxSegmentsAvailable = TIME_SEGMENTS.length - (segment.scheduledStartSegment || 0);
    const segmentsToRender = Math.min(segments, maxSegmentsAvailable);
    
    const topPercent = (segment.scheduledStartSegment || 0) * (100 / Math.max(1, TIME_SEGMENTS.length));
    const heightPercent = segmentsToRender * (100 / Math.max(1, TIME_SEGMENTS.length));

    const associatedPOs = useMemo(() => {
        // Source of truth 1: job.purchaseOrderIds
        const fromJobIds = (job.purchaseOrderIds || []).map(id => (purchaseOrders || []).find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
        
        // Source of truth 2: POs that explicitly reference this jobId
        const fromPOJobId = (purchaseOrders || []).filter(po => po.jobId === job.id && po.status !== 'Cancelled');
        
        // Merge and deduplicate
        const merged = [...fromJobIds];
        fromPOJobId.forEach(po => {
            if (!merged.find(m => m.id === po.id)) merged.push(po);
        });
        
        return merged;
    }, [job.id, job.purchaseOrderIds, purchaseOrders]);
    
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

    const canStartOrPause = (currentUser.role === 'Engineer' && engineer?.id === currentUser.engineerId) || currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    const canPerformActions = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';

    const handleAction = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        try {
            action();
        } catch (err) {
            console.error("Action failed", err);
        }
    };

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => {
                if (!canDrag) return;
                e.stopPropagation();
                onDragStart(e, job.id, segment.segmentId);
            }}
            onDragEnd={onDragEnd}
            className={`absolute left-2 right-2 p-1.5 rounded-lg text-white shadow-lg flex flex-col group ${canDrag ? 'cursor-grab' : 'cursor-default'} ${statusColor} allocated-job-container z-10 hover:z-50 hover:shadow-xl transition-all duration-200`}
            style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
                minHeight: '40px', 
            }}
        >
            <div className="flex justify-between items-start text-xs flex-shrink-0">
                <div className="flex flex-col min-w-0 pr-1">
                     <HoverInfo
                        title="Vehicle Details"
                        data={{
                            Make: vehicle?.make,
                            Model: vehicle?.model,
                            Year: vehicle?.year,
                            'Year of Manufacture': vehicle?.manufactureDate,
                            VIN: vehicle?.vin,
                            'MOT Expires': vehicle?.motExpiryDate
                        }}
                    >
                        <span className="font-bold truncate">{vehicle?.registration || 'Unknown Vehicle'}</span>
                    </HoverInfo>
                    <span className="font-mono text-sm font-bold">#{job.id}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {associatedPOs && associatedPOs.length > 0 && (
                        <div className="flex gap-1">
                            {associatedPOs.slice(0, 2).map(po => (
                                <button 
                                    key={po.id}
                                    onClick={(e) => handleAction(e, () => onOpenPurchaseOrder(po))}
                                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold shadow-sm border border-white/20 ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')}`}
                                    title={`View PO #${po.id} (${po.status})`}
                                >
                                    <PackageIcon size={10} />
                                    <span>{po.id.slice(-4)}</span>
                                </button>
                            ))}
                            {associatedPOs.length > 2 && (
                                <div className="relative" ref={poMenuRef}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsPoMenuOpen(p => !p); }}
                                        className="flex items-center gap-1 p-0.5 rounded-sm hover:bg-white/20 bg-white/20 text-[10px]"
                                    >
                                        <span>+{associatedPOs.length - 2}</span>
                                    </button>
                                    {isPoMenuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded shadow-lg z-20 text-black animate-fade-in-up">
                                            <div className="p-1 font-bold text-xs border-b bg-gray-50">Purchase Orders</div>
                                            {associatedPOs.map(po => (
                                                <button 
                                                    key={po.id} 
                                                    onClick={(e) => handleAction(e, () => { onOpenPurchaseOrder(po); setIsPoMenuOpen(false); })} 
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
                        </div>
                    )}
                    {job.keyNumber && <span className="flex items-center gap-1 bg-white/20 px-1 rounded"><KeyRound size={12}/> {job.keyNumber}</span>}
                </div>
            </div>
            
            <div className="flex-grow my-0.5 min-h-0">
                 <p className="text-xs truncate leading-tight">{job.description}</p>
                 <HoverInfo
                    title="Customer Details"
                    data={{
                        Name: getCustomerDisplayName(customer),
                        Mobile: customer?.mobile,
                        Phone: customer?.phone,
                        Email: customer?.email
                    }}
                 >
                    <p className="text-[10px] truncate leading-tight opacity-80">{getCustomerDisplayName(customer)}</p>
                 </HoverInfo>
            </div>
            
            <div className="flex justify-between items-end text-xs mt-auto pt-1 border-t border-white/20 flex-shrink-0">
                 {engineer ? (
                    <span className="font-semibold truncate max-w-[60px] flex items-center gap-1">
                        <UserIcon size={12} />
                        {engineer.name}
                    </span>
                 ) : (
                     <span className="font-semibold truncate max-w-[60px] flex items-center gap-1 text-red-200">
                         <UserPlus size={12} />
                         Unassigned
                     </span>
                 )}
                 <div className="flex items-center gap-0.5">
                    {canStartOrPause && segment.status === 'Allocated' && <button onClick={(e) => handleAction(e, () => onStartWork && onStartWork(job.id, segment.segmentId))} title="Start Job" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><PlayCircle size={14} /></button>}
                    {canStartOrPause && segment.status === 'In Progress' && <button onClick={(e) => handleAction(e, () => onPause(job.id, segment.segmentId))} title="Pause Job" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><PauseCircle size={14} /></button>}
                    {canStartOrPause && segment.status === 'Paused' && <button onClick={(e) => handleAction(e, () => onRestart(job.id, segment.segmentId))} title="Restart Job" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><PlayCircle size={14} /></button>}
                    
                    {canPerformActions && (
                        <>
                            <button onClick={(e) => handleAction(e, () => onOpenAssistant(job.id))} title="Technical Assistant" className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"><Wand2 size={14} /></button>
                            <button 
                                onClick={(e) => handleAction(e, () => onEdit(job.id))} 
                                title="Edit Job" 
                                className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                            >
                                <Edit size={14} />
                            </button>

                            <button 
                                onClick={(e) => handleAction(e, () => onReassign(job.id, segment.segmentId))} 
                                title="Re-assign Engineer" 
                                className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                            >
                                <UserCog size={14} />
                            </button>

                            {canUnschedule && (
                                <button 
                                    onClick={(e) => handleAction(e, () => onUnscheduleSegment(job.id, segment.segmentId))} 
                                    title="Unschedule (Move back to Unallocated)" 
                                    className="p-1 rounded bg-white/20 hover:bg-white/40 text-white hover:text-red-300"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Job, JobSegment, Vehicle, Customer, Engineer, PurchaseOrder, User } from '../../types';
import { Package as PackageIcon, KeyRound, PauseCircle, PlayCircle, UserCog, Trash2, Wand2, Edit, User as UserIcon, UserPlus, CheckCircle, Camera } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../../constants';
import { HoverInfo } from '../shared/HoverInfo';

import { JobHoverPopout } from '../shared/JobHoverPopout';
import { JobActionsMenu } from '../shared/JobActionsMenu';

export const AllocatedJobCard: React.FC<{
    job: Job;
    segment: JobSegment;
    vehicle?: Vehicle;
    customer?: Customer;
    engineer?: Engineer;
    purchaseOrders: PurchaseOrder[];
    onDragStart: (e: React.DragEvent, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onEdit: (jobId: string, initialTab?: string) => void;
    onStartWork?: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onReassign: (jobId: string, segmentId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onUnscheduleSegment: (jobId: string, segmentId: string) => void;
    currentUser: User;
    onOpenAssistant: (jobId: string) => void;
    engineers?: Engineer[];
    onQcApprove?: (jobId: string) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
}> = ({ job, segment, vehicle, customer, engineer, purchaseOrders, onDragStart, onDragEnd, onEdit, onStartWork, onPause, onRestart, onReassign, onOpenPurchaseOrder, onUnscheduleSegment, currentUser, onOpenAssistant, engineers = [], onQcApprove = () => {}, onEngineerComplete = () => {} }) => {
    
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
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
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
    
    let statusColor = 'bg-blue-100 text-blue-900 border-blue-200';
    if (segment.status === 'In Progress') statusColor = 'bg-amber-100 text-amber-900 border-amber-200';
    if (segment.status === 'Engineer Complete') statusColor = 'bg-orange-100 text-orange-900 border-orange-200';
    if (segment.status === 'QC Complete') statusColor = 'bg-emerald-100 text-emerald-900 border-emerald-200';
    if (segment.status === 'Paused') statusColor = 'bg-rose-100 text-rose-900 border-rose-200';

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

    const isSmallCard = segment.duration <= 1;
    const actions = useMemo(() => {
        const list: any[] = [];
        
        // For small cards, add identifying info to the menu to keep card clear
        if (isSmallCard) {
            list.push({ 
                id: 'info-customer', 
                label: `Customer: ${getCustomerDisplayName(customer)}`, 
                icon: UserIcon, 
                onClick: () => {}, 
                group: 'primary',
                disabled: true 
            });
            list.push({ 
                id: 'info-engineer', 
                label: `Engineer: ${engineer?.name || 'Unassigned'}`, 
                icon: engineer ? UserCog : UserPlus, 
                onClick: () => {}, 
                group: 'primary',
                disabled: true 
            });
        }
        
        // Context-aware actions
        if (canStartOrPause) {
            if (segment.status === 'Allocated') {
                list.push({ id: 'start', label: 'Start Work', icon: PlayCircle, onClick: () => onStartWork?.(job.id, segment.segmentId), group: 'primary', color: 'text-green-600' });
            } else if (segment.status === 'In Progress') {
                list.push({ id: 'pause', label: 'Pause Work', icon: PauseCircle, onClick: () => onPause(job.id, segment.segmentId), group: 'primary', color: 'text-orange-600' });
                list.push({ id: 'complete', label: 'Mark as Complete', icon: CheckCircle, onClick: () => {}, group: 'primary', color: 'text-green-600', disabled: true }); // Need onComplete prop if available?
            } else if (segment.status === 'Paused') {
                list.push({ id: 'restart', label: 'Restart Work', icon: PlayCircle, onClick: () => onRestart(job.id, segment.segmentId), group: 'primary', color: 'text-green-600' });
            }
        }

        if (canPerformActions) {
            list.push({ id: 'assistant', label: 'Technical Assistant', icon: Wand2, onClick: () => onOpenAssistant(job.id), group: 'secondary' });
            list.push({ id: 'edit', label: 'Edit Job', icon: Edit, onClick: () => onEdit(job.id), group: 'secondary' });
            list.push({ id: 'reassign', label: 'Reassign Engineer', icon: UserCog, onClick: () => onReassign(job.id, segment.segmentId), group: 'secondary' });
        }

        if (canUnschedule) {
            list.push({ id: 'unschedule', label: 'Move to Unallocated', icon: Trash2, onClick: () => onUnscheduleSegment(job.id, segment.segmentId), group: 'danger' });
        }

        return list;
    }, [segment.status, job.id, segment.segmentId, canStartOrPause, canPerformActions, canUnschedule, onStartWork, onPause, onRestart, onOpenAssistant, onEdit, onReassign, onUnscheduleSegment, isSmallCard, customer, engineer]);
    return (
            <div
                draggable={canDrag}
                onDragStart={(e) => {
                    if (!canDrag) return;
                    e.stopPropagation();
                    onDragStart(e, job.id, segment.segmentId);
                }}
                onDragEnd={onDragEnd}
                className={`absolute left-0 right-0 p-1.5 rounded-lg shadow-sm border flex flex-col group ${canDrag ? 'cursor-grab' : 'cursor-default'} ${statusColor} allocated-job-container ${isActionsMenuOpen ? 'z-[999]' : 'z-10'} hover:z-50 hover:shadow-md transition-all duration-200`}
                style={{
                    top: `${topPercent}%`,
                    height: `${heightPercent}%`,
                    minHeight: '40px', 
                }}
            >
                <div className="flex justify-between items-start gap-1 pb-1 text-xs flex-shrink-0 mb-1">
                    <div className="flex flex-col min-w-0 flex-grow">
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
                            <span className="font-bold truncate" title={vehicle?.registration}>{vehicle?.registration || 'Unknown Vehicle'}</span>
                        </HoverInfo>
                        <div className="flex items-center gap-1.5 leading-tight">
                            <span className="font-mono text-[11px] font-black text-gray-900">#{job.id}</span>
                            {job.jobType === 'MOT' && (
                                <span className="bg-emerald-500/20 text-emerald-800 text-[8px] px-1 rounded-sm font-bold uppercase tracking-tighter">MOT</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                        {job.checkInPhotos && job.checkInPhotos.length > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(job.id, 'media'); }}
                                className="flex items-center gap-1 bg-indigo-50 px-1 rounded font-bold text-[10px] text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors" 
                                title={`${job.checkInPhotos.length} Condition Photos - Click to View`}
                            >
                                <Camera size={12}/> {job.checkInPhotos.length}
                            </button>
                        )}
                        {job.keyNumber && <span className="flex items-center gap-1 bg-white/20 px-1 rounded font-bold text-[10px] text-gray-700 border border-gray-200"><KeyRound size={12}/> {job.keyNumber}</span>}
                    </div>
                </div>
                
                <div className="flex-grow my-0.5 min-h-0">
                    <p className={`text-xs truncate leading-tight ${isSmallCard ? 'font-medium' : ''}`}>{job.description}</p>
                    {!isSmallCard && (
                        <HoverInfo
                            title="Customer Details"
                            data={{
                                Name: getCustomerDisplayName(customer),
                                Mobile: customer?.mobile,
                                Phone: customer?.phone,
                                Email: customer?.email
                            }}
                        >
                            <p className="text-[10px] truncate leading-tight opacity-70 font-semibold">{getCustomerDisplayName(customer)}</p>
                        </HoverInfo>
                    )}
                    {!isSmallCard && associatedPOs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {associatedPOs.map(po => (
                                <button
                                    key={po.id}
                                    onClick={(e) => handleAction(e, () => onOpenPurchaseOrder(po))}
                                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-black border border-white/20 transition-all hover:scale-105 ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')}`}
                                    title={`PO #${po.id} (${po.status})`}
                                >
                                    <PackageIcon size={10} />
                                    {po.id}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {!isSmallCard && (
                    <div className="flex justify-between items-end text-xs mt-auto pt-1 border-t border-black/5 flex-shrink-0">
                        {engineer ? (
                            <span className="font-semibold truncate max-w-[60px] flex items-center gap-1">
                                <UserIcon size={12} />
                                {engineer.name}
                            </span>
                        ) : (
                            <span className="font-semibold truncate max-w-[60px] flex items-center gap-1 text-rose-300">
                                <UserPlus size={12} />
                                Unassigned
                            </span>
                        )}
                        <div className="flex items-center gap-1">
                            <JobActionsMenu actions={actions} size="sm" colorScheme="light" title={`Job #${job.id} Actions`} onOpenChange={setIsActionsMenuOpen} />
                        </div>
                    </div>
                )}

                {isSmallCard && (
                    <div className="absolute bottom-1 right-1">
                        <JobActionsMenu 
                            actions={actions} 
                            size="sm" 
                            colorScheme="light" 
                            title={`Job #${job.id} - ${engineer?.name || 'Unassigned'}`} 
                            onOpenChange={setIsActionsMenuOpen}
                        />
                    </div>
                )}
            </div>
    );
};
import React, { useMemo } from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, JobSegment, Engineer, VehicleStatus } from '../../types';
import { Package as PackageIcon, PackageCheck, CheckCircle, ArrowRightCircle, Clock, KeyRound, Car, Wand2, LogIn, ClipboardCheck, FileText, LogOut, PlayCircle, Play, PauseCircle, User as UserIcon, XCircle } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getRelativeDate } from '../../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES, END_HOUR, END_MINUTE } from '../../constants';
import { getPoStatusColor } from '../../core/utils/statusUtils';

interface ConciergeJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders: PurchaseOrder[];
    engineers: Engineer[];
    currentUser: User;
    onEdit: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onOpenAssistant: (jobId: string) => void;
    onGenerateInvoice?: (jobId: string) => void;
    onCollect?: (jobId: string) => void;
    onQcApprove?: (jobId: string) => void;
    onStartWork?: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart?: (jobId: string, segmentId: string) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
    highlightAction?: 'checkIn' | 'invoice' | 'collect';
}

export const ConciergeJobCard: React.FC<ConciergeJobCardProps> = (props) => {
    const { job, vehicle, customer, purchaseOrders, engineers, currentUser, onEdit, onCheckIn, onOpenPurchaseOrder, onOpenAssistant, onGenerateInvoice, onCollect, onQcApprove, onStartWork, onPause, onRestart, onEngineerComplete, highlightAction } = props;
    
    const { partsStatus, vehicleStatus } = job;
    const today = getRelativeDate(0);
    const engineersById = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers]);
    const segmentsToday = useMemo(() => (job.segments || []).filter(s => s.date === today && s.allocatedLift), [job.segments, today]);

    const partsStatusInfo = {
        'Awaiting Order': { title: 'Awaiting Parts Order', color: 'text-red-600', icon: PackageIcon },
        'Ordered': { title: 'Parts Ordered', color: 'text-blue-600', icon: PackageIcon },
        'Partially Received': { title: 'Parts Partially Received', color: 'text-amber-600', icon: PackageIcon },
        'Fully Received': { title: 'All Parts Received', color: 'text-purple-600', icon: PackageCheck },
    }[partsStatus || 'Not Required'];

    const vehicleStatusInfo: Record<VehicleStatus, { icon: React.ElementType, color: string, text: string }> = {
        'On Site': { icon: CheckCircle, color: 'text-green-600', text: 'On Site' },
        'Off-Site (Partner)': { icon: ArrowRightCircle, color: 'text-blue-600', text: 'Off-Site' },
        'Awaiting Arrival': { icon: Clock, color: 'text-gray-500', text: 'Awaiting Arrival' },
        'Awaiting Collection': { icon: Clock, color: 'text-purple-600', text: 'Awaiting Collection' },
        'Collected': { icon: CheckCircle, color: 'text-gray-500', text: 'Collected' },
        'Cancelled': { icon: XCircle, color: 'text-red-600', text: 'Cancelled' },
    };
    const currentVehicleStatus = vehicleStatusInfo[vehicleStatus || 'Awaiting Arrival'];

    const getCardColorClasses = () => {
        if (highlightAction === 'collect') return 'bg-purple-50 border-purple-300';
        if (highlightAction === 'invoice') return 'bg-indigo-50 border-indigo-300';
        if (highlightAction === 'checkIn') return 'bg-blue-50 border-blue-300';
        
        switch (job.status) {
            case 'Unallocated': return 'bg-slate-100 border-slate-400';
            case 'Allocated': return 'bg-blue-50 border-blue-200';
            case 'In Progress': return 'bg-yellow-50 border-yellow-200';
            case 'Paused': return 'bg-red-50 border-red-200';
            case 'Pending QC': return 'bg-orange-50 border-orange-200';
            case 'Invoiced': return 'bg-green-50 border-green-200';
            default: return 'bg-white border-gray-200';
        }
    };
    
    const associatedPOs = (job.purchaseOrderIds || []).map(id => purchaseOrders.find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    
    const canControl = (segment: JobSegment) => {
        if (!segment.engineerId) return false;
        if (currentUser.role === 'Engineer') return segment.engineerId === currentUser.engineerId;
        return currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    };

    return (
        <div
            className={`p-2 rounded-lg shadow-sm border space-y-1.5 cursor-pointer hover:shadow-md transition-shadow ${getCardColorClasses()}`}
            onClick={() => onEdit(job.id)}
        >
            {/* Header */}
            <div className="flex justify-between items-start">
                <h4 className="text-gray-800 flex-grow text-xs flex items-center gap-1">
                    {job.description}
                </h4>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-sm font-bold bg-gray-200 px-1.5 py-0.5 rounded text-gray-800">#{job.id}</span>
                    {job.keyNumber && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded border border-yellow-200">
                            <KeyRound size={8} /> {job.keyNumber}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Details */}
            <div className="text-[10px] text-gray-600 space-y-0.5">
                <p className="flex items-center gap-1 font-medium"><Car size={10}/> {vehicle?.registration} - {vehicle?.make} {vehicle?.model}</p>
                <p title={getCustomerDisplayName(customer)} className="truncate">{getCustomerDisplayName(customer)}</p>
                <p>{job.estimatedHours} hours</p>
            </div>

             {/* Purchase Orders Links */}
             {associatedPOs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {associatedPOs.map(po => (
                        <button
                            key={po.id}
                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] transition-colors ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-current opacity-90 hover:opacity-100`}
                            title={`View PO #${po.id} (${po.status})`}
                        >
                            <PackageIcon size={8} />
                            <span className="font-mono font-semibold">{po.id}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Segments for Today */}
            {segmentsToday.length > 0 && (
                <div className="mt-1 pt-1 border-t text-[10px] space-y-0.5">
                    {segmentsToday.map(seg => {
                        let timeString = `${seg.duration} hrs`;
                        if (seg.scheduledStartSegment !== null) {
                            const startTime = TIME_SEGMENTS[seg.scheduledStartSegment];
                            const numSegments = seg.duration * (60 / SEGMENT_DURATION_MINUTES);
                            const endSegmentIndex = seg.scheduledStartSegment + numSegments;
                            const endTime = endSegmentIndex < TIME_SEGMENTS.length ? TIME_SEGMENTS[endSegmentIndex] : `${END_HOUR}:${END_MINUTE}`;
                            timeString = `${startTime} - ${endTime}`;
                        }
                        
                        const controlEnabled = canControl(seg);

                        return (
                            <div key={seg.segmentId} className={`p-1 rounded-md ${controlEnabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold truncate">{engineersById.get(seg.engineerId!)?.name} on {seg.allocatedLift}</span>
                                    <span className={`font-semibold ml-1 ${seg.status === 'Paused' ? 'text-orange-600 animate-pulse' : 'text-indigo-700'}`}>{seg.status === 'Paused' ? 'PAUSED' : timeString}</span>
                                </div>
                                {controlEnabled && (
                                    <div className="mt-1 flex items-center justify-end gap-1">
                                        {seg.status === 'Allocated' && onStartWork && <button onClick={(e) => { e.stopPropagation(); onStartWork(job.id, seg.segmentId); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"><PlayCircle size={12} /> Start</button>}
                                        {seg.status === 'Paused' && onRestart && <button onClick={(e) => { e.stopPropagation(); onRestart(job.id, seg.segmentId); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"><Play size={12}/> Restart</button>}
                                        {seg.status === 'In Progress' && onPause && <button onClick={(e) => { e.stopPropagation(); onPause(job.id, seg.segmentId); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600"><PauseCircle size={12}/> Pause</button>}
                                        {seg.status === 'In Progress' && onEngineerComplete && <button onClick={(e) => { e.stopPropagation(); onEngineerComplete(job, seg.segmentId); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"><CheckCircle size={12}/> Complete</button>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-1 border-t mt-0.5">
                 <div className="flex items-center gap-1 text-[9px]">
                     {partsStatusInfo && <span title={partsStatusInfo.title} className={`flex items-center gap-0.5 font-semibold ${partsStatusInfo.color}`}>{partsStatusInfo.icon && <partsStatusInfo.icon size={10}/>} {partsStatus}</span>}
                    <span title={`Vehicle Status: ${currentVehicleStatus.text}`} className={`flex items-center gap-0.5 font-semibold ${currentVehicleStatus.color}`}>
                        <currentVehicleStatus.icon size={10}/> {currentVehicleStatus.text}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className="p-0.5 text-blue-600 hover:bg-blue-100 rounded" title="Assistant"><Wand2 size={12} /></button>
                    
                    {/* Check In Action */}
                    {highlightAction === 'checkIn' && (
                        <button onClick={(e) => { e.stopPropagation(); onCheckIn(job.id); }} className="text-[10px] flex items-center gap-0.5 bg-blue-100 text-blue-800 px-1 py-0.5 rounded hover:bg-blue-200">
                            <LogIn size={10} /> In
                        </button>
                    )}
                    
                    {/* Invoice Action */}
                    {highlightAction === 'invoice' && onGenerateInvoice && (
                        <button onClick={(e) => { e.stopPropagation(); onGenerateInvoice(job.id); }} className="text-[10px] flex items-center gap-0.5 bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded hover:bg-indigo-200">
                            <FileText size={10} /> Inv
                        </button>
                    )}

                    {/* FIXED Check Out Action - Matches ConciergeView Handover Logic */}
                    {(highlightAction === 'collect' || vehicleStatus === 'Awaiting Collection' || (vehicleStatus === 'On Site' && !!job.invoiceId)) && onCollect && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCollect(job.id); }} 
                            className="text-[10px] flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 shadow-sm"
                        >
                            <LogOut size={10} /> 
                            <span className="font-bold">OUT</span>
                        </button>
                    )}

                    {/* QC Action (Only show if not in collect/invoice mode) */}
                    {job.status === 'Pending QC' && highlightAction !== 'collect' && onQcApprove && (currentUser.role === 'Admin' || currentUser.role === 'Dispatcher') && (
                        <button onClick={(e) => {e.stopPropagation(); onQcApprove(job.id);}} className="text-[10px] flex items-center gap-0.5 bg-orange-100 text-orange-800 px-1 py-0.5 rounded hover:bg-orange-200">
                            <ClipboardCheck size={10}/> QC
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
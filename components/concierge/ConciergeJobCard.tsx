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

    const partsStatusColor = () => {
        switch (partsStatus) {
            case 'Awaiting Order': return { bg: 'bg-rose-100', text: 'text-rose-800 border-rose-200' };
            case 'Ordered': return { bg: 'bg-sky-100', text: 'text-sky-800 border-sky-200' };
            case 'Partially Received': return { bg: 'bg-amber-100', text: 'text-amber-800 border-amber-200' };
            case 'Fully Received': return { bg: 'bg-emerald-100', text: 'text-emerald-800 border-emerald-200' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-800 border-gray-200' };
        }
    };

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
        if (highlightAction === 'collect') return 'bg-purple-100 border-purple-200 text-purple-900';
        if (highlightAction === 'invoice') return 'bg-indigo-100 border-indigo-200 text-indigo-900';
        if (highlightAction === 'checkIn') return 'bg-blue-100 border-blue-200 text-blue-900';
        
        switch (job.status) {
            case 'Unallocated': return 'bg-slate-50 border-slate-200 text-slate-800';
            case 'Allocated': return 'bg-blue-50 border-blue-200 text-blue-900';
            case 'In Progress': return 'bg-amber-50 border-amber-200 text-amber-900';
            case 'Paused': return 'bg-rose-50 border-rose-200 text-rose-900';
            case 'Pending QC': return 'bg-orange-50 border-orange-200 text-orange-900';
            case 'Invoiced': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
            case 'Complete': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
            default: return 'bg-white border-gray-100 text-gray-800';
        }
    };
    
    const isVibrant = getCardColorClasses().includes('text-white');
    const associatedPOs = (job.purchaseOrderIds || []).map(id => purchaseOrders.find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    
    const canControl = (segment: JobSegment) => {
        if (!segment.engineerId) return false;
        if (currentUser.role === 'Engineer') return segment.engineerId === currentUser.engineerId;
        return currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    };

    return (
        <div
            className={`p-3 rounded-xl shadow-lg border relative overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-[1.01] mb-3 ${getCardColorClasses()}`}
            onClick={() => onEdit(job.id)}
        >
            {/* Parts Status Accent */}
            <div className={`absolute top-0 right-0 h-1.5 w-12 rounded-bl-lg ${partsStatusColor()?.bg || 'bg-white/20'}`} title={partsStatus || 'No Parts'}></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <h4 className={`flex-grow text-sm font-bold uppercase tracking-tight leading-tight text-gray-900`}>
                    {job.description}
                </h4>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border bg-white/50 border-gray-200 text-gray-600`}>
                        #{job.id}
                    </span>
                    {job.keyNumber && (
                        <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-800`}>
                            <KeyRound size={10} /> {job.keyNumber}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Details */}
            <div className={`text-xs space-y-1 mb-3 text-gray-600`}>
                <p className="flex items-center gap-2 font-bold text-gray-800"><Car size={13} className="opacity-70 text-gray-400"/> {vehicle?.registration} • {vehicle?.make} {vehicle?.model}</p>
                <p title={getCustomerDisplayName(customer)} className="truncate font-semibold flex items-center gap-2"><UserIcon size={13} className="opacity-70 text-gray-400"/> {getCustomerDisplayName(customer)}</p>
                <div className="flex items-center gap-2 opacity-80 font-semibold">
                    <Clock size={13} className="text-gray-400" />
                    <span>{job.estimatedHours} hours estimated</span>
                </div>
            </div>

             {/* Purchase Orders Links */}
             {associatedPOs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-2 py-2 border-t border-gray-100">
                    {associatedPOs.map(po => (
                        <button
                            key={po.id}
                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-white/20`}
                            title={`View PO #${po.id} (${po.status})`}
                        >
                            <PackageIcon size={10} />
                            <span className="font-mono">{po.id.slice(-6)}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Segments for Today */}
            {segmentsToday.length > 0 && (
                <div className={`mt-2 pt-2 border-t border-gray-100 text-xs space-y-1.5`}>
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
                            <div key={seg.segmentId} className={`p-2 rounded-xl transition-colors ${controlEnabled ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold truncate text-gray-700">{engineersById.get(seg.engineerId!)?.name} on {seg.allocatedLift}</span>
                                    <span className={`font-bold ${seg.status === 'Paused' ? 'text-rose-600 animate-pulse' : 'text-indigo-700'}`}>
                                        {seg.status === 'Paused' ? 'PAUSED' : timeString}
                                    </span>
                                </div>
                                {controlEnabled && (
                                    <div className="flex items-center justify-end gap-1.5">
                                        {seg.status === 'Allocated' && onStartWork && <button onClick={(e) => { e.stopPropagation(); onStartWork(job.id, seg.segmentId); }} className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"><PlayCircle size={14} /> Start</button>}
                                        {seg.status === 'Paused' && onRestart && <button onClick={(e) => { e.stopPropagation(); onRestart(job.id, seg.segmentId); }} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"><PlayCircle size={14}/> Restart</button>}
                                        {seg.status === 'In Progress' && onPause && <button onClick={(e) => { e.stopPropagation(); onPause(job.id, seg.segmentId); }} className="flex items-center gap-1 px-2 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"><PauseCircle size={14}/> Pause</button>}
                                        {seg.status === 'In Progress' && onEngineerComplete && <button onClick={(e) => { e.stopPropagation(); onEngineerComplete(job, seg.segmentId); }} className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 shadow-sm text-[10px] font-bold uppercase tracking-tight border border-indigo-200 transition-transform active:scale-95"><CheckCircle size={14}/> Complete</button>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <div className={`flex justify-between items-center pt-2 border-t mt-2 border-gray-100`}>
                 <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span title={`Vehicle Status: ${currentVehicleStatus.text}`} className={`flex items-center gap-1 text-gray-500`}>
                        <currentVehicleStatus.icon size={12}/> {currentVehicleStatus.text}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className={`p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 text-indigo-600 border border-gray-200`} title="Assistant"><Wand2 size={14} /></button>
                    
                    {/* Check In Action */}
                    {highlightAction === 'checkIn' && (
                        <button onClick={(e) => { e.stopPropagation(); onCheckIn(job.id); }} className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 bg-white text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-50 border border-blue-100 shadow-xs transition-transform active:scale-95">
                            <LogIn size={12} /> Check In
                        </button>
                    )}
                    
                    {/* Invoice Action */}
                    {highlightAction === 'invoice' && onGenerateInvoice && (
                        <button onClick={(e) => { e.stopPropagation(); onGenerateInvoice(job.id); }} className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 bg-white text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-50 border border-indigo-100 shadow-xs transition-transform active:scale-95">
                            <FileText size={12} /> Invoice
                        </button>
                    )}

                    {/* Check Out Action */}
                    {(highlightAction === 'collect' || vehicleStatus === 'Awaiting Collection' || (vehicleStatus === 'On Site' && !!job.invoiceId)) && onCollect && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCollect(job.id); }} 
                            className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
                        >
                            <LogOut size={12} /> 
                            <span>COLLECT</span>
                        </button>
                    )}

                    {/* QC Action */}
                    {job.status === 'Pending QC' && highlightAction !== 'collect' && onQcApprove && (currentUser.role === 'Admin' || currentUser.role === 'Dispatcher') && (
                        <button onClick={(e) => {e.stopPropagation(); onQcApprove(job.id);}} className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 bg-white text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-50 border border-orange-100 shadow-xs transition-transform active:scale-95">
                            <ClipboardCheck size={12}/> Sign-off
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
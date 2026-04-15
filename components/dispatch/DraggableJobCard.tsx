import React, { useMemo } from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, VehicleStatus, Engineer } from '../../types';
import { Package as PackageIcon, PackageCheck, CheckCircle, ArrowRightCircle, Clock, Wrench, Edit, Wand2, LogIn, XCircle, Car } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';

import { JobHoverPopout } from '../shared/JobHoverPopout';
import { JobActionsMenu } from '../shared/JobActionsMenu';

export const DraggableJobCard: React.FC<{
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders: PurchaseOrder[];
    onDragStart: (e: React.DragEvent<HTMLDivElement>, parentJobId: string, segmentId: string) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    onEdit: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    currentUser: User;
    onOpenAssistant: (jobId: string) => void;
    engineers?: Engineer[];
    onStartWork?: (jobId: string, segmentId: string) => void;
    onPause?: (jobId: string, segmentId: string) => void;
    onRestart?: (jobId: string, segmentId: string) => void;
    onQcApprove?: (jobId: string) => void;
}> = ({ job, vehicle, customer, purchaseOrders, onDragStart, onDragEnd, onEdit, onCheckIn, onOpenPurchaseOrder, currentUser, onOpenAssistant, engineers = [], onStartWork = () => {}, onPause = () => {}, onRestart = () => {}, onQcApprove = () => {} }) => {
    const unallocatedSegments = (job.segments || []).filter(s => s.status === 'Unallocated');

    if (unallocatedSegments.length === 0) return null;
    
    // @ts-ignore
    const canDrag = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    const segmentToDrag = unallocatedSegments[0];
    const { partsStatus, vehicleStatus } = job;

    const partsStatusInfo = {
        'Awaiting Order': { title: 'Awaiting Parts Order', color: 'text-red-600', icon: PackageIcon },
        'Ordered': { title: 'Parts Ordered', color: 'text-blue-600', icon: PackageIcon },
        'Partially Received': { title: 'Parts Partially Received', color: 'text-amber-600', icon: PackageIcon },
        'Fully Received': { title: 'All Parts Received', color: 'text-purple-600', icon: PackageCheck },
        'Not Required': { title: 'Parts Not Required', color: 'text-purple-600', icon: CheckCircle },
    }[partsStatus || 'Not Required'];

    const vehicleStatusInfo: Record<string, { icon: React.ElementType, color: string, text: string }> = {
        'On Site': { icon: CheckCircle, color: 'text-green-600', text: 'On Site' },
        'Off-Site (Partner)': { icon: ArrowRightCircle, color: 'text-blue-600', text: 'Off-Site' },
        'Awaiting Arrival': { icon: Clock, color: 'text-gray-500', text: 'Awaiting Arrival' },
        // @ts-ignore
        'Awaiting Collection': { icon: Clock, color: 'text-purple-600', text: 'Awaiting Collection' },
        // @ts-ignore
        'Collected': { icon: CheckCircle, color: 'text-gray-500', text: 'Collected' },
        // @ts-ignore
        'Cancelled': { icon: XCircle, color: 'text-red-600', text: 'Cancelled' },
    };
    const currentVehicleStatus = vehicleStatusInfo[vehicleStatus || 'Awaiting Arrival'] || vehicleStatusInfo['Awaiting Arrival'];

    const getCardColorClasses = () => {
        const isVehicleOnSite = job.vehicleStatus === 'On Site';
        const arePartsReady = job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required';
        const isReadyForWorkshop = isVehicleOnSite && arePartsReady;
        
        if (isReadyForWorkshop) return 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100';
        
        switch (job.partsStatus) {
            case 'Awaiting Order': return 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-100';
            case 'Ordered': return 'bg-sky-50 border-sky-200 text-sky-900 shadow-sky-100';
            case 'Partially Received': return 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-100';
            case 'Fully Received': case 'Not Required': return 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-indigo-100';
            default: return 'bg-white border-gray-100 text-gray-800';
        }
    };
    
    const isVibrant = getCardColorClasses().includes('text-white');
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

    const isReadyForWorkshop = job.vehicleStatus === 'On Site' && (job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required');

    const actions = useMemo(() => {
        const list = [
            { id: 'assistant', label: 'Technical Assistant', icon: Wand2, onClick: () => onOpenAssistant(job.id), group: 'primary' as const },
            { id: 'edit', label: 'Edit Job', icon: Edit, onClick: () => onEdit(job.id), group: 'secondary' as const }
        ];

        if (job.vehicleStatus === 'Awaiting Arrival') {
            list.unshift({ id: 'checkin', label: 'Check Vehicle In', icon: LogIn, onClick: () => onCheckIn(job.id), group: 'primary' as const });
        }

        return list;
    }, [job.id, job.vehicleStatus, onOpenAssistant, onEdit, onCheckIn]);

    return (
        <JobHoverPopout
            job={job}
            vehicle={vehicle}
            customer={customer}
            purchaseOrders={purchaseOrders}
            engineers={engineers}
            currentUser={currentUser}
            onEdit={onEdit}
            onCheckIn={onCheckIn}
            onOpenPurchaseOrder={onOpenPurchaseOrder}
            onOpenAssistant={onOpenAssistant}
            onStartWork={onStartWork}
            onPause={onPause}
            onRestart={onRestart}
            onQcApprove={onQcApprove}
        >
            <div
                draggable={canDrag}
                onDragStart={(e) => canDrag && onDragStart(e, job.id, segmentToDrag.segmentId)}
                onDragEnd={onDragEnd}
                className={`p-3.5 rounded-xl shadow-lg border relative transition-all duration-200 hover:shadow-xl hover:scale-[1.01] mb-3 ${canDrag ? 'cursor-grab' : 'cursor-default'} draggable-job ${getCardColorClasses()}`}
                title={canDrag ? `Drag to schedule: ${job.description} (${segmentToDrag.duration}h)`: 'View job details'}
            >
                {/* Parts Status Accent */}
                <div className={`absolute top-0 right-0 h-1.5 w-16 rounded-bl-lg ${partsStatusInfo?.color ? 'bg-white/20' : 'bg-white/10'}`} title={partsStatus || 'No Parts'}></div>

                <div className="flex justify-between items-start mb-2">
                    <h4 className={`text-sm font-bold uppercase tracking-tight leading-tight flex-grow flex items-center gap-2 text-gray-900`}>
                        {isReadyForWorkshop && <span title="Ready for Workshop"><Wrench size={18} className="text-emerald-600" /></span>}
                        {job.description}
                    </h4>
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 flex-shrink-0 ml-2`}>
                        #{job.id}
                    </span>
                </div>
                
                <div className={`text-xs space-y-1.5 mb-3 text-gray-600`}>
                    <p className="flex items-center gap-2 font-bold text-gray-800"><Car size={13} className="opacity-70 text-gray-400"/> {vehicle?.registration} • {vehicle?.make} {vehicle?.model}</p>
                    <p title={getCustomerDisplayName(customer)} className="truncate font-semibold flex items-center gap-2">
                        <LogIn size={13} className="opacity-70 text-gray-400"/> {getCustomerDisplayName(customer)}
                    </p>
                    <div className="flex items-center gap-2 opacity-80 font-semibold">
                        <Clock size={13} className="text-gray-400" />
                        <span>{job.estimatedHours}h ({unallocatedSegments.length} segs)</span>
                    </div>
                </div>

                {associatedPOs && associatedPOs.length > 0 && (
                    <div className={`flex flex-wrap gap-1.5 my-2 py-2 border-t border-gray-100`}>
                        {associatedPOs.map(po => (
                            <button
                                key={po.id}
                                onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-white/20`}
                                title={`View PO #${po.id} (${po.status})`}
                            >
                                <PackageIcon size={10} />
                                <span className="font-mono">{po.id}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t mt-2 border-gray-100">
                    <div className="flex items-center gap-3">
                        {partsStatusInfo && <span title={partsStatusInfo.title} className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isVibrant ? 'text-white/80' : partsStatusInfo.color}`}>{partsStatusInfo.icon && <partsStatusInfo.icon size={12}/>} {partsStatus}</span>}
                        <span title={`Vehicle Status: ${currentVehicleStatus.text}`} className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500`}>
                            <currentVehicleStatus.icon size={12}/> {currentVehicleStatus.text}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <JobActionsMenu actions={actions} size="sm" colorScheme="light" title={`Job #${job.id} Actions`} />
                    </div>
                </div>
            </div>
        </JobHoverPopout>
    );
};
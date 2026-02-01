
import React from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, VehicleStatus } from '../../types';
import { Package as PackageIcon, PackageCheck, CheckCircle, ArrowRightCircle, Clock, Wrench, Edit, Wand2, LogIn } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getPoStatusColor } from '../../core/utils/statusUtils';

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
}> = ({ job, vehicle, customer, purchaseOrders, onDragStart, onDragEnd, onEdit, onCheckIn, onOpenPurchaseOrder, currentUser, onOpenAssistant }) => {
    const unallocatedSegments = (job.segments || []).filter(s => s.status === 'Unallocated');

    if (unallocatedSegments.length === 0) return null;
    
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

    const vehicleStatusInfo: Record<VehicleStatus, { icon: React.ElementType, color: string, text: string }> = {
        'On Site': { icon: CheckCircle, color: 'text-green-600', text: 'On Site' },
        'Off-Site (Partner)': { icon: ArrowRightCircle, color: 'text-blue-600', text: 'Off-Site' },
        'Awaiting Arrival': { icon: Clock, color: 'text-gray-500', text: 'Awaiting Arrival' },
        'Awaiting Collection': { icon: Clock, color: 'text-purple-600', text: 'Awaiting Collection' },
        'Collected': { icon: CheckCircle, color: 'text-gray-500', text: 'Collected' },
    };
    const currentVehicleStatus = vehicleStatusInfo[vehicleStatus || 'Awaiting Arrival'];

    const getCardColorClasses = () => {
        const isVehicleOnSite = job.vehicleStatus === 'On Site';
        const arePartsReady = job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required';
        const isReadyForWorkshop = isVehicleOnSite && arePartsReady;
        
        if (isReadyForWorkshop) return 'bg-green-100 border-green-300';
        
        switch (job.partsStatus) {
            case 'Awaiting Order': return 'bg-red-50 border-red-200';
            case 'Ordered': return 'bg-blue-50 border-blue-200';
            case 'Partially Received': return 'bg-amber-50 border-amber-200';
            case 'Fully Received': case 'Not Required': return 'bg-purple-100 border-purple-300';
            default: return 'bg-white border-gray-200';
        }
    };
    
    const associatedPOs = (job.purchaseOrderIds || []).map(id => purchaseOrders.find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    const isReadyForWorkshop = job.vehicleStatus === 'On Site' && (job.partsStatus === 'Fully Received' || job.partsStatus === 'Not Required');
    
    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => canDrag && onDragStart(e, job.id, segmentToDrag.segmentId)}
            onDragEnd={onDragEnd}
            className={`p-2.5 rounded-lg shadow-md border space-y-2 ${canDrag ? 'cursor-grab' : 'cursor-default'} draggable-job ${getCardColorClasses()}`}
            title={canDrag ? `Drag to schedule: ${job.description} (${segmentToDrag.duration}h)`: 'View job details'}
        >
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm text-gray-800 flex-grow flex items-center gap-2">
                    {isReadyForWorkshop && <span title="Ready for Workshop"><Wrench size={16} className="text-green-600" /></span>}
                    {job.description}
                </h4>
                <span className="font-mono text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">#{job.id}</span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Vehicle:</strong> {vehicle?.registration} - {vehicle?.make} {vehicle?.model}</p>
                <p><strong>Customer:</strong> {getCustomerDisplayName(customer)} ({customer?.mobile || customer?.phone})</p>
                <p><strong>Job Length:</strong> {job.estimatedHours} hours ({unallocatedSegments.length} segment{unallocatedSegments.length > 1 ? 's' : ''})</p>
            </div>

            {associatedPOs && associatedPOs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-black/5">
                    {associatedPOs.map(po => (
                        <button
                            key={po.id}
                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-current opacity-90 hover:opacity-100`}
                            title={`View PO #${po.id} (${po.status})`}
                        >
                            <PackageIcon size={10} />
                            <span className="font-mono font-semibold">{po.id}</span>
                        </button>
                    ))}
                </div>
            )}
             <div className="flex justify-between items-center pt-2 border-t mt-2">
                <div className="flex items-center gap-4 text-xs">
                     {partsStatusInfo && <span title={partsStatusInfo.title} className={`flex items-center gap-1 font-semibold ${partsStatusInfo.color}`}>{partsStatusInfo.icon && <partsStatusInfo.icon size={14}/>} {partsStatus}</span>}
                    <span title={`Vehicle Status: ${currentVehicleStatus.text}`} className={`flex items-center gap-1 font-semibold ${currentVehicleStatus.color}`}>
                        <currentVehicleStatus.icon size={14}/> {currentVehicleStatus.text}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className="p-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200" title="Technical Assistant"><Wand2 size={14} /></button>
                    {job.vehicleStatus === 'Awaiting Arrival' && <button onClick={() => onCheckIn(job.id)} className="p-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200" title="Check Vehicle In"><LogIn size={14} /></button>}
                    <button onClick={() => onEdit(job.id)} className="p-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200" title="Edit Job"><Edit size={14} /></button>
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { Job, Vehicle, Customer, PurchaseOrder } from '../../../types';
import { Calendar, User, Truck, Wrench, Package, PackageOpen, Camera, Share, ArrowRightCircle, LogIn } from 'lucide-react';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { formatReadableDate } from '../../../core/utils/dateUtils';
import { getPoStatusColor } from '../../../core/utils/statusUtils';

interface JobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders?: PurchaseOrder[];
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn?: (jobId: string) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onGoToDispatch?: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
    job,
    vehicle,
    customer,
    purchaseOrders = [],
    onEditJob,
    onCheckIn,
    onOpenPurchaseOrder,
    onGoToDispatch
}) => {
    // Check parts status (assumes job.partsStatus is calculated somewhere, or we use a heuristic)
    // If not, we can rely on standard status
    const hasOrderedParts = job.partsStatus === 'Ordered' || job.partsStatus === 'Partially Received';
    const isAwaitingParts = job.partsStatus === 'Awaiting Order';
    const isPartsReady = job.partsStatus === 'Fully Received';

    const fromJobRef = (job.purchaseOrderIds || []).map(id => purchaseOrders.find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    const fromPOJobId = (purchaseOrders || []).filter(po => po.jobId === job.id && po.status !== 'Cancelled');
    const allPOs = [...fromJobRef, ...fromPOJobId];
    const associatedPOs = Array.from(new Set(allPOs.map(po => po.id))).map(id => allPOs.find(po => po.id === id) as PurchaseOrder);

    const hasPhotos = job.checkInPhotos && job.checkInPhotos.length > 0;

    const renderStatusBadge = () => {
        let bgColor = 'bg-gray-100 text-gray-800';
        switch (job.status) {
            case 'Complete':
            case 'Invoiced':
                bgColor = 'bg-green-100 text-green-800';
                break;
            case 'In Progress':
                bgColor = 'bg-yellow-100 text-yellow-800';
                break;
            case 'Allocated':
                bgColor = 'bg-blue-100 text-blue-800';
                break;
            case 'Closed':
                bgColor = 'bg-gray-300 text-gray-800';
                break;
        }
        return (
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${bgColor}`}>
                {job.status}
            </span>
        );
    };

    return (
        <div 
            onClick={() => onEditJob(job.id)}
            className="flex flex-col bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-200 transition-all duration-200 cursor-pointer overflow-hidden group h-full"
        >
            {/* Header: Date and ID */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center text-xs font-semibold text-gray-500 gap-1.5">
                    <Calendar size={14} className="text-gray-400" />
                    {job.createdAt ? formatReadableDate(job.createdAt) : 'No Date'}
                </div>
                <div className="font-mono text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    #{job.id}
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 flex-grow flex flex-col gap-3">
                {/* Vehicle & Customer */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="text-lg font-black uppercase text-gray-900 tracking-tight">
                            {vehicle?.registration || 'NO REG'}
                        </span>
                        <span className="text-sm font-medium text-indigo-600 flex items-center gap-1 mt-0.5">
                            <Truck size={14} />
                            {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
                        </span>
                    </div>
                    {renderStatusBadge()}
                </div>

                <div className="flex items-center text-sm text-gray-600 font-medium gap-1.5">
                    <User size={14} className="text-gray-400" />
                    {getCustomerDisplayName(customer) || 'Unknown Customer'}
                </div>

                {/* Description */}
                <div className="mt-2 text-sm text-gray-700 line-clamp-3 bg-gray-50 p-2 rounded-md border border-gray-100">
                    <Wrench size={14} className="inline-block mr-1 text-gray-400" />
                    {job.description || <span className="italic text-gray-400">No description provided</span>}
                </div>

                {/* Purchase Orders */}
                {associatedPOs.length > 0 && onOpenPurchaseOrder && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {associatedPOs.map(po => (
                            <button
                                key={po.id}
                                onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-bold tracking-wider hover:opacity-80 transition-opacity shadow-sm ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')}`}
                                title={`View PO #${po.id} (${po.status})`}
                            >
                                <Package size={12} />
                                <span>PO #{po.id}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer with badges and actions */}
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex flex-col gap-3 mt-auto">
                {/* Badges / Check-ins / Parts */}
                <div className="flex flex-wrap gap-2">
                    {hasPhotos && (
                        <div 
                            title={`${job.checkInPhotos!.length} Check-in Photos`}
                            onClick={(e) => { e.stopPropagation(); onEditJob(job.id, 'media'); }}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            <Camera size={14} /> 
                            <span className="hidden sm:inline">Photos</span>
                        </div>
                    )}
                    
                    {isAwaitingParts && (
                        <div 
                            title="Awaiting Parts to be ordered" 
                            onClick={(e) => { e.stopPropagation(); onEditJob(job.id, 'parts'); }}
                            className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-xs font-bold hover:bg-rose-100 transition-colors"
                        >
                            <PackageOpen size={14} />
                            <span className="hidden sm:inline">Needs Parts</span>
                        </div>
                    )}
                    
                    {hasOrderedParts && (
                        <div 
                            title="Parts Ordered" 
                            onClick={(e) => { e.stopPropagation(); onEditJob(job.id, 'parts'); }}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-bold hover:bg-amber-100 transition-colors"
                        >
                            <Truck size={14} />
                            <span className="hidden sm:inline">Parts on way</span>
                        </div>
                    )}

                    {isPartsReady && (
                        <div 
                            title="Parts Ready" 
                            onClick={(e) => { e.stopPropagation(); onEditJob(job.id, 'parts'); }}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                            <Package size={14} />
                            <span className="hidden sm:inline">Parts Ready</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                    {onCheckIn && job.vehicleStatus !== 'On-Site' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCheckIn(job.id); }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-blue-200 transition-all shadow-sm active:scale-95"
                            title="Check In Vehicle"
                        >
                            <LogIn size={14} /> Check In
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditJob(job.id, 'schedule'); }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                        title="Allocate to Lift & Individual"
                    >
                        <Share size={14} /> Allocate
                    </button>
                    {onGoToDispatch && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onGoToDispatch(job.id); }}
                            className="px-2 py-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Go to Dispatch View"
                        >
                            <ArrowRightCircle size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

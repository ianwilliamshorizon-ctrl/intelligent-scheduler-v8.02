import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Inquiry, Estimate, Customer, Vehicle, User, PurchaseOrder } from '../types';
import { 
    Search, PlusCircle, Car, FileText, CalendarCheck, UserCheck, 
    Package as PackageIcon, ArrowRightCircle, CheckCircle2, Play, AlertTriangle, Camera,
    ChevronDown, ChevronUp, RefreshCw, Loader2
} from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import ConfirmationModal from './ConfirmationModal';
import { saveDocument, deleteDocument } from '../core/db';
import { getImage } from '../utils/imageStore';

interface InquiriesViewProps {
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onConvert: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
    onMergeEstimate?: (estimate: Estimate, jobId: string) => void;
}

const getPoStatusStyles = (status: PurchaseOrder['status']) => {
    switch(status) {
        case 'Draft': return { container: 'bg-red-50 border-red-200', text: 'text-red-800', icon: 'text-red-700' };
        case 'Ordered': return { container: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-700' };
        case 'Partially Received': return { container: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: 'text-amber-700' };
        case 'Received': return { container: 'bg-green-50 border-green-200', text: 'text-green-800', icon: 'text-green-700' };
        default: return { container: 'bg-gray-50 border-gray-200', text: 'text-gray-800', icon: 'text-gray-700' };
    }
};

const InquiryCard: React.FC<{
    inquiry: Inquiry;
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onInitiateMerge: (estimate: Estimate, jobId: string, linkedPOs: PurchaseOrder[]) => void;
    onInitiateBooking: (estimate: Estimate, inquiryId: string) => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    isCompact?: boolean;
    onUpdateStatus?: (inquiry: Inquiry, status: Inquiry['status']) => void;
}> = ({ inquiry, onOpenInquiryModal, onInitiateMerge, onInitiateBooking, onViewEstimate, onOpenPurchaseOrder, isCompact, onUpdateStatus }) => {
    const { customers, vehicles, estimates, purchaseOrders, jobs } = useData();
    const { users } = useApp();
    
    const takenBy = users.find(u => u.id === inquiry.takenByUserId);
    const customer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
    const vehicle = inquiry.linkedVehicleId ? vehicles.find(v => v.id === inquiry.linkedVehicleId) : null;
    const estimate = inquiry.linkedEstimateId ? estimates.find(e => e.id === inquiry.linkedEstimateId) : null;
    const job = estimate?.jobId ? jobs.find(j => j.id === estimate.jobId) : null;
    
    const linkedPOs = useMemo(() => 
        (job?.purchaseOrderIds || [])
            .map(id => purchaseOrders.find(po => po.id === id))
            .filter((po): po is PurchaseOrder => !!po),
        [job, purchaseOrders]
    );

    const handleDownloadMedia = async (item: any) => {
        try {
            const dataUrl = await getImage(item.id);
            if (dataUrl) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = item.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('Could not retrieve file data.');
            }
        } catch (err) {
            console.error("Error downloading media:", err);
        }
    };

    const isApproved = inquiry.status === 'Approved' || estimate?.status === 'Approved';
    const mergeJobId = estimate?.jobId;
    const latestLog = inquiry.logs && inquiry.logs.length > 0 ? inquiry.logs[inquiry.logs.length - 1] : null;
    const isOverdue = inquiry.followUpDate && new Date(inquiry.followUpDate) < new Date(new Date().setHours(0,0,0,0));
    const isToday = inquiry.followUpDate && new Date(inquiry.followUpDate).toDateString() === new Date().toDateString();

    if (isCompact) {
        return (
            <div 
                className={`bg-white rounded-lg shadow p-2.5 border-l-4 ${
                    inquiry.status === 'New' ? 'border-red-400' : 
                    inquiry.status === 'Immediate Quote' ? 'border-amber-400' : 
                    inquiry.status === 'Escalated/Urgent' ? 'border-orange-500' : 
                    inquiry.status === 'In Progress' ? 'border-blue-400' : 
                    inquiry.status === 'Quoted or Responded' ? 'border-gray-200' : 
                    inquiry.status === 'Approved' ? 'border-green-400' : 'border-gray-200'
                } ${isOverdue || isToday ? 'ring-2 ring-red-400 bg-red-50/10' : ''} cursor-pointer hover:shadow-md transition-shadow mb-2`}
                onClick={() => onOpenInquiryModal(inquiry)}
            >
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-grow">
                        <p className="font-bold text-gray-800 text-xs truncate" title={inquiry.fromName}>{inquiry.fromName}</p>
                        {(inquiry.fromEmail || inquiry.fromPhone || inquiry.fromContact) && (
                            <p className="text-[10px] text-gray-500 truncate">
                                {[inquiry.fromEmail, inquiry.fromPhone, (!inquiry.fromEmail && !inquiry.fromPhone) ? inquiry.fromContact : null].filter(Boolean).join(' • ')}
                            </p>
                        )}
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 font-medium flex flex-col items-end">
                        <span>{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                        {inquiry.followUpDate && (
                            <span className={`mt-0.5 ${(isOverdue || isToday) ? 'text-red-500 font-bold' : 'text-blue-500'}`}>
                                FU: {new Date(inquiry.followUpDate).toLocaleDateString()}
                            </span>
                        )}
                    </span>
                </div>
                
                <p className="text-xs text-gray-600 my-1 line-clamp-1 whitespace-pre-wrap">{inquiry.message}</p>
                {latestLog && (
                    <div className="bg-gray-50 border rounded p-1 mb-1 mt-1 text-[9px] text-gray-600">
                        <span className="font-semibold">{latestLog.userId === 'System' ? 'System' : users.find(u => u.id === latestLog.userId)?.name || 'User'}:</span> <span className="line-clamp-1">{latestLog.notes}</span>
                    </div>
                )}
                
                {/* Badges Row */}
                <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-gray-100/50">
                    {customer && (
                        <div className="flex items-center gap-0.5 bg-green-50 text-green-700 px-1 py-0.5 rounded text-[9px] font-semibold max-w-[100px] truncate" title={getCustomerDisplayName(customer)}>
                            <UserCheck size={10} className="shrink-0"/>
                            <span className="truncate">{customer.surname || customer.forename}</span>
                        </div>
                    )}
                    {vehicle && (
                        <div className="flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[9px] font-bold">
                            <Car size={10} className="shrink-0"/>
                            <span>{vehicle.registration}</span>
                        </div>
                    )}
                    {estimate && (
                        <div className="flex items-center gap-0.5 bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-[9px] font-bold">
                            <FileText size={10} className="shrink-0"/>
                            <span>Est #{estimate.estimateNumber}</span>
                        </div>
                    )}
                    {linkedPOs.length > 0 && (
                        <div className="flex items-center gap-0.5 bg-amber-50 text-amber-700 px-1 py-0.5 rounded text-[9px] font-bold">
                            <PackageIcon size={10} className="shrink-0"/>
                            <span>{linkedPOs.length} PO{linkedPOs.length > 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>

                {/* Attachment Chips */}
                {inquiry.media && inquiry.media.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-gray-100/50">
                        {inquiry.media.map(item => (
                            <div 
                                key={item.id} 
                                title={item.name}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadMedia(item);
                                }}
                                className="flex items-center gap-0.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-1 py-0.5 text-[8px] font-medium text-gray-600 transition cursor-pointer"
                            >
                                {item.type === 'Photo' ? <Camera size={8} className="text-indigo-500 shrink-0" /> : <FileText size={8} className="text-gray-500 shrink-0" />}
                                <span className="truncate max-w-[80px]">{item.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Fast Action Buttons */}
                {onUpdateStatus && (
                    <div className="flex justify-end gap-1.5 mt-2 pt-1.5 border-t border-gray-100/50" onClick={(e) => e.stopPropagation()}>
                        {inquiry.status !== 'In Progress' && (
                            <button
                                type="button"
                                title="Set In Progress"
                                onClick={() => onUpdateStatus(inquiry, 'In Progress')}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            >
                                <Play size={10} className="shrink-0" />
                                <span>In Progress</span>
                            </button>
                        )}
                        {inquiry.status !== 'Escalated/Urgent' && (
                            <button
                                type="button"
                                title="Escalate"
                                onClick={() => onUpdateStatus(inquiry, 'Escalated/Urgent')}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                            >
                                <AlertTriangle size={10} className="shrink-0" />
                                <span>Escalate</span>
                            </button>
                        )}
                        <button
                            type="button"
                            title="Close Inquiry"
                            onClick={() => onUpdateStatus(inquiry, 'Closed')}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition"
                        >
                            <CheckCircle2 size={10} className="shrink-0" />
                            <span>Close</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div 
            className={`bg-white rounded-lg shadow p-3 border-l-4 ${
                inquiry.status === 'New' ? 'border-red-400' : 
                inquiry.status === 'Immediate Quote' ? 'border-amber-400' : 
                inquiry.status === 'Escalated/Urgent' ? 'border-orange-500' : 
                inquiry.status === 'In Progress' ? 'border-blue-400' : 
                inquiry.status === 'Quoted or Responded' ? 'border-gray-200' : 
                inquiry.status === 'Approved' ? 'border-green-400' : 'border-gray-200'
            } ${isOverdue || isToday ? 'ring-2 ring-red-400 bg-red-50/10' : ''} cursor-pointer hover:shadow-md transition-shadow mb-3`}
            onClick={() => onOpenInquiryModal(inquiry)}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-gray-800 text-sm">{inquiry.fromName}</p>
                    <p className="text-xs text-gray-500">
                        {[inquiry.fromEmail, inquiry.fromPhone, (!inquiry.fromEmail && !inquiry.fromPhone) ? inquiry.fromContact : null].filter(Boolean).join(' • ')}
                    </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                    <p>{new Date(inquiry.createdAt).toLocaleDateString()}</p>
                    {inquiry.followUpDate && (
                        <p className={`mt-1 font-semibold ${(isOverdue || isToday) ? 'text-red-500' : 'text-blue-500'}`}>
                            Follow Up: {new Date(inquiry.followUpDate).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
            
            <p className="text-sm text-gray-700 my-2 line-clamp-3 whitespace-pre-wrap">{inquiry.message}</p>
            {latestLog && (
                <div className="bg-gray-50 border rounded p-2 mb-2 mt-2 text-xs text-gray-600 shadow-sm">
                    <span className="font-semibold text-gray-700">{latestLog.userId === 'System' ? 'System' : users.find(u => u.id === latestLog.userId)?.name || 'User'}:</span> <span className="line-clamp-2">{latestLog.notes}</span>
                </div>
            )}
            
            <div className="mt-2 pt-2 border-t space-y-2">
                {customer && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <UserCheck size={14} className="text-green-600"/>
                        <span className="font-semibold">{getCustomerDisplayName(customer)}</span>
                    </div>
                )}
                {vehicle && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Car size={14} className="text-blue-600"/>
                        <span className="font-semibold">{vehicle.registration}</span>
                    </div>
                )}
                
                {estimate && (
                    <div className="flex flex-col gap-2 p-2 bg-gray-100 rounded">
                        <div className="flex items-center justify-between text-xs text-gray-700">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="text-purple-600"/>
                                <span className="font-semibold">Est #{estimate.estimateNumber}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end items-center mt-1">
                            {onViewEstimate && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onViewEstimate(estimate); }} className="text-xs text-indigo-600 hover:underline">View</button>
                            )}
                        </div>
                    </div>
                )}

                {isApproved && estimate && (
                    <div className="grid grid-cols-2 gap-2 mt-2 border-t pt-2">
                        {mergeJobId ? (
                            <button
                                type="button"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onInitiateMerge(estimate, mergeJobId, linkedPOs);
                                }}
                                className="flex flex-col items-center justify-center p-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition text-[10px] font-bold uppercase"
                            >
                                <ArrowRightCircle size={16} className="mb-1 text-white"/>
                                Apply to Job
                            </button>
                        ) : (
                            <div className="flex items-center justify-center p-2 bg-gray-50 text-gray-400 border border-dashed rounded text-[9px] text-center">
                                No Linked Job
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onInitiateBooking(estimate, inquiry.id);
                            }}
                            className="flex flex-col items-center justify-center p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 transition text-[10px] font-bold uppercase"
                        >
                            <CalendarCheck size={16} className="mb-1 text-indigo-600"/>
                            Book New Job
                        </button>
                    </div>
                )}

                 {linkedPOs.length > 0 && (
                    <div className="space-y-1.5 mt-2 pt-1 border-t">
                        <p className="text-xs font-bold text-gray-500">Parts Required:</p>
                        {linkedPOs.map(po => {
                            const styles = getPoStatusStyles(po.status);
                            return (
                                <div key={po.id} className={`flex items-center justify-between p-2 border rounded ${styles.container}`}>
                                    <div className={`flex items-center gap-2 text-xs ${styles.text}`}>
                                        <PackageIcon size={14} className={styles.icon}/>
                                        <span className="font-semibold block">PO #{po.id}</span>
                                    </div>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder?.(po); }} className="text-[10px] bg-white px-2 py-1 rounded shadow-sm border font-bold">View</button>
                                </div>
                            );
                        })}
                    </div>
                 )}
            </div>

            {/* Attachment Chips */}
            {inquiry.media && inquiry.media.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                    {inquiry.media.map(item => (
                        <div 
                            key={item.id} 
                            title={item.name}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadMedia(item);
                            }}
                            className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] font-medium text-gray-600 transition cursor-pointer"
                        >
                            {item.type === 'Photo' ? <Camera size={12} className="text-indigo-500 shrink-0" /> : <FileText size={12} className="text-gray-500 shrink-0" />}
                            <span className="truncate max-w-[120px]">{item.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Fast Action Buttons */}
            {onUpdateStatus && (
                <div className="flex justify-end gap-1.5 mt-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    {inquiry.status !== 'In Progress' && (
                        <button
                            type="button"
                            title="Set In Progress"
                            onClick={() => onUpdateStatus(inquiry, 'In Progress')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        >
                            <Play size={12} className="shrink-0" />
                            <span>In Progress</span>
                        </button>
                    )}
                    {inquiry.status !== 'Escalated/Urgent' && (
                        <button
                            type="button"
                            title="Escalate"
                            onClick={() => onUpdateStatus(inquiry, 'Escalated/Urgent')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                        >
                            <AlertTriangle size={12} className="shrink-0" />
                            <span>Escalate</span>
                        </button>
                    )}
                    <button
                        type="button"
                        title="Close Inquiry"
                        onClick={() => onUpdateStatus(inquiry, 'Closed')}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition"
                    >
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span>Close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const InquiriesView: React.FC<InquiriesViewProps> = (props) => {
    const { inquiries, setInquiries, customers, vehicles, estimates, purchaseOrders, jobs } = useData();
    
    const normalizedInquiries = useMemo(() => {
        return (inquiries || []).map(i => {
            let status = i.status;
            if (status === ('Quoted' as any)) {
                status = 'Quoted or Responded';
            } else if (status === ('Escalated' as any)) {
                status = 'Escalated/Urgent';
            }
            return { ...i, status };
        });
    }, [inquiries]);

    const { selectedEntityId, users, currentUser } = useApp();

    const [assignedUserFilter, setAssignedUserFilter] = useState<string>('all');
    const [stalenessFilter, setStalenessFilter] = useState<string>('all');

    const handleUpdateStatus = async (inquiry: Inquiry, newStatus: Inquiry['status']) => {
        const updated: Inquiry = {
            ...inquiry,
            status: newStatus,
            logs: [...(inquiry.logs || []), {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: 'System',
                actionType: 'Status Update',
                notes: `Status updated to ${newStatus} via fast action card button.`
            }]
        };
        // Update local state immediately for visual responsiveness
        setInquiries(prev => prev.map(i => i.id === inquiry.id ? updated : i));
        // Persist to database in background
        try {
            await saveDocument('brooks_inquiries', updated);
        } catch (e) {
            console.error("Failed to update inquiry status:", e);
        }
    };

    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
    const [viewLayout, setViewLayout] = useState<'kanban' | 'list'>('kanban');
    const [isCompact, setIsCompact] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'7' | '30' | '90' | 'all'>('all');
    const [sortField, setSortField] = useState<'createdAt' | 'fromName' | 'registration' | 'status'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);

    React.useEffect(() => {
        setSelectedInquiryIds([]);
    }, [activeTab, searchTerm, dateFilter, selectedEntityId, viewLayout, assignedUserFilter, stalenessFilter]);

    const handleBulkUpdateStatus = async (newStatus: Inquiry['status']) => {
        if (selectedInquiryIds.length === 0) return;
        
        const updatedInquiries = displayInquiries.filter(i => selectedInquiryIds.includes(i.id)).map(i => ({
            ...i,
            status: newStatus,
            logs: [...(i.logs || []), {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: 'System',
                actionType: 'Status Update',
                notes: `Status updated to ${newStatus} via bulk action.`
            }]
        }));
        
        setInquiries(prev => prev.map(i => {
            const up = updatedInquiries.find(u => u.id === i.id);
            return up ? up : i;
        }));
        
        const promises = updatedInquiries.map(up => saveDocument('brooks_inquiries', up));
        try {
            await Promise.all(promises);
        } catch (err) {
            console.error("Bulk update status failed:", err);
        }
        
        setSelectedInquiryIds([]);
    };

    const handleBulkDelete = () => {
        if (selectedInquiryIds.length === 0) return;
        
        setConfirmState({
            isOpen: true,
            title: 'Confirm Bulk Delete',
            message: `Are you sure you want to permanently delete the ${selectedInquiryIds.length} selected inquiries? This action cannot be undone.`,
            type: 'warning',
            actionType: 'bulk_delete' as any,
            payload: null
        });
    };

    const handleSort = (field: 'createdAt' | 'fromName' | 'registration' | 'status') => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };



    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'success' | 'warning';
        actionType: 'merge' | 'book' | 'bulk_delete' | null;
        payload: any;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success',
        actionType: null,
        payload: null
    });

    const handleConfirmAction = () => {
        const { actionType, payload } = confirmState;
        
        console.log("DEBUG: handleConfirmAction triggered", { actionType, payload });

        if (actionType === 'merge' && props.onMergeEstimate) {
            props.onMergeEstimate(payload.estimate, payload.jobId);
        } else if (actionType === 'book' && props.onScheduleEstimate) {
            console.log("DEBUG: Handing off to onScheduleEstimate", payload.estimate.estimateNumber);
            props.onScheduleEstimate(payload.estimate, payload.inquiryId);
        } else if (actionType === 'bulk_delete') {
            const idsToDelete = [...selectedInquiryIds];
            setInquiries(prev => prev.filter(i => !idsToDelete.includes(i.id)));
            const promises = idsToDelete.map(id => deleteDocument('brooks_inquiries', id));
            Promise.all(promises).catch(err => console.error("Bulk delete failed:", err));
            setSelectedInquiryIds([]);
        }
        
        setConfirmState(prev => ({ ...prev, isOpen: false, actionType: null, payload: null }));
    };

    const handleInitiateMerge = (estimate: Estimate, jobId: string, linkedPOs: PurchaseOrder[]) => {
        const pendingPOs = linkedPOs.filter(p => !['Ordered', 'Received', 'Partially Received'].includes(p.status));
        
        if (pendingPOs.length > 0) {
            setConfirmState({
                isOpen: true,
                title: 'Parts Not Ordered',
                message: `There are ${pendingPOs.length} Purchase Orders pending. Please order parts before merging.`,
                type: 'warning',
                actionType: null,
                payload: null
            });
            return;
        }

        setConfirmState({
            isOpen: true,
            title: 'Confirm Merge',
            message: `Merge Estimate #${estimate.estimateNumber} into Job #${jobId}?`,
            type: 'success',
            actionType: 'merge',
            payload: { estimate, jobId }
        });
    };

    const handleInitiateBooking = (estimate: Estimate, inquiryId: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Book Job',
            message: `Would you like to schedule a new job for Estimate #${estimate.estimateNumber}? This will open the Workshop Scheduler.`,
            type: 'success',
            actionType: 'book',
            payload: { estimate, inquiryId }
        });
    };

    const filteredInquiries = useMemo(() => {
        let filtered = normalizedInquiries.filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId);
        
        if (assignedUserFilter !== 'all') {
            const targetUserId = assignedUserFilter === 'me' ? currentUser.id : assignedUserFilter;
            filtered = filtered.filter(i => i.takenByUserId === targetUserId || i.assignedToUserId === targetUserId);
        }

        if (stalenessFilter === 'stale_24h') {
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
            filtered = filtered.filter(i => {
                const latestLogTime = i.logs && i.logs.length > 0 
                    ? new Date(i.logs[i.logs.length - 1].timestamp).getTime() 
                    : new Date(i.createdAt).getTime();
                return latestLogTime < twentyFourHoursAgo.getTime();
            });
        }

        if (searchTerm.trim()) {
            const low = searchTerm.toLowerCase();
            filtered = filtered.filter(i => 
                i.fromName.toLowerCase().includes(low) || 
                i.message.toLowerCase().includes(low)
            );
        }

        if (dateFilter !== 'all') {
            const now = new Date();
            const cutoff = new Date();
            cutoff.setDate(now.getDate() - parseInt(dateFilter));
            filtered = filtered.filter(i => new Date(i.createdAt) >= cutoff);
        }

        return filtered;
    }, [normalizedInquiries, selectedEntityId, searchTerm, dateFilter, assignedUserFilter, stalenessFilter, currentUser.id]);

    const activeInquiries = useMemo(() => {
        const columns: { [key in Inquiry['status']]?: Inquiry[] } = {
            'New': [], 'Immediate Quote': [], 'Escalated/Urgent': [], 'In Progress': [], 'Quoted or Responded': [], 'Approved': [], 'Rejected': [],
        };
        filteredInquiries.forEach(i => {
            if (i.status !== 'Closed' && columns[i.status]) columns[i.status]!.push(i);
        });
        return columns;
    }, [filteredInquiries]);

    const closedInquiries = useMemo(() => {
        return filteredInquiries.filter(i => i.status === 'Closed').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [filteredInquiries]);

    const displayInquiries = useMemo(() => {
        let list = filteredInquiries;
        if (activeTab === 'active') {
            list = list.filter(i => i.status !== 'Closed');
        } else {
            list = list.filter(i => i.status === 'Closed');
        }
        
        const items = [...list];
        items.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            
            if (sortField === 'createdAt') {
                valA = a.createdAt || '';
                valB = b.createdAt || '';
            } else if (sortField === 'fromName') {
                valA = (a.fromName || '').toLowerCase();
                valB = (b.fromName || '').toLowerCase();
            } else if (sortField === 'status') {
                valA = (a.status || '').toLowerCase();
                valB = (b.status || '').toLowerCase();
            } else if (sortField === 'registration') {
                const vA = a.linkedVehicleId ? vehicles.find(v => v.id === a.linkedVehicleId) : null;
                const vB = b.linkedVehicleId ? vehicles.find(v => v.id === b.linkedVehicleId) : null;
                valA = (vA?.registration || '').toLowerCase();
                valB = (vB?.registration || '').toLowerCase();
            }
            
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return items;
    }, [filteredInquiries, activeTab, sortField, sortOrder, vehicles]);

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-6">
                    <h2 className="text-2xl font-bold text-gray-800">Inquiries</h2>
                    
                    {/* Active/Closed Tabs */}
                    <div className="flex bg-gray-200 p-0.5 rounded-lg border shadow-sm">
                        <button
                            type="button"
                            onClick={() => setActiveTab('active')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                activeTab === 'active' 
                                ? 'bg-white text-gray-800 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            Active
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('closed')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                activeTab === 'closed' 
                                ? 'bg-white text-gray-800 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            Closed
                        </button>
                    </div>
                    
                    {/* Additional Filters */}
                    <div className="flex items-center gap-2">
                        <select 
                            value={assignedUserFilter} 
                            onChange={e => setAssignedUserFilter(e.target.value)}
                            className="bg-white border rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
                        >
                            <option value="all">All Users</option>
                            <option value="me">My Inquiries</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <select 
                            value={stalenessFilter} 
                            onChange={e => setStalenessFilter(e.target.value)}
                            className="bg-white border rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
                        >
                            <option value="all">All Activity</option>
                            <option value="stale_24h">Unactioned &gt; 24h</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Date filter */}
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                        {(['7', '30', '90', 'all'] as const).map(days => (
                            <button
                                key={days}
                                onClick={() => setDateFilter(days)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                    dateFilter === days 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {days === 'all' ? 'All Time' : `${days} Days`}
                            </button>
                        ))}
                    </div>

                    {/* View Layout Toggle (Kanban vs List) */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm">
                        <button
                            type="button"
                            onClick={() => setViewLayout('kanban')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                viewLayout === 'kanban' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            Kanban Board
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewLayout('list')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                viewLayout === 'list' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            List View
                        </button>
                    </div>

                    {/* Detailed vs Compact Toggle */}
                    {viewLayout === 'kanban' && (
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm mr-2">
                            <button
                                type="button"
                                onClick={() => setIsCompact(false)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                    !isCompact 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                Detailed
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCompact(true)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                    isCompact 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                Compact
                            </button>
                        </div>
                    )}

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"/>
                    </div>

                    <button onClick={() => props.onOpenInquiryModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                        <PlusCircle size={16}/> Log Inquiry
                    </button>
                </div>
            </header>

            {viewLayout === 'list' ? (
                <div className="flex-grow flex flex-col min-h-0">
                    {selectedInquiryIds.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 px-4 py-2.5 flex items-center justify-between shadow-sm rounded-lg mb-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-800 font-sans">
                                    {selectedInquiryIds.length} item{selectedInquiryIds.length > 1 ? 's' : ''} selected
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedInquiryIds([])}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                                >
                                    Deselect all
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleBulkUpdateStatus('Quoted or Responded')}
                                    className="px-3 py-1 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg transition"
                                >
                                    Move to Quoted/Responded
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleBulkUpdateStatus('Closed')}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition"
                                >
                                    Bulk Close
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition"
                                >
                                    Bulk Delete
                                </button>
                            </div>
                        </div>
                    )}
                    <main className="flex-grow overflow-y-auto bg-white rounded-xl border shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3 text-left w-10">
                                            <input 
                                                type="checkbox"
                                                checked={displayInquiries.length > 0 && selectedInquiryIds.length === displayInquiries.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedInquiryIds(displayInquiries.map(i => i.id));
                                                    } else {
                                                        setSelectedInquiryIds([]);
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                            />
                                        </th>
                                        <th 
                                            className="p-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-200 transition-colors"
                                            onClick={() => handleSort('createdAt')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Date</span>
                                                {sortField === 'createdAt' && (
                                                    sortOrder === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="p-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-200 transition-colors"
                                            onClick={() => handleSort('fromName')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Customer / From</span>
                                                {sortField === 'fromName' && (
                                                    sortOrder === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="p-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-200 transition-colors"
                                            onClick={() => handleSort('registration')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Vehicle</span>
                                                {sortField === 'registration' && (
                                                    sortOrder === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="p-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-200 transition-colors"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Status</span>
                                                {sortField === 'status' && (
                                                    sortOrder === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="p-3 text-left font-semibold text-gray-600">Message</th>
                                        <th className="p-3 text-center font-semibold text-gray-600">Attachments</th>
                                        <th className="p-3 text-right font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {displayInquiries.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-500 font-medium">
                                                No inquiries found.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayInquiries.map(i => {
                                            const customer = i.linkedCustomerId ? customers.find(c => c.id === i.linkedCustomerId) : null;
                                            const vehicle = i.linkedVehicleId ? vehicles.find(v => v.id === i.linkedVehicleId) : null;
                                            const estimate = i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null;
                                            const isSelected = selectedInquiryIds.includes(i.id);
                                            
                                            return (
                                                <tr 
                                                    key={i.id} 
                                                    className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                                    onClick={() => props.onOpenInquiryModal(i)}
                                                >
                                                    <td className="p-3 text-left w-10" onClick={e => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedInquiryIds(prev => [...prev, i.id]);
                                                                } else {
                                                                    setSelectedInquiryIds(prev => prev.filter(id => id !== i.id));
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                                        />
                                                    </td>
                                                {/* Date */}
                                                <td className="py-1.5 px-3 whitespace-nowrap text-xs text-gray-600 font-mono">
                                                    {new Date(i.createdAt).toLocaleDateString()} {new Date(i.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                {/* Customer */}
                                                <td className="py-1.5 px-3 max-w-[200px]">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="font-bold text-gray-800 truncate" title={i.fromName}>{i.fromName}</span>
                                                        {customer && (
                                                            <span className="inline-flex shrink-0" title={getCustomerDisplayName(customer)}>
                                                                <UserCheck size={12} className="text-green-600 text-semibold" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Vehicle */}
                                                <td className="py-1.5 px-3 whitespace-nowrap">
                                                    {vehicle ? (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                                                            <Car size={10} className="shrink-0" />
                                                            <span>{vehicle.registration}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">-</span>
                                                    )}
                                                </td>
                                                {/* Status */}
                                                <td className="py-1.5 px-3 whitespace-nowrap">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                        i.status === 'New' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        i.status === 'Immediate Quote' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        i.status === 'Escalated/Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        i.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        i.status === 'Quoted or Responded' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                                        i.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        i.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                                        'bg-gray-100 text-gray-800 border-gray-300'
                                                    }`}>
                                                        {i.status}
                                                    </span>
                                                </td>
                                                {/* Message */}
                                                <td className="py-1.5 px-3 text-xs text-gray-600 max-w-[320px] truncate" title={i.message}>
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {estimate && (
                                                            <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-[9px] font-bold shrink-0">
                                                                Est #{estimate.estimateNumber}
                                                            </span>
                                                        )}
                                                        <span className="truncate">{i.message.replace(/\s+/g, ' ')}</span>
                                                    </div>
                                                </td>
                                                {/* Attachments */}
                                                <td className="py-1.5 px-3 text-center whitespace-nowrap">
                                                    {i.media && i.media.length > 0 ? (
                                                        <span className="inline-flex" title={`${i.media.length} attachment(s)`}>
                                                            <Camera size={14} className="text-indigo-500" />
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                {/* Actions */}
                                                <td className="py-1.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex justify-end items-center gap-1">
                                                        {i.status !== 'Closed' && i.status !== 'Approved' && (
                                                            <>
                                                                {i.status !== 'In Progress' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(i, 'In Progress')}
                                                                        className="p-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 shadow-sm"
                                                                        title="Set In Progress"
                                                                    >
                                                                        <Play size={10} />
                                                                    </button>
                                                                )}
                                                                {i.status !== 'Escalated/Urgent' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(i, 'Escalated/Urgent')}
                                                                        className="p-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 transition border border-orange-200 shadow-sm"
                                                                        title="Escalate"
                                                                    >
                                                                        <AlertTriangle size={10} />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {i.status !== 'Closed' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(i, 'Closed')}
                                                                className="p-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition border border-green-200 shadow-sm"
                                                                title="Close Inquiry"
                                                            >
                                                                <CheckCircle2 size={10} />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => props.onOpenInquiryModal(i)}
                                                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-700 border transition ml-1"
                                                        >
                                                            View
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>
            ) : activeTab === 'active' ? (
                <main className="flex-grow overflow-x-auto pb-2">
                    <div className="flex gap-4 h-full min-w-full font-sans">
                        {(['New', 'Immediate Quote', 'Escalated/Urgent', 'In Progress', 'Quoted or Responded', 'Approved', 'Rejected'] as Inquiry['status'][]).map(status => (
                            <div key={status} className="flex-1 flex flex-col bg-gray-100 rounded-xl min-w-[280px] h-full">
                                <div className="p-3 border-b-2 border-indigo-200 bg-white rounded-t-xl font-bold text-gray-700">
                                    {status} ({activeInquiries[status]?.length || 0})
                                </div>
                                <div className="p-3 space-y-3 overflow-y-auto flex-grow">
                                    {(activeInquiries[status] || []).map(i => (
                                        <InquiryCard 
                                            key={i.id} 
                                            inquiry={i} 
                                            onOpenInquiryModal={props.onOpenInquiryModal}
                                            onInitiateMerge={handleInitiateMerge}
                                            onInitiateBooking={handleInitiateBooking}
                                            onViewEstimate={props.onViewEstimate}
                                            onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                            isCompact={isCompact}
                                            onUpdateStatus={handleUpdateStatus}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            ) : (
                <main className="flex-grow overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {closedInquiries.map(i => (
                            <InquiryCard 
                                key={i.id} 
                                inquiry={i} 
                                onOpenInquiryModal={props.onOpenInquiryModal}
                                onInitiateMerge={handleInitiateMerge}
                                onInitiateBooking={handleInitiateBooking}
                                onViewEstimate={props.onViewEstimate}
                                onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                isCompact={isCompact}
                                onUpdateStatus={handleUpdateStatus}
                            />
                        ))}
                    </div>
                </main>
            )}

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                onConfirm={handleConfirmAction}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                confirmText={confirmState.type === 'warning' ? 'OK' : 'Proceed'}
                cancelText={confirmState.type === 'warning' ? '' : 'Cancel'}
            />
        </div>
    );
};

export default InquiriesView;
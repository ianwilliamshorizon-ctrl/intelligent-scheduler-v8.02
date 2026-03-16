import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Inquiry, Estimate, Customer, Vehicle, User, PurchaseOrder } from '../types';
import { 
    Search, PlusCircle, Car, FileText, CalendarCheck, UserCheck, 
    Package as PackageIcon, ArrowRightCircle 
} from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import ConfirmationModal from './ConfirmationModal';

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
}> = ({ inquiry, onOpenInquiryModal, onInitiateMerge, onInitiateBooking, onViewEstimate, onOpenPurchaseOrder }) => {
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

    const isApproved = inquiry.status === 'Approved' || estimate?.status === 'Approved';
    const mergeJobId = estimate?.jobId;

    return (
        <div 
            className={`bg-white rounded-lg shadow p-3 border-l-4 ${
                inquiry.status === 'New' ? 'border-red-400' : 
                inquiry.status === 'In Progress' ? 'border-blue-400' : 
                inquiry.status === 'Quoted' ? 'border-yellow-400' : 
                inquiry.status === 'Approved' ? 'border-green-400' : 'border-gray-200'
            } cursor-pointer hover:shadow-md transition-shadow mb-3`}
            onClick={() => onOpenInquiryModal(inquiry)}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-gray-800 text-sm">{inquiry.fromName}</p>
                    <p className="text-xs text-gray-500">{inquiry.fromContact}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                    <p>{new Date(inquiry.createdAt).toLocaleDateString()}</p>
                </div>
            </div>
            
            <p className="text-sm text-gray-700 my-2 line-clamp-3 whitespace-pre-wrap">{inquiry.message}</p>
            
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
        </div>
    );
};

const InquiriesView: React.FC<InquiriesViewProps> = (props) => {
    const { inquiries } = useData();
    const { selectedEntityId } = useApp();
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
    const [searchTerm, setSearchTerm] = useState('');

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'success' | 'warning';
        actionType: 'merge' | 'book' | null;
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
        let filtered = inquiries.filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId);
        if (searchTerm.trim()) {
            const low = searchTerm.toLowerCase();
            filtered = filtered.filter(i => 
                i.fromName.toLowerCase().includes(low) || 
                i.message.toLowerCase().includes(low)
            );
        }
        return filtered;
    }, [inquiries, selectedEntityId, searchTerm]);

    const activeInquiries = useMemo(() => {
        const columns: { [key in Inquiry['status']]?: Inquiry[] } = {
            'New': [], 'In Progress': [], 'Quoted': [], 'Approved': [], 'Rejected': [],
        };
        filteredInquiries.forEach(i => {
            if (i.status !== 'Closed' && columns[i.status]) columns[i.status]!.push(i);
        });
        return columns;
    }, [filteredInquiries]);

    const closedInquiries = useMemo(() => {
        return filteredInquiries.filter(i => i.status === 'Closed').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [filteredInquiries]);

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Inquiries</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"/>
                    </div>
                    <button onClick={() => props.onOpenInquiryModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                        <PlusCircle size={16}/> Log Inquiry
                    </button>
                </div>
            </header>

            {activeTab === 'active' ? (
                <main className="flex-grow overflow-x-auto pb-2">
                    <div className="flex gap-4 h-full min-w-full">
                        {(['New', 'In Progress', 'Quoted', 'Approved', 'Rejected'] as Inquiry['status'][]).map(status => (
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
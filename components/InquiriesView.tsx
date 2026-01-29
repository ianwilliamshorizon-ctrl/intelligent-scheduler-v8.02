
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Inquiry, Estimate, Customer, Vehicle, User, PurchaseOrder } from '../types';
import { Search, X, MessageSquare, PlusCircle, Workflow, ChevronDown, ChevronsUpDown, User as UserIcon, Car, FileText, CalendarCheck, Edit, GitPullRequest, UserCheck, Package as PackageIcon, Filter, ShoppingCart, CheckCircle } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { getRelativeDate } from '../core/utils/dateUtils';

interface InquiriesViewProps {
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onConvert: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
}

const getPoStatusStyles = (status: PurchaseOrder['status']) => {
    switch(status) {
        case 'Draft': return { container: 'bg-red-50 border-red-200', text: 'text-red-800', icon: 'text-red-700', label: 'bg-red-100 text-red-800' };
        case 'Ordered': return { container: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-700', label: 'bg-blue-100 text-blue-800' };
        case 'Partially Received': return { container: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: 'text-amber-700', label: 'bg-amber-100 text-amber-800' };
        case 'Received': return { container: 'bg-green-50 border-green-200', text: 'text-green-800', icon: 'text-green-700', label: 'bg-green-100 text-green-800' };
        case 'Cancelled': return { container: 'bg-gray-50 border-gray-200', text: 'text-gray-800', icon: 'text-gray-700', label: 'bg-gray-200 text-gray-800' };
        default: return { container: 'bg-gray-50 border-gray-200', text: 'text-gray-800', icon: 'text-gray-700', label: 'bg-gray-200 text-gray-800' };
    }
};

const InquiryCard: React.FC<{
    inquiry: Inquiry;
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onConvert: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
}> = ({ inquiry, onOpenInquiryModal, onConvert, onViewEstimate, onScheduleEstimate, onOpenPurchaseOrder, onEditEstimate }) => {
    const { customers, vehicles, estimates, purchaseOrders } = useData();
    const { users } = useApp();
    const takenBy = users.find(u => u.id === inquiry.takenByUserId);
    const assignedTo = inquiry.assignedToUserId ? users.find(u => u.id === inquiry.assignedToUserId) : null;
    const customer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
    const vehicle = inquiry.linkedVehicleId ? vehicles.find(v => v.id === inquiry.linkedVehicleId) : null;
    const estimate = inquiry.linkedEstimateId ? estimates.find(e => e.id === inquiry.linkedEstimateId) : null;
    
    // Ensure we are getting the latest PO data from context
    const linkedPOs = useMemo(() => 
        (inquiry.linkedPurchaseOrderIds || [])
            .map(id => purchaseOrders.find(po => po.id === id))
            .filter((po): po is PurchaseOrder => !!po),
        [inquiry.linkedPurchaseOrderIds, purchaseOrders]
    );

    const statusColorClass = () => {
        switch(inquiry.status) {
            case 'Open': return 'border-red-400';
            case 'In Progress': return 'border-blue-400';
            case 'Sent': return 'border-yellow-400';
            case 'Approved': return 'border-green-400';
            case 'Rejected': return 'border-gray-400';
            case 'Closed': return 'border-gray-300 bg-gray-50';
            default: return 'border-gray-200';
        }
    };

    return (
        <div 
            className={`bg-white rounded-lg shadow p-3 border-l-4 ${statusColorClass()} cursor-pointer hover:shadow-md transition-shadow mb-3`}
            onClick={() => onOpenInquiryModal(inquiry)}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-gray-800 text-sm">{inquiry.fromName}</p>
                    <p className="text-xs text-gray-500">{inquiry.fromContact}</p>
                </div>
                <div className="text-right text-xs">
                    <p className="text-gray-500">{new Date(inquiry.createdAt).toLocaleDateString()}</p>
                    <p className="text-gray-500">Taken by: {takenBy?.name || 'Unknown'}</p>
                </div>
            </div>
            
            <p className="text-sm text-gray-700 my-2 line-clamp-3 whitespace-pre-wrap">{inquiry.message}</p>
            
            {assignedTo && (
                <div className="flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full self-start w-fit mt-2">
                    <UserIcon size={12}/> Assigned to: {assignedTo.name}
                </div>
            )}
            
            <div className="mt-2 pt-2 border-t space-y-2">
                {customer && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <UserCheck size={14} className="text-green-600"/>
                        <span>Linked to: <span className="font-semibold">{getCustomerDisplayName(customer)}</span></span>
                    </div>
                )}
                {vehicle && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Car size={14} className="text-blue-600"/>
                        <span>Vehicle: <span className="font-semibold">{vehicle.registration}</span></span>
                    </div>
                )}
                {estimate && (
                    <div className="flex flex-col gap-2 p-2 bg-gray-100 rounded">
                        <div className="flex items-center justify-between text-xs text-gray-700">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="text-purple-600"/>
                                <span className="font-semibold">Est #{estimate.estimateNumber}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${estimate.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-gray-200'}`}>{estimate.status}</span>
                        </div>
                        {/* Changed container to flex-wrap to handle narrow columns */}
                        <div className="flex flex-wrap gap-2 justify-end items-center mt-1">
                            {onViewEstimate && (
                                <button onClick={(e) => { e.stopPropagation(); onViewEstimate(estimate); }} className="text-xs text-indigo-600 hover:underline">View</button>
                            )}
                             {onEditEstimate && (estimate.status === 'Draft' || estimate.status === 'Sent') && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEditEstimate(estimate); }}
                                    className="flex items-center gap-1.5 text-xs py-1 px-2 bg-yellow-500 text-white font-semibold rounded hover:bg-yellow-600"
                                >
                                    <Edit size={12}/> Edit
                                </button>
                            )}
                             {estimate.status === 'Approved' && !estimate.jobId && onScheduleEstimate && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onScheduleEstimate(estimate, inquiry.id); }}
                                    className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                                >
                                    <CalendarCheck size={12}/> Schedule Job
                                </button>
                            )}
                        </div>
                    </div>
                )}
                 {linkedPOs.length > 0 && (
                    <div className="space-y-1.5 mt-2 pt-1 border-t">
                        <p className="text-xs font-bold text-gray-500">Parts Required:</p>
                        {linkedPOs.map(po => {
                            const styles = getPoStatusStyles(po.status);
                            const poTotal = (po.lineItems || []).reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
                            return (
                                <div key={po.id} className={`flex items-center justify-between p-2 border rounded ${styles.container}`}>
                                    <div className={`flex items-center gap-2 text-xs ${styles.text}`}>
                                        <PackageIcon size={14} className={styles.icon}/>
                                        <div>
                                            <span className="font-semibold block">PO #{po.id}</span>
                                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ${styles.label}`}>{po.status}</span>
                                        </div>
                                    </div>
                                    {onOpenPurchaseOrder && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }} 
                                            className={`text-xs px-2 py-1 rounded font-semibold flex items-center gap-1 transition ${po.status === 'Draft' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                        >
                                            {po.status === 'Draft' ? <><ShoppingCart size={12}/> Order Parts</> : <><CheckCircle size={12}/> View</>}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// Main View
const InquiriesView: React.FC<InquiriesViewProps> = ({ onOpenInquiryModal, onConvert, onViewEstimate, onScheduleEstimate, onOpenPurchaseOrder, onEditEstimate }) => {
    const { inquiries } = useData();
    const { selectedEntityId } = useApp();
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
    const [closedFilter, setClosedFilter] = useState<'7days' | '30days' | 'all'>('7days');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredInquiries = useMemo(() => {
        let filtered = inquiries.filter(i => selectedEntityId === 'all' || i.entityId === selectedEntityId);
        
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(i => 
                i.fromName.toLowerCase().includes(lowerSearch) ||
                i.message.toLowerCase().includes(lowerSearch) ||
                (i.fromContact && i.fromContact.toLowerCase().includes(lowerSearch))
            );
        }
        return filtered;
    }, [inquiries, selectedEntityId, searchTerm]);

    const activeInquiries = useMemo(() => {
        const columns: { [key in Inquiry['status']]?: Inquiry[] } = {
            'Open': [],
            'In Progress': [],
            'Sent': [],
            'Approved': [],
            'Rejected': [],
        };
        
        filteredInquiries.forEach(inquiry => {
            if (inquiry.status !== 'Closed' && columns[inquiry.status]) {
                columns[inquiry.status]!.push(inquiry);
            }
        });
        
        // Sort each column by date descending (newest first)
        for (const status in columns) {
            columns[status as Inquiry['status']]?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        
        return columns;
    }, [filteredInquiries]);

    const closedInquiries = useMemo(() => {
        let closed = filteredInquiries.filter(i => i.status === 'Closed');
        
        const today = new Date();
        const cutoffDate = new Date();
        if (closedFilter === '7days') cutoffDate.setDate(today.getDate() - 7);
        else if (closedFilter === '30days') cutoffDate.setDate(today.getDate() - 30);
        else cutoffDate.setFullYear(2000); // effectively all

        return closed
            .filter(i => new Date(i.createdAt) >= cutoffDate)
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [filteredInquiries, closedFilter]);
    
    // The columns for the Kanban board (Active only)
    const kanbanColumns: { title: string; status: Inquiry['status']; color: string; }[] = [
        { title: 'New / Open', status: 'Open', color: 'border-red-400' },
        { title: 'In Progress / Parts', status: 'In Progress', color: 'border-blue-400' },
        { title: 'Estimate Sent', status: 'Sent', color: 'border-yellow-400' },
        { title: 'Approved / Action Required', status: 'Approved', color: 'border-green-400' },
        { title: 'Rejected / Lost', status: 'Rejected', color: 'border-gray-400' },
    ];

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Inquiries</h2>
                    
                    <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('active')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${activeTab === 'active' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Active Board
                        </button>
                        <button 
                            onClick={() => setActiveTab('closed')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${activeTab === 'closed' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Closed Archive
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search inquiries..."
                            className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                        />
                         {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                    <button onClick={() => onOpenInquiryModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> Log Inquiry
                    </button>
                </div>
            </header>
            
            {activeTab === 'active' ? (
                <main className="flex-grow overflow-x-auto pb-2">
                    <div className="flex gap-4 h-full min-w-full">
                        {kanbanColumns.map(col => {
                            const colInquiries = activeInquiries[col.status] || [];
                            return (
                                 <div key={col.status} className="flex-1 flex flex-col bg-gray-100 rounded-xl min-w-[250px] h-full max-h-full">
                                    <div className={`p-3 border-b-4 ${col.color} bg-white rounded-t-xl sticky top-0 z-10 shadow-sm`}>
                                        <h3 className="font-bold text-gray-700">{col.title} ({colInquiries.length})</h3>
                                    </div>
                                    <div className="p-3 space-y-3 overflow-y-auto flex-grow">
                                        {colInquiries.map(inquiry => (
                                            <InquiryCard 
                                                key={inquiry.id} 
                                                inquiry={inquiry} 
                                                onOpenInquiryModal={onOpenInquiryModal} 
                                                onConvert={onConvert}
                                                onViewEstimate={onViewEstimate}
                                                onScheduleEstimate={onScheduleEstimate}
                                                onOpenPurchaseOrder={onOpenPurchaseOrder}
                                                onEditEstimate={onEditEstimate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            ) : (
                <main className="flex-grow overflow-y-auto pb-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-700">Closed Inquiries ({closedInquiries.length})</h3>
                        <div className="flex items-center bg-gray-200 p-1 rounded-lg">
                            <span className="text-xs font-semibold text-gray-600 px-2">Timeframe:</span>
                            <select 
                                value={closedFilter} 
                                onChange={(e) => setClosedFilter(e.target.value as any)} 
                                className="bg-transparent text-sm font-semibold text-gray-800 border-none focus:ring-0 cursor-pointer outline-none"
                            >
                                <option value="7days">Last 7 Days</option>
                                <option value="30days">Last 30 Days</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>
                    </div>
                    
                    {closedInquiries.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {closedInquiries.map(inquiry => (
                                <InquiryCard 
                                    key={inquiry.id} 
                                    inquiry={inquiry} 
                                    onOpenInquiryModal={onOpenInquiryModal} 
                                    onConvert={onConvert}
                                    onViewEstimate={onViewEstimate}
                                    onScheduleEstimate={onScheduleEstimate}
                                    onOpenPurchaseOrder={onOpenPurchaseOrder}
                                    onEditEstimate={onEditEstimate}
                                />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-20 text-gray-500">
                             <p>No closed inquiries found matching your criteria.</p>
                         </div>
                    )}
                </main>
            )}
        </div>
    );
};

export default InquiriesView;

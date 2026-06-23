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
import { toast } from 'react-toastify';
import { triggerEmailSync } from '../core/services/emailService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/services/firebaseServices';

interface InquiriesViewProps {
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onConvert: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
    onMergeEstimate?: (estimate: Estimate, jobId: string) => void;
}

export const isStale72h = (i: Inquiry) => {
    if (i.status !== 'Quoted or Responded') return false;
    const latestLogTime = i.logs && i.logs.length > 0 
        ? Math.max(...i.logs.map(log => new Date(log.timestamp).getTime()))
        : new Date(i.createdAt).getTime();
    return (Date.now() - latestLogTime) > (72 * 60 * 60 * 1000);
};

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
    onConvert?: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    draggable?: boolean;
    isExpanded?: boolean;
    onMouseEnter?: () => void;
}> = ({ inquiry, onOpenInquiryModal, onInitiateMerge, onInitiateBooking, onViewEstimate, onOpenPurchaseOrder, isCompact, onUpdateStatus, onConvert, draggable, isExpanded = false, onMouseEnter }) => {
    const { customers, vehicles, estimates, purchaseOrders, jobs } = useData();
    const { users, businessEntities: entities } = useApp();
    
    const takenBy = users.find(u => u.id === inquiry.takenByUserId);
    const customer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
    const vehicle = inquiry.linkedVehicleId ? vehicles.find(v => v.id === inquiry.linkedVehicleId) : null;
    const estimate = inquiry.linkedEstimateId ? estimates.find(e => e.id === inquiry.linkedEstimateId) : null;
    const job = estimate?.jobId ? jobs.find(j => j.id === estimate.jobId) : null;
    
    const displayName = customer ? getCustomerDisplayName(customer) : inquiry.fromName;
    const displayEmail = customer?.email || inquiry.fromEmail;
    const displayPhone = customer?.mobile || customer?.phone || inquiry.fromPhone;
    const displayContact = (!displayEmail && !displayPhone) ? inquiry.fromContact : null;
    const contactInfoString = [displayEmail, displayPhone, displayContact].filter(Boolean).join(' • ');
    
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
                toast.error('Could not retrieve file data.');
            }
        } catch (err) {
            console.error("Error downloading media:", err);
        }
    };

    const isApproved = inquiry.status === 'Approved' || estimate?.status === 'Approved';
    const mergeJobId = estimate?.jobId;
    const latestLog = inquiry.logs && inquiry.logs.length > 0 
        ? [...inquiry.logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[inquiry.logs.length - 1] 
        : null;
    const isOverdue = inquiry.followUpDate && new Date(inquiry.followUpDate) < new Date(new Date().setHours(0,0,0,0));
    const isToday = inquiry.followUpDate && new Date(inquiry.followUpDate).toDateString() === new Date().toDateString();

    const now = new Date().getTime();
    const latestActivityTime = latestLog ? new Date(latestLog.timestamp).getTime() : new Date(inquiry.createdAt).getTime();
    const hoursSinceLastActivity = (now - latestActivityTime) / (1000 * 60 * 60);
    const daysSinceLastActivity = Math.floor(hoursSinceLastActivity / 24);
    const showDaysBadge = daysSinceLastActivity >= 1 && !['Rejected', 'Scheduled', 'Closed', 'Approved'].includes(inquiry.status);
    
    let badgeColorClass = 'bg-green-500 text-white';
    if (daysSinceLastActivity > 14) {
        badgeColorClass = 'bg-red-500 text-white';
    } else if (daysSinceLastActivity > 7) {
        badgeColorClass = 'bg-amber-500 text-white';
    }
    
    let healthBgClass = 'bg-white';
    let ringClass = 'ring-1 ring-gray-200 hover:ring-gray-300';
    let cardExplanation = 'New or normal status (White background)';
    
    if (inquiry.status !== 'Closed' && inquiry.status !== 'Approved') {
        if (isOverdue || isToday) {
            healthBgClass = 'bg-red-50';
            ringClass = 'ring-1 ring-red-400';
            cardExplanation = 'Action Overdue: Follow-up date is today or in the past (Red background)';
        } else if (inquiry.hasNewReply) {
            healthBgClass = 'bg-yellow-50';
            ringClass = 'ring-1 ring-yellow-400';
            cardExplanation = 'Customer Responded: Customer has sent a new reply (Yellow background)';
        } else if (hoursSinceLastActivity > 48) {
            healthBgClass = 'bg-orange-50';
            ringClass = 'ring-1 ring-orange-400';
            cardExplanation = 'Stale Inquiry: No activity logged for more than 48 hours (Orange background)';
        } else if (latestLog && hoursSinceLastActivity <= 48) {
            healthBgClass = 'bg-emerald-50';
            ringClass = 'ring-1 ring-emerald-300';
            cardExplanation = 'Recently Active: Updated in the last 48 hours (Green background)';
        }
    } else {
        healthBgClass = 'bg-gray-50';
        cardExplanation = `${inquiry.status} inquiry (Gray background)`;
    }

    if (isCompact) {
        return (
            <div 
                draggable={draggable}
                onDragStart={(e) => {
                    if (draggable) {
                        e.dataTransfer.setData('inquiryId', inquiry.id);
                        e.dataTransfer.effectAllowed = 'move';
                    }
                }}
                onMouseEnter={onMouseEnter}
                className={`${healthBgClass} rounded shadow-sm p-1.5 border-l-4 ${
                    inquiry.status === 'New' ? 'border-red-400' : 
                    inquiry.status === 'Immediate Quote' ? 'border-amber-400' : 
                    inquiry.status === 'Escalated/Urgent' ? 'border-orange-500' : 
                    inquiry.status === 'Scheduled' ? 'border-blue-400' : 
                    inquiry.status === 'Quoted or Responded' ? (isStale72h(inquiry) ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-200') : 
                    inquiry.status === 'Approved' ? 'border-green-400' : 'border-gray-200'
                } ${isExpanded ? 'shadow-md ring-1 ring-indigo-400' : ringClass} cursor-pointer transition-all mb-1.5`}
                onClick={() => onOpenInquiryModal(inquiry)}
                title={cardExplanation}
            >
                <div className="flex justify-between items-start gap-1">
                    <div className="min-w-0 flex-grow pr-1">
                        <div className="flex items-center gap-1">
                            <p className="font-bold text-gray-800 text-[11px] truncate leading-tight" title={displayName}>{displayName}</p>
                            {showDaysBadge && (
                                <span className={`${badgeColorClass} text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm`} title={`${daysSinceLastActivity} days since last action`}>
                                    {daysSinceLastActivity}d
                                </span>
                            )}
                            {(customer || vehicle || estimate || linkedPOs.length > 0) && (
                                <div className={`flex gap-0.5 ${isExpanded ? 'hidden' : ''}`}>
                                    {customer && <UserCheck size={8} className="text-green-600"/>}
                                    {vehicle && <Car size={8} className="text-blue-600"/>}
                                    {estimate && <FileText size={8} className="text-purple-600"/>}
                                    {linkedPOs.length > 0 && <PackageIcon size={8} className="text-amber-600"/>}
                                </div>
                            )}
                        </div>
                        {contactInfoString && (
                            <p className={`${isExpanded ? 'block' : 'hidden'} text-[9px] text-gray-500 break-words leading-tight mt-0.5`}>
                                {contactInfoString}
                            </p>
                        )}
                    </div>
                    <span className="text-[9px] text-gray-400 shrink-0 font-medium flex flex-col items-end leading-tight">
                        <span>{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                        {inquiry.inquiryNumber && <span className="text-gray-500 font-semibold">{inquiry.inquiryNumber}</span>}
                        {inquiry.followUpDate && (
                            <span className={`mt-0.5 ${(isOverdue || isToday) ? 'text-red-500 font-bold' : 'text-blue-500'} ${!(isOverdue || isToday) && !isExpanded ? 'hidden' : 'inline'}`}>
                                FU: {new Date(inquiry.followUpDate).toLocaleDateString()}
                            </span>
                        )}
                    </span>
                </div>
                
                <p className={`text-[10px] text-gray-600 my-0.5 whitespace-pre-wrap leading-snug ${isExpanded ? 'line-clamp-none max-h-40 overflow-y-auto' : 'line-clamp-1'}`}>{inquiry.message}</p>
                
                {latestLog && (
                    <div className={`${isExpanded ? 'block' : 'hidden'} bg-gray-50 border rounded p-1 mb-1 mt-1 text-[9px] text-gray-600`}>
                        <span className="font-semibold">{latestLog.userId === 'System' ? 'System' : users.find(u => u.id === latestLog.userId)?.name || 'User'}:</span> <span className="line-clamp-1">{latestLog.notes}</span>
                    </div>
                )}
                
                {/* Badges Row */}
                {(customer || vehicle || estimate || linkedPOs.length > 0) && (
                    <div className={`${isExpanded ? 'flex' : 'hidden'} flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100/50`}>
                        {customer && (
                            <div className="flex items-center gap-0.5 bg-green-50 text-green-700 px-1 rounded text-[9px] font-semibold max-w-[100px] truncate" title={getCustomerDisplayName(customer)}>
                                <UserCheck size={9} className="shrink-0"/>
                                <span className="truncate">{customer.surname || customer.forename}</span>
                            </div>
                        )}
                        {vehicle && (
                            <div className="flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1 rounded text-[9px] font-bold">
                                <Car size={9} className="shrink-0"/>
                                <span>{vehicle.registration}</span>
                            </div>
                        )}
                        {estimate && (
                            <div className="flex items-center gap-0.5 bg-purple-50 text-purple-700 px-1 rounded text-[9px] font-bold">
                                <FileText size={9} className="shrink-0"/>
                                <span>Est #{estimate.estimateNumber}</span>
                            </div>
                        )}
                        {linkedPOs.length > 0 && (
                            <div className="flex items-center gap-0.5 bg-amber-50 text-amber-700 px-1 rounded text-[9px] font-bold">
                                <PackageIcon size={9} className="shrink-0"/>
                                <span>{linkedPOs.length} PO{linkedPOs.length > 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Attachment Chips */}
                {inquiry.media && inquiry.media.length > 0 && (
                    <div className={`${isExpanded ? 'flex' : 'hidden'} flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100/50`}>
                        {inquiry.media.map(item => (
                            <div 
                                key={item.id} 
                                title={item.name}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadMedia(item);
                                }}
                                className="flex items-center gap-0.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-1 text-[8px] font-medium text-gray-600 transition cursor-pointer"
                            >
                                {item.type === 'Photo' ? <Camera size={8} className="text-indigo-500 shrink-0" /> : <FileText size={8} className="text-gray-500 shrink-0" />}
                                <span className="truncate max-w-[80px]">{item.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Fast Action Buttons */}
                {onUpdateStatus && (
                    <div className={`${isExpanded ? 'flex' : 'hidden'} justify-end gap-1 mt-1 pt-1 border-t border-gray-100/50`} onClick={(e) => e.stopPropagation()}>
                        {(!estimate && onConvert) && (
                            <button
                                type="button"
                                title="Link Estimate"
                                onClick={() => onConvert(inquiry, 'estimate')}
                                className="p-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                            >
                                <FileText size={10} className="shrink-0" />
                            </button>
                        )}
                        {inquiry.status !== 'Scheduled' && (
                            <button
                                type="button"
                                title="Set Scheduled"
                                onClick={() => onUpdateStatus(inquiry, 'Scheduled')}
                                className="p-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            >
                                <Play size={10} className="shrink-0" />
                            </button>
                        )}
                        {inquiry.status !== 'Escalated/Urgent' && (
                            <button
                                type="button"
                                title="Escalate"
                                onClick={() => onUpdateStatus(inquiry, 'Escalated/Urgent')}
                                className="p-0.5 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                            >
                                <AlertTriangle size={10} className="shrink-0" />
                            </button>
                        )}
                        <button
                            type="button"
                            title="Close Inquiry"
                            onClick={() => onUpdateStatus(inquiry, 'Closed')}
                            className="p-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition"
                        >
                            <CheckCircle2 size={10} className="shrink-0" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div 
            draggable={draggable}
            onDragStart={(e) => {
                if (draggable) {
                    e.dataTransfer.setData('inquiryId', inquiry.id);
                    e.dataTransfer.effectAllowed = 'move';
                }
            }}
            className={`${healthBgClass} rounded-lg shadow p-3 border-l-4 ${
                inquiry.status === 'New' ? 'border-red-400' : 
                inquiry.status === 'Immediate Quote' ? 'border-amber-400' : 
                inquiry.status === 'Escalated/Urgent' ? 'border-orange-500' : 
                inquiry.status === 'Scheduled' ? 'border-blue-400' : 
                inquiry.status === 'Quoted or Responded' ? (isStale72h(inquiry) ? 'border-red-500 bg-red-50 text-red-800 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'border-gray-200') : 
                inquiry.status === 'Approved' ? 'border-green-400' : 'border-gray-200'
            } ${ringClass} cursor-pointer hover:shadow-md transition-shadow mb-3`}
            onClick={() => onOpenInquiryModal(inquiry)}
            title={cardExplanation}
        >
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-gray-800 text-sm">{displayName}</p>
                        {showDaysBadge && (
                            <span className={`${badgeColorClass} text-[10px] font-bold px-2 py-0.5 rounded-full leading-none shadow-sm`} title={`${daysSinceLastActivity} days since last action`}>
                                {daysSinceLastActivity}d
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        {contactInfoString}
                    </p>
                </div>
                <div className="text-right text-xs text-gray-500 flex flex-col items-end gap-1">
                    <p>{new Date(inquiry.createdAt).toLocaleDateString()}</p>
                    {inquiry.inquiryNumber && <p className="font-semibold text-gray-400">{inquiry.inquiryNumber}</p>}
                    {inquiry.followUpDate && (
                        <p className={`font-semibold ${(isOverdue || isToday) ? 'text-red-500' : 'text-blue-500'}`}>
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
            
            {(() => {
                const assigneeName = inquiry.assignedToUserId 
                    ? users.find(u => u.id === inquiry.assignedToUserId)?.name 
                    : inquiry.assignedToEntityId 
                        ? entities?.find(e => e.id === inquiry.assignedToEntityId)?.name 
                        : null;
                
                if (assigneeName) {
                    return (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <UserCheck size={12} className={inquiry.assignedToEntityId ? 'text-blue-500' : 'text-purple-500'} />
                            <span>Assigned: {assigneeName}</span>
                        </div>
                    );
                }
                return null;
            })()}
            
            <div className="mt-2 pt-2 border-t space-y-2">
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
                    {(!estimate && onConvert) && (
                        <button
                            type="button"
                            title="Link Estimate"
                            onClick={() => onConvert(inquiry, 'estimate')}
                            className="p-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                        >
                            <FileText size={14} className="shrink-0" />
                        </button>
                    )}
                    {inquiry.status !== 'Scheduled' && (
                        <button
                            type="button"
                            title="Set Scheduled"
                            onClick={() => onUpdateStatus(inquiry, 'Scheduled')}
                            className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        >
                            <Play size={14} className="shrink-0" />
                        </button>
                    )}
                    {inquiry.status !== 'Escalated/Urgent' && (
                        <button
                            type="button"
                            title="Escalate"
                            onClick={() => onUpdateStatus(inquiry, 'Escalated/Urgent')}
                            className="p-1.5 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                        >
                            <AlertTriangle size={14} className="shrink-0" />
                        </button>
                    )}
                    <button
                        type="button"
                        title="Close Inquiry"
                        onClick={() => onUpdateStatus(inquiry, 'Closed')}
                        className="p-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition"
                    >
                        <CheckCircle2 size={14} className="shrink-0" />
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
            if (status === ('Quoted' as any) || status === ('Customer Responded' as any)) {
                status = 'Quoted or Responded';
            } else if (status === ('Escalated' as any)) {
                status = 'Escalated/Urgent';
            } else if (status === ('In Progress' as any)) {
                status = 'Scheduled';
            }
            return { ...i, status };
        });
    }, [inquiries]);

    const { selectedEntityId, users, currentUser, businessEntities: entities } = useApp();

    const [hoveredInquiryId, setHoveredInquiryId] = useState<string | null>(null);
    const [assignedUserFilter, setAssignedUserFilter] = useState<string>('all');
    const [stalenessFilter, setStalenessFilter] = useState<string>('all');
    const [syncStatus, setSyncStatus] = useState<{ status: 'success' | 'error', lastRunTime: string, errorMsg?: string } | null>(null);

    React.useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "brooks_settings", "email_sync_status"), (docSnap) => {
            if (docSnap.exists()) {
                setSyncStatus(docSnap.data() as any);
            }
        });
        return () => unsubscribe();
    }, []);

    // Auto-parse 67 Degrees Web Inquiries
    React.useEffect(() => {
        if (!inquiries || inquiries.length === 0) return;
        
        const toUpdate = inquiries.filter(i => 
            i.fromName?.toLowerCase().includes('67 degrees') || 
            i.fromName?.toLowerCase().includes('67degrees')
        );

        if (toUpdate.length === 0) return;

        toUpdate.forEach(async (inq) => {
            const text = inq.message || '';
            let updated = false;
            const updates: Partial<Inquiry> = { id: inq.id };

            // Parse Name
            const nameMatch = text.match(/(?:Name|Customer|First Name|Last Name)\s*[:\-]\s*([^\n\r]+)/i);
            if (nameMatch && nameMatch[1].trim()) {
                updates.fromName = nameMatch[1].trim();
                updated = true;
            } else {
                // If we can't find a name, at least rename it to Web Inquiry so it stops looping
                updates.fromName = 'Web Inquiry (Unknown Name)';
                updated = true;
            }

            // Parse Email
            const emailMatch = text.match(/(?:Email|E-mail)\s*[:\-]\s*([^\n\r ]+)/i) || text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
            if (emailMatch && emailMatch[1].trim()) {
                updates.fromEmail = emailMatch[1].trim();
                updated = true;
            }

            // Parse Phone
            const phoneMatch = text.match(/(?:Phone|Telephone|Tel|Mobile|Contact Number)\s*[:\-]\s*([^\n\r]+)/i);
            if (phoneMatch && phoneMatch[1].trim()) {
                updates.fromPhone = phoneMatch[1].trim();
                updated = true;
            }

            if (updated) {
                try {
                    const fullUpdate = { ...inq, ...updates };
                    
                    // Update locally to prevent immediate re-trigger before db sync
                    setInquiries(prev => prev.map(p => p.id === inq.id ? fullUpdate : p));
                    
                    // Persist to DB
                    await saveDocument('brooks_inquiries', fullUpdate);
                } catch (err) {
                    console.error("Failed to auto-parse 67 degrees inquiry:", err);
                }
            }
        });
    }, [inquiries, setInquiries]);

    // Auto-close Scheduled Inquiries if job date is past
    React.useEffect(() => {
        if (!inquiries || inquiries.length === 0 || !jobs || jobs.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const toClose = inquiries.filter(i => {
            if (i.status !== 'Closed' && (i.linkedEstimateId || i.linkedJobId)) {
                let jobToUse = i.linkedJobId ? jobs.find(j => j.id === i.linkedJobId) : null;
                
                if (!jobToUse && i.linkedEstimateId) {
                    const est = estimates.find(e => e.id === i.linkedEstimateId);
                    if (est?.jobId) {
                        jobToUse = jobs.find(j => j.id === est.jobId);
                    }
                }

                if (jobToUse) {
                    // Close inquiry if job is completed, invoiced, closed, or cancelled
                    if (jobToUse.status === 'Complete' || jobToUse.status === 'Invoiced' || jobToUse.status === 'Closed' || jobToUse.status === 'Cancelled') {
                        return true;
                    }
                }
            }
            return false;
        });

        if (toClose.length === 0) return;

        toClose.forEach(async (inq) => {
            try {
                const updated = {
                    ...inq,
                    status: 'Closed' as Inquiry['status'],
                    logs: [...(inq.logs || []), {
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        userId: 'System',
                        actionType: 'Status Update',
                        notes: 'Automatically closed because the associated job was completed.'
                    }]
                };
                setInquiries(prev => prev.map(p => p.id === inq.id ? updated : p));
                await saveDocument('brooks_inquiries', updated);
            } catch (err) {
                console.error("Failed to auto-close scheduled inquiry:", err);
            }
        });
    }, [inquiries, jobs, estimates, setInquiries]);

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
    const [dateFilter, setDateFilter] = useState<'today' | '7' | '30' | '90' | 'all'>('all');
    const [sortField, setSortField] = useState<'createdAt' | 'fromName' | 'registration' | 'status' | 'inquiryNumber'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncEmails = async () => {
        setIsSyncing(true);
        try {
            const result = await triggerEmailSync();
            if (result.success) {
                toast.success(`Successfully synced ${result.processedCount} new email(s).`);
            } else {
                toast.error("Sync completed but returned an unexpected result.");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to sync emails.");
        } finally {
            setIsSyncing(false);
        }
    };

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

    const handleSort = (field: 'createdAt' | 'fromName' | 'registration' | 'status' | 'inquiryNumber') => {
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
            if (assignedUserFilter === 'me') {
                const myEntity = currentUser.preferredEntityId;
                filtered = filtered.filter(i => 
                    i.takenByUserId === currentUser.id || 
                    i.assignedToUserId === currentUser.id || 
                    (myEntity && i.assignedToEntityId === myEntity) ||
                    (myEntity && !i.assignedToUserId && i.entityId === myEntity)
                );
            } else {
                filtered = filtered.filter(i => 
                    i.takenByUserId === assignedUserFilter || 
                    i.assignedToUserId === assignedUserFilter || 
                    i.assignedToEntityId === assignedUserFilter ||
                    (!i.assignedToUserId && i.entityId === assignedUserFilter)
                );
            }
        }

        if (stalenessFilter === 'stale_24h') {
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
            filtered = filtered.filter(i => {
                const latestLogTime = i.logs && i.logs.length > 0 
                    ? Math.max(...i.logs.map(log => new Date(log.timestamp).getTime()))
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
            
            if (dateFilter === 'today') {
                cutoff.setHours(0, 0, 0, 0);
            } else {
                cutoff.setDate(now.getDate() - parseInt(dateFilter));
            }
            
            filtered = filtered.filter(i => new Date(i.createdAt) >= cutoff);
        }

        return filtered.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [normalizedInquiries, selectedEntityId, searchTerm, dateFilter, assignedUserFilter, stalenessFilter, currentUser.id]);

    const activeInquiries = useMemo(() => {
        const columns: { [key in Inquiry['status']]?: Inquiry[] } = {
            'New': [], 'Immediate Quote': [], 'Escalated/Urgent': [], 'Quoted or Responded': [], 'Approved': [], 'Rejected': [], 'Scheduled': [],
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
            } else if (sortField === 'inquiryNumber') {
                valA = (a.inquiryNumber || '').toLowerCase();
                valB = (b.inquiryNumber || '').toLowerCase();
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
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-gray-800">Inquiries</h2>
                        {syncStatus && (
                            <div 
                                className={`w-3 h-3 rounded-full shadow-sm border border-white ${
                                    syncStatus.status === 'error' ? 'bg-red-500 animate-pulse' :
                                    (Date.now() - new Date(syncStatus.lastRunTime).getTime() > 60 * 60 * 1000) ? 'bg-amber-500' : 
                                    'bg-green-500'
                                }`}
                                title={`Email Sync Status: ${syncStatus.status === 'error' ? 'Error (' + syncStatus.errorMsg + ')' : 'OK'}\nLast run: ${new Date(syncStatus.lastRunTime).toLocaleString()}`}
                            />
                        )}
                    </div>
                    
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

                    {/* Card Health Color Legend */}
                    <div className="flex items-center gap-3.5 text-xs bg-white px-3.5 py-1.5 rounded-lg border border-gray-200 shadow-xs text-gray-600 select-none">
                        <span className="font-semibold text-gray-400 mr-0.5">Card Status:</span>
                        <div className="flex items-center gap-1.5" title="Updated in the last 48 hours">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600 block shrink-0"></span>
                            <span className="font-medium text-gray-700">Active</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="No activity for more than 48 hours">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-600 block shrink-0"></span>
                            <span className="font-medium text-gray-700">Stale (&gt;48h)</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Customer has sent a new reply">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500 block shrink-0"></span>
                            <span className="font-medium text-gray-700">New Reply</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Follow-up date is today or in the past">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600 animate-pulse block shrink-0"></span>
                            <span className="font-medium text-gray-700">Overdue / Today</span>
                        </div>
                    </div>
                    
                    {/* Additional Filters */}
                    <div className="flex items-center gap-2">
                        <select 
                            value={assignedUserFilter} 
                            onChange={e => setAssignedUserFilter(e.target.value)}
                            className="bg-white border rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
                        >
                            <option value="all">All Assignments</option>
                            <option value="me">My Inquiries</option>
                            <optgroup label="Users">
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </optgroup>
                            {entities && entities.length > 0 && (
                                <optgroup label="Teams (Entities)">
                                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </optgroup>
                            )}
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
                        {(['today', '7', '30', '90', 'all'] as const).map(days => (
                            <button
                                key={days}
                                onClick={() => setDateFilter(days)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                                    dateFilter === days 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {days === 'today' ? 'Today' : days === 'all' ? 'All Time' : `${days} Days`}
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

                    <button 
                        onClick={handleSyncEmails} 
                        disabled={isSyncing}
                        className="flex items-center gap-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
                        title="Manually trigger email sync from info@brookspeed.com"
                    >
                        {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Sync Emails
                    </button>

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
                                            onClick={() => handleSort('inquiryNumber')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Inquiry #</span>
                                                {sortField === 'inquiryNumber' && (
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
                                            <td colSpan={9} className="p-8 text-center text-gray-500 font-medium">
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
                                                {/* Inquiry # */}
                                                <td className="py-1.5 px-3 whitespace-nowrap text-xs text-gray-600 font-mono font-semibold">
                                                    {i.inquiryNumber || '-'}
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
                                                        i.status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        i.status === 'Quoted or Responded' ? (isStale72h(i) ? 'bg-red-50 text-red-800 border-red-500 ring-1 ring-red-400' : 'bg-indigo-50 text-indigo-700 border-indigo-200') :
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
                                                                {i.status !== 'Scheduled' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(i, 'Scheduled')}
                                                                        className="p-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 shadow-sm"
                                                                        title="Set Scheduled"
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
                <main className="flex-grow overflow-x-auto pb-2" onMouseLeave={() => setHoveredInquiryId(null)}>
                    <div className="flex gap-4 h-full min-w-full font-sans">
                        {(['New', 'Immediate Quote', 'Escalated/Urgent', 'Quoted or Responded', 'Approved', 'Rejected', 'Scheduled'] as Inquiry['status'][]).map(status => (
                            <div 
                                key={status} 
                                className="flex-1 flex flex-col bg-gray-100 rounded-xl min-w-[280px] h-full transition-colors border-2 border-transparent"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50/50');
                                }}
                                onDragLeave={(e) => {
                                    e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/50');
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/50');
                                    const inquiryId = e.dataTransfer.getData('inquiryId');
                                    if (!inquiryId) return;
                                    const inquiry = inquiries.find(i => i.id === inquiryId);
                                    if (inquiry && inquiry.status !== status) {
                                        handleUpdateStatus(inquiry, status);
                                    }
                                }}
                            >
                                <div 
                                    className="p-3 border-b-2 border-indigo-200 bg-white rounded-t-xl font-bold text-gray-700"
                                    onMouseEnter={() => setHoveredInquiryId(null)}
                                >
                                    {status} ({activeInquiries[status]?.length || 0})
                                </div>
                                <div className="p-3 space-y-3 overflow-y-auto flex-grow">
                                    {(activeInquiries[status] || []).map(i => (
                                        <InquiryCard 
                                            key={i.id} 
                                            inquiry={i} 
                                            onOpenInquiryModal={(inq) => {
                                                setHoveredInquiryId(null);
                                                props.onOpenInquiryModal(inq);
                                            }}
                                            onInitiateMerge={handleInitiateMerge}
                                            onInitiateBooking={handleInitiateBooking}
                                            onViewEstimate={props.onViewEstimate}
                                            onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                            isCompact={isCompact}
                                            onUpdateStatus={handleUpdateStatus}
                                            onConvert={props.onConvert}
                                            draggable={true}
                                            isExpanded={hoveredInquiryId === i.id}
                                            onMouseEnter={() => setHoveredInquiryId(i.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            ) : (
                <main className="flex-grow overflow-y-auto" onMouseLeave={() => setHoveredInquiryId(null)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {closedInquiries.map(i => (
                            <InquiryCard 
                                key={i.id} 
                                inquiry={i} 
                                onOpenInquiryModal={(inq) => {
                                    setHoveredInquiryId(null);
                                    props.onOpenInquiryModal(inq);
                                }}
                                onInitiateMerge={handleInitiateMerge}
                                onInitiateBooking={handleInitiateBooking}
                                onViewEstimate={props.onViewEstimate}
                                onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                isCompact={isCompact}
                                onUpdateStatus={handleUpdateStatus}
                                onConvert={props.onConvert}
                                isExpanded={hoveredInquiryId === i.id}
                                onMouseEnter={() => setHoveredInquiryId(i.id)}
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
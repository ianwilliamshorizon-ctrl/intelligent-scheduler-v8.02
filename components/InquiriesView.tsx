import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Inquiry, Estimate, Customer, Vehicle, User, PurchaseOrder } from '../types';
import { 
    Search, PlusCircle, Car, FileText, CalendarCheck, UserCheck, 
    Package as PackageIcon, ArrowRightCircle, CheckCircle2, Play, AlertTriangle, Camera,
    ChevronDown, ChevronUp, RefreshCw, Loader2, Copy, Wand2, MapPin, Calendar, Archive, Printer,
    Mail, Send, X
} from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import ConfirmationModal from './ConfirmationModal';
import DuplicateInquiriesModal from './DuplicateInquiriesModal';
import PrintableInquiryList from './PrintableInquiryList';
import { InquiryMergeModal } from './inquiries/InquiryMergeModal';
import { saveDocument, deleteDocument } from '../core/db';
import { getImage } from '../utils/imageStore';
import { toast } from 'react-toastify';
import { triggerEmailSync, sendOutboundEmail } from '../core/services/emailService';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../core/services/firebaseServices';
import { extractUKRegistration, getCleanInquirySnippet, CANONICAL_KANBAN_STAGES, normalizeInquiryKanbanStage, isOnlineApprovedInquiry, CanonicalKanbanStage } from '../core/utils/inquiryUtils';
import { getEffectiveJobScheduledDate, getEffectiveInquiryScheduledDate } from '../core/utils/dateUtils';

interface InquiriesViewProps {
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onConvert: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
    onMergeEstimate?: (estimate: Estimate, jobId: string) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewVehicle?: (vehicleId: string) => void;
}

export const getLatestActivityTime = (inquiry: Inquiry) => {
    return inquiry.logs && inquiry.logs.length > 0 
        ? Math.max(...inquiry.logs.map(log => new Date(log.timestamp).getTime()))
        : new Date(inquiry.createdAt).getTime();
};

export const isScheduledInquiry = (inquiry: Inquiry, linkedJob?: any) => {
    return inquiry.status === 'Scheduled' || Boolean(inquiry.linkedJobId) || Boolean(linkedJob);
};

export const getInquiryHealth = (inquiry: Inquiry, isScheduledJob: boolean = false) => {
    if (inquiry.status === 'Closed') return 'closed';
    if (inquiry.isUrgent) return 'urgent';

    // Scheduled tasks/jobs have aging disabled
    const isScheduled = isScheduledJob || inquiry.status === 'Scheduled' || Boolean(inquiry.linkedJobId);
    if (isScheduled) {
        if (inquiry.hasNewReply) return 'responded';
        return 'normal';
    }

    const isOverdue = inquiry.followUpDate && new Date(inquiry.followUpDate) < new Date(new Date().setHours(0,0,0,0));
    const isToday = inquiry.followUpDate && new Date(inquiry.followUpDate).toDateString() === new Date().toDateString();
    const isFutureFollowUp = inquiry.followUpDate && !isOverdue && !isToday;

    const latestLogTime = getLatestActivityTime(inquiry);
    
    const hoursSinceLastActivity = (Date.now() - latestLogTime) / (1000 * 60 * 60);

    if (isOverdue || isToday) return 'overdue';
    if (inquiry.hasNewReply) return 'responded';
    if (isFutureFollowUp) return 'future_follow_up';
    if (inquiry.status === 'Waiting on Customer' && hoursSinceLastActivity > 72) return 'stale_quote';
    if (hoursSinceLastActivity > 48) return 'stale_activity';
    if (inquiry.logs && inquiry.logs.length > 0 && hoursSinceLastActivity <= 48) return 'active';
    
    return 'normal';
};

export const isStale72h = (i: Inquiry) => {
    return getInquiryHealth(i) === 'stale_quote';
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

const getActionStatusStyles = (status: string) => {
    switch (status) {
        case 'New Mail': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Email Sent': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'Email Responded': return 'bg-sky-100 text-sky-800 border-sky-200';
        case 'Call Required': return 'bg-red-100 text-red-800 border-red-200';
        case 'Voicemail Left': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'Estimate Required': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'Estimate Sent': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'Estimate Approved': return 'bg-green-100 text-green-800 border-green-200';
        case 'Estimate Rejected': return 'bg-gray-100 text-gray-800 border-gray-300';
        case 'Internal Review': return 'bg-pink-100 text-pink-800 border-pink-200';
        default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

const InquiryCard: React.FC<{
    inquiry: Inquiry;
    onOpenInquiryModal: (inquiry: Partial<Inquiry> | null) => void;
    onInitiateMerge: (estimate: Estimate, jobId: string, linkedPOs: PurchaseOrder[]) => void;
    onInitiateBooking: (estimate: Estimate, inquiryId: string) => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewVehicle?: (vehicleId: string) => void;
    isCompact?: boolean;
    onUpdateStatus?: (inquiry: Inquiry, status: Inquiry['status']) => void;
    onConvert?: (inquiry: Inquiry, type: 'job' | 'estimate') => void;
    draggable?: boolean;
    isExpanded?: boolean;
    onMouseEnter?: () => void;
    isSelected?: boolean;
    onToggleSelect?: (id: string, e: React.MouseEvent) => void;
    onRunAgent?: (inquiry: Inquiry) => void;
    isRunningAgent?: boolean;
    onQuickReply?: (inquiry: Inquiry, mode: 'ai_draft' | 'chase_72h', targetEmail: string) => void;
}> = ({ inquiry, onOpenInquiryModal, onInitiateMerge, onInitiateBooking, onViewEstimate, onOpenPurchaseOrder, onViewCustomer, onViewVehicle, isCompact, onUpdateStatus, onConvert, draggable, isExpanded = false, onMouseEnter, isSelected = false, onToggleSelect, onRunAgent, isRunningAgent = false, onQuickReply }) => {
    const { customers, vehicles, estimates, purchaseOrders, jobs } = useData();
    const { users, businessEntities: entities } = useApp();
    
    const takenBy = users.find(u => u.id === inquiry.takenByUserId);
    const customer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
    const estimate = (inquiry.linkedEstimateId ? estimates.find(e => e.id === inquiry.linkedEstimateId) : null)
        || estimates.find(e => e.linkedInquiryId === inquiry.id)
        || null;
    const vehicle = inquiry.linkedVehicleId 
        ? vehicles.find(v => v.id === inquiry.linkedVehicleId) 
        : (estimate?.vehicleId ? vehicles.find(v => v.id === estimate.vehicleId) : null);
    const job = inquiry.linkedJobId 
        ? jobs.find(j => j.id === inquiry.linkedJobId) 
        : (jobs.find(j => (j as any).associatedInquiryId === inquiry.id)
           || (estimate?.jobId ? jobs.find(j => j.id === estimate.jobId) : null)
           || (estimate ? jobs.find(j => j.estimateId === estimate.id) : null)
           || (inquiry.linkedEstimateId ? jobs.find(j => j.estimateId === inquiry.linkedEstimateId) : null));
    const estimateVehicle = estimate?.vehicleId ? vehicles.find(v => v.id === estimate.vehicleId) : null;
    const extractedReg = extractUKRegistration(`${inquiry.subject || ''} ${inquiry.message || ''}`);
    const effectiveReg = vehicle?.registration || inquiry.vehicleRegistration || estimateVehicle?.registration || (estimate as any)?.vehicleRegistration || extractedReg || '';
    
    const displayName = inquiry.fromName;
    const displayEmail = customer?.email || inquiry.fromEmail;
    const displayPhone = customer?.mobile || customer?.phone || inquiry.fromPhone;
    const displayContact = (!displayEmail && !displayPhone) ? inquiry.fromContact : null;
    const contactInfoString = [displayEmail, displayPhone, displayContact].filter(Boolean).join(' • ');
    
    const addrParts = [
        customer?.addressLine1 || inquiry.addressLine1,
        customer?.city || inquiry.city,
        customer?.postcode || inquiry.postcode
    ].filter(Boolean);
    const displayAddress = addrParts.length > 0 ? addrParts.join(', ') : null;
    
    const linkedPOs = useMemo(() => 
        (job?.purchaseOrderIds || [])
            .map(id => purchaseOrders.find(po => po.id === id))
            .filter((po): po is PurchaseOrder => !!po),
        [job, purchaseOrders]
    );

    const handleDownloadMedia = async (item: any) => {
        try {
            // Open window immediately to bypass popup blockers
            const win = window.open('about:blank', '_blank');
            const dataUrl = await getImage(item.id);
            if (dataUrl && win) {
                win.location.href = dataUrl;
            } else {
                win?.close();
                if (!dataUrl) toast.error('Could not retrieve file data.');
            }
        } catch (err) {
            console.error("Error downloading media:", err);
        }
    };

    const isApproved = estimate?.status === 'Approved';
    const mergeJobId = estimate?.jobId;
    const isScheduledJob = isScheduledInquiry(inquiry, job);
    const latestLog = inquiry.logs && inquiry.logs.length > 0 
        ? [...inquiry.logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[inquiry.logs.length - 1] 
        : null;
    const isOverdue = !isScheduledJob && inquiry.followUpDate && new Date(inquiry.followUpDate) < new Date(new Date().setHours(0,0,0,0));
    const isToday = !isScheduledJob && inquiry.followUpDate && new Date(inquiry.followUpDate).toDateString() === new Date().toDateString();

    const now = new Date().getTime();
    const latestActivityTime = latestLog ? new Date(latestLog.timestamp).getTime() : new Date(inquiry.createdAt).getTime();
    const hoursSinceLastActivity = (now - latestActivityTime) / (1000 * 60 * 60);
    const daysSinceLastActivity = Math.floor(hoursSinceLastActivity / 24);
    const showDaysBadge = !isScheduledJob && daysSinceLastActivity >= 1 && !['Rejected', 'Scheduled', 'Closed', 'Approved'].includes(inquiry.status);
    
    let badgeColorClass = 'bg-green-500 text-white';
    if (daysSinceLastActivity > 14) {
        badgeColorClass = 'bg-red-500 text-white';
    } else if (daysSinceLastActivity > 7) {
        badgeColorClass = 'bg-amber-500 text-white';
    }
    
    let healthBgClass = 'bg-white';
    let ringClass = 'ring-1 ring-gray-200 hover:ring-gray-300';
    let cardExplanation = 'New or normal status (White background)';
    
    if (inquiry.status !== 'Closed') {
        const isFutureFollowUp = !isScheduledJob && inquiry.followUpDate && !isOverdue && !isToday;

        if (inquiry.isUrgent) {
            healthBgClass = 'bg-red-50/80';
            ringClass = 'ring-2 ring-red-500 shadow-md';
            cardExplanation = 'Urgent Inquiry (Red border)';
        } else if (isScheduledJob) {
            // Once a job is scheduled, remove aging feature
            if (inquiry.hasNewReply) {
                healthBgClass = 'bg-yellow-100/60';
                ringClass = 'ring-1 ring-yellow-400';
                cardExplanation = 'Customer Responded: Customer has sent a new reply (Yellow background)';
            } else {
                healthBgClass = 'bg-purple-100/75';
                ringClass = 'ring-1 ring-purple-300 hover:ring-purple-400';
                cardExplanation = 'Scheduled Job (Pale purple background)';
            }
        } else if (isOverdue || isToday) {
            healthBgClass = 'bg-red-100/60';
            ringClass = 'ring-1 ring-red-400';
            cardExplanation = 'Action Overdue: Follow-up date is today or in the past (Red background)';
        } else if (inquiry.hasNewReply) {
            healthBgClass = 'bg-yellow-100/60';
            ringClass = 'ring-1 ring-yellow-400';
            cardExplanation = 'Customer Responded: Customer has sent a new reply (Yellow background)';
        } else if (isFutureFollowUp) {
            healthBgClass = 'bg-emerald-100/60';
            ringClass = 'ring-1 ring-emerald-300';
            cardExplanation = 'Follow-up Scheduled: A future follow-up date is set (Green background)';
        } else if (isStale72h(inquiry)) {
            healthBgClass = 'bg-red-100/60';
            ringClass = 'ring-1 ring-red-400';
            cardExplanation = 'Stale Quote: Unanswered quote for more than 72 hours (Red background)';
        } else if (hoursSinceLastActivity > 48) {
            healthBgClass = 'bg-orange-100/60';
            ringClass = 'ring-1 ring-orange-400';
            cardExplanation = 'Stale Inquiry: No activity logged for more than 48 hours (Orange background)';
        } else if (latestLog && hoursSinceLastActivity <= 48) {
            healthBgClass = 'bg-emerald-100/60';
            ringClass = 'ring-1 ring-emerald-300';
            cardExplanation = 'Recently Active: Updated in the last 48 hours (Green background)';
        }
    } else {
        healthBgClass = 'bg-gray-50';
        cardExplanation = `Closed inquiry (Gray background)`;
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
                    inquiry.isUrgent ? 'border-red-600' :
                    isOnlineApprovedInquiry(inquiry, estimate) ? 'border-emerald-500' :
                    inquiry.status === 'Triage' || inquiry.status === 'Inbox' || inquiry.status === 'New Requests' ? 'border-sky-400' : 
                    inquiry.status === 'Our Action' ? 'border-amber-400' : 
                    inquiry.status === 'Scheduled' || isScheduledJob ? 'border-purple-600' : 
                    inquiry.status === 'Waiting on Customer' ? (isStale72h(inquiry) ? 'border-red-500 text-red-800' : 'border-gray-300') : 
                    'border-gray-200'
                } ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md' : isExpanded ? 'shadow-md ring-1 ring-indigo-400' : ringClass} cursor-pointer transition-all mb-1.5`}
                onClick={() => onOpenInquiryModal(inquiry)}
                title={cardExplanation}
            >
                <div className="flex justify-between items-start gap-1">
                    <div className="min-w-0 flex-grow pr-1">
                        <div className="flex items-center gap-1 flex-wrap">
                            {onToggleSelect && (
                                <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleSelect(inquiry.id, e as any);
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5 mr-0.5 shrink-0 self-center"
                                    title="Select for bulk action"
                                />
                            )}
                            <p className="font-bold text-gray-800 text-[11px] truncate leading-tight" title={displayName}>{displayName}</p>
                            {effectiveReg && (
                                <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-800 border border-blue-200/80 px-1 py-0.2 rounded text-[9px] font-bold font-mono shrink-0" title={`Vehicle Reg: ${effectiveReg}`}>
                                    <Car size={8} className="text-blue-600 shrink-0"/>
                                    <span>{effectiveReg}</span>
                                </span>
                            )}
                            {showDaysBadge && (
                                <span className={`${badgeColorClass} text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm`} title={`${daysSinceLastActivity} days since last action`}>
                                    {daysSinceLastActivity}d
                                </span>
                            )}
                            {(customer || estimate || job || linkedPOs.length > 0) && (
                                <div className={`flex gap-0.5 items-center ${isExpanded ? 'hidden' : ''}`}>
                                    {customer && <UserCheck size={8} className="text-green-600"/>}
                                    {estimate && <FileText size={8} className="text-purple-600"/>}
                                    {job && <CalendarCheck size={8} className="text-indigo-600"/>}
                                    {linkedPOs.length > 0 && <PackageIcon size={8} className="text-amber-600"/>}
                                </div>
                            )}
                        </div>
                        {contactInfoString && (
                            <p className={`${isExpanded ? 'block' : 'hidden'} text-[9px] text-gray-500 break-words leading-tight mt-0.5`}>
                                {contactInfoString}
                            </p>
                        )}
                        {displayAddress && (
                            <p className={`${isExpanded ? 'block' : 'hidden'} text-[9px] text-gray-500 break-words leading-tight mt-0.5 flex items-center gap-1`}>
                                <MapPin size={8} className="shrink-0"/> {displayAddress}
                            </p>
                        )}
                    </div>
                    <span className="text-[9px] text-gray-400 shrink-0 font-medium flex flex-col items-end leading-tight">
                        <span>{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                        {inquiry.inquiryNumber && <span className="text-gray-500 font-semibold">{inquiry.inquiryNumber}</span>}
                        {(() => {
                            const effectiveDate = getEffectiveInquiryScheduledDate(inquiry, job);
                            if (isScheduledJob || inquiry.status === 'Scheduled') {
                                if (!effectiveDate) {
                                    return (
                                        <span className="mt-0.5 text-purple-800 font-bold inline-flex items-center gap-0.5 bg-purple-200/70 px-1 py-0.2 rounded border border-purple-300/80 shrink-0" title="Scheduled">
                                            <CalendarCheck size={9} className="shrink-0 text-purple-600" />
                                            <span>Scheduled</span>
                                        </span>
                                    );
                                }
                                const formatted = new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).toLocaleDateString('en-GB');
                                return (
                                    <span className="mt-0.5 text-purple-800 font-bold inline-flex items-center gap-0.5 bg-purple-200/70 px-1 py-0.2 rounded border border-purple-300/80 shrink-0" title={`Scheduled Arrival: ${effectiveDate}`}>
                                        <CalendarCheck size={9} className="shrink-0 text-purple-600" />
                                        <span>{formatted}</span>
                                    </span>
                                );
                            }
                            if (effectiveDate) {
                                const formatted = new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).toLocaleDateString('en-GB');
                                return (
                                    <span className="mt-0.5 text-amber-800 font-bold inline-flex items-center gap-0.5 bg-amber-100 px-1 py-0.2 rounded border border-amber-300 shrink-0" title={`Expected Scheduled Date: ${effectiveDate}`}>
                                        <CalendarCheck size={9} className="shrink-0 text-amber-600" />
                                        <span>Exp: {formatted}</span>
                                    </span>
                                );
                            }
                            if (inquiry.followUpDate) {
                                return (
                                    <span className={`mt-0.5 ${(isOverdue || isToday) ? 'text-red-500 font-bold' : 'text-blue-500'} ${!(isOverdue || isToday) && !isExpanded ? 'hidden' : 'inline'}`}>
                                        FU: {new Date(inquiry.followUpDate).toLocaleDateString()}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </span>
                </div>
                
                {(isOnlineApprovedInquiry(inquiry, estimate) || inquiry.hasNewReply || inquiry.actionStatus) && (
                    <div className="mt-0.5 mb-0.5 flex flex-wrap gap-1">
                        {isOnlineApprovedInquiry(inquiry, estimate) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 size={9} /> Approved — Ready to Book
                            </span>
                        )}
                        {inquiry.hasNewReply && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                Customer Replied
                            </span>
                        )}
                        {inquiry.actionStatus && !isOnlineApprovedInquiry(inquiry, estimate) && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${getActionStatusStyles(inquiry.actionStatus)}`}>
                                {inquiry.actionStatus}
                            </span>
                        )}
                    </div>
                )}
                
                {(inquiry.agentPlan || inquiry.aiNextStepSuggestion) && (
                    <div className="mt-0.5 mb-0.5 p-1 bg-purple-50/90 border border-purple-200 rounded text-[9px] text-purple-900 space-y-0.5">
                        <div className="flex items-start gap-1">
                            <Wand2 size={10} className="shrink-0 mt-0.5 text-purple-600" />
                            <span className="leading-tight font-semibold">
                                {inquiry.agentPlan?.recommendedActionLabel || `AI: ${inquiry.aiNextStepSuggestion}`}
                            </span>
                        </div>
                        {isExpanded && inquiry.agentPlan?.suggestedPackageNames && inquiry.agentPlan.suggestedPackageNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 pl-3.5">
                                {inquiry.agentPlan.suggestedPackageNames.map((pkg, idx) => (
                                    <span key={idx} className="px-1 py-0.2 bg-white border border-purple-200 rounded text-[8px] font-bold text-purple-700">
                                        {pkg}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {inquiry.subject && (
                    <p className="text-[10px] font-semibold text-gray-800 my-0.5 truncate" title={`Subject: ${inquiry.subject}`}>
                        <span className="text-gray-500 font-normal">Subject:</span> {inquiry.subject}
                    </p>
                )}
                <p className={`text-[10px] text-gray-600 my-0.5 whitespace-pre-wrap leading-snug ${isExpanded ? 'line-clamp-none max-h-40 overflow-y-auto' : 'line-clamp-2'}`}>{isExpanded ? inquiry.message : getCleanInquirySnippet(inquiry.message, 120)}</p>
                
                {latestLog && (
                    <div className={`${isExpanded ? 'block' : 'hidden'} bg-gray-50 border rounded p-1 mb-1 mt-1 text-[9px] text-gray-600`}>
                        <span className="font-semibold">{latestLog.userId === 'System' ? 'System' : users.find(u => u.id === latestLog.userId)?.name || 'User'}:</span> <span className="line-clamp-1">{latestLog.notes}</span>
                    </div>
                )}

                {inquiry.status === 'Closed' && inquiry.closedReason && (
                    <div className={`${isExpanded ? 'block' : 'hidden'} bg-red-50 border border-red-100 rounded p-1 mb-1 mt-1 text-[9px] text-red-700 font-bold`}>
                        Closed Reason: <span className="font-normal">{inquiry.closedReason}</span>
                    </div>
                )}
                
                {/* Badges Row */}
                {(customer || vehicle || effectiveReg || estimate || job || linkedPOs.length > 0) && (
                    <div className={`${isExpanded ? 'flex' : 'hidden'} flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100/50`}>
                        {customer && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewCustomer?.(customer.id);
                                }}
                                className="flex items-center gap-0.5 bg-green-50 text-green-700 px-1 rounded text-[9px] font-semibold max-w-[100px] truncate hover:bg-green-100 hover:underline cursor-pointer border border-green-200/30 text-left transition" 
                                title={getCustomerDisplayName(customer)}
                            >
                                <UserCheck size={9} className="shrink-0 text-green-600"/>
                                <span className="truncate">{customer.surname || customer.forename}</span>
                            </button>
                        )}
                        {vehicle ? (() => {
                            const make = (vehicle.make && String(vehicle.make).toLowerCase() !== 'unknown') ? String(vehicle.make) : (inquiry.vehicleMake && String(inquiry.vehicleMake).toLowerCase() !== 'unknown' ? String(inquiry.vehicleMake) : '');
                            const model = (vehicle.model && String(vehicle.model).toLowerCase() !== 'unknown') ? String(vehicle.model) : (inquiry.vehicleModel && String(inquiry.vehicleModel).toLowerCase() !== 'unknown' ? String(inquiry.vehicleModel) : '');
                            const spec = make ? ` - ${make} ${model}`.trim() : '';
                            return (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewVehicle?.(vehicle.id);
                                    }}
                                    className="flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1 rounded text-[9px] font-bold hover:bg-blue-100 hover:underline cursor-pointer border border-blue-200/30 text-left transition font-mono"
                                    title={`${vehicle.registration}${spec}`}
                                >
                                    <Car size={9} className="shrink-0 text-blue-600"/>
                                    <span>{vehicle.registration}</span>
                                </button>
                            );
                        })() : effectiveReg ? (
                            <span 
                                className="flex items-center gap-0.5 bg-amber-50 text-amber-800 px-1 rounded text-[9px] font-bold border border-amber-200/50 font-mono"
                                title={`Vehicle Reg: ${effectiveReg}`}
                            >
                                <Car size={9} className="shrink-0 text-amber-600"/>
                                <span>{effectiveReg}</span>
                            </span>
                        ) : null}
                        {estimate && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewEstimate?.(estimate);
                                }}
                                className="flex items-center gap-0.5 bg-purple-50 text-purple-700 px-1 rounded text-[9px] font-bold hover:bg-purple-100 hover:underline cursor-pointer border border-purple-200/30 text-left transition"
                                title={`Estimate #${estimate.estimateNumber} - ${estimate.status}`}
                            >
                                <FileText size={9} className="shrink-0 text-purple-600"/>
                                <span>#{estimate.estimateNumber}</span>
                            </button>
                        )}
                        {job && (() => {
                            const effectiveJobDate = getEffectiveJobScheduledDate(job);
                            return (
                                <span
                                    className="flex items-center gap-0.5 bg-emerald-50 text-emerald-800 px-1 rounded text-[9px] font-bold border border-emerald-200 text-left transition"
                                    title={`Job #${job.id}${effectiveJobDate ? ` - Scheduled: ${effectiveJobDate}` : ''}`}
                                >
                                    <CalendarCheck size={9} className="shrink-0 text-emerald-600"/>
                                    <span>Job #{job.id}</span>
                                    {effectiveJobDate && (
                                        <span className="text-emerald-900 font-mono ml-0.5">({new Date(effectiveJobDate.includes('T') ? effectiveJobDate : `${effectiveJobDate}T00:00:00`).toLocaleDateString('en-GB')})</span>
                                    )}
                                </span>
                            );
                        })()}
                        {!job && (() => {
                            const effectiveInquiryDate = getEffectiveInquiryScheduledDate(inquiry, job);
                            if (!effectiveInquiryDate) return null;
                            const formatted = new Date(effectiveInquiryDate.includes('T') ? effectiveInquiryDate : `${effectiveInquiryDate}T00:00:00`).toLocaleDateString('en-GB');
                            const isFirm = isScheduledJob || inquiry.status === 'Scheduled';
                            return (
                                <span
                                    className={`flex items-center gap-0.5 ${isFirm ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'} px-1 rounded text-[9px] font-bold border text-left transition`}
                                    title={`${isFirm ? 'Scheduled Date' : 'Expected Scheduled Date'}: ${effectiveInquiryDate}`}
                                >
                                    <CalendarCheck size={9} className={`shrink-0 ${isFirm ? 'text-purple-600' : 'text-indigo-600'}`}/>
                                    <span>{isFirm ? 'Sched:' : 'Exp:'} {formatted}</span>
                                </span>
                            );
                        })()}
                        {linkedPOs.map(po => {
                            const poStyles = getPoStatusStyles(po.status);
                            return (
                                <button
                                    key={po.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenPurchaseOrder?.(po);
                                    }}
                                    className={`flex items-center gap-0.5 ${poStyles.container} ${poStyles.text} px-1 rounded text-[9px] font-bold hover:opacity-80 hover:underline cursor-pointer border text-left transition`}
                                    title={`PO #${po.poNumber || po.id} - ${po.status}`}
                                >
                                    <PackageIcon size={9} className={`shrink-0 ${poStyles.icon}`}/>
                                    <span>{po.poNumber || po.id}</span>
                                </button>
                            );
                        })}
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
                    <div className={`${isExpanded ? 'flex' : 'hidden'} flex-wrap justify-end gap-1 mt-1 pt-1 border-t border-gray-100/50`} onClick={(e) => e.stopPropagation()}>
                        {onRunAgent && (
                            <button
                                type="button"
                                title="Run Concierge Agent"
                                disabled={isRunningAgent}
                                onClick={() => onRunAgent(inquiry)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[9px] font-bold transition disabled:opacity-50"
                            >
                                {isRunningAgent ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
                                <span>Agent</span>
                            </button>
                        )}
                        {displayEmail && onQuickReply && (inquiry.agentPlan?.draftReply || isStale72h(inquiry) || inquiry.hasNewReply) && (
                            <button
                                type="button"
                                title={isStale72h(inquiry) ? "Send 72h Follow-up & Move to Waiting" : "Review & Send AI Reply"}
                                onClick={() => onQuickReply(inquiry, isStale72h(inquiry) ? 'chase_72h' : 'ai_draft', displayEmail)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold transition ${isStale72h(inquiry) ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'}`}
                            >
                                <Mail size={9} />
                                <span>{isStale72h(inquiry) ? 'Chase 72h' : 'Send AI Reply'}</span>
                            </button>
                        )}
                        {isOnlineApprovedInquiry(inquiry, estimate) && estimate && !job && (
                            <button
                                type="button"
                                title="Book Approved Estimate into Workshop"
                                onClick={() => onInitiateBooking(estimate, inquiry.id)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-[9px] font-bold transition"
                            >
                                <CalendarCheck size={9} />
                                <span>Book Bay</span>
                            </button>
                        )}
                        {(!estimate && onConvert) && (
                            <button
                                type="button"
                                title="Create / Link Estimate"
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
            className={`${healthBgClass} rounded-lg shadow-sm p-4 border-l-4 ${
                inquiry.isUrgent ? 'border-red-600' :
                isOnlineApprovedInquiry(inquiry, estimate) ? 'border-emerald-500' :
                inquiry.status === 'Triage' || inquiry.status === 'Inbox' || inquiry.status === 'New Requests' ? 'border-sky-400' : 
                inquiry.status === 'Our Action' ? 'border-amber-400' : 
                inquiry.status === 'Scheduled' || isScheduledJob ? 'border-purple-600' : 
                inquiry.status === 'Waiting on Customer' ? (isStale72h(inquiry) ? 'border-red-500 text-red-800' : 'border-gray-300') : 
                'border-gray-200'
            } ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md' : ringClass} cursor-pointer transition-all mb-3 relative`}
            onClick={() => onOpenInquiryModal(inquiry)}
            title={cardExplanation}
        >
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-2">
                    {onToggleSelect && (
                        <input 
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                e.stopPropagation();
                                onToggleSelect(inquiry.id, e as any);
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 mt-1 shrink-0"
                            title="Select for bulk action"
                        />
                    )}
                    <div>
                        <h3 className="font-bold text-gray-800 text-base" title={displayName}>{displayName}</h3>
                        {contactInfoString && (
                            <p className="text-xs text-gray-500">{contactInfoString}</p>
                        )}
                        {displayAddress && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} className="shrink-0"/> {displayAddress}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-400 font-medium block">{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                    {inquiry.inquiryNumber && (
                        <span className="text-xs text-gray-600 font-bold block mt-0.5">{inquiry.inquiryNumber}</span>
                    )}
                    {showDaysBadge && (
                        <span className={`inline-block ${badgeColorClass} text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 leading-none shadow-sm`} title={`${daysSinceLastActivity} days since last action`}>
                            {daysSinceLastActivity}d
                        </span>
                    )}
                    {(() => {
                        const effectiveDate = getEffectiveInquiryScheduledDate(inquiry, job);
                        if (isScheduledJob || inquiry.status === 'Scheduled') {
                            const formatted = effectiveDate 
                                ? new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).toLocaleDateString('en-GB')
                                : null;
                            return (
                                <span className="mt-1 text-purple-900 font-bold text-xs inline-flex items-center gap-1 bg-purple-200/80 px-2 py-0.5 rounded border border-purple-300 shadow-2xs" title={effectiveDate ? `Scheduled Arrival: ${effectiveDate}` : 'Scheduled'}>
                                    <CalendarCheck size={12} className="shrink-0 text-purple-700" />
                                    <span>{formatted ? `Scheduled: ${formatted}` : 'Scheduled'}</span>
                                </span>
                            );
                        }
                        if (effectiveDate) {
                            const formatted = new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).toLocaleDateString('en-GB');
                            return (
                                <span className="mt-1 text-amber-900 font-bold text-xs inline-flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shadow-2xs" title={`Expected Scheduled Date: ${effectiveDate}`}>
                                    <CalendarCheck size={12} className="shrink-0 text-amber-700" />
                                    <span>Expected: {formatted}</span>
                                </span>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>

            {inquiry.expectedScheduledDate && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-900 bg-purple-50/80 border border-purple-200/80 px-2 py-1 rounded font-medium shadow-2xs">
                    <CalendarCheck size={13} className="text-purple-600 shrink-0" />
                    <span>Expected Scheduled Date: <strong className="font-bold text-purple-950 font-mono">{new Date(inquiry.expectedScheduledDate.includes('T') ? inquiry.expectedScheduledDate : `${inquiry.expectedScheduledDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                </div>
            )}

            {inquiry.followUpDate && (
                <div className={`mt-2 flex items-center gap-1 text-xs ${(isOverdue || isToday) ? 'text-red-600 font-bold' : 'text-blue-600'}`}>
                    <Calendar size={12} />
                    <span>Follow-up: {new Date(inquiry.followUpDate).toLocaleDateString()}</span>
                    {isOverdue && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold uppercase">Overdue</span>}
                    {isToday && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold uppercase">Today</span>}
                </div>
            )}

            {inquiry.subject && (
                <p className="text-xs font-semibold text-gray-800 mt-2">
                    <span className="text-gray-500 font-normal">Subject:</span> {inquiry.subject}
                </p>
            )}

            {(isOnlineApprovedInquiry(inquiry, estimate) || inquiry.hasNewReply || inquiry.actionStatus) && (
                <div className="mt-2 mb-1 flex flex-wrap gap-1.5">
                    {isOnlineApprovedInquiry(inquiry, estimate) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={12} /> Approved — Ready to Book
                        </span>
                    )}
                    {inquiry.hasNewReply && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            Customer Replied
                        </span>
                    )}
                    {inquiry.actionStatus && !isOnlineApprovedInquiry(inquiry, estimate) && (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getActionStatusStyles(inquiry.actionStatus)}`}>
                            {inquiry.actionStatus}
                        </span>
                    )}
                </div>
            )}

            {(inquiry.agentPlan || inquiry.aiNextStepSuggestion) && (
                <div className="mt-2 mb-1 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900 shadow-sm space-y-1">
                    <div className="flex items-start gap-1.5">
                        <Wand2 size={14} className="shrink-0 mt-0.5 text-purple-600" />
                        <span className="leading-snug font-medium">
                            <strong>Concierge Agent:</strong> {inquiry.agentPlan?.recommendedActionLabel || inquiry.aiNextStepSuggestion}
                        </span>
                    </div>
                    {inquiry.agentPlan?.suggestedPackageNames && inquiry.agentPlan.suggestedPackageNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-5">
                            {inquiry.agentPlan.suggestedPackageNames.map((pkg, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-white border border-purple-200 rounded text-[10px] font-bold text-purple-700">
                                    {pkg}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            <p className="text-sm text-gray-700 my-2 line-clamp-3 whitespace-pre-wrap leading-relaxed">{getCleanInquirySnippet(inquiry.message, 240)}</p>
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
                {customer && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer?.(customer.id);
                        }}
                        className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded hover:bg-green-100 hover:underline cursor-pointer border border-green-200/50 w-fit text-left transition font-semibold"
                        title={getCustomerDisplayName(customer)}
                    >
                        <UserCheck size={14} className="text-green-600 shrink-0"/>
                        <span>{getCustomerDisplayName(customer)}</span>
                    </button>
                )}
                
                {vehicle ? (() => {
                    const make = (vehicle.make && String(vehicle.make).toLowerCase() !== 'unknown') ? String(vehicle.make) : (inquiry.vehicleMake && String(inquiry.vehicleMake).toLowerCase() !== 'unknown' ? String(inquiry.vehicleMake) : '');
                    const model = (vehicle.model && String(vehicle.model).toLowerCase() !== 'unknown') ? String(vehicle.model) : (inquiry.vehicleModel && String(inquiry.vehicleModel).toLowerCase() !== 'unknown' ? String(inquiry.vehicleModel) : '');
                    const displaySpecs = make ? `(${make} ${model})`.trim() : '';
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewVehicle?.(vehicle.id);
                            }}
                            className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 hover:underline cursor-pointer border border-blue-200/50 w-fit text-left transition font-semibold font-mono"
                            title={`${vehicle.registration}${displaySpecs ? ` - ${displaySpecs}` : ''}`}
                        >
                            <Car size={14} className="text-blue-600 shrink-0"/>
                            <span>{vehicle.registration} {displaySpecs}</span>
                        </button>
                    );
                })() : effectiveReg ? (
                    <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 w-fit font-semibold font-mono" title={`Vehicle Registration: ${effectiveReg}`}>
                        <Car size={14} className="text-amber-600 shrink-0"/>
                        <span>{effectiveReg} {inquiry.vehicleMake && String(inquiry.vehicleMake).toLowerCase() !== 'unknown' ? `(${inquiry.vehicleMake} ${inquiry.vehicleModel && String(inquiry.vehicleModel).toLowerCase() !== 'unknown' ? inquiry.vehicleModel : ''})`.trim() : ''}</span>
                    </div>
                ) : null}
                
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

                {job && (() => {
                    const effectiveJobDate = getEffectiveJobScheduledDate(job);
                    return (
                        <div className="flex items-center justify-between p-2 bg-indigo-50/70 border border-indigo-200 rounded text-xs">
                            <div className="flex items-center gap-2 text-indigo-800 font-bold">
                                <CalendarCheck size={14} className="text-indigo-600 shrink-0"/>
                                <span>Job #{job.id}</span>
                                {job.status && (
                                    <span className="text-[10px] bg-white text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-semibold">
                                        {job.status}
                                    </span>
                                )}
                            </div>
                            {effectiveJobDate && (
                                <span className="text-[11px] text-indigo-700 font-bold flex items-center gap-1">
                                    <CalendarCheck size={12} className="text-indigo-600" />
                                    Scheduled: {new Date(effectiveJobDate.includes('T') ? effectiveJobDate : `${effectiveJobDate}T00:00:00`).toLocaleDateString('en-GB')}
                                </span>
                            )}
                        </div>
                    );
                })()}

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
                <div className="flex flex-wrap justify-end gap-1.5 mt-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    {onRunAgent && (
                        <button
                            type="button"
                            title="Run Concierge Agent"
                            disabled={isRunningAgent}
                            onClick={() => onRunAgent(inquiry)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition disabled:opacity-50"
                        >
                            {isRunningAgent ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                            <span>Agent</span>
                        </button>
                    )}
                    {displayEmail && onQuickReply && (inquiry.agentPlan?.draftReply || isStale72h(inquiry) || inquiry.hasNewReply) && (
                        <button
                            type="button"
                            title={isStale72h(inquiry) ? "Send 72h Follow-up & Move to Waiting" : "Review & Send AI Reply"}
                            onClick={() => onQuickReply(inquiry, isStale72h(inquiry) ? 'chase_72h' : 'ai_draft', displayEmail)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold transition ${isStale72h(inquiry) ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'}`}
                        >
                            <Mail size={12} />
                            <span>{isStale72h(inquiry) ? 'Chase 72h' : 'Send AI Reply'}</span>
                        </button>
                    )}
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
                    {(!job && onConvert) && (
                        <button
                            type="button"
                            title="Book New Job"
                            onClick={() => onConvert(inquiry, 'job')}
                            className="p-1.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                        >
                            <CalendarCheck size={14} className="shrink-0" />
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
    const { inquiries, setInquiries, customers, vehicles, estimates, setEstimates, purchaseOrders, jobs, servicePackages, forceRefresh } = useData();
    
    const normalizedInquiries = useMemo(() => {
        return (inquiries || []).map(i => {
            const linkedCustomer = i.linkedCustomerId ? customers.find(c => c.id === i.linkedCustomerId) : null;
            const linkedEstimate = (i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === i.id);
            const linkedJob = i.linkedJobId
                ? jobs.find(j => j.id === i.linkedJobId)
                : (jobs.find(j => (j as any).associatedInquiryId === i.id)
                    || (linkedEstimate?.jobId ? jobs.find(j => j.id === linkedEstimate.jobId) : null)
                    || (linkedEstimate ? jobs.find(j => j.estimateId === linkedEstimate.id) : null)
                    || (i.linkedEstimateId ? jobs.find(j => j.estimateId === i.linkedEstimateId) : null));

            const status = normalizeInquiryKanbanStage(i, linkedEstimate, linkedJob, linkedCustomer);

            // Effective Entity ID resolution:
            // Inquiry's own entityId or assignedToEntityId takes precedence; fallback to linked estimate's entityId if unset
            const entityId = i.entityId || i.assignedToEntityId || linkedEstimate?.entityId || 'ent_porsche';

            return { ...i, status, entityId };
        });
    }, [inquiries, customers, estimates, jobs]);

    const { selectedEntityId, users, currentUser, businessEntities: entities, setCurrentView } = useApp();

    const [hoveredInquiryId, setHoveredInquiryId] = useState<string | null>(null);
    const [inquiryToClose, setInquiryToClose] = useState<Inquiry | null>(null);
    const [inquiryToDelete, setInquiryToDelete] = useState<Inquiry | null>(null);
    const [assignedUserFilter, setAssignedUserFilter] = useState<string>('all');
    const [healthFilter, setHealthFilter] = useState<string>('all');
    const [syncStatus, setSyncStatus] = useState<{ status: 'success' | 'error', lastRunTime: string, errorMsg?: string } | null>(null);
    const [showDuplicateFinder, setShowDuplicateFinder] = useState(false);

    React.useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "brooks_settings", "email_sync_status"), (docSnap) => {
            if (docSnap.exists()) {
                setSyncStatus(docSnap.data() as any);
            }
        });
        return () => unsubscribe();
    }, []);

    // Automatically trigger email sync if not run in the last 5 minutes
    React.useEffect(() => {
        const lastRun = syncStatus?.lastRunTime ? new Date(syncStatus.lastRunTime).getTime() : 0;
        if (Date.now() - lastRun > 5 * 60 * 1000) {
            triggerEmailSync().catch(err => console.error("Auto email sync error:", err));
        }
    }, [syncStatus?.lastRunTime]);

    // Auto-fix missing inquiry numbers
    React.useEffect(() => {
        if (!inquiries || inquiries.length === 0) return;
        
        const missingNumbers = inquiries.filter(i => 
            !i.inquiryNumber || 
            i.inquiryNumber.trim() === '' || 
            i.inquiryNumber === 'null' || 
            i.inquiryNumber === 'undefined'
        );
        
        if (missingNumbers.length === 0) return;

        const runFixes = async () => {
            // Find current max number
            const yearSuffix = new Date().getFullYear().toString().slice(-2);
            const prefix = `INQ${yearSuffix}-`;
            const existingNumbers = inquiries
                .filter(i => i.inquiryNumber && i.inquiryNumber.includes('-') && i.inquiryNumber !== 'null' && i.inquiryNumber !== 'undefined')
                .map(i => {
                    const parts = i.inquiryNumber!.split('-');
                    return parseInt(parts[1], 10);
                })
                .filter(n => !isNaN(n));
            
            let maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
            
            let fixedCount = 0;
            // Fix each missing inquiry sequentially to avoid rate limits
            for (const inq of missingNumbers) {
                maxNumber++;
                const newNumber = `${prefix}${String(maxNumber).padStart(5, '0')}`;
                try {
                    await saveDocument('brooks_inquiries', { ...inq, inquiryNumber: newNumber });
                    console.log(`Auto-fixed inquiry ${inq.id} with new number ${newNumber}`);
                    fixedCount++;
                } catch (err) {
                    console.error("Failed to auto-fix inquiry number", err);
                }
            }
            
            if (fixedCount > 0) {
                toast.success(`Successfully assigned ID numbers to ${fixedCount} previously unnumbered inquiries!`);
            }
        };

        runFixes();
    }, [inquiries.length]); // Intentionally using .length to avoid infinite loops if saveDocument triggers a re-fetch

    // Auto-fix inquiries with "brookspeed" in forename/surname/fromName/email that are stuck in 'Waiting on Customer'
    React.useEffect(() => {
        if (!inquiries || inquiries.length === 0) return;

        const toFix = inquiries.filter(i => {
            const rawStatus = (i.status || '').trim();
            const isWaiting = rawStatus === 'Waiting on Customer' || rawStatus === 'Quoted or Responded' || rawStatus === 'Quoted' || rawStatus === 'Sent';
            if (!isWaiting) return false;

            const linkedCustomer = i.linkedCustomerId ? customers.find(c => c.id === i.linkedCustomerId) : null;
            return (
                (i.fromName || '').toLowerCase().includes('brookspeed') ||
                (i.fromEmail || '').toLowerCase().includes('brookspeed') ||
                (linkedCustomer?.forename || '').toLowerCase().includes('brookspeed') ||
                (linkedCustomer?.surname || '').toLowerCase().includes('brookspeed')
            );
        });

        if (toFix.length === 0) return;

        const runBrookspeedFix = async () => {
            let fixedCount = 0;
            for (const inq of toFix) {
                try {
                    const updated = { ...inq, status: 'New Requests' as Inquiry['status'] };
                    setInquiries(prev => prev.map(p => p.id === inq.id ? updated : p));
                    await saveDocument('brooks_inquiries', updated);
                    console.log(`Auto-fixed Brookspeed inquiry ${inq.id} status to New Requests`);
                    fixedCount++;
                } catch (err) {
                    console.error("Failed to auto-fix Brookspeed inquiry status", err);
                }
            }
            if (fixedCount > 0) {
                toast.success(`Updated ${fixedCount} Brookspeed inquiries to New Requests!`);
            }
        };

        runBrookspeedFix();
    }, [inquiries.length, customers.length]);

    const handleUnarchiveMB = async () => {
        try {
            const mbInquiries = inquiries.filter(i => 
                i.fromEmail?.toLowerCase().trim() === 'mb@brookspeed.com' && 
                i.status === 'Closed'
            );
            
            console.log("Found closed MB inquiries:", mbInquiries.length, mbInquiries);
            
            let count = 0;
            for (const inq of mbInquiries) {
                await updateDoc(doc(db, 'brooks_inquiries', inq.id), {
                    status: 'Inbox'
                });
                count++;
            }
            toast.success(`Un-archived ${count} inquiries! You can now delete the giant merged inquiry (INQ26-02143).`);
        } catch (e: any) {
            console.error(e);
            toast.error("Failed to un-archive: " + e.message);
        }
    };

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
                const newName = nameMatch[1].trim();
                if (inq.fromName !== newName) {
                    updates.fromName = newName;
                    updated = true;
                }
            } else {
                // If we can't find a name, at least rename it to Web Inquiry so it stops looping
                if (inq.fromName !== 'Web Inquiry (Unknown Name)') {
                    updates.fromName = 'Web Inquiry (Unknown Name)';
                    updated = true;
                }
            }

            // Parse Email
            const emailMatch = text.match(/(?:Email|E-mail)\s*[:\-]\s*([^\n\r ]+)/i) || text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
            if (emailMatch && emailMatch[1].trim()) {
                const newEmail = emailMatch[1].trim();
                if (inq.fromEmail !== newEmail) {
                    updates.fromEmail = newEmail;
                    updated = true;
                }
            }

            // Parse Phone
            const phoneMatch = text.match(/(?:Phone|Telephone|Tel|Mobile|Contact Number)\s*[:\-]\s*([^\n\r]+)/i);
            if (phoneMatch && phoneMatch[1].trim()) {
                const newPhone = phoneMatch[1].trim();
                if (inq.fromPhone !== newPhone) {
                    updates.fromPhone = newPhone;
                    updated = true;
                }
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
            const est = (i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === i.id) || null;
            if (i.status !== 'Closed' && (est || i.linkedJobId)) {
                let jobToUse = i.linkedJobId ? jobs.find(j => j.id === i.linkedJobId) : null;
                
                if (!jobToUse && est) {
                    if (est.jobId) {
                        jobToUse = jobs.find(j => j.id === est.jobId);
                    } else {
                        jobToUse = jobs.find(j => j.estimateId === est.id) || null;
                    }
                }

                if (jobToUse) {
                    // Close inquiry only if job is Invoiced or Cancelled. Leave it as Scheduled until then.
                    if (jobToUse.status === 'Invoiced' || jobToUse.status === 'Cancelled') {
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

    const handleUpdateStatus = async (inquiry: Inquiry, newStatus: Inquiry['status'], providedReason?: string) => {
        let closedReason = providedReason || inquiry.closedReason;
        if (newStatus === 'Closed' && inquiry.status !== 'Closed' && !providedReason) {
            setInquiryToClose(inquiry);
            return;
        }


        const updated: Inquiry = {
            ...inquiry,
            status: newStatus,
            closedReason,
            logs: [...(inquiry.logs || []), {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: 'System',
                actionType: 'Status Update',
                notes: `Status updated to ${newStatus} via fast action card button.` + (closedReason ? ` Reason: ${closedReason}` : '')
            }]
        };
        // Update local state immediately for visual responsiveness
        setInquiries(prev => prev.map(i => i.id === inquiry.id ? updated : i));
        // Persist to database in background
        try {
            await saveDocument('brooks_inquiries', updated);
            
            // TRIGGER CONCIERGE AGENT PLAN (updates structured agentPlan + aiNextStepSuggestion)
            const linkedEstimate = (updated.linkedEstimateId ? estimates.find(e => e.id === updated.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === updated.id);
            const linkedJob = updated.linkedJobId ? jobs.find(j => j.id === updated.linkedJobId) : null;
            import('../core/services/geminiService').then(({ generateInquiryAgentPlan }) => {
                generateInquiryAgentPlan(updated, {
                    hasCustomer: Boolean(updated.linkedCustomerId),
                    hasVehicle: Boolean(updated.linkedVehicleId || updated.vehicleRegistration),
                    estimateStatus: linkedEstimate?.status,
                    jobStatus: linkedJob?.status
                }).then(plan => {
                    const finalUpdated: Inquiry = {
                        ...updated,
                        agentPlan: plan,
                        aiNextStepSuggestion: plan.recommendedActionLabel,
                        vehicleRegistration: updated.vehicleRegistration || plan.extractedVrm || undefined
                    };
                    setInquiries(prev => prev.map(i => i.id === updated.id ? finalUpdated : i));
                    saveDocument('brooks_inquiries', finalUpdated).catch(err => console.error("Failed to save AI agent plan:", err));
                }).catch(err => console.error("Failed to generate AI agent plan:", err));
            });

            if (newStatus === 'Closed') {
                const linkedEstimate = estimates.find(e => e.linkedInquiryId === inquiry.id);
                if (linkedEstimate && linkedEstimate.status !== 'Closed') {
                    const closedEstimate = { ...linkedEstimate, status: 'Closed' as const };
                    setEstimates(prev => prev.map(e => e.id === closedEstimate.id ? closedEstimate : e));
                    await saveDocument('brooks_estimates', closedEstimate);
                }
            }
        } catch (e) {
            console.error("Failed to update inquiry status:", e);
        }
    };

    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
    const [viewLayout, setViewLayout] = useState<'kanban' | 'list'>('kanban');
    const [isCompact, setIsCompact] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | '7' | '30' | '90' | 'all'>('all');
    const [sortField, setSortField] = useState<'createdAt' | 'fromName' | 'registration' | 'status' | 'inquiryNumber' | 'scheduledDate'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
    const [targetBulkStatus, setTargetBulkStatus] = useState<Inquiry['status'] | ''>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printFilterMode, setPrintFilterMode] = useState<'all' | 'scheduled'>('all');
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
    const [quickReplyModal, setQuickReplyModal] = useState<{
        inquiry: Inquiry;
        to: string;
        subject: string;
        body: string;
        isSending: boolean;
    } | null>(null);

    const handleRunConciergeAgent = async (inquiry: Inquiry) => {
        setRunningAgentId(inquiry.id);
        try {
            const linkedEstimate = (inquiry.linkedEstimateId ? estimates.find(e => e.id === inquiry.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === inquiry.id);
            const linkedJob = inquiry.linkedJobId ? jobs.find(j => j.id === inquiry.linkedJobId) : null;
            const entityPackages = (servicePackages || [])
                .filter(p => !inquiry.entityId || p.entityId === inquiry.entityId)
                .map(p => p.name)
                .filter(Boolean);

            const { generateInquiryAgentPlan } = await import('../core/services/geminiService');
            const plan = await generateInquiryAgentPlan(inquiry, {
                availablePackageNames: entityPackages,
                hasCustomer: Boolean(inquiry.linkedCustomerId),
                hasVehicle: Boolean(inquiry.linkedVehicleId || inquiry.vehicleRegistration),
                estimateStatus: linkedEstimate?.status,
                jobStatus: linkedJob?.status
            });

            const updated: Inquiry = {
                ...inquiry,
                agentPlan: plan,
                aiNextStepSuggestion: plan.recommendedActionLabel,
                vehicleRegistration: inquiry.vehicleRegistration || plan.extractedVrm || undefined
            };
            setInquiries(prev => prev.map(i => i.id === inquiry.id ? updated : i));
            await saveDocument('brooks_inquiries', updated);
            toast.success('Concierge Agent updated plan');
        } catch (err: any) {
            console.error('Failed to run Concierge Agent:', err);
            toast.error(err?.message || 'Failed to run Concierge Agent');
        } finally {
            setRunningAgentId(null);
        }
    };

    const handleOpenQuickReply = (inquiry: Inquiry, mode: 'ai_draft' | 'chase_72h', targetEmail: string) => {
        const refNum = inquiry.inquiryNumber || inquiry.id;
        const firstName = (inquiry.fromName || 'Customer').split(' ')[0];
        const defaultChase = `Hi ${firstName},\n\nJust following up on your recent inquiry${inquiry.vehicleRegistration ? ` regarding ${inquiry.vehicleRegistration}` : ''} to see if you had any questions or would like us to get this booked in for you.\n\nKind regards,\nBrookspeed`;
        setQuickReplyModal({
            inquiry,
            to: targetEmail,
            subject: `Re: Your Inquiry [${refNum}]`,
            body: mode === 'chase_72h'
                ? (inquiry.agentPlan?.draftReply || defaultChase)
                : (inquiry.agentPlan?.draftReply || ''),
            isSending: false
        });
    };

    const handleSendQuickReply = async () => {
        if (!quickReplyModal || !quickReplyModal.body.trim()) return;
        const { inquiry, to, subject, body } = quickReplyModal;
        setQuickReplyModal(prev => prev ? { ...prev, isSending: true } : null);
        try {
            const success = await sendOutboundEmail({
                to,
                fromName: 'Brookspeed',
                fromEmail: 'info@brookspeed.com',
                subject,
                body
            });
            if (!success) {
                toast.error('Failed to send email.');
                setQuickReplyModal(prev => prev ? { ...prev, isSending: false } : null);
                return;
            }
            const newLog = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                actionType: 'Email Sent',
                notes: `To: ${to}\n\n${body}`
            };
            const updated: Inquiry = {
                ...inquiry,
                status: 'Waiting on Customer',
                actionStatus: 'Email Sent',
                hasNewReply: false,
                followUpDate: undefined,
                logs: [...(inquiry.logs || []), newLog]
            };
            setInquiries(prev => prev.map(i => i.id === inquiry.id ? updated : i));
            await saveDocument('brooks_inquiries', updated);
            setQuickReplyModal(null);
            toast.success('Reply sent & moved to Waiting on Customer');
        } catch (err: any) {
            console.error('Quick reply failed:', err);
            toast.error(err?.message || 'Failed to send email');
            setQuickReplyModal(prev => prev ? { ...prev, isSending: false } : null);
        }
    };

    const handleSyncEmails = async () => {
        setIsSyncing(true);
        try {
            const result = await triggerEmailSync();
            if (result.success) {
                toast.success(`Successfully synced ${result.processedCount} new email(s).`);
                await forceRefresh('brooks_inquiries' as any);
            } else {
                toast.error("Sync completed but returned an unexpected result.");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to sync emails.");
        } finally {
            setIsSyncing(false);
        }
    };

    const [isRethreading, setIsRethreading] = useState(false);

    const handleRethreadInquiries = async () => {
        setIsRethreading(true);
        try {
            const res = await fetch('https://europe-west1-intelligent-scheduling-v801.cloudfunctions.net/rethreadMisroutedInquiries', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(`Successfully re-threaded ${data.rethreadedCount} duplicate inquiry card(s).`);
                await forceRefresh('brooks_inquiries' as any);
            } else {
                toast.error(data.error || "Failed to re-thread duplicate inquiries.");
            }
        } catch (err: any) {
            toast.error(err.message || "Error running re-thread operation.");
        } finally {
            setIsRethreading(false);
        }
    };
    React.useEffect(() => {
        setSelectedInquiryIds([]);
    }, [activeTab, searchTerm, dateFilter, selectedEntityId, viewLayout, assignedUserFilter, healthFilter]);

    const handleBulkUpdateStatus = async (newStatus: Inquiry['status']) => {
        if (selectedInquiryIds.length === 0 || !newStatus) return;
        
        const updatedInquiries = displayInquiries.filter(i => selectedInquiryIds.includes(i.id)).map(i => ({
            ...i,
            status: newStatus,
            logs: [...(i.logs || []), {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: currentUser?.name || 'System',
                actionType: 'Status Update',
                notes: `Status updated to ${newStatus} via bulk action.`
            }]
        }));
        
        setInquiries(prev => prev.map(i => {
            const up = updatedInquiries.find(u => u.id === i.id);
            return up ? up : i;
        }));
        
        const promises = updatedInquiries.map(async (up) => {
            await saveDocument('brooks_inquiries', up);
            if (newStatus === 'Closed') {
                const linkedEstimate = estimates.find(e => e.linkedInquiryId === up.id);
                if (linkedEstimate && linkedEstimate.status !== 'Closed') {
                    const closedEstimate = { ...linkedEstimate, status: 'Closed' as const };
                    setEstimates(prev => prev.map(e => e.id === closedEstimate.id ? closedEstimate : e));
                    await saveDocument('brooks_estimates', closedEstimate);
                }
            }
        });
        try {
            await Promise.all(promises);
            toast.success(`Successfully updated status of ${updatedInquiries.length} inquiry card(s) to "${newStatus}".`);
        } catch (err) {
            console.error("Bulk update status failed:", err);
            toast.error("Failed to update status for some selected inquiries.");
        }
        
        setSelectedInquiryIds([]);
        setTargetBulkStatus('');
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

    const handleSort = (field: 'createdAt' | 'fromName' | 'registration' | 'status' | 'inquiryNumber' | 'scheduledDate') => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'scheduledDate' ? 'asc' : 'desc');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!inquiryToDelete) return;
        try {
            await deleteDocument('brooks_inquiries', inquiryToDelete.id);
            setInquiries(prev => prev.filter(i => i.id !== inquiryToDelete.id));
            toast.success("Inquiry deleted successfully");
        } catch (err) {
            toast.error("Failed to delete inquiry");
        }
        setInquiryToDelete(null);
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
        let filtered = normalizedInquiries.filter(i => {
            if (selectedEntityId === 'all') return true;
            const effectiveEntity = i.assignedToEntityId || i.entityId;
            return effectiveEntity === selectedEntityId || i.entityId === selectedEntityId || i.assignedToEntityId === selectedEntityId;
        });
        
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

        if (healthFilter !== 'all') {
            filtered = filtered.filter(i => {
                const est = (i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === i.id) || null;
                const jb = i.linkedJobId ? jobs.find(j => j.id === i.linkedJobId) : (est?.jobId ? jobs.find(j => j.id === est.jobId) : (est ? jobs.find(j => j.estimateId === est.id) : null));
                const isSched = isScheduledInquiry(i, jb);
                if (healthFilter === 'scheduled') return isSched;
                return getInquiryHealth(i, isSched) === healthFilter;
            });
        }

        if (searchTerm.trim()) {
            const low = searchTerm.toLowerCase();
            const cleanLow = low.replace(/\s/g, '');
            filtered = filtered.filter(i => {
                const vehicle = i.linkedVehicleId ? vehicles.find(v => v.id === i.linkedVehicleId) : null;
                const estimate = (i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === i.id) || null;
                const estimateVehicle = estimate?.vehicleId ? vehicles.find(v => v.id === estimate.vehicleId) : null;
                const reg = vehicle?.registration || i.vehicleRegistration || estimateVehicle?.registration || (estimate as any)?.vehicleRegistration || '';
                const cleanReg = reg.toLowerCase().replace(/\s/g, '');
                const linkedCust = i.linkedCustomerId ? customers.find(c => c.id === i.linkedCustomerId) : null;
                const custName = linkedCust ? `${linkedCust.forename || ''} ${linkedCust.surname || ''}`.toLowerCase() : '';
                const custEmail = (linkedCust?.email || '').toLowerCase();
                
                return (
                    i.fromName.toLowerCase().includes(low) || 
                    (i.fromEmail && i.fromEmail.toLowerCase().includes(low)) ||
                    (i.subject && i.subject.toLowerCase().includes(low)) ||
                    i.message.toLowerCase().includes(low) ||
                    (i.inquiryNumber && i.inquiryNumber.toLowerCase().includes(low)) ||
                    (cleanReg && cleanReg.includes(cleanLow)) ||
                    (custName && custName.includes(low)) ||
                    (custEmail && custEmail.includes(low))
                );
            });
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

        return filtered.sort((a,b) => {
            const aTime = getLatestActivityTime(a);
            const bTime = getLatestActivityTime(b);
            return bTime - aTime;
        });
    }, [normalizedInquiries, selectedEntityId, searchTerm, dateFilter, assignedUserFilter, healthFilter, currentUser.id, vehicles, estimates, customers]);

    const activeInquiries = useMemo(() => {
        const columns: { [key in CanonicalKanbanStage]: Inquiry[] } = {
            'Triage': [],
            'Our Action': [],
            'Waiting on Customer': [],
            'Scheduled': []
        };
        filteredInquiries.forEach(i => {
            if (i.status === 'Closed') return;
            const stage = (CANONICAL_KANBAN_STAGES.includes(i.status as CanonicalKanbanStage) ? i.status : 'Triage') as CanonicalKanbanStage;
            columns[stage].push(i);
        });

        // Float Online Approved and Customer Replied cards to the top of Our Action
        columns['Our Action'].sort((a, b) => {
            const aEst = (a.linkedEstimateId ? estimates.find(e => e.id === a.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === a.id);
            const bEst = (b.linkedEstimateId ? estimates.find(e => e.id === b.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === b.id);
            const aScore = (isOnlineApprovedInquiry(a, aEst) ? 2 : 0) + (a.hasNewReply ? 1 : 0);
            const bScore = (isOnlineApprovedInquiry(b, bEst) ? 2 : 0) + (b.hasNewReply ? 1 : 0);
            if (aScore !== bScore) return bScore - aScore;
            return getLatestActivityTime(b) - getLatestActivityTime(a);
        });

        return columns;
    }, [filteredInquiries, estimates]);

    const closedInquiries = useMemo(() => {
        return filteredInquiries.filter(i => {
            const s = (i.status || '').toLowerCase();
            return s === 'closed' || s === 'archived';
        }).sort((a,b) => getLatestActivityTime(b) - getLatestActivityTime(a));
    }, [filteredInquiries]);

    const displayInquiries = useMemo(() => {
        let list = filteredInquiries;
        if (activeTab === 'active') {
            list = list.filter(i => {
                const s = (i.status || '').toLowerCase();
                return s !== 'closed' && s !== 'archived';
            });
        } else {
            list = list.filter(i => {
                const s = (i.status || '').toLowerCase();
                return s === 'closed' || s === 'archived';
            });
        }
        
        const items = [...list];
        items.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            
            if (sortField === 'createdAt') {
                valA = getLatestActivityTime(a);
                valB = getLatestActivityTime(b);
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
                const getReg = (inq: Inquiry) => {
                    const v = inq.linkedVehicleId ? vehicles.find(veh => veh.id === inq.linkedVehicleId) : null;
                    const est = (inq.linkedEstimateId ? estimates.find(e => e.id === inq.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === inq.id) || null;
                    const estVeh = est?.vehicleId ? vehicles.find(veh => veh.id === est.vehicleId) : null;
                    return (v?.registration || inq.vehicleRegistration || estVeh?.registration || (est as any)?.vehicleRegistration || '').toLowerCase();
                };
                valA = getReg(a);
                valB = getReg(b);
            } else if (sortField === 'scheduledDate') {
                const getSchedDate = (inq: Inquiry) => {
                    const est = (inq.linkedEstimateId ? estimates.find(e => e.id === inq.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === inq.id) || null;
                    const jb = inq.linkedJobId 
                        ? jobs.find(j => j.id === inq.linkedJobId) 
                        : (jobs.find(j => (j as any).associatedInquiryId === inq.id)
                           || (est?.jobId ? jobs.find(j => j.id === est.jobId) : null)
                           || (est ? jobs.find(j => j.estimateId === est.id) : null)
                           || (inq.linkedEstimateId ? jobs.find(j => j.estimateId === inq.linkedEstimateId) : null));
                    const effectiveDate = getEffectiveInquiryScheduledDate(inq, jb);
                    if (effectiveDate) {
                        const t = new Date(effectiveDate.includes('T') ? effectiveDate : `${effectiveDate}T00:00:00`).getTime();
                        if (!isNaN(t)) return t;
                    }
                    return sortOrder === 'asc' ? 9999999999999 : 0;
                };
                valA = getSchedDate(a);
                valB = getSchedDate(b);
            }
            
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return items;
    }, [filteredInquiries, activeTab, sortField, sortOrder, vehicles, jobs]);

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex flex-col gap-4 mb-4 flex-shrink-0">
                {/* Top Row: Title, Tabs, and Action Buttons (Sync, Log Inquiry) */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
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
                        {viewLayout === 'list' && (
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
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentView('dispatch' as any)}
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition"
                            title="View Dispatch Board (Weekly / Monthly)"
                        >
                            <Calendar size={16} /> Capacity & Scheduling
                        </button>

                        <button 
                            onClick={handleBulkDelete} 
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-red-300 text-red-600 font-semibold rounded-lg shadow-sm hover:bg-red-50 transition disabled:opacity-50"
                            title="Bulk delete selected inquiries"
                            disabled={selectedInquiryIds.length === 0}
                        >
                            <Archive size={16} /> Bulk Action (Remove)
                        </button>

                        <button 
                            onClick={handleSyncEmails} 
                            disabled={isSyncing}
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
                            title="Manually trigger email sync from all configured mailboxes"
                        >
                            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Sync Emails
                        </button>

                        <button 
                            onClick={() => setShowMergeModal(true)} 
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-indigo-300 text-indigo-700 font-semibold rounded-lg shadow-sm hover:bg-indigo-50 transition"
                            title="Open interactive inquiry merge tool to choose Master and Secondary cards"
                        >
                            <Copy size={16} /> Merge Inquiries
                        </button>

                        <button 
                            onClick={() => setShowDuplicateFinder(true)} 
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition"
                            title="Find duplicate inquiries by Email, Name or Message content"
                        >
                            <Search size={16} /> Find Duplicates
                        </button>

                        <button 
                            onClick={handleRethreadInquiries} 
                            disabled={isRethreading}
                            className="flex items-center gap-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
                            title="Scan and automatically re-thread misrouted duplicate inquiry cards into their target parent inquiry"
                        >
                            {isRethreading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Auto Re-thread
                        </button>

                        <button onClick={() => props.onOpenInquiryModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                            <PlusCircle size={16}/> Log Inquiry
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Filters (Legend, dropdowns, toggles, search) */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Card Health Color Legend */}
                        <div className="flex items-center gap-3.5 text-xs bg-white px-3.5 py-1.5 rounded-lg border border-gray-200 shadow-xs text-gray-600 select-none">
                            <span className="font-semibold text-gray-400 mr-0.5">Card Status:</span>
                            <div className="flex items-center gap-1.5" title="Updated in the last 48 hours">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600 block shrink-0"></span>
                                <span className="font-medium text-gray-700">Active</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Job is scheduled / booked">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-purple-600 block shrink-0"></span>
                                <span className="font-medium text-gray-700">Scheduled</span>
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
                                value={healthFilter} 
                                onChange={e => setHealthFilter(e.target.value)}
                                className="bg-white border rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
                            >
                                <option value="all">All Card Health</option>
                                <option value="scheduled">Scheduled (Pale Purple)</option>
                                <option value="urgent">Urgent (Red Border)</option>
                                <option value="overdue">Overdue / Today</option>
                                <option value="responded">New Reply</option>
                                <option value="stale_quote">Stale Quote (&gt;72h)</option>
                                <option value="stale_activity">Stale Activity (&gt;48h)</option>
                                <option value="active">Recently Active (&lt;48h)</option>
                            </select>
                        </div>

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
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"/>
                        </div>

                        {/* View Layout Toggle (Kanban vs List) */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewLayout('kanban');
                                    setActiveTab('active');
                                }}
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
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border shadow-sm">
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

                        {/* Print Actions */}
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintFilterMode('all');
                                    setIsPrintModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                                title="Print currently filtered list of inquiries"
                            >
                                <Printer size={15} className="text-gray-600" />
                                <span>Print List</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintFilterMode('scheduled');
                                    setSortField('scheduledDate');
                                    setSortOrder('asc');
                                    setIsPrintModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                                title="Print only scheduled inquiries sorted by scheduled date"
                            >
                                <CalendarCheck size={15} className="text-emerald-600" />
                                <span>Print Scheduled</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Universal Bulk Actions Bar (Works in both Kanban & List view) */}
            {selectedInquiryIds.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-4 py-3 rounded-xl shadow-lg mb-4 flex flex-wrap items-center justify-between gap-3 border border-indigo-700 animate-in fade-in duration-200 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold bg-indigo-700/80 border border-indigo-500/50 px-3 py-1 rounded-lg font-mono">
                            {selectedInquiryIds.length} card{selectedInquiryIds.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                if (selectedInquiryIds.length === displayInquiries.length) {
                                    setSelectedInquiryIds([]);
                                } else {
                                    setSelectedInquiryIds(displayInquiries.map(i => i.id));
                                }
                            }}
                            className="text-xs text-indigo-200 hover:text-white font-semibold underline underline-offset-2 transition cursor-pointer"
                        >
                            {selectedInquiryIds.length === displayInquiries.length ? 'Deselect All' : `Select All Visible (${displayInquiries.length})`}
                        </button>
                        {selectedInquiryIds.length > 0 && selectedInquiryIds.length !== displayInquiries.length && (
                            <button
                                type="button"
                                onClick={() => setSelectedInquiryIds([])}
                                className="text-xs text-indigo-300 hover:text-white transition cursor-pointer"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Selector & Apply */}
                        <div className="flex items-center gap-1.5 bg-indigo-950/60 p-1 rounded-lg border border-indigo-700">
                            <span className="text-xs font-semibold text-indigo-200 pl-2">Set Status:</span>
                            <select
                                value={targetBulkStatus}
                                onChange={(e) => setTargetBulkStatus(e.target.value as Inquiry['status'])}
                                className="bg-indigo-900 border border-indigo-600 text-white text-xs font-bold rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                            >
                                <option value="">-- Choose Stage --</option>
                                <option value="Triage">Triage</option>
                                <option value="Our Action">Our Action</option>
                                <option value="Waiting on Customer">Waiting on Customer</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="Closed">Closed</option>
                            </select>
                            <button
                                type="button"
                                disabled={!targetBulkStatus}
                                onClick={() => handleBulkUpdateStatus(targetBulkStatus as Inquiry['status'])}
                                className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-bold text-xs rounded transition shadow-sm cursor-pointer"
                            >
                                Apply Status
                            </button>
                        </div>

                        {/* Quick Action Shortcuts */}
                        <button
                            type="button"
                            onClick={() => handleBulkUpdateStatus('Waiting on Customer')}
                            className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg border border-indigo-600 transition cursor-pointer"
                        >
                            To Waiting on Customer
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => handleBulkUpdateStatus('Closed')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                        >
                            Close Selected
                        </button>

                        {selectedInquiryIds.length >= 2 && (
                            <button
                                type="button"
                                onClick={() => setShowMergeModal(true)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                                <Copy size={13} />
                                Merge Selected
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {viewLayout === 'list' ? (
                <div className="flex-grow flex flex-col min-h-0">
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
                                                <span>Last Action</span>
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
                                            const estimate = (i.linkedEstimateId ? estimates.find(e => e.id === i.linkedEstimateId) : null) || estimates.find(e => e.linkedInquiryId === i.id) || null;
                                            const estVeh = estimate?.vehicleId ? vehicles.find(v => v.id === estimate.vehicleId) : null;
                                            const effectiveReg = vehicle?.registration || i.vehicleRegistration || estVeh?.registration || (estimate as any)?.vehicleRegistration || '';
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
                                                    {new Date(getLatestActivityTime(i)).toLocaleDateString()} {new Date(getLatestActivityTime(i)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                    {vehicle ? (() => {
                                                        const make = (vehicle.make && String(vehicle.make).toLowerCase() !== 'unknown') ? String(vehicle.make) : (i.vehicleMake && String(i.vehicleMake).toLowerCase() !== 'unknown' ? String(i.vehicleMake) : '');
                                                        const model = (vehicle.model && String(vehicle.model).toLowerCase() !== 'unknown') ? String(vehicle.model) : (i.vehicleModel && String(i.vehicleModel).toLowerCase() !== 'unknown' ? String(i.vehicleModel) : '');
                                                        const spec = make ? ` - ${make} ${model}`.trim() : '';
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    if (props.onViewVehicle) {
                                                                        e.stopPropagation();
                                                                        props.onViewVehicle(vehicle.id);
                                                                    }
                                                                }}
                                                                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border border-blue-200/50 cursor-pointer"
                                                                title={`${vehicle.registration}${spec}`}
                                                            >
                                                                <Car size={10} className="shrink-0" />
                                                                <span>{vehicle.registration}</span>
                                                            </button>
                                                        );
                                                    })() : effectiveReg ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono" title={`Vehicle Registration: ${effectiveReg}`}>
                                                            <Car size={10} className="shrink-0 text-amber-600" />
                                                            <span>{effectiveReg}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">-</span>
                                                    )}
                                                </td>
                                                {/* Status */}
                                                <td className="py-1.5 px-3 whitespace-nowrap">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                        i.status === 'Triage' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                                        i.status === 'Our Action' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        i.status === 'Scheduled' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                                        i.status === 'Waiting on Customer' ? (isStale72h(i) ? 'bg-red-50 text-red-800 border-red-500 ring-1 ring-red-400' : 'bg-purple-50 text-purple-700 border-purple-200') :
                                                        'bg-gray-100 text-gray-800 border-gray-300'
                                                    }`}
                                                    title={i.status === 'Closed' && i.closedReason ? `Reason: ${i.closedReason}` : undefined}
                                                    >
                                                        {i.status}
                                                    </span>
                                                </td>
                                                {/* Message */}
                                                <td className="py-1.5 px-3 text-xs text-gray-600 max-w-[320px] truncate" title={i.status === 'Closed' && i.closedReason ? `Closed Reason: ${i.closedReason}` : i.message}>
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {estimate && (
                                                            <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-[9px] font-bold shrink-0">
                                                                Est #{estimate.estimateNumber}
                                                            </span>
                                                        )}
                                                        {i.status === 'Closed' && i.closedReason ? (
                                                            <span className="truncate text-red-600 font-medium">Closed Reason: {i.closedReason}</span>
                                                        ) : (
                                                            <span className="truncate">{i.message.replace(/\s+/g, ' ')}</span>
                                                        )}
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
                                                        {i.status !== 'Closed' && (
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
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(i, 'Closed')}
                                                                    className="p-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition border border-green-200 shadow-sm"
                                                                    title="Close Inquiry"
                                                                >
                                                                    <CheckCircle2 size={10} />
                                                                </button>
                                                            </>
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
                        {CANONICAL_KANBAN_STAGES.map(status => {
                            const stageSubtitle =
                                status === 'Triage' ? 'Unreviewed & new leads' :
                                status === 'Our Action' ? "Ball in Brookspeed's court" :
                                status === 'Waiting on Customer' ? "Ball in customer's court" :
                                'Booked in workshop bay';
                            return (
                            <div 
                                key={status} 
                                className="flex-1 flex flex-col bg-gray-100 rounded-xl min-w-[290px] h-full transition-colors border-2 border-transparent"
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
                                    className={`p-3 border-b-2 ${
                                        status === 'Scheduled' ? 'border-purple-300 bg-purple-50/60 text-purple-950' :
                                        status === 'Our Action' ? 'border-amber-300 bg-amber-50/50 text-amber-950' :
                                        status === 'Triage' ? 'border-sky-300 bg-sky-50/50 text-sky-950' :
                                        'border-indigo-200 bg-white text-gray-800'
                                    } rounded-t-xl`}
                                    onMouseEnter={() => setHoveredInquiryId(null)}
                                >
                                    <div className="font-bold flex items-center justify-between">
                                        <span>{status}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 border border-gray-200 font-bold">{activeInquiries[status]?.length || 0}</span>
                                    </div>
                                    <p className="text-[10px] font-medium opacity-75 mt-0.5">{stageSubtitle}</p>
                                </div>
                                <div className="p-3 space-y-3 overflow-y-auto flex-grow">
                                    {(activeInquiries[status] || []).map(i => (
                                        <InquiryCard 
                                            key={i.id} 
                                            inquiry={i} 
                                            isSelected={selectedInquiryIds.includes(i.id)}
                                            onToggleSelect={(id, e) => {
                                                if (selectedInquiryIds.includes(id)) {
                                                    setSelectedInquiryIds(prev => prev.filter(x => x !== id));
                                                } else {
                                                    setSelectedInquiryIds(prev => [...prev, id]);
                                                }
                                            }}
                                            onOpenInquiryModal={(inq) => {
                                                setHoveredInquiryId(null);
                                                props.onOpenInquiryModal(inq);
                                            }}
                                            onInitiateMerge={handleInitiateMerge}
                                            onInitiateBooking={handleInitiateBooking}
                                            onViewEstimate={props.onViewEstimate}
                                            onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                            onViewCustomer={props.onViewCustomer}
                                            onViewVehicle={props.onViewVehicle}
                                            isCompact={isCompact}
                                            onUpdateStatus={handleUpdateStatus}
                                            onConvert={props.onConvert}
                                            draggable={true}
                                            isExpanded={hoveredInquiryId === i.id}
                                            onMouseEnter={() => setHoveredInquiryId(i.id)}
                                            onRunAgent={handleRunConciergeAgent}
                                            isRunningAgent={runningAgentId === i.id}
                                            onQuickReply={handleOpenQuickReply}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                        })}
                    </div>
                </main>
            ) : (
                <main className="flex-grow overflow-y-auto" onMouseLeave={() => setHoveredInquiryId(null)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {closedInquiries.map(i => (
                            <InquiryCard 
                                key={i.id} 
                                inquiry={i} 
                                isSelected={selectedInquiryIds.includes(i.id)}
                                onToggleSelect={(id, e) => {
                                    if (selectedInquiryIds.includes(id)) {
                                        setSelectedInquiryIds(prev => prev.filter(x => x !== id));
                                    } else {
                                        setSelectedInquiryIds(prev => [...prev, id]);
                                    }
                                }}
                                onOpenInquiryModal={(inq) => {
                                    setHoveredInquiryId(null);
                                    props.onOpenInquiryModal(inq);
                                }}
                                onInitiateMerge={handleInitiateMerge}
                                onInitiateBooking={handleInitiateBooking}
                                onViewEstimate={props.onViewEstimate}
                                onOpenPurchaseOrder={props.onOpenPurchaseOrder}
                                onViewCustomer={props.onViewCustomer}
                                onViewVehicle={props.onViewVehicle}
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
                isOpen={!!inquiryToDelete}
                onClose={() => setInquiryToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Inquiry"
                message={`Are you sure you want to delete this inquiry? This action cannot be undone.`}
                type="warning"
            />

            <DuplicateInquiriesModal
                isOpen={showDuplicateFinder}
                onClose={() => setShowDuplicateFinder(false)}
                activeInquiries={(inquiries || []).filter(i => {
                    const s = (i.status || '').toLowerCase();
                    const isEntityMatch = selectedEntityId === 'all' || i.entityId === selectedEntityId || i.assignedToEntityId === selectedEntityId;
                    return s !== 'closed' && s !== 'archived' && isEntityMatch;
                })}
                onViewInquiry={props.onOpenInquiryModal}
            />

            <InquiryMergeModal
                isOpen={showMergeModal}
                onClose={() => setShowMergeModal(false)}
                inquiries={(inquiries || []).filter(i => {
                    const s = (i.status || '').toLowerCase();
                    const isEntityMatch = selectedEntityId === 'all' || i.entityId === selectedEntityId || i.assignedToEntityId === selectedEntityId;
                    return s !== 'closed' && s !== 'archived' && isEntityMatch;
                })}
                customers={customers || []}
                vehicles={vehicles || []}
                preselectedInquiryIds={selectedInquiryIds}
                onRefresh={async () => {
                    await forceRefresh('brooks_inquiries' as any);
                    setSelectedInquiryIds([]);
                }}
            />

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

            {inquiryToClose && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Close Inquiry</h2>
                        <p className="text-sm text-gray-600 mb-4">Please select a reason for closing this inquiry.</p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason for Closing</label>
                            <select 
                                id="closeReasonSelect"
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="Lost to Competitor">Lost to Competitor</option>
                                <option value="Too Expensive">Too Expensive</option>
                                <option value="No Response / Ghosted">No Response / Ghosted</option>
                                <option value="Project Cancelled / Changed Mind">Project Cancelled / Changed Mind</option>
                                <option value="Duplicate Inquiry">Duplicate Inquiry</option>
                                <option value="Spam / Invalid">Spam / Invalid</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setInquiryToClose(null)}
                                className="px-4 py-2 border rounded font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    const select = document.getElementById('closeReasonSelect') as HTMLSelectElement;
                                    handleUpdateStatus(inquiryToClose, 'Closed', select.value);
                                    setInquiryToClose(null);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded font-medium shadow-sm hover:bg-red-700"
                            >
                                Close Inquiry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {quickReplyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !quickReplyModal.isSending && setQuickReplyModal(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Wand2 size={15} className="text-purple-600" />
                                Quick Send AI Reply & Move to Waiting
                            </h3>
                            <button
                                type="button"
                                disabled={quickReplyModal.isSending}
                                onClick={() => setQuickReplyModal(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="text-xs text-gray-600">
                            <span className="font-bold">To:</span> {quickReplyModal.to}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Subject</label>
                            <input
                                type="text"
                                value={quickReplyModal.subject}
                                onChange={(e) => setQuickReplyModal(prev => prev ? { ...prev, subject: e.target.value } : null)}
                                className="w-full p-2 border border-gray-300 rounded text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Reply Body</label>
                            <textarea
                                rows={8}
                                value={quickReplyModal.body}
                                onChange={(e) => setQuickReplyModal(prev => prev ? { ...prev, body: e.target.value } : null)}
                                className="w-full p-2 border border-gray-300 rounded text-xs"
                                placeholder="Edit the AI-drafted reply before sending..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <button
                                type="button"
                                disabled={quickReplyModal.isSending}
                                onClick={() => setQuickReplyModal(null)}
                                className="px-3 py-1.5 border rounded text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={quickReplyModal.isSending || !quickReplyModal.body.trim()}
                                onClick={handleSendQuickReply}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50"
                            >
                                {quickReplyModal.isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                <span>Send & Move to Waiting</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPrintModalOpen && (
                <PrintableInquiryList
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    inquiries={displayInquiries}
                    vehicles={vehicles}
                    customers={customers}
                    estimates={estimates}
                    users={users}
                    entities={entities}
                    jobs={jobs}
                    initialFilter={printFilterMode}
                    title={`${activeTab === 'active' ? 'Active' : 'Closed'} Inquiries (${dateFilter === 'today' ? 'Today' : dateFilter === 'all' ? 'All Time' : `${dateFilter} Days`})`}
                />
            )}
        </div>
    );
};

export default InquiriesView;
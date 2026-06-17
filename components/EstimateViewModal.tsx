import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { toast } from 'react-toastify';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate, BusinessEntity, Part, User, ServicePackage } from '../types';
import { 
    X, CheckSquare, Mail, Loader2, Printer, CheckCircle, 
    MessageSquare, Monitor, Image as ImageIcon, Gauge, AlertTriangle, 
    ChevronLeft, ChevronRight, AlertCircle, CalendarCheck, Package,
    ArrowRight, Calendar, Edit, FileText, Volume2, VolumeX
} from 'lucide-react';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import { prepareTextForSpeech, findBestVoice } from '../core/utils/speechUtils';
import EmailEstimateModal from './EmailEstimateModal';
import { sendOutboundEmail } from '../core/services/emailService';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, getRelativeDate, dateStringToDate, addDays, getNextWorkingDay, formatReadableDate } from '../core/utils/dateUtils';
import { usePrint } from '../core/hooks/usePrint';
import { useData } from '../core/state/DataContext';
import { BookingCalendarView } from './BookingCalendarView';
import { getDisplayDate } from './estimates/EstimateShared';
import { PrintableEstimate } from './estimates/PrintableEstimate';
import { CustomerServicePackage, SelectableEstimateItemRow } from './estimates/CustomerViewComponents';
import AsyncImage from './AsyncImage';

interface EstimateViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    entityDetails?: BusinessEntity;
    onApprove: (estimate: Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => void;
    onCustomerApprove?: (estimate: Estimate, selectedOptionalItemIds: string[], dateRange: { start: string, end: string }, notes: string) => void;
    onDecline?: (estimate: Estimate) => void;
    onEmailSuccess: (estimate: Estimate) => void;
    viewMode?: 'internal' | 'customer';
    parts: Part[];
    users: User[];
    currentUser: User;
    onCreateInquiry?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void;
    onEdit?: (estimate: Estimate) => void;
}

const EstimateViewModal: React.FC<EstimateViewModalProps> = ({ 
    isOpen, 
    onClose, 
    estimate, 
    customer, 
    vehicle, 
    taxRates, 
    servicePackages,
    entityDetails, 
    onApprove, 
    onCustomerApprove, 
    onDecline, 
    onEmailSuccess, 
    viewMode = 'internal', 
    parts, 
    users, 
    currentUser, 
    onCreateInquiry,
    onScheduleEstimate,
    onEdit
}) => {
    const { jobs, businessEntities, vehicles, customers, absenceRequests } = useData();
    const [isEmailing, setIsEmailing] = useState(false);
    const [localViewMode, setLocalViewMode] = useState<'internal' | 'customer'>(viewMode);
    
    const [selectedOptionalItems, setSelectedOptionalItems] = useState<Set<string>>(new Set());
    const [isApproving, setIsApproving] = useState(false);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [approvalDate, setApprovalDate] = useState(formatDate(new Date()));
    
    const [currentMonthDate, setCurrentMonthDate] = useState(() => dateStringToDate(formatDate(new Date())));
    const print = usePrint();
    const mainRef = useRef<HTMLDivElement>(null);
    
    const isSubmitting = useRef(false);
    
    const [isConfirmingApproval, setIsConfirmingApproval] = useState(false);
    const [preferredStartDate, setPreferredStartDate] = useState(formatDate(new Date()));
    const [preferredEndDate, setPreferredEndDate] = useState(formatDate(new Date()));
    const [customerNotes, setCustomerNotes] = useState('');
    const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 840) {
                const targetWidth = width - 32;
                setPreviewZoom(targetWidth / 794);
            } else {
                setPreviewZoom(0.9);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen]);

    const isCustomerMode = localViewMode === 'customer';
    const isSupplementary = !!estimate.jobId;
    const isAlreadyApproved = estimate.status === 'Approved';

    useEffect(() => {
        if (!isOpen) return;
        
        setIsSpeaking(false);
        const initialSelection = new Set<string>();
        const seenGroups = new Set<string>();
        
        // CUSTOMER REQUEST: Assume all items are clicked by default
        (estimate.lineItems || []).forEach(item => {
            if (item.isOptional) {
                if (!item.optionGroupId) {
                    initialSelection.add(item.id);
                } else if (!seenGroups.has(item.optionGroupId)) {
                    // Pre-select the first occurrence in an option group (Default option)
                    initialSelection.add(item.id);
                    seenGroups.add(item.optionGroupId);
                }
            }
        });
        setSelectedOptionalItems(initialSelection);

        return () => {
            cloudSpeechSynthesis.cancel();
        };
    }, [isOpen, estimate.id]);

    useEffect(() => {
        if (isConfirmingApproval && mainRef.current) {
            setTimeout(() => {
                mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    }, [isConfirmingApproval]);

    const isInteractive = isCustomerMode 
        ? (!['Converted to Job', 'Closed', 'Declined', 'Approved'].includes(estimate.status))
        : (estimate.status === 'Draft' || estimate.status === 'Sent');

    const handleToggleSpeakNotes = () => {
        if (isSpeaking) {
            cloudSpeechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            if (!estimate.notes?.trim()) return;
            const plainText = prepareTextForSpeech(estimate.notes);
            const utterance = new CloudSpeechSynthesisUtterance(plainText);
            
            const voices = cloudSpeechSynthesis.getVoices();
            const preferredVoice = findBestVoice(voices);
            utterance.voice = preferredVoice;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            cloudSpeechSynthesis.speak(utterance);
        }
    };

    const canViewPricing = useMemo(() => {
        if (isCustomerMode) return true;
        if (!currentUser) return false;
        return !['Engineer'].includes(currentUser.role);
    }, [currentUser, isCustomerMode]);

    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    const t99RateId = useMemo(() => taxRates.find(t => t.code === 'T99')?.id, [taxRates]);

    const laborHours = useMemo(() => {
        return (estimate.lineItems || [])
            .filter(item => (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR') && !item.isOptional)
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }, [estimate.lineItems]);

    const projectedLaborHours = useMemo(() => {
        return (estimate.lineItems || [])
            .filter(item => (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR'))
            .filter(item => !item.isOptional || selectedOptionalItems.has(item.id))
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }, [estimate.lineItems, selectedOptionalItems]);

    const resolvedEntity = useMemo(() => {
        if (entityDetails) return entityDetails;
        if (estimate.entityId) {
            const found = businessEntities.find(e => e.id === estimate.entityId);
            if (found) return found;
        }
        return businessEntities[0];
    }, [entityDetails, estimate.entityId, businessEntities]);

    const absencesByDate = useMemo(() => {
        const map = new Map<string, number>();
        absenceRequests.forEach(req => {
            if (req.status === 'Approved' || req.status === 'Pending') {
                 let currentDate = dateStringToDate(req.startDate);
                 const endDate = dateStringToDate(req.endDate);
                 while(currentDate <= endDate) {
                    const dateStr = formatDate(currentDate);
                    map.set(dateStr, (map.get(dateStr) || 0) + 8);
                    currentDate = addDays(currentDate, 1);
                 }
            }
        });
        return map;
    }, [absenceRequests]);

    const manualApprovalCapacity = useMemo(() => {
        if (!approvalDate || !resolvedEntity) return null;
        const entityJobs = jobs.filter(j => j.entityId === estimate.entityId);
        const allocatedHours = entityJobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === approvalDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);

        const absenceHours = absencesByDate.get(approvalDate) || 0;
        const maxHours = resolvedEntity.dailyCapacityHours || 0;
        const effectiveCapacity = Math.max(0, maxHours - absenceHours);

        // Account for job splitting: only calculate the load this specific date would take
        // If the job starts on this day, how many hours does it take ON THIS DAY?
        // Let's assume the user is checking the START day capacity.
        const durationOnThisDay = Math.min(projectedLaborHours, 8); // Simplification: assume 8h segments
        const newTotalLoad = allocatedHours + durationOnThisDay;
        const loadPercentage = effectiveCapacity > 0 ? newTotalLoad / effectiveCapacity : (newTotalLoad > 0 ? 1.1 : 0);
        const remainingHours = effectiveCapacity - newTotalLoad;

        let statusColor = 'bg-green-100 border-green-200 text-green-800';
        if (remainingHours < 0) {
            statusColor = 'bg-red-100 border-red-200 text-red-800';
        } else if (loadPercentage > 0.8) {
            statusColor = 'bg-amber-100 border-amber-200 text-amber-800';
        }

        return {
            allocated: allocatedHours,
            max: maxHours,
            absence: absenceHours,
            effective: effectiveCapacity,
            remaining: remainingHours,
            statusColor,
            isOverCapacity: remainingHours < 0
        };
    }, [approvalDate, jobs, resolvedEntity, estimate.entityId, projectedLaborHours, absencesByDate]);

    const capacityOnStartDate = useMemo(() => {
        if (!preferredStartDate || !resolvedEntity) return null;
        const entityJobs = jobs.filter(j => j.entityId === estimate.entityId);
        const allocatedHours = entityJobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === preferredStartDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);

        const absenceHours = absencesByDate.get(preferredStartDate) || 0;
        const maxCapacity = resolvedEntity.dailyCapacityHours || 40;
        const effectiveCapacity = Math.max(0, maxCapacity - absenceHours);
        const remainingHours = effectiveCapacity - allocatedHours;

        // The hours required on the first day is min(projectedLaborHours, 8)
        const hoursRequiredFirstDay = Math.min(projectedLaborHours, 8);
        const isOverCapacity = remainingHours < hoursRequiredFirstDay;

        return {
            allocatedHours,
            effectiveCapacity,
            remainingHours,
            hoursRequiredFirstDay,
            isOverCapacity
        };
    }, [preferredStartDate, jobs, resolvedEntity, estimate.entityId, projectedLaborHours, absencesByDate]);

    const handleMonthChange = (offset: number) => {
        setCurrentMonthDate(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };

    const minBookingDate = useMemo(() => getRelativeDate(3), []);

    useEffect(() => {
        if (isConfirmingApproval && preferredStartDate) {
            if (preferredStartDate < minBookingDate) {
                setPreferredStartDate(minBookingDate);
                if (preferredEndDate < minBookingDate) {
                    setPreferredEndDate(minBookingDate);
                }
            }
            
            // Calculate load based on job splitting across a potential sequence
            const maxCapacity = resolvedEntity?.dailyCapacityHours || 40;
            let currentDay = preferredStartDate;
            let remainingHours = projectedLaborHours;
            let maxDailyLoad = 0;

            // Check up to 5 days to find the peak load created by this job
            for (let i = 0; i < 5 && remainingHours > 0; i++) {
                const dailyHours = jobs
                    .flatMap(job => job.segments || [])
                    .filter(segment => segment.date === currentDay && segment.status !== 'Unallocated')
                    .reduce((sum, segment) => sum + segment.duration, 0);

                const hoursForThisDay = Math.min(remainingHours, 8);
                const totalProjectedHours = dailyHours + hoursForThisDay;
                const loadPercentage = maxCapacity > 0 ? totalProjectedHours / maxCapacity : 0;
                
                if (loadPercentage > maxDailyLoad) {
                    maxDailyLoad = loadPercentage;
                }

                remainingHours -= hoursForThisDay;
                currentDay = getNextWorkingDay(currentDay);
            }

            if (maxDailyLoad > 0.85) {
                setCapacityWarning('This date range is very busy. We will do our best to accommodate your request or offer an alternative date upon confirmation.');
            } else if (maxDailyLoad > 0.6) {
                setCapacityWarning('This is a high-demand period. We will do our best to accommodate your request.');
            } else {
                setCapacityWarning(null);
            }
        } else {
            setCapacityWarning(null);
        }
    }, [preferredStartDate, isConfirmingApproval, jobs, resolvedEntity, projectedLaborHours, minBookingDate, preferredEndDate]);

    const memoizedItemsAndTotals = useMemo(() => {
        const allItems = estimate.lineItems || [];
        const essentials: EstimateLineItem[] = [];
        const optionals: EstimateLineItem[] = [];

        allItems.forEach(item => {
            if (item.isOptional) optionals.push(item);
            else essentials.push(item);
        });

        const breakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));

        (allItems || []).forEach(item => {
            if (item.isOptional && !selectedOptionalItems.has(item.id)) return;
            if (item.isPackageComponent) return;

            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            const itemNet = qty * price;

            if (item.taxCodeId === t99RateId) {
                if (!breakdown[t99RateId]) {
                    breakdown[t99RateId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' };
                }
                breakdown[t99RateId].net += itemNet;
                breakdown[t99RateId].vat += (item.preCalculatedVat || 0) * qty;
            } else {
                const effectiveTaxId = item.taxCodeId || standardTaxRateId;
                if (!effectiveTaxId) return;

                const taxRate = taxRatesMap.get(effectiveTaxId);
                if (!taxRate) return;

                if (!breakdown[effectiveTaxId]) {
                    breakdown[effectiveTaxId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }

                breakdown[effectiveTaxId].net += itemNet;
                if (taxRate.rate > 0) {
                    breakdown[effectiveTaxId].vat += itemNet * (taxRate.rate / 100);
                }
            }
        });

        const finalVatBreakdown = Object.values(breakdown);
        const totalNet = finalVatBreakdown.reduce((sum, b) => sum + b.net, 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const grandTotal = totalNet + totalVat;

        const totals = { totalNet, grandTotal, vatBreakdown: finalVatBreakdown.filter(b => b.net > 0 || b.vat > 0) };
        
        return { essentialItems: essentials, optionalItems: optionals, dynamicTotals: totals };

    }, [estimate.lineItems, selectedOptionalItems, taxRates, standardTaxRateId, t99RateId]);

    const { essentialItems, optionalItems, dynamicTotals } = memoizedItemsAndTotals;

    const handleToggleOptional = (itemId: string) => {
        if (!isInteractive && !isApproving) return;
        
        const toggledItem = (estimate.lineItems || []).find(i => i.id === itemId);
        
        setSelectedOptionalItems(prev => {
            const newSet = new Set(prev);
            
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                // If this is part of a mutual option group (e.g. Option 1 vs 2),
                // deselect any other items currently active in that same group.
                if (toggledItem?.optionGroupId) {
                    (estimate.lineItems || []).forEach(item => {
                        if (item.isOptional && item.optionGroupId === toggledItem.optionGroupId && item.id !== itemId) {
                            newSet.delete(item.id);
                        }
                    });
                }
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handlePrint = (asInternal = false) => {
         const approvedEstimateForPdf: Estimate = { ...estimate, lineItems: estimate.lineItems };
         print(
            <PrintableEstimate 
                estimate={approvedEstimateForPdf} 
                customer={customer}
                vehicle={vehicle}
                entityDetails={resolvedEntity}
                taxRates={taxRates}
                parts={parts}
                canViewPricing={canViewPricing}
                totals={dynamicTotals}
            />
        );
    };

    const handleEmailSuccess = async (recipients: string, subject: string, body: string) => {
        try {
            await sendOutboundEmail({
                to: recipients,
                fromName: resolvedEntity?.name || 'Brookspeed',
                fromEmail: resolvedEntity?.email || 'info@brookspeed.com',
                subject: subject,
                body: body
            });
            onEmailSuccess({ ...estimate, status: 'Sent' });
            setIsEmailing(false);
            onClose(); // Close the modal back to the estimate list
        } catch (error: any) {
            toast.error(`Failed to send email: ${error.message}`);
        }
    };

    const handleSubmitApproval = () => {
        if (isSubmitting.current) return;
        isSubmitting.current = true;

        if (onCustomerApprove) {
            const dateRange = { start: preferredStartDate, end: preferredEndDate };
            onCustomerApprove(
                estimate,
                Array.from(selectedOptionalItems),
                dateRange,
                customerNotes
            );
            onClose();
        }
    };

    const handleApproveNextAvailable = () => {
        if (isSubmitting.current) return;
        isSubmitting.current = true;

        if (onCustomerApprove) {
            onCustomerApprove(
                estimate,
                Array.from(selectedOptionalItems),
                { start: 'next-available', end: 'next-available' },
                customerNotes || 'Customer requested the next available workshop slot.'
            );
            onClose();
        }
    };

    const handleStartDateChange = (newStartDate: string) => {
        setPreferredStartDate(newStartDate);
        if (newStartDate > preferredEndDate) {
            setPreferredEndDate(newStartDate);
        }
    };

    const groupItems = (items: EstimateLineItem[]) => {
        const packages: { header: EstimateLineItem, children: EstimateLineItem[] }[] = [];
        const labor: EstimateLineItem[] = [];
        const partsItems: EstimateLineItem[] = [];
        
        const topLevelItems = items.filter(i => !i.isPackageComponent);
        const allChildren = items.filter(i => i.isPackageComponent);

        topLevelItems.forEach(item => {
            if (item.servicePackageId) {
                packages.push({ header: item, children: allChildren.filter(c => c.servicePackageId === item.servicePackageId) });
            } else if (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || item.partNumber === 'MOT') {
                labor.push(item);
            } else {
                partsItems.push(item);
            }
        });
        return { packages, labor, parts: partsItems };
    };

    const essentialGroups = useMemo(() => groupItems(essentialItems), [essentialItems]);
    const optionalGroups = useMemo(() => groupItems(optionalItems), [optionalItems]);

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <header className="flex-shrink-0 flex justify-between items-center p-3 sm:p-4 border-b bg-gray-50 rounded-t-xl">
                        <div>
                            <h2 className="text-base sm:text-xl font-bold text-gray-800">Estimate #{estimate.estimateNumber}</h2>
                             {isCustomerMode ? (
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                                    <span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Customer View</span>
                                    <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">Interactive Approval Mode</p>
                                </div>
                             ) : (
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                                        PDF Version
                                    </span>
                                    <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">
                                        Printable Estimate
                                    </p>
                                </div>
                             )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <button onClick={() => setLocalViewMode(isCustomerMode ? 'internal' : 'customer')} className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isCustomerMode ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                {isCustomerMode ? (
                                    <>
                                        <Printer size={14}/>
                                        <span className="hidden lg:inline">Switch to PDF Preview</span>
                                        <span className="inline lg:hidden">PDF View</span>
                                    </>
                                ) : (
                                    <>
                                        <Monitor size={14}/>
                                        <span className="hidden lg:inline">Switch to Interactive View</span>
                                        <span className="inline lg:hidden">Interactive</span>
                                    </>
                                )}
                            </button>
                            <button onClick={onClose} className="p-1"><X size={20} className="text-gray-400 hover:text-gray-600 sm:w-6 sm:h-6" /></button>
                        </div>
                    </header>

                    <main ref={mainRef} className="flex-grow overflow-y-auto p-4 bg-gray-100">
                        {isCustomerMode ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6 max-w-3xl mx-auto">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-6">
                                    <div>
                                        <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900">{resolvedEntity?.name || 'Brookspeed'}</h1>
                                        <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{resolvedEntity?.addressLine1}, {resolvedEntity?.postcode}</p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <h2 className="text-base sm:text-xl font-semibold text-gray-800">{isSupplementary ? 'Supplementary ' : ''}Estimate</h2>
                                        <p className="text-sm sm:text-lg font-mono text-indigo-600">#{estimate.estimateNumber}</p>
                                        <p className="text-xs sm:text-sm text-gray-500">{getDisplayDate(estimate.issueDate)}</p>
                                    </div>
                                </div>

                                {estimate.media && estimate.media.length > 0 && (
                                    <div className="bg-white p-4 rounded-xl border-2 border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                            <ImageIcon size={20} className="text-indigo-600"/> Technician Report & Media
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {estimate.media.map(m => (
                                                <div key={m.id} className="space-y-1">
                                                    <div className="rounded-lg overflow-hidden border bg-gray-100 h-32 flex items-center justify-center relative group">
                                                        <AsyncImage imageId={m.id} className="w-full h-full object-cover" />
                                                    </div>
                                                    {m.notes && <p className="text-xs text-gray-600 italic bg-gray-50 p-1 rounded">{m.notes}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {estimate.notes && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                <FileText size={16} className="text-indigo-600"/> Estimate Notes & Instructions
                                            </h3>
                                            <button
                                                onClick={handleToggleSpeakNotes}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                                                    isSpeaking 
                                                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                }`}
                                                title={isSpeaking ? "Stop Speaking" : "Read Notes"}
                                            >
                                                {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                                {isSpeaking ? "Stop" : "Listen"}
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {estimate.notes}
                                        </div>
                                    </div>
                                )}

                                {essentialItems.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-100 flex items-center gap-2">
                                            <CheckCircle size={20} className="text-green-600"/> Essential Work
                                        </h3>
                                        <div className="space-y-4">
                                            {essentialGroups.packages.map(pkg => (
                                                <CustomerServicePackage key={pkg.header.id} header={pkg.header} childrenItems={pkg.children} isSelected={true} onToggle={() => {}} canViewPricing={canViewPricing} isInteractive={false}/>
                                            ))}
                                            
                                            {essentialGroups.labor.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Labour</h4>
                                                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                                        {essentialGroups.labor.map(item => (
                                                            <SelectableEstimateItemRow key={item.id} item={item} isSelected={false} onToggle={() => {}} canInteract={false} canViewPricing={canViewPricing} isOptional={false}/>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {essentialGroups.parts.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Parts & Materials</h4>
                                                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                                        {essentialGroups.parts.map(item => (
                                                            <SelectableEstimateItemRow key={item.id} item={item} isSelected={false} onToggle={() => {}} canInteract={false} canViewPricing={canViewPricing} isOptional={false}/>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {optionalItems.length > 0 && (
                                    <div className="bg-indigo-50 p-5 rounded-xl border-2 border-indigo-100">
                                        <h3 className="text-lg font-bold text-indigo-900 mb-2 border-b border-indigo-200 pb-2 flex items-center gap-2">
                                            <CheckSquare size={20}/> {isSupplementary ? 'Required / Recommended Work' : 'Optional Upgrades & Recommendations'}
                                        </h3>
                                        <p className="text-sm text-indigo-700 mb-4 bg-white/60 p-2 rounded">
                                            Select the items you would like to include in the job. The total will update automatically.
                                        </p>
                                        <div className="space-y-4">
                                             {optionalGroups.packages.map(pkg => (
                                                <CustomerServicePackage key={pkg.header.id} header={pkg.header} childrenItems={pkg.children} isSelected={selectedOptionalItems.has(pkg.header.id)} onToggle={() => handleToggleOptional(pkg.header.id)} canViewPricing={canViewPricing} isInteractive={isInteractive || isApproving}/>
                                            ))}
                                             {optionalGroups.labor.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Labour Recommendations</h4>
                                                    <div className="border-2 border-indigo-200/50 rounded-lg overflow-hidden bg-indigo-50/30 shadow-sm">
                                                        {optionalGroups.labor.map(item => (
                                                            <SelectableEstimateItemRow key={item.id} item={item} isSelected={selectedOptionalItems.has(item.id)} onToggle={() => handleToggleOptional(item.id)} canInteract={isInteractive || isApproving} canViewPricing={canViewPricing} isOptional={true}/>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {optionalGroups.parts.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Part Recommendations</h4>
                                                    <div className="border-2 border-amber-200/50 rounded-lg overflow-hidden bg-amber-50/30 shadow-sm">
                                                        {optionalGroups.parts.map(item => (
                                                            <SelectableEstimateItemRow key={item.id} item={item} isSelected={selectedOptionalItems.has(item.id)} onToggle={() => handleToggleOptional(item.id)} canInteract={isInteractive || isApproving} canViewPricing={canViewPricing} isOptional={true}/>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-6 border-t-2 border-gray-100">
                                    <div className="w-72 bg-gray-50 p-4 rounded-lg">
                                        <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatCurrency(dynamicTotals.totalNet)}</span></div>
                                        {dynamicTotals.vatBreakdown.map((b: any) => (<div key={b.name} className="flex justify-between text-sm text-gray-500 mb-1"><span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span><span>{formatCurrency(b.vat)}</span></div>))}
                                        <div className="flex justify-between font-bold text-xl mt-3 pt-3 border-t border-gray-200 text-indigo-900"><span>Total</span><span>{formatCurrency(dynamicTotals.grandTotal)}</span></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-center w-full overflow-hidden p-2 sm:p-4">
                                <div 
                                    className="bg-white shadow-lg origin-top"
                                    style={{
                                        zoom: previewZoom,
                                        width: '210mm',
                                        minWidth: '210mm'
                                    }}
                                >
                                    <PrintableEstimate estimate={{...estimate, lineItems: estimate.lineItems}} customer={customer} vehicle={vehicle} entityDetails={resolvedEntity} taxRates={taxRates} parts={parts} canViewPricing={canViewPricing} totals={dynamicTotals}/>
                                </div>
                            </div>
                        )}

                        {isCustomerMode && isConfirmingApproval && (
                            <div className="mt-6 p-6 bg-white border-2 border-green-500 rounded-xl shadow-lg animate-fade-in-up max-w-2xl mx-auto">
                                <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">
                                    {isSupplementary ? <CheckCircle size={24} /> : <CalendarCheck size={24} />}
                                    {isSupplementary ? 'Confirm Approval' : 'Request Booking'}
                                </h3>

                                    <>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Please select a range of dates. We will check our workshop availability and confirm the first available date closest to your preference. A minimum of 3 days lead time is required for parts ordering.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Preferred Start Date</label>
                                                <input 
                                                    type="date" 
                                                    value={preferredStartDate} 
                                                    min={minBookingDate} 
                                                    onChange={(e) => handleStartDateChange(e.target.value)} 
                                                    className={`w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 outline-none ${
                                                        capacityOnStartDate?.isOverCapacity 
                                                            ? 'border-red-400 ring-red-200 bg-red-50 focus:ring-red-500' 
                                                            : capacityWarning 
                                                                ? 'border-orange-400 ring-orange-200 bg-orange-50 focus:ring-orange-500' 
                                                                : 'border-gray-300 focus:ring-green-500'
                                                    }`} 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Preferred End Date</label>
                                                <input 
                                                    type="date" 
                                                    value={preferredEndDate} 
                                                    min={preferredStartDate} 
                                                    onChange={(e) => setPreferredEndDate(e.target.value)} 
                                                    className={`w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 outline-none ${
                                                        capacityOnStartDate?.isOverCapacity 
                                                            ? 'border-red-400 ring-red-200 bg-red-50 focus:ring-red-500' 
                                                            : capacityWarning 
                                                                ? 'border-orange-400 ring-orange-200 bg-orange-50 focus:ring-orange-500' 
                                                                : 'border-gray-300 focus:ring-green-500'
                                                    }`} 
                                                />
                                            </div>
                                        </div>
                                        {capacityOnStartDate?.isOverCapacity ? (
                                            <div className="p-3 bg-red-100 text-red-800 text-sm rounded-lg border border-red-200 mb-4 animate-fade-in">
                                                <p className="font-semibold flex items-center gap-2"><AlertCircle size={16}/> Date Fully Booked</p>
                                                <p className="mt-1">
                                                    We do not have enough workshop hours available on {formatReadableDate(preferredStartDate)} to accommodate this work (requires {capacityOnStartDate.hoursRequiredFirstDay} hrs, only {Math.max(0, capacityOnStartDate.remainingHours).toFixed(1)} hrs available). 
                                                    Please choose a different start date, or click <strong>"Approve & Request Next Available Slot"</strong> to let us allocate the next open slot for you.
                                                </p>
                                            </div>
                                        ) : capacityWarning ? (
                                            <div className="p-3 bg-orange-100 text-orange-800 text-sm rounded-lg border border-orange-200 mb-4 animate-fade-in">
                                                <p className="font-semibold flex items-center gap-2"><AlertCircle size={16}/> High Demand Date</p>
                                                <p className="mt-1">{capacityWarning}</p>
                                            </div>
                                        ) : null}
                                    </>
                                
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{isSupplementary ? 'Notes for Technician (Optional)' : 'Notes / Special Requests'}</label>
                                    <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" placeholder={isSupplementary ? "e.g., Please proceed with the work." : "Any specific requirements or questions..."}/>
                                </div>

                                <div className="flex justify-between items-center flex-wrap gap-3">
                                    <button onClick={() => setIsConfirmingApproval(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition">Back</button>
                                    <div className="flex gap-3 flex-wrap">
                                        <button 
                                            onClick={handleApproveNextAvailable} 
                                            className="px-5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 transition"
                                        >
                                            Request Next Available Slot instead
                                        </button>
                                        <button 
                                            onClick={handleSubmitApproval} 
                                            disabled={!!capacityOnStartDate?.isOverCapacity} 
                                            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-lg shadow-md transition transform ${
                                                capacityOnStartDate?.isOverCapacity 
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed transform-none' 
                                                    : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
                                            }`}
                                        >
                                            {isSupplementary ? 'Confirm Approval' : 'Submit Booking Request'}
                                        </button>
                                    </div>
                                </div>
                           </div>
                        )}
                    </main>
                    
                    <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10">
                        {!isCustomerMode ? (
                            <>
                                <div className="flex gap-2">
                                    {viewMode !== 'customer' && currentUser.role !== 'Engineer' && (
                                        <button onClick={() => setIsEmailing(true)} className="flex items-center py-2 px-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition"><Mail size={16} className="mr-2"/> Email Link</button>
                                    )}
                                    <button onClick={() => handlePrint()} className="flex items-center py-2 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">
                                        <Printer size={16} className="mr-2"/> Print Estimate
                                    </button>
                                </div>
                    
                                {viewMode !== 'customer' && (
                                    <div className="flex gap-2">
                                        {onCreateInquiry && <button onClick={() => onCreateInquiry(estimate)} className="flex items-center py-2 px-4 bg-purple-100 text-purple-700 font-semibold rounded-lg hover:bg-purple-200 transition"><MessageSquare size={16} className="mr-2"/> Raise Inquiry</button>}
                                        {onEdit && (
                                            <button onClick={() => { onEdit(estimate); onClose(); }} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-md transition">
                                                <Edit size={16} className="mr-2"/> Edit Estimate
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => { 
                                                if (!estimate.vehicleId) {
                                                    toast.warning("This estimate does not have a vehicle registration. Please edit the estimate to add vehicle details before scheduling it as a job.");
                                                    return;
                                                }
                                                onScheduleEstimate?.(estimate); 
                                                onClose(); 
                                            }} 
                                            className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md transition"
                                        >
                                            <CalendarCheck size={16} className="mr-2"/> Schedule Job
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full flex justify-between items-center flex-wrap gap-4">
                                <div className="text-xs text-gray-500">* This total is an estimate and subject to final inspection.</div>
                                {!isConfirmingApproval && isInteractive && (
                                     <div className="flex gap-3 flex-wrap">
                                         {onDecline && (
                                             <button 
                                                 onClick={() => onDecline(estimate)} 
                                                 className="px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition"
                                             >
                                                 Decline Estimate
                                             </button>
                                         )}
                                         <button 
                                             onClick={handleApproveNextAvailable} 
                                             className="flex items-center py-2.5 px-4 sm:px-6 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 transition transform hover:-translate-y-0.5 animate-fade-in text-xs sm:text-sm"
                                         >
                                             <CheckSquare size={18} className="mr-2 flex-shrink-0"/>
                                             <span>
                                                 <span className="hidden lg:inline">{isSupplementary ? 'Approve & Next Available' : 'Approve & Request Next Available Slot'}</span>
                                                 <span className="inline lg:hidden">{isSupplementary ? 'Approve & Next Available' : 'Approve (Fastest)'}</span>
                                             </span>
                                         </button>
                                         <button 
                                             onClick={() => setIsConfirmingApproval(true)} 
                                             className="flex items-center py-2.5 px-4 sm:px-6 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 transition transform hover:-translate-y-0.5 animate-fade-in text-xs sm:text-sm"
                                         >
                                             <Calendar size={18} className="mr-2 flex-shrink-0"/>
                                             <span>
                                                 <span className="hidden lg:inline">{isSupplementary ? 'Approve & Select Dates' : 'Approve & Choose Preferred Dates'}</span>
                                                 <span className="inline lg:hidden">Approve & Choose Dates</span>
                                             </span>
                                         </button>
                                     </div>
                                 )}
                            </div>
                        )}
                    </footer>
                </div>
            </div>
            {isEmailing && <EmailEstimateModal isOpen={isEmailing} onClose={() => setIsEmailing(false)} onSend={handleEmailSuccess} onViewAsCustomer={() => { setIsEmailing(false); setLocalViewMode('customer'); }} estimate={estimate} customer={customer} vehicle={vehicle} taxRates={taxRates}/>}
        </>
    );
};

export default EstimateViewModal;

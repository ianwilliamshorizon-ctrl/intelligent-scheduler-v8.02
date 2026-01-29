
import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate, BusinessEntity, Part, User, Job } from '../types';
import { X, CheckSquare, Mail, Download, Loader2, CalendarCheck, Printer, CheckCircle, MessageSquare, Monitor, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import EmailEstimateModal from './EmailEstimateModal';
import { formatCurrency } from '../utils/formatUtils';
import { useApp } from '../core/state/AppContext';
import { formatDate, getRelativeDate, dateStringToDate, addDays, formatReadableDate } from '../core/utils/dateUtils';
import { usePrint } from '../core/hooks/usePrint';
import { useData } from '../core/state/DataContext';
import { BookingCalendarView } from './BookingCalendarView';
import { getDisplayDate } from './estimates/EstimateShared';
import { PrintableEstimate } from './estimates/PrintableEstimate';
import { CustomerServicePackage, SelectableEstimateItemRow } from './estimates/CustomerViewComponents';

interface EstimateViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    taxRates: TaxRate[];
    entityDetails?: BusinessEntity;
    onApprove: (estimate: Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => void;
    onCustomerApprove?: (estimate: Estimate, selectedOptionalItemIds: string[], dateRange: { start: string, end: string }, notes: string) => void;
    onDecline?: (estimate: Estimate) => void;
    onEmailSuccess: (estimate: Estimate) => void;
    onViewAsCustomer?: () => void;
    viewMode?: 'internal' | 'customer';
    parts: Part[];
    users: User[];
    currentUser: User;
    onCreateInquiry?: (estimate: Estimate) => void;
}

export const EstimateViewModal: React.FC<EstimateViewModalProps> = ({ isOpen, onClose, estimate, customer, vehicle, taxRates, entityDetails, onApprove, onCustomerApprove, onDecline, onEmailSuccess, onViewAsCustomer, viewMode = 'internal', parts, users, currentUser, onCreateInquiry }) => {
    const { jobs, businessEntities, vehicles, customers, absenceRequests } = useData();
    const [isEmailing, setIsEmailing] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [localViewMode, setLocalViewMode] = useState<'internal' | 'customer'>(viewMode);
    
    // Track optional items selected
    const [selectedOptionalItems, setSelectedOptionalItems] = useState<Set<string>>(new Set());
    const [isApproving, setIsApproving] = useState(false);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [approvalDate, setApprovalDate] = useState(formatDate(new Date())); // Default to today
    const [currentMonthDate, setCurrentMonthDate] = useState(() => dateStringToDate(formatDate(new Date())));

    const print = usePrint();
    const mainRef = useRef<HTMLDivElement>(null);
    
    // Customer Approval State
    const [isConfirmingApproval, setIsConfirmingApproval] = useState(false);
    const [preferredStartDate, setPreferredStartDate] = useState(formatDate(new Date()));
    const [preferredEndDate, setPreferredEndDate] = useState(formatDate(new Date()));
    const [customerNotes, setCustomerNotes] = useState('');
    const [capacityWarning, setCapacityWarning] = useState<string | null>(null);

    const isCustomerMode = localViewMode === 'customer';
    
    // Auto-scroll when confirmation starts
    useEffect(() => {
        if (isConfirmingApproval && mainRef.current) {
            setTimeout(() => {
                mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    }, [isConfirmingApproval]);
    
    const isInteractive = isCustomerMode 
        ? (!['Converted to Job', 'Closed', 'Declined'].includes(estimate.status))
        : (estimate.status === 'Draft' || estimate.status === 'Sent');
    
    const isSupplementary = !!estimate.jobId;

    const canViewPricing = useMemo(() => {
        if (isCustomerMode) return true;
        if (!currentUser) return false;
        return !['Engineer'].includes(currentUser.role);
    }, [currentUser, isCustomerMode]);

    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    const laborHours = useMemo(() => {
        return (estimate.lineItems || [])
            .filter(item => item.isLabor && !item.isOptional)
            .reduce((sum, item) => sum + item.quantity, 0);
    }, [estimate.lineItems]);

    const projectedLaborHours = useMemo(() => {
        return (estimate.lineItems || [])
            .filter(item => item.isLabor)
            .filter(item => !item.isOptional || selectedOptionalItems.has(item.id))
            .reduce((sum, item) => sum + item.quantity, 0);
    }, [estimate.lineItems, selectedOptionalItems]);
    
    const resolvedEntity = useMemo(() => {
        if (entityDetails) return entityDetails;
        if (estimate.entityId) {
            return businessEntities.find(e => e.id === estimate.entityId);
        }
        return undefined;
    }, [entityDetails, estimate.entityId, businessEntities]);

    // Calculate capacity for manual approval date
    const manualApprovalCapacity = useMemo(() => {
        if (!approvalDate || !resolvedEntity) return null;

        const entityJobs = jobs.filter(j => j.entityId === estimate.entityId);
        
        const allocatedHours = entityJobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === approvalDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);

        const maxHours = resolvedEntity.dailyCapacityHours || 0;
        const remainingHours = Math.max(0, maxHours - allocatedHours);
        const isOverCapacity = (allocatedHours + projectedLaborHours) > maxHours;

        return {
            allocated: allocatedHours,
            max: maxHours,
            remaining: remainingHours,
            isOverCapacity
        };
    }, [approvalDate, jobs, resolvedEntity, estimate.entityId, projectedLaborHours]);

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

    const entityJobs = useMemo(() => {
        const targetEntityId = estimate.entityId;
        return jobs.filter(j => j.entityId === targetEntityId);
    }, [jobs, estimate.entityId]);
    
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
            
            const dailyHours = jobs
                .flatMap(job => job.segments || [])
                .filter(segment => segment.date === preferredStartDate && segment.status !== 'Unallocated')
                .reduce((sum, segment) => sum + segment.duration, 0);

            const maxCapacity = resolvedEntity?.dailyCapacityHours || 40;
            const totalProjectedHours = dailyHours + laborHours;
            const loadPercentage = maxCapacity > 0 ? totalProjectedHours / maxCapacity : 0;

            if (loadPercentage > 0.5) {
                setCapacityWarning('This is a high-demand day. We will do our best to accommodate your request or offer an alternative date upon confirmation.');
            } else {
                setCapacityWarning(null);
            }
        } else {
            setCapacityWarning(null);
        }
    }, [preferredStartDate, isConfirmingApproval, jobs, resolvedEntity, laborHours, minBookingDate, preferredEndDate]);

    // Unified memo for calculating items and totals
    const { essentialItems, optionalItems, dynamicTotals } = useMemo(() => {
        const allItems = estimate.lineItems || [];
        const essentials: EstimateLineItem[] = [];
        const optionals: EstimateLineItem[] = [];
        
        allItems.forEach(item => {
            if (item.isOptional) optionals.push(item);
            else essentials.push(item);
        });
        
        const itemsToTotal = [
            ...essentials.filter(item => !item.isPackageComponent),
            ...optionals.filter(item => {
                if (item.isPackageComponent) return false;
                return selectedOptionalItems.has(item.id);
            })
        ];
        
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        let totalNet = 0;

        itemsToTotal.forEach(item => {
            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            totalNet += itemNet;
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRateInfo = taxRates.find(t => t.id === taxCodeId);
            if (taxRateInfo && taxRateInfo.rate > 0) {
                if (!breakdown[taxCodeId]) {
                    breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRateInfo.rate, name: taxRateInfo.name };
                }
                breakdown[taxCodeId].net += itemNet;
                breakdown[taxCodeId].vat += itemNet * (taxRateInfo.rate / 100);
            }
        });

        const finalVatBreakdown = Object.values(breakdown);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        const totals = { totalNet, grandTotal: totalNet + totalVat, vatBreakdown: finalVatBreakdown };
        
        return { essentialItems: essentials, optionalItems: optionals, dynamicTotals: totals };
    }, [estimate.lineItems, selectedOptionalItems, taxRates, standardTaxRateId]);

    const handleToggleOptional = (itemId: string) => {
        if (!isInteractive && !isApproving) return;
        
        setSelectedOptionalItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
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
                isInternal={asInternal}
                canViewPricing={canViewPricing}
                totals={dynamicTotals}
            />
        );
    };

    const handleDownloadPdf = async (internal: boolean) => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const approvedEstimateForPdf: Estimate = { ...estimate, lineItems: estimate.lineItems };

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableEstimate 
                    estimate={approvedEstimateForPdf} 
                    customer={customer}
                    vehicle={vehicle}
                    entityDetails={resolvedEntity}
                    taxRates={taxRates}
                    parts={parts}
                    isInternal={internal}
                    canViewPricing={canViewPricing}
                    totals={dynamicTotals}
                />
            </React.StrictMode>
        );
        
        await new Promise(resolve => setTimeout(resolve, 800));
    
        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasHeightOnPdf = pdfWidth * (canvas.height / canvas.width);
            let heightLeft = canvasHeightOnPdf;
            let position = 0;
            
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Estimate-${estimate.estimateNumber}${internal ? '-INTERNAL' : ''}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Try using the 'Print' button and saving as PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };
    
    const handleEmailSuccess = () => {
        onEmailSuccess({ ...estimate, status: 'Sent' });
        setIsEmailing(false);
    };
    
    const handleSubmitApproval = () => {
        if (onCustomerApprove) {
            onCustomerApprove(
                estimate,
                Array.from(selectedOptionalItems),
                isSupplementary ? { start: '', end: '' } : { start: preferredStartDate, end: preferredEndDate },
                customerNotes
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
        const standalone: EstimateLineItem[] = [];
        const headers = items.filter(i => i.servicePackageId && !i.isPackageComponent);
        const children = items.filter(i => i.isPackageComponent);
        
        headers.forEach(header => {
            packages.push({ header, children: children.filter(c => c.servicePackageId === header.servicePackageId) });
        });
        
        items.forEach(item => {
            if (!item.servicePackageId) standalone.push(item);
        });
        return { packages, standalone };
    };

    const essentialGroups = useMemo(() => groupItems(essentialItems), [essentialItems]);
    const optionalGroups = useMemo(() => groupItems(optionalItems), [optionalItems]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Estimate #{estimate.estimateNumber}</h2>
                             {isCustomerMode ? (
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Customer View</span>
                                    <p className="text-xs text-gray-500">Interactive Approval Mode</p>
                                 </div>
                             ) : (
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Internal Preview</span>
                                    <p className="text-xs text-gray-500">Staff View (Print Preview)</p>
                                 </div>
                             )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-gray-200 rounded-lg p-1">
                                <button onClick={() => setLocalViewMode('internal')} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${localViewMode === 'internal' ? 'bg-white shadow text-gray-800' : 'text-gray-600 hover:text-gray-800'}`}>Internal</button>
                                <button onClick={() => setLocalViewMode('customer')} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1 ${localViewMode === 'customer' ? 'bg-indigo-600 shadow text-white' : 'text-gray-600 hover:text-gray-800'}`}><Monitor size={14}/> Customer</button>
                            </div>
                            <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                    </header>

                    <main ref={mainRef} className="flex-grow overflow-y-auto p-4 bg-gray-100">
                        {isCustomerMode ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6 max-w-3xl mx-auto">
                                <div className="flex justify-between items-start border-b pb-6">
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-gray-900">{resolvedEntity?.name || 'Brookspeed'}</h1>
                                        <p className="text-sm text-gray-600 mt-1">{resolvedEntity?.addressLine1}, {resolvedEntity?.postcode}</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-semibold text-gray-800">Estimate</h2>
                                        <p className="text-lg font-mono text-indigo-600">#{estimate.estimateNumber}</p>
                                        <p className="text-sm text-gray-500">{getDisplayDate(estimate.issueDate)}</p>
                                    </div>
                                </div>

                                {essentialItems.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-100 flex items-center gap-2">
                                            <CheckCircle size={20} className="text-green-600"/> Essential Work
                                        </h3>
                                        <div className="space-y-3">
                                            {essentialGroups.packages.map(pkg => (
                                                <CustomerServicePackage key={pkg.header.id} header={pkg.header} childrenItems={pkg.children} isSelected={true} onToggle={() => {}} canViewPricing={canViewPricing} isInteractive={false}/>
                                            ))}
                                            {essentialGroups.standalone.length > 0 && (
                                                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                                    {essentialGroups.standalone.map(item => (
                                                        <SelectableEstimateItemRow key={item.id} item={item} isSelected={false} onToggle={() => {}} canInteract={false} canViewPricing={canViewPricing} isOptional={false}/>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {optionalItems.length > 0 && (
                                    <div className="bg-indigo-50 p-5 rounded-xl border-2 border-indigo-100">
                                        <h3 className="text-lg font-bold text-indigo-900 mb-2 border-b border-indigo-200 pb-2 flex items-center gap-2">
                                            <CheckSquare size={20}/> Optional Upgrades & Recommendations
                                        </h3>
                                        <p className="text-sm text-indigo-700 mb-4 bg-white/60 p-2 rounded">
                                            Select the items you would like to include in the job. The total will update automatically.
                                        </p>
                                        <div className="space-y-4">
                                             {optionalGroups.packages.map(pkg => (
                                                <CustomerServicePackage key={pkg.header.id} header={pkg.header} childrenItems={pkg.children} isSelected={selectedOptionalItems.has(pkg.header.id)} onToggle={() => handleToggleOptional(pkg.header.id)} canViewPricing={canViewPricing} isInteractive={isInteractive || isApproving}/>
                                            ))}
                                            {optionalGroups.standalone.length > 0 && (
                                                <div className="border border-indigo-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                                     {optionalGroups.standalone.map(item => (
                                                        <SelectableEstimateItemRow key={item.id} item={item} isSelected={selectedOptionalItems.has(item.id)} onToggle={() => handleToggleOptional(item.id)} canInteract={isInteractive || isApproving} canViewPricing={canViewPricing} isOptional={true}/>
                                                     ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-6 border-t-2 border-gray-100">
                                    <div className="w-72 bg-gray-50 p-4 rounded-lg">
                                        <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatCurrency(dynamicTotals.totalNet)}</span></div>
                                        {dynamicTotals.vatBreakdown.map((b: any) => (<div key={b.name} className="flex justify-between text-sm text-gray-500 mb-1"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                                        <div className="flex justify-between font-bold text-xl mt-3 pt-3 border-t border-gray-200 text-indigo-900"><span>Total</span><span>{formatCurrency(dynamicTotals.grandTotal)}</span></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <div className="bg-white shadow-lg scale-90 origin-top">
                                    <PrintableEstimate estimate={{...estimate, lineItems: estimate.lineItems}} customer={customer} vehicle={vehicle} entityDetails={resolvedEntity} taxRates={taxRates} parts={parts} isInternal={false} canViewPricing={canViewPricing} totals={dynamicTotals}/>
                                </div>
                            </div>
                        )}

                        {isCustomerMode && isConfirmingApproval && (
                            <div className="mt-6 p-6 bg-white border-2 border-green-500 rounded-xl shadow-lg animate-fade-in-up max-w-2xl mx-auto">
                                <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">
                                    {isSupplementary ? <CheckCircle size={24} /> : <CalendarCheck size={24} />}
                                    {isSupplementary ? 'Confirm Approval' : 'Request Booking'}
                                </h3>

                                {!isSupplementary && (
                                    <>
                                        <p className="text-sm text-gray-600 mb-4">Please indicate your preferred dates for this work. A minimum of 3 days lead time is required for parts ordering.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Preferred Start Date</label>
                                                <input type="date" value={preferredStartDate} min={minBookingDate} onChange={(e) => handleStartDateChange(e.target.value)} className={`w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 outline-none ${capacityWarning ? 'border-orange-400 ring-orange-200 bg-orange-50' : 'border-gray-300 focus:ring-green-500'}`} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Preferred End Date</label>
                                                <input type="date" value={preferredEndDate} min={preferredStartDate} onChange={(e) => setPreferredEndDate(e.target.value)} className={`w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 outline-none ${capacityWarning ? 'border-orange-400 ring-orange-200 bg-orange-50' : 'border-gray-300 focus:ring-green-500'}`} />
                                            </div>
                                        </div>
                                         {capacityWarning && (
                                            <div className="p-3 bg-orange-100 text-orange-800 text-sm rounded-lg border border-orange-200 mb-4 animate-fade-in">
                                                <p className="font-semibold flex items-center gap-2"><AlertCircle size={16}/> High Demand Date</p>
                                                <p className="mt-1">{capacityWarning}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{isSupplementary ? 'Notes for Technician (Optional)' : 'Notes / Special Requests'}</label>
                                    <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" placeholder={isSupplementary ? "e.g., Please proceed with the work." : "Any specific requirements or questions..."}/>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setIsConfirmingApproval(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition">Back</button>
                                    <button onClick={handleSubmitApproval} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition transform hover:scale-105">
                                        {isSupplementary ? 'Confirm Approval' : 'Submit Booking Request'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                    
                    <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10">
                        {!isCustomerMode ? (
                            <>
                                <div className="flex gap-2">
                                    {currentUser.role !== 'Engineer' && (
                                    <button onClick={() => setIsEmailing(true)} className="flex items-center py-2 px-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition"><Mail size={16} className="mr-2"/> Email Link</button>
                                    )}
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button onClick={() => handlePrint(false)} className="flex items-center py-1.5 px-3 rounded text-sm font-semibold hover:bg-white hover:shadow transition">
                                            <Printer size={16} className="mr-2"/> Customer Print
                                        </button>
                                        <div className="w-px bg-gray-300 my-1 mx-1"></div>
                                        <button onClick={() => handlePrint(true)} className="flex items-center py-1.5 px-3 rounded text-sm font-semibold hover:bg-white hover:shadow transition">Internal Print</button>
                                    </div>
                                    <button onClick={() => handleDownloadPdf(false)} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
                                        {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />} PDF
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    {onCreateInquiry && <button onClick={() => onCreateInquiry(estimate)} className="flex items-center py-2 px-4 bg-purple-100 text-purple-700 font-semibold rounded-lg hover:bg-purple-200 transition"><MessageSquare size={16} className="mr-2"/> Raise Inquiry</button>}
                                    <button onClick={() => { setIsApproving(true); setApprovalNotes(''); }} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md transition"><CheckSquare size={16} className="mr-2"/> Manual Approve</button>
                                </div>
                            </>
                        ) : (
                            <div className="w-full flex justify-between items-center">
                                <div className="text-xs text-gray-500">* This total is an estimate and subject to final inspection.</div>
                                {!isConfirmingApproval && isInteractive && (
                                     <div className="flex gap-3">
                                        {onDecline && <button onClick={() => onDecline(estimate)} className="px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition">Decline Estimate</button>}
                                         <button onClick={() => setIsConfirmingApproval(true)} className="flex items-center py-2.5 px-6 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 transition transform hover:-translate-y-0.5"><CheckSquare size={18} className="mr-2"/>{isSupplementary ? 'Approve Additional Work' : 'Approve & Request Booking'}</button>
                                     </div>
                                )}
                            </div>
                        )}
                    </footer>
                </div>
            </div>
            {isEmailing && <EmailEstimateModal isOpen={isEmailing} onClose={() => setIsEmailing(false)} onSend={handleEmailSuccess} onViewAsCustomer={() => { setIsEmailing(false); setLocalViewMode('customer'); }} estimate={estimate} customer={customer} vehicle={vehicle} taxRates={taxRates}/>}
            {isApproving && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4 border-b pb-4 flex-shrink-0">
                             <h3 className="text-xl font-bold">Approve & Schedule Estimate</h3>
                             <button onClick={() => setIsApproving(false)}><X size={24} className="text-gray-500"/></button>
                        </div>
                        <div className="flex-grow overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <h4 className="font-bold text-sm mb-2">Optional Items</h4>
                                    {optionalItems.length > 0 ? (
                                        <div className="space-y-2">
                                            {optionalItems.map(item => (
                                                <div key={item.id} className="flex items-center gap-3 p-2 bg-white border rounded cursor-pointer hover:border-indigo-300" onClick={() => handleToggleOptional(item.id)}>
                                                    <div className="flex justify-center flex-shrink-0">
                                                        <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedOptionalItems.has(item.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'} cursor-pointer`}>
                                                             {selectedOptionalItems.has(item.id) && <CheckSquare size={14} className="text-white" />}
                                                        </div>
                                                    </div>
                                                    <span className="text-sm">{item.description} ({formatCurrency(item.unitPrice * item.quantity)})</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-gray-500">No optional items.</p>}
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <h4 className="font-bold text-sm text-indigo-900 mb-2">Schedule Job</h4>
                                    <div className="space-y-2">
                                         <div>
                                            <label className="block text-xs font-semibold text-indigo-700">Selected Date</label>
                                            <input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} className="w-full p-2 border rounded-md"/>
                                         </div>
                                         {manualApprovalCapacity && (
                                            <div className="text-xs space-y-1 bg-white p-2 rounded border">
                                                <div className="flex justify-between"><span className="text-gray-600">Existing Load:</span><span className="font-semibold">{manualApprovalCapacity.allocated.toFixed(1)} hrs</span></div>
                                                <div className="flex justify-between"><span className="text-gray-600">This Job:</span><span className="font-semibold">{projectedLaborHours.toFixed(1)} hrs</span></div>
                                                <div className={`flex justify-between pt-1 border-t font-bold ${manualApprovalCapacity.isOverCapacity ? 'text-red-600' : 'text-green-600'}`}><span>Capacity Status:</span><span>{manualApprovalCapacity.isOverCapacity ? 'Over Capacity' : 'OK'}</span></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isSupplementary && (
                                    <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                                         <textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} rows={3} className="w-full p-2 border rounded-lg text-sm" placeholder="Any specific instructions..." />
                                    </div>
                                )}
                            </div>
                            <div className="lg:col-span-2 flex flex-col h-full min-h-0 bg-gray-50 rounded-lg border p-4">
                                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                     <h4 className="font-bold text-gray-700">Calendar Availability</h4>
                                     <div className="flex items-center gap-2">
                                        <button onClick={() => handleMonthChange(-1)} className="p-1 rounded hover:bg-gray-200"><ChevronLeft/></button>
                                        <span className="font-semibold text-sm w-32 text-center">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                                        <button onClick={() => handleMonthChange(1)} className="p-1 rounded hover:bg-gray-200"><ChevronRight/></button>
                                     </div>
                                 </div>
                                 <div className="flex-grow min-h-0 overflow-hidden">
                                    <BookingCalendarView jobs={entityJobs} vehicles={vehicles} customers={customers} onAddJob={() => {}} onDragStart={() => {}} maxDailyCapacityHours={resolvedEntity?.dailyCapacityHours || 40} absencesByDate={absencesByDate} onDayClick={(date) => setApprovalDate(date)} onEditJob={() => {}} currentMonthDate={currentMonthDate} selectedDate={approvalDate}/>
                                 </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t flex-shrink-0">
                            <button onClick={() => setIsApproving(false)} className="px-4 py-2 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300">Cancel</button>
                            <button onClick={() => { onApprove(estimate, Array.from(selectedOptionalItems), approvalNotes, approvalDate); setIsApproving(false); onClose(); }} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">Confirm Approval</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
export default EstimateViewModal;

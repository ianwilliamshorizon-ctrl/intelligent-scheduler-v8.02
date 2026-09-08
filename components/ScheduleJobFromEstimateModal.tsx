import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Estimate, Customer, Vehicle, Job, BusinessEntity, AbsenceRequest, JobSegment, PurchaseOrder, Inquiry, Part, PurchaseOrderStatus, EstimateLineItem } from '../types';
import { X, Calendar, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle, Gauge, Clock, Printer, CalendarCheck } from 'lucide-react';
import { formatDate, dateStringToDate, getRelativeDate, splitJobIntoSegments, addDays, findNextAvailableDate, formatReadableDate } from '../core/utils/dateUtils';
import { generateJobId } from '../core/utils/numberGenerators';
import { BookingCalendarView } from './BookingCalendarView';
import { MOTBookingModal } from './MOTBookingModal';
import { TIME_SEGMENTS } from '../constants';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { usePrint } from '../core/hooks/usePrint';
import { PrintableEstimate } from './estimates/PrintableEstimate';
import { formatCurrency } from '../core/utils/formatUtils';
import FormModal from './FormModal';
import { calculateJobPartsStatus } from '../core/utils/jobUtils';

interface ScheduleJobFromEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (job: Job, estimate: Estimate, options: { isAlternative: boolean; originalDate: string; isOverbooked?: boolean }, extraJobs?: Job[], newPurchaseOrders?: PurchaseOrder[]) => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    jobs: Job[];
    vehicles: Vehicle[];
    maxDailyCapacityHours: number;
    businessEntities: BusinessEntity[];
    customers: Customer[];
    absenceRequests: AbsenceRequest[];
    onEditJob: (jobId: string, initialTab?: string) => void;
    inquiry?: Inquiry | null;
    parts: Part[];
}

const ScheduleJobFromEstimateModal: React.FC<ScheduleJobFromEstimateModalProps> = ({ isOpen, onClose, onConfirm, estimate, customer, vehicle, jobs, vehicles, maxDailyCapacityHours, businessEntities, customers, absenceRequests, onEditJob, inquiry, parts }) => {
    const { setConfirmation, currentUser } = useApp();
    const { saveRecord, purchaseOrders, servicePackages } = useData();
    const [scheduledDate, setScheduledDate] = useState(() => estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0));
    const [suggestion, setSuggestion] = useState<{ suggestedDate: string; originalDate: string } | null>(null);
    const [allowOverbooking, setAllowOverbooking] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => dateStringToDate(scheduledDate));
    
    const [isMotBookingOpen, setIsMotBookingOpen] = useState(false);
    const [motBooking, setMotBooking] = useState<{ date: string; time: string; liftId: string } | null>(null);
    const isMotRequired = useMemo(() => 
        estimate.lineItems.some(item => 
            (/\bmot\b/i.test(item.description || '') || item.partNumber === 'MOT')
        ), 
    [estimate.lineItems]);

    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [depositMethod, setDepositMethod] = useState<string>('BACS');
    const [hasDeposit, setHasDeposit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [createdJobFinal, setCreatedJobFinal] = useState<Job | null>(null);

    const print = usePrint();
    const triggerPrintDepositReceipt = () => {
        if (!createdJobFinal) return;
        print(
            <PrintableEstimate 
                estimate={estimate}
                customer={customer}
                vehicle={vehicle}
                entityDetails={businessEntities.find(e => e.id === createdJobFinal.entityId)}
                taxRates={[]}
                parts={parts}
                canViewPricing={true}
                depositAmount={Number(depositAmount || 0)}
                totals={{ 
                    totalNet: (estimate.lineItems || []).reduce((sum, item) => sum + (item.isOptional ? 0 : ((item.quantity || 1) * (item.unitPrice || 0))), 0),
                    grandTotal: (estimate.lineItems || []).reduce((sum, item) => sum + (item.isOptional ? 0 : ((item.quantity || 1) * (item.unitPrice || 0))), 0),
                    vatBreakdown: [] 
                }}
            />
        );
    };

    useEffect(() => {
        if (isOpen) {
            if (!estimate) {
                onClose();
                return;
            }
            const initialDate = estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0);
            setScheduledDate(initialDate);
            setCurrentMonth(dateStringToDate(initialDate));
            setSuggestion(null);
            setAllowOverbooking(false);
            setMotBooking(null);
        }
    }, [isOpen, estimate, onClose]);
    
    const laborHours = useMemo(() => {
        const hours = (estimate?.lineItems || [])
            .filter(item => {
                const isItemLabor = item.isLabor || 
                                   item.type === 'labor' || 
                                   item.partNumber === 'LABOUR' || 
                                   item.partNumber === 'MOT' ||
                                   item.description?.toLowerCase().includes('labour');
                
                // We default to including all items for duration planning, 
                // matching the "remove to adjust price" customer flow.
                return isItemLabor;
            })
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        return hours === 0 ? 1 : hours;
    }, [estimate.lineItems]);
    
    const entityForEstimate = useMemo(() => businessEntities.find(e => e.id === estimate.entityId), [businessEntities, estimate]);

    const jobsForEntity = useMemo(() => {
        if (!entityForEstimate) return jobs;
        return jobs.filter(j => j.entityId === entityForEstimate.id);
    }, [jobs, entityForEstimate]);

    const absencesByDate = useMemo(() => {
        const map = new Map<string, number>();
        absenceRequests.forEach(req => {
            const reqAsAny = req as any;
            if (reqAsAny.status === 'Approved' || reqAsAny.status === 'Pending') {
                 let currentDate = dateStringToDate(reqAsAny.startDate);
                 const endDate = dateStringToDate(reqAsAny.endDate);
                 while(currentDate <= endDate) {
                    const dateStr = formatDate(currentDate);
                    map.set(dateStr, (map.get(dateStr) || 0) + 8);
                    currentDate = addDays(currentDate, 1);
                }
            }
        });
        return map;
    }, [absenceRequests]);

    const dailyStats = useMemo(() => {
        const entity = entityForEstimate as any;
        const maxCapacity = entity?.dailyCapacityHours || maxDailyCapacityHours;
        const absenceHours = absencesByDate.get(scheduledDate) || 0;
        const effectiveCapacity = Math.max(0, maxCapacity - absenceHours);

        const currentLoad = (jobsForEntity.flatMap(j => j.segments) || [])
            .filter(s => s.date === scheduledDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);
        
        // Multi-day split logic: only show the load for the FIRST segment (or total if < 8h)
        const durationForThisDay = Math.min(laborHours, 8);
        const newTotalLoad = currentLoad + durationForThisDay;
        const remainingCapacity = effectiveCapacity - newTotalLoad;
        const loadPercentage = effectiveCapacity > 0 ? newTotalLoad / effectiveCapacity : (newTotalLoad > 0 ? 1.1 : 0);

        let statusColor = 'bg-green-100 border-green-200 text-green-800';
        if (remainingCapacity < 0) {
            statusColor = 'bg-red-100 border-red-200 text-red-800';
        } else if (loadPercentage > 0.8) {
            statusColor = 'bg-amber-100 border-amber-200 text-amber-800';
        }

        return { maxCapacity, absenceHours, effectiveCapacity, currentLoad, remainingCapacity, statusColor, durationForThisDay, isSplit: laborHours > 8 };
    }, [scheduledDate, jobsForEntity, laborHours, entityForEstimate, maxDailyCapacityHours, absencesByDate]);

    const handleMonthChange = (offset: number) => {
        setCurrentMonth(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };
    
    const handleToday = () => {
        const today = dateStringToDate(getRelativeDate(0));
        setScheduledDate(formatDate(today));
        setCurrentMonth(today);
    };

    const handleMotSelect = (date: string, time: string, liftId: string) => {
        setMotBooking({ date, time, liftId });
        setScheduledDate(date);
        setCurrentMonth(dateStringToDate(date));
        setIsMotBookingOpen(false);
    };

    if (!isOpen) return null;

    const handleConfirmClick = async (overrideOverbook: boolean = false, overrideDate?: string) => {
        if (isMotRequired && !motBooking) {
            setConfirmation({
                isOpen: true,
                title: 'MOT Booking Required',
                message: 'This estimate includes an MOT. Please use the "Book Specific MOT Slot" button to schedule the MOT before creating the job.',
                type: 'error',
                onConfirm: () => setConfirmation({ isOpen: false, title: '', message: '' }),
            });
            return;
        }

        const targetDate = overrideDate || scheduledDate;

        if (customer) {
            await saveRecord('customers', customer);
        }

        const entityShortCode = entityForEstimate?.shortCode || 'UNK';
        const dailyHours = (jobsForEntity.flatMap(j => j.segments) || []).filter(s => s.date === targetDate && s.status !== 'Cancelled').reduce((sum, s) => sum + s.duration, 0);
        const baseCapacity = (entityForEstimate as any)?.dailyCapacityHours || maxDailyCapacityHours;
        const absenceHours = absencesByDate.get(targetDate) || 0;
        const effectiveCapacity = Math.max(0, baseCapacity - absenceHours);

        const hasOtherLabor = estimate.lineItems.some(item => 
            (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR') && 
            !item.isOptional && 
            !/\bmot\b/i.test(item.description || '') &&
            item.partNumber !== 'MOT'
        );
        const isMotOnlyEstimate = motBooking && !hasOtherLabor;

        const isOverbookingAuthorized = overrideOverbook || allowOverbooking;
        const startDuration = Math.min(laborHours, 8);
        if (dailyHours + startDuration > effectiveCapacity && !motBooking && !isOverbookingAuthorized) {
            const alternativeDate = findNextAvailableDate(targetDate, laborHours, jobsForEntity, baseCapacity);
            setSuggestion({ suggestedDate: alternativeDate, originalDate: targetDate });
            return;
        }

        let mainJob: Job;
        let extraJobs: Job[] = [];
        
        if (motBooking) {
            const timeIndex = TIME_SEGMENTS.indexOf(motBooking.time);
            
            if (isMotOnlyEstimate) {
                const motJobId = generateJobId(jobs, entityShortCode);
                mainJob = {
                    id: motJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `MOT Test`, estimatedHours: 1, scheduledDate: motBooking.date, status: 'Allocated', createdAt: formatDate(new Date()), createdByUserId: '', estimateId: estimate.id, vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', notes: estimate.notes || '', segments: [],
                    depositAmount: hasDeposit ? depositAmount : undefined,
                    depositMethod: hasDeposit ? depositMethod : undefined,
                };
                if (timeIndex !== -1) {
                    mainJob.segments = [{ id: crypto.randomUUID(), description: 'MOT', segmentId: crypto.randomUUID(), date: motBooking.date, duration: 1, status: 'Allocated', allocatedLift: motBooking.liftId, scheduledStartSegment: timeIndex, engineerId: null }];
                } else {
                    mainJob.segments = splitJobIntoSegments(mainJob);
                    mainJob.status = 'Unallocated';
                }
            } else {
                const mainJobId = generateJobId(jobs, entityShortCode);
                mainJob = {
                    id: mainJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: targetDate, status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes || '', vehicleStatus: 'Awaiting Arrival', createdByUserId: '',
                    depositAmount: hasDeposit ? depositAmount : undefined,
                    depositMethod: hasDeposit ? depositMethod : undefined,
                };
                mainJob.segments = splitJobIntoSegments(mainJob);

                const motJobId = `${mainJobId}-MOT`;
                const motJob: Job = { id: motJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `MOT Test (Linked to ${mainJobId})`, estimatedHours: 1, scheduledDate: motBooking.date, status: 'Allocated', createdAt: formatDate(new Date()), createdByUserId: '', segments: [], estimateId: undefined, vehicleStatus: 'Awaiting Arrival', notes: `Linked to Master Job #${mainJobId}. Do not invoice separately.`, partsStatus: 'Not Required' };

                if (timeIndex !== -1) {
                    motJob.segments = [{ id: crypto.randomUUID(), description: 'MOT', segmentId: crypto.randomUUID(), date: motBooking.date, duration: 1, status: 'Allocated', allocatedLift: motBooking.liftId, scheduledStartSegment: timeIndex, engineerId: null }];
                }
                mainJob.notes += `

Linked MOT Booking: #${motJobId} @ ${motBooking.time}`;
                extraJobs.push(motJob);
            }
        } else {
            const mainJobId = generateJobId(jobs, entityShortCode);
            mainJob = { id: mainJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: targetDate, status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes || '', vehicleStatus: 'Awaiting Arrival', createdByUserId: '',
                depositAmount: hasDeposit ? depositAmount : undefined,
                depositMethod: hasDeposit ? depositMethod : undefined,
             };
            mainJob.segments = splitJobIntoSegments(mainJob);
        }

        if (isOverbookingAuthorized) {
            const overtimeNote = `[Overbooked - Engineer Overtime Authorized for ${formatReadableDate(targetDate)}]`;
            mainJob.notes = mainJob.notes ? `${mainJob.notes}\n\n${overtimeNote}` : overtimeNote;
        }

        mainJob.partsStatus = calculateJobPartsStatus(estimate, purchaseOrders || []);

        const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: mainJob.id };
        setIsSubmitting(true);
        try {
            await onConfirm(mainJob, updatedEstimate, { isAlternative: false, originalDate: targetDate, isOverbooked: isOverbookingAuthorized }, extraJobs);
            setCreatedJobFinal(mainJob);
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintReceipt = () => {
        triggerPrintDepositReceipt();
    };

    if (isSuccess && createdJobFinal) {
        return (
            <>
                <FormModal isOpen={isOpen} onClose={onClose} title="Job Scheduled Successfully" maxWidth="max-w-md">
                <div className="p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle size={48} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Success!</h3>
                        <p className="text-gray-500">Job <span className="font-bold text-indigo-600">#{createdJobFinal.id}</span> has been scheduled.</p>
                    </div>

                    {hasDeposit && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 space-y-4">
                            <p className="text-sm text-indigo-800 font-medium">A deposit of <span className="font-black">{formatCurrency(depositAmount)}</span> has been recorded.</p>
                            <button 
                                onClick={handlePrintReceipt}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-black py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
                            >
                                <Printer size={20} />
                                PRINT DEPOSIT RECEIPT
                            </button>
                        </div>
                    )}

                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                    >
                        Close Window
                    </button>
                </div>
            </FormModal>
            {/* Print components are handled globally by usePrint now */}
        </>
        );
    }

    const handleAcceptSuggestion = async () => {
        if (!suggestion) return;
        if (isMotRequired) {
            setConfirmation({ isOpen: true, title: 'MOT Booking Required', message: 'Please use the calendar to select a valid date and then book the MOT slot before creating the job.', type: 'error' });
            return;
        }

        if (customer) {
            await saveRecord('customers', customer);
        }

        const newJobId = generateJobId(jobs, entityForEstimate?.shortCode || 'UNK');
        let newJob: Job = { 
            id: newJobId, 
            entityId: estimate.entityId, 
            vehicleId: estimate.vehicleId, 
            customerId: estimate.customerId, 
            description: `Work from Estimate #${estimate.estimateNumber}`, 
            estimatedHours: laborHours, 
            scheduledDate: suggestion.suggestedDate, 
            status: 'Unallocated', 
            createdAt: formatDate(new Date()), 
            segments: [], 
            estimateId: estimate.id, 
            notes: estimate.notes, 
            vehicleStatus: 'Awaiting Arrival', 
            createdByUserId: '',
            depositAmount: hasDeposit ? depositAmount : undefined,
            depositMethod: hasDeposit ? depositMethod : undefined,
        };
        newJob.segments = splitJobIntoSegments(newJob);

        newJob.partsStatus = calculateJobPartsStatus(estimate, purchaseOrders || []);

        const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: newJob.id };
        setIsSubmitting(true);
        try {
            await onConfirm(newJob, updatedEstimate, { isAlternative: true, originalDate: suggestion.originalDate }, []);
            setCreatedJobFinal(newJob);
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOverbook = async () => {
        if (!suggestion) return;
        const targetDate = suggestion.originalDate;
        setSuggestion(null);
        await handleConfirmClick(true, targetDate);
    };

    const handleChooseDifferentDate = () => {
        setSuggestion(null);
    };

    const monthYearString = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl flex flex-col h-[90vh] transform transition-all animate-fade-in-up">
                <div className="flex-shrink-0 flex justify-between items-start border-b p-6">
                    <div>
                        <h2 className="text-2xl font-bold text-indigo-700 flex items-center">
                            <Calendar size={20} className="mr-2"/>
                            Schedule Job from Estimate
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Select a day from the calendar to book this job for <span className="font-semibold">{entityForEstimate?.name}</span>.</p>
                    </div>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    {suggestion ? (
                        <div className="text-center flex flex-col items-center justify-center min-h-full animate-fade-in max-w-2xl mx-auto py-4">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3 shadow-sm">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-1">Workshop Capacity Exceeded</h3>
                            <p className="text-sm text-gray-600 mb-6 max-w-lg">
                                The date you selected (<span className="font-bold text-gray-800">{formatReadableDate(suggestion.originalDate)}</span>) does not have enough standard capacity for this <span className="font-bold text-gray-800">{laborHours.toFixed(1)}h</span> job.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left mb-6">
                                {/* Option 1: Alternate Date */}
                                <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-400 transition-all flex flex-col justify-between shadow-sm">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">Option 1 • Alternate Date</span>
                                            <CalendarCheck size={18} className="text-indigo-600" />
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-base mb-1">Book Next Available Date</h4>
                                        <p className="text-xs text-gray-600 mb-3">Workshop has standard capacity available. Customer will be notified of this provisional date.</p>
                                        <div className="p-3 bg-white rounded-lg border border-indigo-100 mb-4">
                                            <span className="text-[11px] text-gray-500 block font-medium">Suggested Next Date:</span>
                                            <span className="text-base font-black text-indigo-900">{formatReadableDate(suggestion.suggestedDate)}</span>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleAcceptSuggestion}
                                        disabled={isSubmitting}
                                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2 text-sm"
                                    >
                                        <CalendarCheck size={16} />
                                        {isSubmitting ? 'Booking...' : `Book for ${formatReadableDate(suggestion.suggestedDate).split(',')[1] || suggestion.suggestedDate}`}
                                    </button>
                                </div>

                                {/* Option 2: Overbook / Overtime */}
                                <div className="p-5 rounded-xl border-2 border-amber-300 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-400 transition-all flex flex-col justify-between shadow-sm">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Option 2 • Overtime</span>
                                            <Clock size={18} className="text-amber-600" />
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-base mb-1">Overbook Requested Date</h4>
                                        <p className="text-xs text-gray-600 mb-3">Book on the requested date anyway if an engineer is authorized to work overtime to cover the extra hours.</p>
                                        <div className="p-3 bg-white rounded-lg border border-amber-200 mb-4">
                                            <span className="text-[11px] text-gray-500 block font-medium">Requested Date:</span>
                                            <span className="text-base font-black text-amber-900">{formatReadableDate(suggestion.originalDate)}</span>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleOverbook}
                                        disabled={isSubmitting}
                                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Clock size={16} />
                                        {isSubmitting ? 'Overbooking...' : `Overbook for ${formatReadableDate(suggestion.originalDate).split(',')[1] || suggestion.originalDate}`}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="button" 
                                onClick={handleChooseDifferentDate}
                                className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline flex items-center gap-1.5"
                            >
                                <ChevronLeft size={16}/> Choose a different date on calendar
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                            <div className="lg:col-span-3 space-y-4">
                                <h3 className="font-bold text-lg text-gray-800">Job Details</h3>
                                <div className="p-3 bg-gray-50 rounded-lg border space-y-1 text-sm">
                                    <p><strong>Estimate:</strong> <span className="font-mono bg-gray-200 px-1 rounded">#{estimate.estimateNumber}</span></p>
                                    <p><strong>Customer:</strong> {customer?.forename} {customer?.surname}</p>
                                    <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                                    <p><strong>Labor Hours:</strong> {laborHours.toFixed(1)} hrs</p>
                                </div>
                                
                                <div className={`p-3 rounded-lg border text-sm ${dailyStats.statusColor}`}>
                                    <h4 className="font-bold flex items-center gap-2 mb-2"><Gauge size={16}/> Capacity Impact</h4>
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span>Total Capacity:</span> <span>{dailyStats.maxCapacity} hrs</span></div>
                                        
                                        {dailyStats.absenceHours > 0 && (
                                            <div className="flex justify-between text-red-600 font-medium">
                                                <span>Staff Absence:</span> 
                                                <span>- {dailyStats.absenceHours} hrs</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between font-semibold border-b border-black/10 pb-1 mb-1">
                                            <span>Net Availability:</span> 
                                            <span>{dailyStats.effectiveCapacity.toFixed(1)} hrs</span>
                                        </div>

                                        <div className="flex justify-between"><span>Current Load:</span> <span>{dailyStats.currentLoad.toFixed(1)} hrs</span></div>
                                        <div className="flex justify-between font-semibold border-t border-black/10 pt-1 mt-1">
                                            <span>New Job:</span> 
                                            <span className="flex flex-col items-end">
                                                <span>+ {dailyStats.durationForThisDay.toFixed(1)} hrs</span>
                                                {dailyStats.isSplit && <span className="text-[9px] text-gray-400 italic font-normal">(Split: {laborHours.toFixed(1)} total)</span>}
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-bold text-base mt-1"><span>Remaining:</span> <span>{dailyStats.remainingCapacity.toFixed(1)} hrs</span></div>
                                    </div>
                                    {dailyStats.remainingCapacity < 0 && (
                                        <div className="mt-2 pt-2 border-t border-red-200/60 space-y-1.5">
                                            <p className="text-xs font-bold text-red-700 flex items-center"><AlertTriangle size={12} className="mr-1"/> Over Capacity ({Math.abs(dailyStats.remainingCapacity).toFixed(1)}h over)</p>
                                            <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-amber-950 bg-amber-50/90 p-2 rounded border border-amber-200 hover:bg-amber-100/80 transition">
                                                <input 
                                                    type="checkbox" 
                                                    checked={allowOverbooking} 
                                                    onChange={(e) => setAllowOverbooking(e.target.checked)}
                                                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                                                />
                                                <span className="leading-tight">
                                                    Authorize Overtime / Overbooking
                                                    <span className="block text-[10px] font-normal text-amber-800 mt-0.5">
                                                        Engineer will work overtime to complete this job on this date.
                                                    </span>
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t pt-4">
                                    {(estimate as any).requestedDate && (
                                        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm mb-4">
                                            <p className="flex items-center mb-1"><Calendar size={16} className="mr-2" /><strong>Customer Requested Date:&nbsp;</strong> {formatReadableDate((estimate as any).requestedDate)}</p>
                                            <p className="text-xs text-blue-700 ml-6">This is their preferred start date. Please select the actual scheduled date below based on availability.</p>
                                        </div>
                                    )}
                                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">Selected Start Date</label>
                                    <input type="date" id="scheduledDate" value={scheduledDate} onChange={(e) => { setScheduledDate(e.target.value); setMotBooking(null); setAllowOverbooking(false); }} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                                </div>

                                {isMotRequired && (
                                <div className="pt-2">
                                     <button 
                                        type="button" 
                                        onClick={() => setIsMotBookingOpen(true)}
                                        className={`w-full flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded border transition-colors ${motBooking ? 'bg-green-100 border-green-200 text-green-800' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
                                        title="Book specific slot on MOT Ramp"
                                    >
                                        <Clock size={16}/>
                                        {motBooking ? (
                                            <span className="font-semibold">MOT: {motBooking.time}</span>
                                        ) : (
                                            "Book Specific MOT Slot"
                                        )}
                                    </button>
                                </div>
                                )}

                                <div className="border-t pt-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-gray-700">Take Deposit?</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setHasDeposit(!hasDeposit)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${hasDeposit ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${hasDeposit ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    {hasDeposit && (
                                        <div className="space-y-3 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Deposit Amount (£)</label>
                                                <input 
                                                    type="number" 
                                                    value={depositAmount || ''} 
                                                    onChange={e => setDepositAmount(Number(e.target.value))}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Method</label>
                                                <select 
                                                    value={depositMethod} 
                                                    onChange={e => setDepositMethod(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                                >
                                                    <option value="BACS">BACS / Transfer</option>
                                                    <option value="Card">Credit/Debit Card</option>
                                                    <option value="Cash">Cash</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-9 flex flex-col h-full">
                               <div className="flex justify-between items-center mb-2 flex-shrink-0">
                                    <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
                                        <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-gray-300"><ChevronLeft /></button>
                                        <button onClick={handleToday} className="p-2 rounded-md hover:bg-gray-300 text-sm font-semibold">Today</button>
                                        <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-gray-300"><ChevronRight /></button>
                                    </div>
                                    <h3 className="font-semibold text-gray-800 text-lg">{monthYearString}</h3>
                               </div>
                               <div className="flex-grow min-h-0">
                                    <BookingCalendarView
                                        jobs={jobsForEntity}
                                        vehicles={vehicles}
                                        customers={customers}
                                        onAddJob={() => {}}
                                        onDragStart={() => {}}
                                        maxDailyCapacityHours={(entityForEstimate as any)?.dailyCapacityHours || maxDailyCapacityHours}
                                        absencesByDate={absencesByDate}
                                        onDayClick={(date) => { setScheduledDate(date); setMotBooking(null); }}
                                        onEditJob={onEditJob}
                                        currentMonthDate={currentMonth}
                                        selectedDate={scheduledDate}
                                    />
                               </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 flex justify-end space-x-2 border-t p-6">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                    {suggestion ? (
                        <>
                            <button type="button" onClick={handleChooseDifferentDate} className="py-2 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-semibold border">
                                Choose Another Date
                            </button>
                            <button type="button" onClick={handleOverbook} disabled={isSubmitting} className="flex items-center py-2 px-4 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 transition">
                                <Clock size={16} className="mr-2"/> Overbook (Overtime)
                            </button>
                            <button type="button" onClick={handleAcceptSuggestion} disabled={isSubmitting} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                                <CalendarCheck size={16} className="mr-2"/> Book for {formatReadableDate(suggestion.suggestedDate).split(',')[1] || suggestion.suggestedDate} & Notify
                            </button>
                        </>
                    ) : (
                        <button type="button" onClick={() => handleConfirmClick(false)} disabled={isSubmitting} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                            <CheckCircle size={16} className="mr-2"/> {isSubmitting ? 'Scheduling Job...' : 'Confirm & Create Job'}
                        </button>
                    )}
                </div>
            </div>

            {isMotBookingOpen && (
                <MOTBookingModal 
                    isOpen={isMotBookingOpen}
                    onClose={() => setIsMotBookingOpen(false)}
                    onSelect={handleMotSelect}
                    entityId={estimate.entityId}
                    initialDate={scheduledDate}
                />
            )}
        </div>
    );
};

export default ScheduleJobFromEstimateModal;

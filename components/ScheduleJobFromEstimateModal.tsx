import React, { useState, useMemo, useEffect } from 'react';
import { Estimate, Customer, Vehicle, Job, BusinessEntity, AbsenceRequest, JobSegment, PurchaseOrder, Inquiry, Part, PurchaseOrderStatus, EstimateLineItem } from '../types';
import { X, Calendar, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle, Gauge, Clock } from 'lucide-react';
import { formatDate, dateStringToDate, getRelativeDate, splitJobIntoSegments, addDays, findNextAvailableDate, formatReadableDate } from '../core/utils/dateUtils';
import { generateJobId, generatePurchaseOrderId } from '../core/utils/numberGenerators';
import { BookingCalendarView } from './BookingCalendarView';
import { MOTBookingModal } from './MOTBookingModal';
import { TIME_SEGMENTS } from '../constants';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';

interface ScheduleJobFromEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (job: Job, estimate: Estimate, options: { isAlternative: boolean; originalDate: string }, extraJobs?: Job[], newPurchaseOrders?: PurchaseOrder[]) => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    jobs: Job[];
    vehicles: Vehicle[];
    maxDailyCapacityHours: number;
    businessEntities: BusinessEntity[];
    customers: Customer[];
    absenceRequests: AbsenceRequest[];
    onEditJob: (jobId: string) => void;
    inquiry?: Inquiry;
    parts: Part[];
}

const ScheduleJobFromEstimateModal: React.FC<ScheduleJobFromEstimateModalProps> = ({ isOpen, onClose, onConfirm, estimate, customer, vehicle, jobs, vehicles, maxDailyCapacityHours, businessEntities, customers, absenceRequests, onEditJob, inquiry, parts }) => {
    const { setConfirmation, currentUser } = useApp();
    const { saveRecord, purchaseOrders } = useData();
    const [scheduledDate, setScheduledDate] = useState(() => estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0));
    const [suggestion, setSuggestion] = useState<{ suggestedDate: string; originalDate: string } | null>(null);
    const [currentMonth, setCurrentMonth] = useState(() => dateStringToDate(scheduledDate));
    
    const [isMotBookingOpen, setIsMotBookingOpen] = useState(false);
    const [motBooking, setMotBooking] = useState<{ date: string; time: string; liftId: string } | null>(null);
    const isMotRequired = useMemo(() => 
        estimate.lineItems.some(item => 
            item.description.toLowerCase().includes('mot') && !item.isOptional
        ), 
    [estimate.lineItems]);

    useEffect(() => {
        if (isOpen) {
            const initialDate = estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0);
            setScheduledDate(initialDate);
            setCurrentMonth(dateStringToDate(initialDate));
            setSuggestion(null);
            setMotBooking(null);
        }
    }, [isOpen, estimate]);
    
    const laborHours = useMemo(() => {
        const hours = (estimate?.lineItems || [])
            .filter(item => item.isLabor && !item.isOptional)
            .reduce((sum, item) => sum + item.quantity, 0);
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
        
        const newTotalLoad = currentLoad + laborHours;
        const remainingCapacity = effectiveCapacity - newTotalLoad;
        const loadPercentage = effectiveCapacity > 0 ? newTotalLoad / effectiveCapacity : (newTotalLoad > 0 ? 1.1 : 0);

        let statusColor = 'bg-green-100 border-green-200 text-green-800';
        if (remainingCapacity < 0) {
            statusColor = 'bg-red-100 border-red-200 text-red-800';
        } else if (loadPercentage > 0.8) {
            statusColor = 'bg-amber-100 border-amber-200 text-amber-800';
        }

        return { maxCapacity, absenceHours, effectiveCapacity, currentLoad, remainingCapacity, statusColor };
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

    const preparePurchaseOrders = (job: Job, estimateToConvert: Estimate, inquiry?: Inquiry): PurchaseOrder[] => {
        const allPOs = purchaseOrders || [];
        const toCreate: PurchaseOrder[] = [];
        const toUpdate: { [key: string]: PurchaseOrder } = {};
        const processedInquiryPoIds = new Set<string>();
    
        const itemsNeedingOrder = (estimateToConvert.lineItems || [])
            .map(item => {
                if (item.isLabor || item.isOptional || !item.partId) return null;
                const part = parts.find(p => p.id === item.partId);
                const requiredQty = item.quantity;
                const stockQty = part?.stockQuantity || 0;
                const orderQty = requiredQty - stockQty;
                if (orderQty <= 0) return null;
                return { ...item, orderQuantity: orderQty, partInfo: part };
            })
            .filter(Boolean) as (EstimateLineItem & { orderQuantity: number, partInfo?: Part })[];

        const partsBySupplier: Record<string, typeof itemsNeedingOrder> = {};
        itemsNeedingOrder.forEach(item => {
            const supplierId = item.supplierId || item.partInfo?.defaultSupplierId || 'no_supplier';
            if (!partsBySupplier[supplierId]) partsBySupplier[supplierId] = [];
            partsBySupplier[supplierId].push(item);
        });
        
        let poListForIdGeneration = [...allPOs];

        Object.entries(partsBySupplier).forEach(([supplierId, items]) => {
            const supId = supplierId === 'no_supplier' ? undefined : supplierId;
            const inquiryDraftPO = inquiry?.linkedPurchaseOrderIds
                ?.map(id => allPOs.find(p => p.id === id))
                .find(po => po && po.status === 'Draft' && po.supplierId === supId);

            const poLineItems = items.map(item => ({
                id: crypto.randomUUID(),
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.orderQuantity,
                receivedQuantity: 0,
                unitPrice: item.unitCost || 0,
                taxCodeId: item.taxCodeId,
                supplierId: supId,
                jobLineItemId: item.id
            }));

            if (inquiryDraftPO) {
                if (!toUpdate[inquiryDraftPO.id]) {
                    toUpdate[inquiryDraftPO.id] = { ...inquiryDraftPO };
                }
                const existingItems = toUpdate[inquiryDraftPO.id].lineItems || [];
                toUpdate[inquiryDraftPO.id].lineItems = [...existingItems, ...poLineItems];
                toUpdate[inquiryDraftPO.id].jobId = job.id;
                toUpdate[inquiryDraftPO.id].status = 'Ordered';
                processedInquiryPoIds.add(inquiryDraftPO.id);
            } else {
                const entity = businessEntities.find(e => e.id === job.entityId);
                const entityShortCode = entity?.shortCode || 'UNK';
                const vehicle = vehicles.find(v => v.id === job.vehicleId);
                const newPOId = generatePurchaseOrderId(poListForIdGeneration, entityShortCode);

                const newPO: PurchaseOrder = {
                    id: newPOId,
                    entityId: job.entityId,
                    supplierId: supId,
                    vehicleRegistrationRef: vehicle?.registration || 'N/A',
                    orderDate: formatDate(new Date()),
                    status: 'Ordered',
                    jobId: job.id,
                    createdByUserId: currentUser?.id || '',
                    lineItems: poLineItems,
                    notes: `Auto-generated from Estimate #${estimateToConvert.estimateNumber}`
                };
                toCreate.push(newPO);
                poListForIdGeneration.push(newPO);
            }
        });

        (inquiry?.linkedPurchaseOrderIds || []).forEach(poId => {
            if (processedInquiryPoIds.has(poId)) return;
            const po = allPOs.find(p => p.id === poId);
            if (po && po.status === 'Draft') {
                toUpdate[po.id] = { ...po, jobId: job.id, status: 'Ordered' };
            }
        });

        return [...toCreate, ...Object.values(toUpdate)];
    };

    const handleConfirmClick = async () => {
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

        if (customer) {
            await saveRecord('customers', customer);
        }

        const entityShortCode = entityForEstimate?.shortCode || 'UNK';
        const dailyHours = (jobsForEntity.flatMap(j => j.segments) || []).filter(s => s.date === scheduledDate && s.status !== 'Cancelled').reduce((sum, s) => sum + s.duration, 0);
        const baseCapacity = (entityForEstimate as any)?.dailyCapacityHours || maxDailyCapacityHours;
        const absenceHours = absencesByDate.get(scheduledDate) || 0;
        const effectiveCapacity = Math.max(0, baseCapacity - absenceHours);

        const hasOtherLabor = estimate.lineItems.some(item => item.isLabor && !item.isOptional && !item.description.toLowerCase().includes('mot'));
        const isMotOnlyEstimate = motBooking && !hasOtherLabor;

        if (dailyHours + laborHours > effectiveCapacity && !motBooking) {
            const alternativeDate = findNextAvailableDate(scheduledDate, laborHours, jobsForEntity, baseCapacity);
            setSuggestion({ suggestedDate: alternativeDate, originalDate: scheduledDate });
            return;
        }

        let mainJob: Job;
        let extraJobs: Job[] = [];
        
        if (motBooking) {
            const timeIndex = TIME_SEGMENTS.indexOf(motBooking.time);
            
            if (isMotOnlyEstimate) {
                const motJobId = generateJobId(jobs, entityShortCode);
                mainJob = {
                    id: motJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `MOT Test`, estimatedHours: 1, scheduledDate: motBooking.date, status: 'Allocated', createdAt: formatDate(new Date()), createdByUserId: '', estimateId: estimate.id, vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', notes: estimate.notes || '', segments: []
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
                    id: mainJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes || '', vehicleStatus: 'Awaiting Arrival', createdByUserId: '',
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
            mainJob = { id: mainJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: scheduledDate, status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes || '', vehicleStatus: 'Awaiting Arrival', createdByUserId: '', };
            mainJob.segments = splitJobIntoSegments(mainJob);
        }

        const newPurchaseOrders = preparePurchaseOrders(mainJob, estimate, inquiry);
        if (newPurchaseOrders.length > 0) {
            mainJob.purchaseOrderIds = newPurchaseOrders.map(po => po.id);
            mainJob.partsStatus = 'Awaiting Order';
        } else {
            mainJob.partsStatus = 'Not Required';
        }

        const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: mainJob.id };
        onConfirm(mainJob, updatedEstimate, { isAlternative: false, originalDate: scheduledDate }, extraJobs, newPurchaseOrders);
    };

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
        let newJob: Job = { id: newJobId, entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId, description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: suggestion.suggestedDate, status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes, vehicleStatus: 'Awaiting Arrival', createdByUserId: '', };
        newJob.segments = splitJobIntoSegments(newJob);

        const newPurchaseOrders = preparePurchaseOrders(newJob, estimate, inquiry);
        if (newPurchaseOrders.length > 0) {
            newJob.purchaseOrderIds = newPurchaseOrders.map(po => po.id);
            newJob.partsStatus = 'Awaiting Order';
        }

        const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: newJob.id };
        onConfirm(newJob, updatedEstimate, { isAlternative: true, originalDate: suggestion.originalDate }, [], newPurchaseOrders);
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
                        <div className="text-center flex flex-col items-center justify-center h-full animate-fade-in">
                            <AlertTriangle size={48} className="text-amber-500 mb-4" />
                            <h3 className="text-xl font-bold text-gray-800">Requested Date Fully Booked</h3>
                            <p className="mt-2 text-gray-600">The date you selected ({formatReadableDate(suggestion.originalDate)}) does not have enough capacity for this {laborHours}hr job.</p>
                            <p className="mt-4 text-gray-800">We suggest the next available date:</p>
                            <p className="my-2 p-3 bg-green-100 text-green-800 font-bold text-xl rounded-lg border border-green-200">{formatReadableDate(suggestion.suggestedDate)}</p>
                            <p className="text-sm text-gray-500">Would you like to book for this date instead?</p>
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
                                        <div className="flex justify-between font-semibold border-t border-black/10 pt-1 mt-1"><span>New Job:</span> <span>+ {laborHours.toFixed(1)} hrs</span></div>
                                        <div className="flex justify-between font-bold text-base mt-1"><span>Remaining:</span> <span>{dailyStats.remainingCapacity.toFixed(1)} hrs</span></div>
                                    </div>
                                    {dailyStats.remainingCapacity < 0 && (
                                        <p className="mt-2 text-xs font-bold text-red-700 flex items-center"><AlertTriangle size={12} className="mr-1"/> Over Capacity!</p>
                                    )}
                                </div>

                                <div className="border-t pt-4">
                                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">Selected Start Date</label>
                                    <input type="date" id="scheduledDate" value={scheduledDate} onChange={(e) => { setScheduledDate(e.target.value); setMotBooking(null); }} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
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
                        <button type="button" onClick={handleAcceptSuggestion} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                           Book for {formatReadableDate(suggestion.suggestedDate).split(',')[1]} & Notify
                        </button>
                    ) : (
                        <button type="button" onClick={handleConfirmClick} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                            <CheckCircle size={16} className="mr-2"/> Confirm & Create Job
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

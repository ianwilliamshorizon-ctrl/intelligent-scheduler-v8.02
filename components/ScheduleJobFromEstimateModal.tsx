import React, { useState, useMemo, useEffect } from 'react';
import { Estimate, Customer, Vehicle, Job, BusinessEntity, AbsenceRequest } from '../types';
import { X, Calendar, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle, Gauge } from 'lucide-react';
import { formatDate, dateStringToDate, getRelativeDate, splitJobIntoSegments, addDays, findNextAvailableDate, formatReadableDate } from '../core/utils/dateUtils';
import { generateJobId } from '../core/utils/numberGenerators';
import { BookingCalendarView } from './BookingCalendarView';

interface ScheduleJobFromEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (job: Job, estimate: Estimate, options: { isAlternative: boolean; originalDate: string }) => void;
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
}

const ScheduleJobFromEstimateModal: React.FC<ScheduleJobFromEstimateModalProps> = ({ isOpen, onClose, onConfirm, estimate, customer, vehicle, jobs, vehicles, maxDailyCapacityHours, businessEntities, customers, absenceRequests, onEditJob }) => {
    const [scheduledDate, setScheduledDate] = useState(() => estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0));
    const [suggestion, setSuggestion] = useState<{ suggestedDate: string; originalDate: string } | null>(null);
    const [currentMonth, setCurrentMonth] = useState(() => dateStringToDate(scheduledDate));

    useEffect(() => {
        if (isOpen) {
            setScheduledDate(estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0));
            setCurrentMonth(dateStringToDate(estimate.jobId ? getRelativeDate(0) : (estimate as any).requestedDate || getRelativeDate(0)));
            setSuggestion(null);
        }
    }, [isOpen, estimate]);
    
    const laborHours = useMemo(() => {
        // Calculate hours from labor items. If 0 (e.g. only parts or optional items), default to 1 to ensure a segment is created.
        const hours = (estimate?.lineItems || [])
            .filter(item => item.isLabor && !item.isOptional)
            .reduce((sum, item) => sum + item.quantity, 0);
        return Math.max(hours, 1);
    }, [estimate]);
    
    const entityForEstimate = useMemo(() => businessEntities.find(e => e.id === estimate.entityId), [businessEntities, estimate]);

    const jobsForEntity = useMemo(() => {
        if (!entityForEstimate) return jobs;
        return jobs.filter(j => j.entityId === entityForEstimate.id);
    }, [jobs, entityForEstimate]);

    const absencesByDate = useMemo(() => {
        const map = new Map<string, number>();
        absenceRequests.forEach(req => {
            if (req.status === 'Approved' || req.status === 'Pending') {
                 let currentDate = dateStringToDate(req.startDate);
                 const endDate = dateStringToDate(req.endDate);
                 while(currentDate <= endDate) {
                    const dateStr = formatDate(currentDate);
                    map.set(dateStr, (map.get(dateStr) || 0) + 8); // Assuming 8 hours per day
                    currentDate = addDays(currentDate, 1);
                }
            }
        });
        return map;
    }, [absenceRequests]);

    const dailyStats = useMemo(() => {
        const maxCapacity = entityForEstimate?.dailyCapacityHours || maxDailyCapacityHours;
        const currentLoad = (jobsForEntity.flatMap(j => j.segments) || [])
            .filter(s => s.date === scheduledDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);
        
        const newTotalLoad = currentLoad + laborHours;
        const remainingCapacity = maxCapacity - newTotalLoad;
        const loadPercentage = maxCapacity > 0 ? newTotalLoad / maxCapacity : 1;

        let statusColor = 'bg-green-100 border-green-200 text-green-800';
        if (remainingCapacity < 0) {
            statusColor = 'bg-red-100 border-red-200 text-red-800';
        } else if (loadPercentage > 0.8) {
            statusColor = 'bg-amber-100 border-amber-200 text-amber-800';
        }

        return {
            maxCapacity,
            currentLoad,
            remainingCapacity,
            statusColor
        };
    }, [scheduledDate, jobsForEntity, laborHours, entityForEstimate, maxDailyCapacityHours]);

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

    if (!isOpen) return null;

    const handleConfirmClick = () => {
        const dailyHours = (jobsForEntity.flatMap(j => j.segments) || [])
            .filter(s => s.date === scheduledDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);
            
        const entityCapacity = entityForEstimate?.dailyCapacityHours || maxDailyCapacityHours;

        if (dailyHours + laborHours > entityCapacity) {
            const alternativeDate = findNextAvailableDate(scheduledDate, laborHours, jobsForEntity, entityCapacity);
            setSuggestion({ suggestedDate: alternativeDate, originalDate: scheduledDate });
        } else {
            const newJob: Job = {
                id: generateJobId(jobs, entityForEstimate?.shortCode || 'UNK'),
                entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId,
                description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: scheduledDate,
                status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes,
                vehicleStatus: 'Awaiting Arrival',
            };
            newJob.segments = splitJobIntoSegments(newJob);
            const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: newJob.id };
            onConfirm(newJob, updatedEstimate, { isAlternative: false, originalDate: scheduledDate });
        }
    };

    const handleAcceptSuggestion = () => {
        if (!suggestion) return;
        const newJob: Job = {
            id: generateJobId(jobs, entityForEstimate?.shortCode || 'UNK'),
            entityId: estimate.entityId, vehicleId: estimate.vehicleId, customerId: estimate.customerId,
            description: `Work from Estimate #${estimate.estimateNumber}`, estimatedHours: laborHours, scheduledDate: suggestion.suggestedDate,
            status: 'Unallocated', createdAt: formatDate(new Date()), segments: [], estimateId: estimate.id, notes: estimate.notes,
            vehicleStatus: 'Awaiting Arrival',
        };
        newJob.segments = splitJobIntoSegments(newJob);
        const updatedEstimate: Estimate = { ...estimate, status: 'Converted to Job', jobId: newJob.id };
        onConfirm(newJob, updatedEstimate, { isAlternative: true, originalDate: suggestion.originalDate });
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
                                        <div className="flex justify-between"><span>Max Capacity:</span> <span>{dailyStats.maxCapacity} hrs</span></div>
                                        <div className="flex justify-between"><span>Current Load:</span> <span>{dailyStats.currentLoad.toFixed(1)} hrs</span></div>
                                        <div className="flex justify-between font-semibold border-t border-black/10 pt-1 mt-1"><span>New Job:</span> <span>+ {laborHours.toFixed(1)} hrs</span></div>
                                        <div className="flex justify-between font-bold text-base mt-1"><span>Remaining:</span> <span>{dailyStats.remainingCapacity.toFixed(1)} hrs</span></div>
                                    </div>
                                    {dailyStats.remainingCapacity < 0 && (
                                        <p className="mt-2 text-xs font-bold text-red-700 flex items-center"><AlertTriangle size={12} className="mr-1"/> Over Capacity!</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">
                                        Selected Start Date
                                    </label>
                                    <input type="date" id="scheduledDate" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
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
                                        maxDailyCapacityHours={entityForEstimate?.dailyCapacityHours || maxDailyCapacityHours}
                                        absencesByDate={absencesByDate}
                                        onDayClick={(date) => setScheduledDate(date)}
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
        </div>
    );
};

export default ScheduleJobFromEstimateModal;
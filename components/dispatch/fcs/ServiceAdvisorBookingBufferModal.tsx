import React, { useState, useMemo, useEffect } from 'react';
import { Job, Customer, Vehicle, Lift, Engineer, PurchaseOrder, Estimate } from '../../../types';
import { Calendar, Clock, AlertTriangle, CheckCircle, Wrench, ShieldAlert, Sparkles, X, ChevronRight, PackageCheck, Layers, FileText, Check, ArrowRight, BookmarkCheck } from 'lucide-react';
import { calculateEarliestRealisticStart } from '../../../core/services/fcsSchedulingEngine';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { getRelativeDate } from '../../../core/utils/dateUtils';

interface ServiceAdvisorBookingBufferModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: Job[];
    ramps: Lift[];
    engineers: Engineer[];
    purchaseOrders: PurchaseOrder[];
    customers: Customer[];
    vehicles: Vehicle[];
    estimates?: Estimate[];
    unallocatedJobs?: Job[];
    onBookJob: (jobData: Partial<Job>) => void;
    onSaveEstimate?: (estimate: Partial<Estimate>) => void;
}

export const ServiceAdvisorBookingBufferModal: React.FC<ServiceAdvisorBookingBufferModalProps> = ({
    isOpen,
    onClose,
    jobs,
    ramps,
    engineers,
    purchaseOrders,
    customers,
    vehicles,
    estimates = [],
    unallocatedJobs = [],
    onBookJob,
    onSaveEstimate
}) => {
    // Mode selection: 'estimate' | 'unallocated' | 'manual'
    const [mode, setMode] = useState<'estimate' | 'unallocated' | 'manual'>(() => {
        if (estimates.length > 0) return 'estimate';
        if (unallocatedJobs.length > 0) return 'unallocated';
        return 'manual';
    });

    // Active selections
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [selectedUnallocatedJobId, setSelectedUnallocatedJobId] = useState<string>('');

    // Shared / Manual fields
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
    const [description, setDescription] = useState<string>('Major Service & Inspection');
    const [estimatedHours, setEstimatedHours] = useState<number>(8);
    const [partsLeadDays, setPartsLeadDays] = useState<number>(2);
    const [preferredRampId, setPreferredRampId] = useState<string>('');
    const [isMovable, setIsMovable] = useState<boolean>(false);
    const [priority, setPriority] = useState<number>(2); // 1 = Urgent, 2 = High, 3 = Normal

    // Feedback notification
    const [statusToast, setStatusToast] = useState<string | null>(null);

    // Active estimates that can be scheduled (Draft, Sent, Approved)
    const schedulableEstimates = useMemo(() => {
        return estimates.filter(e => e.status !== 'Converted to Job' && e.status !== 'Closed');
    }, [estimates]);

    // Active unallocated jobs from queue
    const queueUnallocatedJobs = useMemo(() => {
        if (unallocatedJobs.length > 0) return unallocatedJobs;
        return jobs.filter(j => j.status === 'Unallocated' || !j.scheduledDate);
    }, [unallocatedJobs, jobs]);

    // Initialize selection on open or mode change
    useEffect(() => {
        if (mode === 'estimate' && schedulableEstimates.length > 0 && !selectedEstimateId) {
            handleSelectEstimate(schedulableEstimates[0].id);
        } else if (mode === 'unallocated' && queueUnallocatedJobs.length > 0 && !selectedUnallocatedJobId) {
            handleSelectUnallocatedJob(queueUnallocatedJobs[0].id);
        }
    }, [mode, schedulableEstimates, queueUnallocatedJobs]);

    // Handle estimate selection
    const handleSelectEstimate = (estId: string) => {
        setSelectedEstimateId(estId);
        const est = estimates.find(e => e.id === estId);
        if (!est) return;

        setSelectedCustomerId(est.customerId || '');
        setSelectedVehicleId(est.vehicleId || '');
        setDescription(est.description || `Estimate #${est.estimateNumber || est.id} Package`);

        // Compute labor hours from estimate line items
        let laborHours = 0;
        let hasParts = false;
        if (est.lineItems && est.lineItems.length > 0) {
            est.lineItems.forEach(li => {
                if (li.isLabor || li.type === 'labor' || (li.servicePackageName && !li.partNumber)) {
                    laborHours += (Number(li.quantity) || 1);
                }
                if (li.type === 'part' || (!li.isLabor && (li.partId || li.partNumber))) {
                    hasParts = true;
                }
            });
        }
        setEstimatedHours(laborHours > 0 ? Math.round(laborHours * 2) / 2 : 6);
        setPartsLeadDays(hasParts ? 2 : 0);
        setStatusToast(null);
    };

    // Handle unallocated job selection
    const handleSelectUnallocatedJob = (jobId: string) => {
        setSelectedUnallocatedJobId(jobId);
        const job = queueUnallocatedJobs.find(j => j.id === jobId);
        if (!job) return;

        setSelectedCustomerId(job.customerId || '');
        setSelectedVehicleId(job.vehicleId || '');
        setDescription(job.description || `Job #${job.jobNumber || job.id}`);

        // Compute duration
        let duration = job.estimatedHours || 0;
        if (!duration && job.segments && job.segments.length > 0) {
            duration = job.segments.reduce((acc, s) => acc + (s.duration || 0), 0);
        }
        setEstimatedHours(duration > 0 ? duration : 4);

        // Check linked purchase orders
        const linkedPos = purchaseOrders.filter(po => po.jobId === job.id);
        const hasUndeliveredParts = linkedPos.some(po => po.status !== 'Received');
        setPartsLeadDays(hasUndeliveredParts ? 2 : 0);
        setIsMovable(!!job.isMovable);
        setPriority(job.priority || 2);
        setStatusToast(null);
    };

    // Filter vehicles by customer if selected
    const customerVehicles = useMemo(() => {
        if (!selectedCustomerId) return vehicles;
        return vehicles.filter(v => v.customerId === selectedCustomerId);
    }, [vehicles, selectedCustomerId]);

    // Live reactive simulation of the earliest realistic start
    const simulation = useMemo(() => {
        if (estimatedHours <= 0) return null;
        return calculateEarliestRealisticStart({
            estimatedHours,
            preferredRampId: preferredRampId || undefined,
            partsLeadDays,
            jobs,
            ramps,
            engineers,
            purchaseOrders,
            startDateStr: getRelativeDate(0)
        });
    }, [estimatedHours, preferredRampId, partsLeadDays, jobs, ramps, engineers, purchaseOrders]);

    if (!isOpen) return null;

    // Action 1: Commit Schedule Date to Unallocated Job
    const handleCommitUnallocatedJob = () => {
        if (!simulation) return;
        const job = queueUnallocatedJobs.find(j => j.id === selectedUnallocatedJobId);
        if (!job) return;

        const updatedJob: Partial<Job> = {
            ...job,
            scheduledDate: simulation.earliestStartDate,
            status: 'Booked In',
            fcsState: partsLeadDays > 0 ? 'STALLED' : 'ACTIVE',
            materialsStatus: partsLeadDays > 0 ? 'Ordered' : 'Delivered',
            estimatedHours,
            isMovable,
            priority,
            segments: (job.segments && job.segments.length > 0) 
                ? job.segments.map((s, idx) => ({
                    ...s,
                    allocatedLift: simulation.compatibleRampName,
                    date: simulation.earliestStartDate,
                    duration: idx === 0 ? estimatedHours : s.duration
                }))
                : [
                    {
                        id: `seg_${Date.now()}`,
                        segmentId: `seg_${Date.now()}`,
                        description,
                        status: 'Allocated',
                        allocatedLift: simulation.compatibleRampName,
                        duration: estimatedHours,
                        date: simulation.earliestStartDate,
                        scheduledStartSegment: 1
                    }
                ],
            notes: (job.notes ? `${job.notes}\n` : '') + `[FCS Buffer Schedule]: Scheduled for ${simulation.earliestStartDate} @ ${simulation.earliestStartTime} on ${simulation.compatibleRampName}. Projected Completion: ${simulation.projectedCompletionDate}.`
        };

        onBookJob(updatedJob);
        onClose();
    };

    // Action 2: Convert Estimate to Booked Job at Earliest Slot
    const handleConvertEstimateToJob = () => {
        if (!simulation) return;
        const est = estimates.find(e => e.id === selectedEstimateId);

        const newJob: Partial<Job> = {
            id: `job_est_${Date.now()}`,
            customerId: selectedCustomerId,
            vehicleId: selectedVehicleId,
            description,
            estimatedHours,
            status: 'Booked In',
            fcsState: partsLeadDays > 0 ? 'STALLED' : 'QUEUED',
            materialsStatus: partsLeadDays > 0 ? 'Ordered' : 'Delivered',
            isMovable,
            priority,
            scheduledDate: simulation.earliestStartDate,
            segments: [
                {
                    id: `seg_${Date.now()}`,
                    segmentId: `seg_${Date.now()}`,
                    description,
                    status: 'Allocated',
                    allocatedLift: simulation.compatibleRampName,
                    duration: estimatedHours,
                    date: simulation.earliestStartDate,
                    scheduledStartSegment: 1
                }
            ],
            notes: `Converted from Estimate ${est?.estimateNumber || selectedEstimateId} via FCS Booking Buffer. Earliest slot: ${simulation.earliestStartDate} @ ${simulation.earliestStartTime}. Handover: ${simulation.projectedCompletionDate}.`
        };

        // Book job
        onBookJob(newJob);

        // Update estimate status if callback provided
        if (onSaveEstimate && est) {
            onSaveEstimate({
                ...est,
                status: 'Converted to Job',
                requestedDate: simulation.earliestStartDate,
                jobId: newJob.id,
                notes: (est.notes ? `${est.notes}\n` : '') + `Converted to Job #${newJob.id} on ${simulation.earliestStartDate} via FCS Booking Buffer.`
            });
        }

        onClose();
    };

    // Action 3: Save Proposed Feasibility Date to Estimate
    const handleSaveSlotToEstimate = () => {
        if (!simulation || !onSaveEstimate) return;
        const est = estimates.find(e => e.id === selectedEstimateId);
        if (!est) return;

        const feasibilityNote = `[FCS Feasibility Slot]: Earliest Start: ${simulation.earliestStartDate} @ ${simulation.earliestStartTime} on ${simulation.compatibleRampName} | Handover: ${simulation.projectedCompletionDate} | Constraint: ${simulation.bottleneckReason}`;
        
        onSaveEstimate({
            ...est,
            requestedDate: simulation.earliestStartDate,
            notes: est.notes ? `${est.notes}\n\n${feasibilityNote}` : feasibilityNote
        });

        setStatusToast(`Saved feasible window (${simulation.earliestStartDate} → ${simulation.projectedCompletionDate}) to Estimate #${est.estimateNumber || est.id}`);
        setTimeout(() => setStatusToast(null), 4000);
    };

    // Action 4: Confirm Custom Manual Booking
    const handleConfirmManualBooking = () => {
        if (!simulation) return;

        const newJob: Partial<Job> = {
            customerId: selectedCustomerId,
            vehicleId: selectedVehicleId,
            description,
            estimatedHours,
            status: 'Booked In',
            fcsState: partsLeadDays > 0 ? 'STALLED' : 'QUEUED',
            materialsStatus: partsLeadDays > 0 ? 'Ordered' : 'Delivered',
            isMovable,
            priority,
            scheduledDate: simulation.earliestStartDate,
            segments: [
                {
                    id: `seg_${Date.now()}`,
                    segmentId: `seg_${Date.now()}`,
                    description,
                    status: 'Allocated',
                    allocatedLift: simulation.compatibleRampName,
                    duration: estimatedHours,
                    date: simulation.earliestStartDate,
                    scheduledStartSegment: 1
                }
            ],
            notes: `FCS Booking Buffer: Calculated slot ${simulation.earliestStartDate} @ ${simulation.earliestStartTime} on ${simulation.compatibleRampName}. Handover: ${simulation.projectedCompletionDate}.`
        };

        onBookJob(newJob);
        onClose();
    };

    const activeCustomer = customers.find(c => c.id === selectedCustomerId);
    const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 relative border-b border-indigo-900/50">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-indigo-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors shadow-xs"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest mb-1">
                        <Sparkles size={14} />
                        <span>FCS Booking Buffer Engine</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        Pre-Booking Feasibility Simulator
                    </h2>
                    <p className="text-indigo-200 text-xs mt-1">
                        Test master schedule lead time and parts arrival feasibility before committing customer handover promises.
                    </p>

                    {/* Mode Navigation Tabs */}
                    <div className="flex items-center gap-2 mt-4 bg-slate-800/80 p-1 rounded-xl border border-indigo-900/60 text-xs font-black">
                        <button
                            type="button"
                            onClick={() => setMode('estimate')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                mode === 'estimate' 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <FileText size={14} />
                            <span>From Estimate</span>
                            {schedulableEstimates.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${mode === 'estimate' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                                    {schedulableEstimates.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode('unallocated')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                mode === 'unallocated' 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <Layers size={14} />
                            <span>Unallocated Queue</span>
                            {queueUnallocatedJobs.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${mode === 'unallocated' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                                    {queueUnallocatedJobs.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode('manual')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                mode === 'manual' 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <Wrench size={14} />
                            <span>Custom / What-If</span>
                        </button>
                    </div>
                </div>

                {/* Body Form */}
                <div className="p-5 overflow-y-auto space-y-4 text-slate-800">
                    {/* Toast Notification */}
                    {statusToast && (
                        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in shadow-xs">
                            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                            <span>{statusToast}</span>
                        </div>
                    )}

                    {/* MODE 1: FROM ESTIMATE SELECTOR */}
                    {mode === 'estimate' && (
                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                                    <FileText size={14} className="text-indigo-600" />
                                    <span>Select Customer Estimate to Test</span>
                                </label>
                                <span className="text-[10px] text-indigo-700 font-bold">
                                    {schedulableEstimates.length} active estimate(s)
                                </span>
                            </div>

                            {schedulableEstimates.length === 0 ? (
                                <p className="text-xs text-slate-500 italic p-2 bg-white rounded-lg border border-slate-200">
                                    No pending customer estimates found. Switch to Custom mode to simulate new work.
                                </p>
                            ) : (
                                <select
                                    value={selectedEstimateId}
                                    onChange={(e) => handleSelectEstimate(e.target.value)}
                                    className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-xs"
                                >
                                    {schedulableEstimates.map(est => {
                                        const cust = customers.find(c => c.id === est.customerId);
                                        const veh = vehicles.find(v => v.id === est.vehicleId);
                                        const custName = cust ? getCustomerDisplayName(cust) : 'Customer';
                                        const reg = veh?.registration || 'Unknown Reg';
                                        const hours = est.lineItems
                                            ? est.lineItems.filter(li => li.isLabor || li.type === 'labor').reduce((acc, li) => acc + (Number(li.quantity) || 1), 0)
                                            : 0;

                                        return (
                                            <option key={est.id} value={est.id}>
                                                [#{est.estimateNumber || est.id.substring(0, 7)}] {reg} • {custName} • {est.description || 'Estimate'} ({hours}h)
                                            </option>
                                        );
                                    })}
                                </select>
                            )}

                            {/* Active Estimate Quick Card */}
                            {selectedEstimateId && (
                                <div className="bg-white p-3 rounded-lg border border-indigo-200 text-xs space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>Customer: <strong className="text-slate-900">{activeCustomer ? getCustomerDisplayName(activeCustomer) : 'N/A'}</strong></span>
                                        <span>Vehicle: <strong className="text-indigo-900 font-mono">{activeVehicle?.registration || 'N/A'}</strong> ({activeVehicle?.make} {activeVehicle?.model})</span>
                                    </div>
                                    <div className="text-slate-700 font-medium">
                                        Package: <strong className="text-slate-900">{description}</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODE 2: FROM UNALLOCATED JOB QUEUE */}
                    {mode === 'unallocated' && (
                        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                                    <Layers size={14} className="text-blue-600" />
                                    <span>Select Unallocated Job from Queue</span>
                                </label>
                                <span className="text-[10px] text-blue-700 font-bold">
                                    {queueUnallocatedJobs.length} job(s) awaiting scheduling
                                </span>
                            </div>

                            {queueUnallocatedJobs.length === 0 ? (
                                <p className="text-xs text-slate-500 italic p-2 bg-white rounded-lg border border-slate-200">
                                    No unallocated jobs currently waiting in queue.
                                </p>
                            ) : (
                                <select
                                    value={selectedUnallocatedJobId}
                                    onChange={(e) => handleSelectUnallocatedJob(e.target.value)}
                                    className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-xs"
                                >
                                    {queueUnallocatedJobs.map(j => {
                                        const cust = customers.find(c => c.id === j.customerId);
                                        const veh = vehicles.find(v => v.id === j.vehicleId);
                                        const custName = cust ? getCustomerDisplayName(cust) : 'Customer';
                                        const reg = veh?.registration || 'Unknown Reg';
                                        const hours = j.estimatedHours || (j.segments ? j.segments.reduce((acc, s) => acc + (s.duration || 0), 0) : 4);

                                        return (
                                            <option key={j.id} value={j.id}>
                                                [#{j.jobNumber || j.id.substring(0, 7)}] {reg} • {custName} • {j.description || 'Workshop Job'} ({hours}h)
                                            </option>
                                        );
                                    })}
                                </select>
                            )}

                            {/* Active Job Quick Card */}
                            {selectedUnallocatedJobId && (
                                <div className="bg-white p-3 rounded-lg border border-blue-200 text-xs space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>Customer: <strong className="text-slate-900">{activeCustomer ? getCustomerDisplayName(activeCustomer) : 'N/A'}</strong></span>
                                        <span>Vehicle: <strong className="text-blue-900 font-mono">{activeVehicle?.registration || 'N/A'}</strong> ({activeVehicle?.make} {activeVehicle?.model})</span>
                                    </div>
                                    <div className="text-slate-700 font-medium">
                                        Scope: <strong className="text-slate-900">{description}</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODE 3: CUSTOM / WHAT-IF FORM */}
                    {mode === 'manual' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Customer</label>
                                <select 
                                    value={selectedCustomerId}
                                    onChange={(e) => {
                                        setSelectedCustomerId(e.target.value);
                                        const matchingV = vehicles.find(v => v.customerId === e.target.value);
                                        if (matchingV) setSelectedVehicleId(matchingV.id);
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                >
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Vehicle</label>
                                <select 
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                >
                                    {customerVehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.registration} ({v.make} {v.model})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Description</label>
                                <input 
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. Multi-day engine overhaul"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                />
                            </div>
                        </div>
                    )}

                    {/* Simulation Parameters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        {/* Labour Hours */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                Labour Hours (H)
                            </label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="0.5"
                                    max="120"
                                    step="0.5"
                                    value={estimatedHours}
                                    onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 1)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-indigo-900"
                                />
                                <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">hrs</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">{(estimatedHours / 8).toFixed(1)} shift day(s)</span>
                        </div>

                        {/* Parts Lead Time */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                Parts Delivery Lead
                            </label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={partsLeadDays}
                                    onChange={(e) => setPartsLeadDays(parseInt(e.target.value, 10) || 0)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-indigo-900"
                                />
                                <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">days</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                {partsLeadDays === 0 ? 'Parts on shelf' : `${partsLeadDays}d supplier transit`}
                            </span>
                        </div>

                        {/* Preferred Ramp */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                Target Ramp / Lift
                            </label>
                            <select 
                                value={preferredRampId}
                                onChange={(e) => setPreferredRampId(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-900"
                            >
                                <option value="">Auto-Assign Optimal Free</option>
                                {ramps.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            <span className="text-[10px] text-slate-500 mt-1 block">Physical constraint</span>
                        </div>
                    </div>

                    {/* Simulation Result Card */}
                    {simulation && (
                        <div className="p-4 rounded-xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-blue-50 relative overflow-hidden shadow-xs">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200">
                                    Simulated Feasibility Window
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {simulation.bottleneckReason === 'NONE' && (
                                        <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle size={11} /> Immediate Capacity
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'PARTS_HOLD' && (
                                        <span className="text-amber-800 bg-amber-100 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <PackageCheck size={11} /> Parts Lead Delay (+{partsLeadDays}d)
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'RAMP_OCCUPIED' && (
                                        <span className="text-rose-800 bg-rose-100 border border-rose-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Layers size={11} /> Ramp Space Contention
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'ENGINEER_UNAVAILABLE' && (
                                        <span className="text-purple-800 bg-purple-100 border border-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Wrench size={11} /> Labour Pool Saturation
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">
                                        Earliest Feasible Start Date
                                    </span>
                                    <span className="text-lg font-black text-indigo-900 block leading-tight">
                                        {simulation.earliestStartDate}
                                    </span>
                                    <span className="text-xs text-indigo-600 font-bold block mt-1">
                                        @ {simulation.earliestStartTime} • {simulation.compatibleRampName}
                                    </span>
                                </div>

                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">
                                        Target Handover Promise Date
                                    </span>
                                    <span className="text-lg font-black text-slate-900 block leading-tight">
                                        {simulation.projectedCompletionDate}
                                    </span>
                                    <span className="text-xs text-slate-500 font-bold block mt-1">
                                        Calculated for {estimatedHours} shop hours
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-700 font-medium bg-white/80 p-2.5 rounded-lg border border-indigo-100/60 leading-relaxed">
                                💡 <strong className="text-indigo-950">Feasibility Diagnostic:</strong> {simulation.explanation}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Action buttons depending on mode */}
                        {mode === 'estimate' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSaveSlotToEstimate}
                                    disabled={!simulation || !selectedEstimateId}
                                    className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                                    title="Save calculated date window into Estimate notes for quoting the customer"
                                >
                                    <BookmarkCheck size={14} className="text-indigo-600" />
                                    <span>Save Window to Estimate</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleConvertEstimateToJob}
                                    disabled={!simulation || !selectedEstimateId}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                >
                                    <span>Book Job from Estimate</span>
                                    <ChevronRight size={16} />
                                </button>
                            </>
                        )}

                        {mode === 'unallocated' && (
                            <button
                                type="button"
                                onClick={handleCommitUnallocatedJob}
                                disabled={!simulation || !selectedUnallocatedJobId}
                                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                                <span>Commit Schedule Date</span>
                                <ChevronRight size={16} />
                            </button>
                        )}

                        {mode === 'manual' && (
                            <button
                                type="button"
                                onClick={handleConfirmManualBooking}
                                disabled={!simulation}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                                <span>Book at Earliest Slot</span>
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

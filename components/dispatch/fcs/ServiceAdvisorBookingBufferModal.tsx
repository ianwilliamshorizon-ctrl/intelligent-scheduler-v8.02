import React, { useState, useMemo } from 'react';
import { Job, Customer, Vehicle, Lift, Engineer, PurchaseOrder } from '../../../types';
import { Calendar, Clock, AlertTriangle, CheckCircle, Wrench, ShieldAlert, Sparkles, X, ChevronRight, PackageCheck, Layers } from 'lucide-react';
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
    onBookJob: (jobData: Partial<Job>) => void;
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
    onBookJob
}) => {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
    const [description, setDescription] = useState<string>('Major Repair / Engine Out Service');
    const [estimatedHours, setEstimatedHours] = useState<number>(12);
    const [partsLeadDays, setPartsLeadDays] = useState<number>(2);
    const [preferredRampId, setPreferredRampId] = useState<string>('');
    const [isMovable, setIsMovable] = useState<boolean>(false);
    const [priority, setPriority] = useState<number>(2); // 1 = Urgent, 2 = High, 3 = Normal

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

    const handleConfirmBooking = () => {
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
                    scheduledStartSegment: 1 // 08:30
                }
            ],
            notes: `FCS Booking Buffer Simulation: Earliest calculated start ${simulation.earliestStartDate} @ ${simulation.earliestStartTime}. Bottleneck factor: ${simulation.bottleneckReason}.`
        };

        onBookJob(newJob);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-5 right-5 text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-widest mb-1">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Finite Capacity Scheduling</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        Service Advisor Booking Buffer
                    </h2>
                    <p className="text-indigo-200 text-xs mt-1">
                        Simulate realistic master schedule availability before committing multi-day customer promises.
                    </p>
                </div>

                {/* Form Body */}
                <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
                    {/* Customer & Vehicle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Customer</label>
                            <select 
                                value={selectedCustomerId}
                                onChange={(e) => {
                                    setSelectedCustomerId(e.target.value);
                                    const matchingV = vehicles.find(v => v.customerId === e.target.value);
                                    if (matchingV) setSelectedVehicleId(matchingV.id);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            >
                                {customerVehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.registration} ({v.make} {v.model})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Job Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Job Package Description</label>
                        <input 
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Engine Rebuild / Clutch Replacement"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                    </div>

                    {/* Simulation Parameters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {/* Labour Hours */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                Est. Labour Hours (H)
                            </label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="1"
                                    max="120"
                                    step="0.5"
                                    value={estimatedHours}
                                    onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 1)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-black text-indigo-900"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">hrs</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">{(estimatedHours / 8).toFixed(1)} shop day(s)</span>
                        </div>

                        {/* Parts Lead Time */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                Parts Lead Time
                            </label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={partsLeadDays}
                                    onChange={(e) => setPartsLeadDays(parseInt(e.target.value, 10) || 0)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-black text-indigo-900"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">days</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">Transit buffer</span>
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
                                <option value="">Auto-Assign Best Free</option>
                                {ramps.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            <span className="text-[10px] text-slate-400 mt-1 block">Constraint pillar</span>
                        </div>
                    </div>

                    {/* Advanced Movable & Priority Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox"
                                id="isMovableCheckbox"
                                checked={isMovable}
                                onChange={(e) => setIsMovable(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded-md border-amber-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="isMovableCheckbox" className="font-bold text-amber-950 cursor-pointer">
                                Vehicle is Movable (Doesn't Lock Ramp Permanently)
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900">Priority:</span>
                            <div className="flex gap-1">
                                {[
                                    { val: 1, label: 'Urgent', color: 'bg-rose-600 text-white' },
                                    { val: 2, label: 'High', color: 'bg-amber-600 text-white' },
                                    { val: 3, label: 'Normal', color: 'bg-slate-600 text-white' }
                                ].map(p => (
                                    <button
                                        key={p.val}
                                        type="button"
                                        onClick={() => setPriority(p.val)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${priority === p.val ? p.color : 'bg-white text-slate-600 border border-slate-200'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Simulation Result Card */}
                    {simulation && (
                        <div className="p-4 rounded-xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-blue-50 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                                    Simulated Feasibility
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {simulation.bottleneckReason === 'NONE' && (
                                        <span className="text-emerald-700 bg-emerald-100 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle size={10} /> Open Capacity
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'PARTS_HOLD' && (
                                        <span className="text-amber-700 bg-amber-100 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <PackageCheck size={10} /> Parts Lead Delay
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'RAMP_OCCUPIED' && (
                                        <span className="text-rose-700 bg-rose-100 border border-rose-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Layers size={10} /> Ramp Bottleneck
                                        </span>
                                    )}
                                    {simulation.bottleneckReason === 'ENGINEER_UNAVAILABLE' && (
                                        <span className="text-purple-700 bg-purple-100 border border-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Wrench size={10} /> Labour Pool Saturation
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-xs">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">
                                        Earliest Realistic Start Date
                                    </span>
                                    <span className="text-lg font-black text-indigo-900">
                                        {simulation.earliestStartDate}
                                    </span>
                                    <span className="text-xs text-indigo-600 font-bold block mt-0.5">
                                        @ {simulation.earliestStartTime} ({simulation.compatibleRampName})
                                    </span>
                                </div>

                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-xs">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">
                                        Projected Handover Date
                                    </span>
                                    <span className="text-lg font-black text-slate-900">
                                        {simulation.projectedCompletionDate}
                                    </span>
                                    <span className="text-xs text-slate-500 font-bold block mt-0.5">
                                        Based on {estimatedHours} working hours
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-600 font-medium bg-white/70 p-2 rounded border border-indigo-100/50">
                                💡 <strong className="text-indigo-950">Advisor Note:</strong> {simulation.explanation}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirmBooking}
                        disabled={!simulation}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <span>Book at Earliest Slot</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, Calendar, Wrench, Layers, Clock, CheckCircle, FileText, User } from 'lucide-react';
import { FCSMatrixResult } from '../../../core/services/fcsSchedulingEngine';
import { Lift, Engineer, Job, Vehicle, Customer, BusinessEntity } from '../../../types';
import { formatDate } from '../../../core/utils/dateUtils';

interface PrintableFCSScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    matrix: FCSMatrixResult;
    startDateStr: string;
    windowDays: number;
    businessEntity?: BusinessEntity | null;
    ramps: Lift[];
    engineers: Engineer[];
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
}

export const PrintableFCSScheduleModal: React.FC<PrintableFCSScheduleModalProps> = ({
    isOpen,
    onClose,
    matrix,
    startDateStr,
    windowDays,
    businessEntity,
    ramps,
    engineers,
    jobs,
    vehicles,
    customers
}) => {
    const printComponentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `FCS_Schedule_${(businessEntity?.name || 'Workshop').replace(/\s+/g, '_')}_${startDateStr}`
    });

    if (!isOpen) return null;

    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));
    const customersMap = new Map(customers.map(c => [c.id, c]));
    const jobsMap = new Map(jobs.map(j => [j.id, j]));

    const endDate = new Date(startDateStr);
    endDate.setDate(endDate.getDate() + windowDays - 1);
    const endDateStr = formatDate(endDate);

    const workshopName = businessEntity?.name || 'All Workshops Combined';

    // Gather all active blocks on the Gantt (ramps and engineers)
    const allRampBlocks = matrix.rampRows.flatMap(r => r.blocks);
    const allEngBlocks = matrix.engineerRows.flatMap(e => e.blocks);

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="p-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-b border-indigo-900/50 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl">
                            <Printer size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Printable Schedule</span>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                                    {windowDays}-Day Horizon
                                </span>
                            </div>
                            <h3 className="text-lg font-black tracking-tight text-white">
                                {workshopName} — Finite Capacity Schedule
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-indigo-500/30 transition-all cursor-pointer active:scale-95"
                        >
                            <Printer size={15} />
                            <span>Print / Export PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area with Preview */}
                <div className="p-6 overflow-y-auto flex-grow bg-slate-100/60">
                    <div
                        ref={printComponentRef}
                        className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-6 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none"
                    >
                        {/* Print Header */}
                        <div className="border-b border-slate-200 pb-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-700 mb-1">
                                        <span>BROOKSPEED MOTORSPORT & WORKSHOP</span>
                                    </div>
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Finite Capacity Schedule (FCS)
                                    </h1>
                                    <p className="text-sm font-bold text-slate-600 mt-0.5">
                                        {workshopName}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-500">Schedule Window</div>
                                    <div className="text-sm font-black text-slate-900">
                                        {startDateStr} &rarr; {endDateStr}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        Printed: {formatDate(new Date())} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            {/* Executive KPI Summary Bar */}
                            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                                    <span className="text-[9px] font-black uppercase text-slate-500 block">Total Backlog</span>
                                    <span className="text-sm font-black text-slate-900">{matrix.metrics.totalBacklogHours} Hours ({matrix.metrics.totalBacklogDays} Days)</span>
                                </div>
                                <div className="bg-indigo-50/60 border border-indigo-200 p-2.5 rounded-xl">
                                    <span className="text-[9px] font-black uppercase text-indigo-700 block">Active Wrench Time</span>
                                    <span className="text-sm font-black text-indigo-950">{matrix.metrics.activeWrenchHours} Hours</span>
                                </div>
                                <div className="bg-blue-50/60 border border-blue-200 p-2.5 rounded-xl">
                                    <span className="text-[9px] font-black uppercase text-blue-700 block">Ramp Bay Utilization</span>
                                    <span className="text-sm font-black text-blue-950">{matrix.metrics.rampUtilizationPercent}%</span>
                                </div>
                                <div className="bg-emerald-50/60 border border-emerald-200 p-2.5 rounded-xl">
                                    <span className="text-[9px] font-black uppercase text-emerald-700 block">Workforce Capacity</span>
                                    <span className="text-sm font-black text-emerald-950">{matrix.engineerRows.length} Active Techs</span>
                                </div>
                            </div>
                        </div>

                        {/* Technician Allocation Timetable */}
                        <div className="space-y-4">
                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b pb-2">
                                <Wrench size={15} className="text-indigo-600" />
                                <span>Technician Schedule & Allocations</span>
                            </h2>

                            {matrix.engineerRows.map(row => {
                                const techBlocks = row.blocks.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
                                const totalTechHours = techBlocks.reduce((acc, b) => acc + (b.hours || 0), 0);

                                return (
                                    <div key={row.engineer.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-500" />
                                                <span className="font-black text-xs text-slate-900">{row.engineer.name}</span>
                                                {row.engineer.specialization && (
                                                    <span className="text-[10px] text-slate-500 font-medium">({row.engineer.specialization})</span>
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                                {totalTechHours}h Allocated ({techBlocks.length} jobs)
                                            </span>
                                        </div>

                                        {techBlocks.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-400 italic">
                                                No jobs allocated to this technician within the selected window.
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100/70 text-[10px] font-black uppercase text-slate-600 border-b">
                                                    <tr>
                                                        <th className="py-2 px-3">Date</th>
                                                        <th className="py-2 px-3">Registration</th>
                                                        <th className="py-2 px-3">Job / Description</th>
                                                        <th className="py-2 px-3">Assigned Ramp</th>
                                                        <th className="py-2 px-3 text-right">Duration</th>
                                                        <th className="py-2 px-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {techBlocks.map(block => {
                                                        const job = jobsMap.get(block.jobId);
                                                        const veh = job?.vehicleId ? vehiclesMap.get(job.vehicleId) : undefined;
                                                        const cust = job?.customerId ? customersMap.get(job.customerId) : undefined;
                                                        const rampBlock = allRampBlocks.find(rb => rb.jobId === block.jobId);

                                                        return (
                                                            <tr key={block.id} className="hover:bg-slate-50/50">
                                                                <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                                    {block.startDate}
                                                                </td>
                                                                <td className="py-2 px-3 font-mono font-black text-slate-800 uppercase whitespace-nowrap">
                                                                    {block.vehicleRegistration || veh?.registration || '—'}
                                                                </td>
                                                                <td className="py-2 px-3">
                                                                    <div className="font-bold text-slate-900 truncate max-w-xs" title={block.title}>
                                                                        {block.title}
                                                                    </div>
                                                                    {cust && (
                                                                        <div className="text-[10px] text-slate-500 truncate">
                                                                            {cust.companyName || `${cust.forename || ''} ${cust.surname || ''}`.trim()}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-2 px-3 text-slate-700 whitespace-nowrap font-medium">
                                                                    {rampBlock?.resourceName || 'Workshop Bay'}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                                                    {block.hours}h
                                                                </td>
                                                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                                        block.isScheduledUnallocated 
                                                                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                                                    }`}>
                                                                        {block.isScheduledUnallocated ? 'Scheduled (Pending Lock)' : 'Allocated'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Ramp Bays Schedule Table */}
                        <div className="space-y-4 pt-4 border-t border-slate-200">
                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b pb-2">
                                <Layers size={15} className="text-blue-600" />
                                <span>Ramp & Workshop Bay Utilization</span>
                            </h2>

                            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b">
                                    <tr>
                                        <th className="py-2.5 px-3">Bay / Ramp</th>
                                        <th className="py-2.5 px-3">Date</th>
                                        <th className="py-2.5 px-3">Vehicle</th>
                                        <th className="py-2.5 px-3">Description</th>
                                        <th className="py-2.5 px-3">Technician</th>
                                        <th className="py-2.5 px-3 text-right">Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrix.rampRows.flatMap(row => 
                                        row.blocks.map(block => (
                                            <tr key={block.id} className="hover:bg-slate-50/50">
                                                <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                    {row.ramp.name}
                                                </td>
                                                <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                                                    {block.startDate}
                                                </td>
                                                <td className="py-2 px-3 font-mono font-black text-slate-900 uppercase whitespace-nowrap">
                                                    {block.vehicleRegistration || '—'}
                                                </td>
                                                <td className="py-2 px-3 font-medium text-slate-700 truncate max-w-xs" title={block.title}>
                                                    {block.title}
                                                </td>
                                                <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                    {block.engineerName || 'Technician'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                                    {block.hours}h
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Sign-off Footer */}
                        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                            <div>
                                <span className="font-bold">Workshop Controller: ___________________________</span>
                            </div>
                            <div>
                                <span className="font-bold">Signed / Approved Date: ___________________________</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        A4 Landscape formatted &bull; All active allocations and dependencies included
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                            <Printer size={15} />
                            <span>Print Schedule</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

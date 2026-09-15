import React, { useState, useMemo, useRef } from 'react';
import { Job, Engineer, BusinessEntity, Vehicle } from '../../types';
import { 
    X, Calendar, Users, Download, Printer, ChevronLeft, ChevronRight, 
    Clock, CheckCircle, Percent, ArrowUpRight, DollarSign, 
    FileSpreadsheet, Filter, ChevronDown, ChevronUp, UserCheck, Shield, HelpCircle
} from 'lucide-react';
import { formatReadableDate } from '../../core/utils/dateUtils';
import Papa from 'papaparse';
import { useReactToPrint } from 'react-to-print';

interface MonthlyLaborTallyModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: Job[];
    engineers: Engineer[];
    businessEntities?: BusinessEntity[];
    vehicles?: Vehicle[];
    selectedEntityId?: string;
    onOpenJob?: (jobId: string) => void;
}

interface SegmentEntryBreakdown {
    jobId: string;
    jobNumber?: string;
    vehicleReg?: string;
    segmentDescription: string;
    date: string;
    isLead: boolean;
    leadEngineerName: string;
    allocatedHours: number;
    actualHours: number;
    sharePercentage: number;
    creditedHours: number;
    notes?: string;
}

interface EngineerMonthlySummary {
    engineer: Engineer;
    leadSegmentsCount: number;
    assistSegmentsCount: number;
    totalAllocatedHours: number;
    totalActualHours: number;
    leadCreditedHours: number;
    assistCreditedHours: number;
    totalCreditedHours: number;
    efficiency: number; // allocated / credited * 100
    hourlyRate?: number;
    estimatedLaborPay?: number;
    breakdown: SegmentEntryBreakdown[];
}

export const MonthlyLaborTallyModal: React.FC<MonthlyLaborTallyModalProps> = ({
    isOpen,
    onClose,
    jobs = [],
    engineers = [],
    businessEntities = [],
    vehicles = [],
    selectedEntityId = 'all',
    onOpenJob
}) => {
    // Current month/year default
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed
    const [entityFilter, setEntityFilter] = useState<string>(selectedEntityId || 'all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [expandedEngineerId, setExpandedEngineerId] = useState<string | null>(null);

    const printRef = useRef<HTMLDivElement>(null);
    const triggerPrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Monthly_Labor_Tally_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}`,
    });

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(prev => prev - 1);
        } else {
            setSelectedMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(prev => prev + 1);
        } else {
            setSelectedMonth(prev => prev + 1);
        }
    };

    const engineerMap = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers]);
    const vehicleMap = useMemo(() => new Map((vehicles || []).map(v => [v.id, v])), [vehicles]);

    // Calculate monthly tally
    const tallyData = useMemo(() => {
        const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

        // Map engineerId -> EngineerMonthlySummary
        const summaryMap = new Map<string, EngineerMonthlySummary>();

        // Initialize all active engineers in summary
        engineers.forEach(eng => {
            if (entityFilter !== 'all' && eng.entityId && eng.entityId !== entityFilter) return;
            summaryMap.set(eng.id, {
                engineer: eng,
                leadSegmentsCount: 0,
                assistSegmentsCount: 0,
                totalAllocatedHours: 0,
                totalActualHours: 0,
                leadCreditedHours: 0,
                assistCreditedHours: 0,
                totalCreditedHours: 0,
                efficiency: 100,
                hourlyRate: eng.hourlyRate,
                estimatedLaborPay: 0,
                breakdown: []
            });
        });

        // Filter relevant jobs
        const filteredJobs = jobs.filter(j => {
            if (entityFilter !== 'all' && j.entityId && j.entityId !== entityFilter) return false;
            return true;
        });

        filteredJobs.forEach(job => {
            const vehicle = job.vehicleId ? vehicleMap.get(job.vehicleId) : undefined;
            const vehicleReg = vehicle?.registration || job.vehicleRegistration || 'N/A';
            const segments = Array.isArray(job.segments) ? job.segments : [];

            segments.forEach((seg, segIdx) => {
                if (seg.status === 'Cancelled') return;

                // Check if segment belongs to selected month
                const segDate = seg.date || (job.scheduledDate ? job.scheduledDate : (job.createdAt ? job.createdAt.substring(0, 10) : ''));
                if (!segDate.startsWith(monthPrefix)) return;

                const allocatedHours = typeof seg.allocatedHours === 'number' ? seg.allocatedHours : (typeof seg.duration === 'number' ? seg.duration : 0);
                const actualHours = typeof seg.actualHours === 'number' ? seg.actualHours : allocatedHours;

                const assists = Array.isArray(seg.assists) ? seg.assists : [];
                const totalAssistPercent = assists.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
                const leadPercent = Math.max(0, 100 - Math.min(100, totalAssistPercent));

                const leadCredited = actualHours * (leadPercent / 100);
                const leadAllocated = allocatedHours * (leadPercent / 100);

                // Lead engineer recording
                if (seg.engineerId) {
                    let leadSummary = summaryMap.get(seg.engineerId);
                    if (!leadSummary) {
                        const fallbackEng = engineerMap.get(seg.engineerId) || { id: seg.engineerId, name: 'Unknown Engineer' };
                        leadSummary = {
                            engineer: fallbackEng,
                            leadSegmentsCount: 0,
                            assistSegmentsCount: 0,
                            totalAllocatedHours: 0,
                            totalActualHours: 0,
                            leadCreditedHours: 0,
                            assistCreditedHours: 0,
                            totalCreditedHours: 0,
                            efficiency: 100,
                            hourlyRate: fallbackEng.hourlyRate,
                            estimatedLaborPay: 0,
                            breakdown: []
                        };
                        summaryMap.set(seg.engineerId, leadSummary);
                    }

                    leadSummary.leadSegmentsCount += 1;
                    leadSummary.totalAllocatedHours += leadAllocated;
                    leadSummary.totalActualHours += actualHours;
                    leadSummary.leadCreditedHours += leadCredited;
                    leadSummary.totalCreditedHours += leadCredited;

                    leadSummary.breakdown.push({
                        jobId: job.id,
                        jobNumber: job.jobNumber || job.id.substring(0, 8),
                        vehicleReg,
                        segmentDescription: seg.description || `Segment ${segIdx + 1}`,
                        date: segDate,
                        isLead: true,
                        leadEngineerName: leadSummary.engineer.name,
                        allocatedHours,
                        actualHours,
                        sharePercentage: leadPercent,
                        creditedHours: leadCredited,
                        notes: assists.length > 0 ? `Lead share (${leadPercent}%) with ${assists.length} assist(s)` : 'Solo lead'
                    });
                }

                // Assists / helpers recording
                assists.forEach(assist => {
                    if (!assist.engineerId) return;
                    let helperSummary = summaryMap.get(assist.engineerId);
                    if (!helperSummary) {
                        const fallbackHelper = engineerMap.get(assist.engineerId) || { id: assist.engineerId, name: 'Unknown Helper' };
                        helperSummary = {
                            engineer: fallbackHelper,
                            leadSegmentsCount: 0,
                            assistSegmentsCount: 0,
                            totalAllocatedHours: 0,
                            totalActualHours: 0,
                            leadCreditedHours: 0,
                            assistCreditedHours: 0,
                            totalCreditedHours: 0,
                            efficiency: 100,
                            hourlyRate: fallbackHelper.hourlyRate,
                            estimatedLaborPay: 0,
                            breakdown: []
                        };
                        summaryMap.set(assist.engineerId, helperSummary);
                    }

                    const assistPercent = Math.min(100, Math.max(0, Number(assist.percentage) || 0));
                    const helperCredited = actualHours * (assistPercent / 100);
                    const helperAllocated = allocatedHours * (assistPercent / 100);
                    const leadEngName = seg.engineerId ? (engineerMap.get(seg.engineerId)?.name || 'Lead') : 'Unassigned';

                    helperSummary.assistSegmentsCount += 1;
                    helperSummary.totalAllocatedHours += helperAllocated;
                    helperSummary.assistCreditedHours += helperCredited;
                    helperSummary.totalCreditedHours += helperCredited;

                    helperSummary.breakdown.push({
                        jobId: job.id,
                        jobNumber: job.jobNumber || job.id.substring(0, 8),
                        vehicleReg,
                        segmentDescription: seg.description || `Segment ${segIdx + 1}`,
                        date: segDate,
                        isLead: false,
                        leadEngineerName: leadEngName,
                        allocatedHours: helperAllocated,
                        actualHours: actualHours,
                        sharePercentage: assistPercent,
                        creditedHours: helperCredited,
                        notes: assist.notes || `Assisting ${leadEngName} (${assistPercent}%)`
                    });
                });
            });
        });

        // Compute efficiency & pay
        const list = Array.from(summaryMap.values()).map(item => {
            const efficiency = item.totalCreditedHours > 0 
                ? Math.round((item.totalAllocatedHours / item.totalCreditedHours) * 100)
                : 100;
            const estimatedLaborPay = item.hourlyRate 
                ? Number((item.totalCreditedHours * item.hourlyRate).toFixed(2))
                : undefined;

            return {
                ...item,
                efficiency,
                estimatedLaborPay
            };
        });

        // Sort by total credited hours desc
        return list.sort((a, b) => b.totalCreditedHours - a.totalCreditedHours);
    }, [jobs, engineers, selectedYear, selectedMonth, entityFilter, vehicleMap, engineerMap]);

    // Overall totals
    const grandTotals = useMemo(() => {
        return tallyData.reduce((acc, curr) => {
            acc.allocated += curr.totalAllocatedHours;
            acc.actual += curr.totalActualHours;
            acc.leadCredited += curr.leadCreditedHours;
            acc.assistCredited += curr.assistCreditedHours;
            acc.totalCredited += curr.totalCreditedHours;
            if (curr.estimatedLaborPay) acc.laborCost += curr.estimatedLaborPay;
            return acc;
        }, { allocated: 0, actual: 0, leadCredited: 0, assistCredited: 0, totalCredited: 0, laborCost: 0 });
    }, [tallyData]);

    // Filtered by search
    const filteredTally = useMemo(() => {
        if (!searchTerm.trim()) return tallyData;
        const q = searchTerm.toLowerCase();
        return tallyData.filter(t => 
            t.engineer.name.toLowerCase().includes(q) || 
            (t.engineer.specialization || '').toLowerCase().includes(q)
        );
    }, [tallyData, searchTerm]);

    // Export CSV
    const handleExportCSV = () => {
        const rows: any[] = [];
        tallyData.forEach(item => {
            rows.push({
                'Engineer Name': item.engineer.name,
                'Specialization': item.engineer.specialization || '',
                'Month': `${monthNames[selectedMonth]} ${selectedYear}`,
                'Lead Jobs Count': item.leadSegmentsCount,
                'Assist Jobs Count': item.assistSegmentsCount,
                'Total Allocated Hours': item.totalAllocatedHours.toFixed(1),
                'Lead Credited Hours': item.leadCreditedHours.toFixed(1),
                'Assist Credited Hours': item.assistCreditedHours.toFixed(1),
                'Total Credited Hours': item.totalCreditedHours.toFixed(1),
                'Efficiency %': `${item.efficiency}%`,
                'Hourly Rate (£)': item.hourlyRate ? item.hourlyRate.toFixed(2) : '',
                'Estimated Gross Pay (£)': item.estimatedLaborPay ? item.estimatedLaborPay.toFixed(2) : ''
            });
        });

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `monthly_labor_tally_${selectedYear}_${selectedMonth + 1}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30 shadow-inner">
                            <Clock size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight">Monthly Engineer Hours Tally</h2>
                                <span className="text-[10px] uppercase font-bold tracking-widest bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                                    Add-on Option
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Allocated time, actual hours worked, and nominated helper assist distribution
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors shadow-sm"
                            title="Export to CSV for Payroll"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-400" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={() => triggerPrint()}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors shadow-sm"
                            title="Print Monthly Report"
                        >
                            <Printer size={15} className="text-indigo-300" />
                            <span>Print</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter and Date Controls */}
                <div className="p-4 sm:px-6 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    {/* Month Navigator */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
                        <button 
                            onClick={handlePrevMonth}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Previous Month"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-1.5 min-w-[140px] justify-center text-sm font-black text-gray-900">
                            <Calendar size={15} className="text-indigo-600" />
                            <span>{monthNames[selectedMonth]} {selectedYear}</span>
                        </div>
                        <button 
                            onClick={handleNextMonth}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Next Month"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Entity Filter & Search */}
                    <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
                        {businessEntities.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
                                <Filter size={14} className="text-gray-400" />
                                <select
                                    value={entityFilter}
                                    onChange={(e) => setEntityFilter(e.target.value)}
                                    className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none cursor-pointer"
                                >
                                    <option value="all">All Workshop Entities</option>
                                    {businessEntities.map(e => (
                                        <option key={e.id} value={e.id}>{e.name || e.shortCode || e.id}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filter technician..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-3 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-40 sm:w-48 font-medium"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Printable and Viewable Content */}
                <div ref={printRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-xs">
                            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                                Total Credited Hours
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-gray-900">{grandTotals.totalCredited.toFixed(1)}</span>
                                <span className="text-xs font-bold text-gray-500">hrs</span>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">Lead + Assist hours earned</span>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100 shadow-xs">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                                Total Allocated Hours
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-gray-900">{grandTotals.allocated.toFixed(1)}</span>
                                <span className="text-xs font-bold text-gray-500">hrs</span>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">Scheduled book time</span>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                                Assist Hours Shared
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-emerald-700">{grandTotals.assistCredited.toFixed(1)}</span>
                                <span className="text-xs font-bold text-emerald-600">hrs</span>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">Helper assists nominated</span>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-xl border border-amber-100 shadow-xs">
                            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                                Active Technicians
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-gray-900">
                                    {tallyData.filter(t => t.totalCreditedHours > 0).length}
                                </span>
                                <span className="text-xs font-bold text-gray-400">/ {engineers.length}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">Logged hours in month</span>
                        </div>
                    </div>

                    {/* Technicians Hours Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="py-3 px-4">Technician / Engineer</th>
                                        <th className="py-3 px-3 text-center">Jobs (Lead / Assist)</th>
                                        <th className="py-3 px-3 text-right">Allocated Time</th>
                                        <th className="py-3 px-3 text-right">Lead Hours</th>
                                        <th className="py-3 px-3 text-right">Assist Hours</th>
                                        <th className="py-3 px-3 text-right font-black text-indigo-700">Total Credited</th>
                                        <th className="py-3 px-3 text-center">Efficiency</th>
                                        {grandTotals.laborCost > 0 && <th className="py-3 px-3 text-right">Estimated Cost</th>}
                                        <th className="py-3 px-4 text-center">Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTally.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-10 text-center text-gray-400">
                                                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                                                <p className="font-semibold">No technician hours recorded for this month</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Time logged on job card segments will appear here automatically.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTally.map(row => {
                                            const isExpanded = expandedEngineerId === row.engineer.id;
                                            const hasHours = row.totalCreditedHours > 0;

                                            return (
                                                <React.Fragment key={row.engineer.id}>
                                                    <tr 
                                                        className={`hover:bg-slate-50/80 transition-colors ${
                                                            isExpanded ? 'bg-indigo-50/40' : ''
                                                        } ${!hasHours ? 'opacity-50' : ''}`}
                                                    >
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shadow-inner">
                                                                    {row.engineer.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                                                        <span>{row.engineer.name}</span>
                                                                        {row.hourlyRate && (
                                                                            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                                                                £{row.hourlyRate}/hr
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400">
                                                                        {row.engineer.specialization || 'Standard Technician'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 text-center">
                                                            <div className="inline-flex items-center gap-1 text-[11px] font-bold">
                                                                <span className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded" title="Lead Segments">
                                                                    {row.leadSegmentsCount} lead
                                                                </span>
                                                                <span className="text-gray-300">•</span>
                                                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Assist Segments">
                                                                    {row.assistSegmentsCount} assist
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-medium text-gray-600">
                                                            {row.totalAllocatedHours.toFixed(1)} hrs
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                            {row.leadCreditedHours.toFixed(1)} hrs
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-medium text-emerald-600">
                                                            {row.assistCreditedHours > 0 ? `+${row.assistCreditedHours.toFixed(1)} hrs` : '—'}
                                                        </td>

                                                        <td className="py-3 px-3 text-right font-black text-sm text-indigo-700">
                                                            {row.totalCreditedHours.toFixed(1)} hrs
                                                        </td>

                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                row.efficiency >= 100 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                {row.efficiency}%
                                                            </span>
                                                        </td>

                                                        {grandTotals.laborCost > 0 && (
                                                            <td className="py-3 px-3 text-right font-mono font-bold text-gray-800">
                                                                {row.estimatedLaborPay ? `£${row.estimatedLaborPay.toFixed(2)}` : '—'}
                                                            </td>
                                                        )}

                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                onClick={() => setExpandedEngineerId(isExpanded ? null : row.engineer.id)}
                                                                disabled={row.breakdown.length === 0}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                                                    row.breakdown.length === 0
                                                                        ? 'text-gray-300 cursor-not-allowed'
                                                                        : isExpanded
                                                                            ? 'bg-indigo-600 text-white shadow-xs'
                                                                            : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                                                                }`}
                                                            >
                                                                <span>{row.breakdown.length} items</span>
                                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Row Drilldown */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/70 border-b border-gray-200">
                                                            <td colSpan={grandTotals.laborCost > 0 ? 9 : 8} className="p-4 sm:p-5">
                                                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
                                                                    <div className="flex items-center justify-between border-b pb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <UserCheck size={16} className="text-indigo-600" />
                                                                            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-tight">
                                                                                Segment Breakdown for {row.engineer.name} ({monthNames[selectedMonth]} {selectedYear})
                                                                            </h4>
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-500 font-bold">
                                                                            {row.breakdown.length} scheduled / completed segments
                                                                        </span>
                                                                    </div>

                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left text-xs border-collapse">
                                                                            <thead>
                                                                                <tr className="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100">
                                                                                    <th className="py-2 px-2">Date</th>
                                                                                    <th className="py-2 px-2">Job # / Reg</th>
                                                                                    <th className="py-2 px-2">Segment</th>
                                                                                    <th className="py-2 px-2">Role & % Share</th>
                                                                                    <th className="py-2 px-2 text-right">Allocated</th>
                                                                                    <th className="py-2 px-2 text-right">Actual Work</th>
                                                                                    <th className="py-2 px-2 text-right font-bold text-indigo-700">Hours Credited</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50 font-normal">
                                                                                {row.breakdown.map((b, idx) => (
                                                                                    <tr key={idx} className="hover:bg-gray-50">
                                                                                        <td className="py-2 px-2 font-mono text-gray-600">{b.date}</td>
                                                                                        <td className="py-2 px-2">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <button
                                                                                                    onClick={() => onOpenJob && onOpenJob(b.jobId)}
                                                                                                    className="font-bold text-indigo-600 hover:underline"
                                                                                                    title="Open Job Card"
                                                                                                >
                                                                                                    #{b.jobNumber}
                                                                                                </button>
                                                                                                <span className="text-gray-300">•</span>
                                                                                                <span className="font-mono text-[11px] font-bold text-gray-800 bg-gray-100 px-1.5 py-0.2 rounded">
                                                                                                    {b.vehicleReg}
                                                                                                </span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-2 px-2 text-gray-800 font-medium">
                                                                                            {b.segmentDescription}
                                                                                        </td>
                                                                                        <td className="py-2 px-2">
                                                                                            {b.isLead ? (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                                    Lead ({b.sharePercentage}%)
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                                                                    Assist ({b.sharePercentage}%) • {b.leadEngineerName}
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="py-2 px-2 text-right text-gray-500">
                                                                                            {b.allocatedHours.toFixed(1)}h
                                                                                        </td>
                                                                                        <td className="py-2 px-2 text-right text-gray-500">
                                                                                            {b.actualHours.toFixed(1)}h
                                                                                        </td>
                                                                                        <td className="py-2 px-2 text-right font-black text-indigo-700">
                                                                                            {b.creditedHours.toFixed(1)}h
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                                {filteredTally.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-gray-300">
                                            <td className="py-3 px-4">Workshop Total</td>
                                            <td className="py-3 px-3 text-center text-[11px]">
                                                {grandTotals.leadCredited > 0 ? `${grandTotals.totalCredited.toFixed(1)} hrs total` : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right">{grandTotals.allocated.toFixed(1)} hrs</td>
                                            <td className="py-3 px-3 text-right">{grandTotals.leadCredited.toFixed(1)} hrs</td>
                                            <td className="py-3 px-3 text-right text-emerald-700">+{grandTotals.assistCredited.toFixed(1)} hrs</td>
                                            <td className="py-3 px-3 text-right text-sm text-indigo-800">{grandTotals.totalCredited.toFixed(1)} hrs</td>
                                            <td className="py-3 px-3 text-center">
                                                {grandTotals.totalCredited > 0
                                                    ? `${Math.round((grandTotals.allocated / grandTotals.totalCredited) * 100)}%`
                                                    : '100%'}
                                            </td>
                                            {grandTotals.laborCost > 0 && (
                                                <td className="py-3 px-3 text-right font-mono">
                                                    £{grandTotals.laborCost.toFixed(2)}
                                                </td>
                                            )}
                                            <td className="py-3 px-4"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Explanatory Helper Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex items-start gap-3">
                        <HelpCircle size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="text-[11px] text-slate-600 space-y-1">
                            <p className="font-bold text-slate-800">How Assist & Credited Hours Work</p>
                            <p>
                                Each segment has a primary <strong>Lead Engineer</strong> (Job Card Owner). When helper engineers are added to assist on a segment, the owner nominates a % share (e.g. 25%).
                                The helper is credited with their nominated % of the actual segment time, while the lead retains the remaining balance (e.g. 75%).
                                Total credited hours reflect actual production time earned and feed directly into monthly performance and payroll calculations.
                            </p>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                    <span className="text-[11px] text-gray-500 font-medium">
                        Intelligent Scheduler v8.02 • Labor Allocation & Assist Module
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-xl font-bold text-xs shadow-xs transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
};
export default MonthlyLaborTallyModal;

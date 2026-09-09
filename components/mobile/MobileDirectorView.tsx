import React, { useMemo } from 'react';
import { Job, Invoice, Estimate, Inquiry, BusinessEntity, Customer, Vehicle } from '../../types';
import { 
    Building2, TrendingUp, DollarSign, Wrench, AlertOctagon, 
    Phone, FileText, Monitor, CheckCircle, Clock, ChevronRight,
    Car, Calendar
} from 'lucide-react';
import { formatCurrency } from '../../core/utils/formatUtils';

interface MobileDirectorViewProps {
    jobs: Job[];
    invoices: Invoice[];
    estimates: Estimate[];
    inquiries: Inquiry[];
    customers: Customer[];
    vehicles: Vehicle[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    onSelectEntity: (entityId: string) => void;
    onSwitchToDesktop: () => void;
    onOpenInquiry?: (inquiry: Inquiry) => void;
}

export const MobileDirectorView: React.FC<MobileDirectorViewProps> = ({
    jobs,
    invoices,
    estimates,
    inquiries,
    customers,
    vehicles,
    businessEntities,
    selectedEntityId,
    onSelectEntity,
    onSwitchToDesktop,
    onOpenInquiry
}) => {
    // Current month calculations
    const kpis = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // 1. Invoices for current month
        const monthlyInvoices = invoices.filter(inv => {
            if (selectedEntityId && selectedEntityId !== 'all' && inv.entityId !== selectedEntityId) return false;
            if (!inv.issueDate) return false;
            const d = new Date(inv.issueDate);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const totalInvoiced = monthlyInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.grandTotal || 0), 0);
        const netLabor = monthlyInvoices.reduce((sum, inv) => {
            const laborLines = (inv.lineItems || []).filter(li => li.isLabor || li.partNumber === 'LABOUR');
            return sum + laborLines.reduce((s, li) => s + ((li.quantity || 1) * (li.unitPrice || 0)), 0);
        }, 0);

        // 2. Open Estimates
        const openEstimates = estimates.filter(e => {
            if (selectedEntityId && selectedEntityId !== 'all' && e.entityId !== selectedEntityId) return false;
            return e.status === 'Draft' || e.status === 'Sent';
        });
        const openEstimatesTotal = openEstimates.reduce((sum, e) => {
            const linesTotal = (e.lineItems || []).reduce((s, li) => s + ((li.quantity || 1) * (li.unitPrice || 0)), 0);
            return sum + linesTotal;
        }, 0);

        // 3. Active Workshop Jobs
        const activeJobs = jobs.filter(j => {
            if (selectedEntityId && selectedEntityId !== 'all' && j.entityId !== selectedEntityId) return false;
            return j.status === 'In Progress';
        });

        // 4. Completed Today
        const todayStr = now.toISOString().split('T')[0];
        const completedToday = jobs.filter(j => {
            if (selectedEntityId && selectedEntityId !== 'all' && j.entityId !== selectedEntityId) return false;
            return j.status === 'Complete' && (j.completedAt?.startsWith(todayStr) || j.scheduledDate?.startsWith(todayStr));
        });

        // 5. Urgent Inquiries needing response
        const urgentInquiries = inquiries.filter(i => {
            if (selectedEntityId && selectedEntityId !== 'all' && i.entityId && i.entityId !== selectedEntityId) return false;
            return i.status === 'Inbox' || i.status === 'New Requests' || (i as any).isUrgent;
        }).slice(0, 5);

        // 6. Urgent Findings from today's jobs
        const urgentFindings = jobs.flatMap(j => (j.inspectionFindings || []).filter(f => f.severity === 'urgent')).length;

        return {
            totalInvoiced,
            netLabor,
            openEstimatesCount: openEstimates.length,
            openEstimatesTotal,
            activeJobsCount: activeJobs.length,
            completedTodayCount: completedToday.length,
            urgentInquiries,
            urgentFindings
        };
    }, [invoices, estimates, jobs, inquiries, selectedEntityId]);

    const activeEntity = businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-20">
            {/* Top Bar */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gradient-to-tr from-amber-600 to-indigo-600 text-white rounded-xl shadow">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase tracking-wider text-white">
                                Director Pocket
                            </h1>
                            <p className="text-xs text-slate-400 font-medium">
                                Executive Performance Stream
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onSwitchToDesktop}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                        <Monitor size={14} /> Desktop View
                    </button>
                </div>

                {/* Entity Switcher Pills */}
                {businessEntities.length > 1 && (
                    <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => onSelectEntity('all')}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition border ${
                                selectedEntityId === 'all'
                                    ? 'bg-indigo-600 text-white border-indigo-400'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                        >
                            All Entities
                        </button>
                        {businessEntities.map(e => (
                            <button
                                key={e.id}
                                onClick={() => onSelectEntity(e.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition border ${
                                    selectedEntityId === e.id
                                        ? 'bg-indigo-600 text-white border-indigo-400'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                            >
                                {e.name}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <main className="p-4 max-w-2xl w-full mx-auto space-y-4">
                {/* MTD Revenue & Estimates Hero Card */}
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-900/60 rounded-2xl p-4 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                        <span className="flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-indigo-400" />
                            Month to Date Billing
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </span>
                    </div>

                    <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                        {formatCurrency(kpis.totalInvoiced)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Labor Produced</span>
                            <span className="font-bold text-slate-200">{formatCurrency(kpis.netLabor)}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Open Quotes ({kpis.openEstimatesCount})</span>
                            <span className="font-bold text-slate-200">{formatCurrency(kpis.openEstimatesTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* Workshop Live Status Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                        <Wrench size={18} className="mx-auto text-indigo-400 mb-1" />
                        <span className="text-xl font-black text-white">{kpis.activeJobsCount}</span>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">On Lifts</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                        <CheckCircle size={18} className="mx-auto text-emerald-400 mb-1" />
                        <span className="text-xl font-black text-white">{kpis.completedTodayCount}</span>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">Done Today</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                        <AlertOctagon size={18} className="mx-auto text-rose-400 mb-1" />
                        <span className="text-xl font-black text-white">{kpis.urgentFindings}</span>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">Urgent Defects</span>
                    </div>
                </div>

                {/* Urgent Inquiries Attention Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                            <Phone size={14} className="text-indigo-400" />
                            Inquiries Requiring Action ({kpis.urgentInquiries.length})
                        </h2>
                    </div>

                    {kpis.urgentInquiries.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">
                            All incoming inquiries have been responded to.
                        </p>
                    ) : (
                        <div className="space-y-2.5">
                            {kpis.urgentInquiries.map(inq => (
                                <div 
                                    key={inq.id}
                                    onClick={() => onOpenInquiry?.(inq)}
                                    className="p-3 bg-slate-950/70 border border-slate-800/90 rounded-xl hover:border-indigo-500/50 transition cursor-pointer flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-white truncate">
                                                {inq.fromName || 'Prospective Client'}
                                            </span>
                                            {inq.vehicleRegistration && (
                                                <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded bg-yellow-400 text-black">
                                                    {inq.vehicleRegistration}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 truncate mt-0.5">
                                            {inq.subject || inq.message || 'No details specified'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {inq.fromPhone && (
                                            <a 
                                                href={`tel:${inq.fromPhone}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                                                title="Call client"
                                            >
                                                <Phone size={13} />
                                            </a>
                                        )}
                                        <ChevronRight size={15} className="text-slate-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MobileDirectorView;

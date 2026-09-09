import React, { useState, useMemo, useEffect } from 'react';
import { 
    Job, Vehicle, Customer, Invoice, Estimate, Inquiry, 
    BusinessEntity, InspectionTemplate, InspectionDiagram, User 
} from '../../types';
import { 
    Wrench, CalendarDays, AlertOctagon, ClipboardCheck, BarChart3, 
    PlayCircle, PauseCircle, CheckCircle2, Phone, Wifi, WifiOff, 
    RefreshCw, Monitor, Search, Car, User as UserIcon, Clock, 
    TrendingUp, Building2, ChevronRight, X, Camera, AlertTriangle,
    ShieldAlert, Sparkles, Check, Play, ArrowRight, Layers
} from 'lucide-react';
import { formatReadableDate } from '../../core/utils/dateUtils';
import { 
    cacheWeeklyJobs, useOfflineSyncStatus, enqueueOfflineAction 
} from '../../core/services/offlineSyncService';
import FastTrackFindingModal from '../jobs/FastTrackFindingModal';
import { JobInspectionTab } from '../jobs/tabs/JobInspectionTab';
import { toast } from 'react-toastify';

export type MobileTab = 'schedule' | 'cockpit' | 'finding' | 'inspection' | 'director';

interface MobileAppShellProps {
    currentUser: User;
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
    invoices: Invoice[];
    estimates: Estimate[];
    inquiries: Inquiry[];
    businessEntities: BusinessEntity[];
    selectedEntityId?: string;
    onSelectEntity: (id: string) => void;
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
    onSaveJob: (job: Job) => Promise<void> | void;
    onSwitchToDesktop: () => void;
    onOpenInquiry?: (inquiry: Inquiry) => void;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
    currentUser,
    jobs = [],
    vehicles = [],
    customers = [],
    invoices = [],
    estimates = [],
    inquiries = [],
    businessEntities = [],
    selectedEntityId,
    onSelectEntity,
    inspectionTemplates = [],
    inspectionDiagrams = [],
    onSaveJob,
    onSwitchToDesktop,
    onOpenInquiry
}) => {
    // Determine default tab based on user role
    const isDirectorOrAdmin = currentUser.role === 'Director' || currentUser.role === 'Admin' || currentUser.role === 'admin';
    const [activeTab, setActiveTab] = useState<MobileTab>(() => isDirectorOrAdmin ? 'director' : 'schedule');

    const { isOnline, pendingCount, triggerSync, isSyncing } = useOfflineSyncStatus(async (col, rec) => {
        if (col === 'jobs') {
            await onSaveJob(rec);
        }
    });

    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [searchFilter, setSearchFilter] = useState('');
    const [activeFindingJob, setActiveFindingJob] = useState<Job | null>(null);
    const [activeInspectionJob, setActiveInspectionJob] = useState<Job | null>(null);

    // Pre-cache 7-day vault
    useEffect(() => {
        if (isOnline && jobs.length > 0) {
            cacheWeeklyJobs(currentUser.id, jobs, vehicles, customers, inspectionTemplates, inspectionDiagrams)
                .catch(err => console.warn('[Mobile App] Pre-cache error:', err));
        }
    }, [currentUser.id, jobs, vehicles, customers, inspectionTemplates, inspectionDiagrams, isOnline]);

    // Format currency helper
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
    };

    // Build rolling 7 days (yesterday, today, +5 days)
    const weekDays = useMemo(() => {
        const days = [];
        const base = new Date();
        base.setDate(base.getDate() - 1);
        const todayStr = new Date().toISOString().split('T')[0];

        for (let i = 0; i < 7; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const dayName = isToday ? 'TODAY' : d.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum = d.getDate();

            const count = jobs.filter(j => {
                const jDate = j.scheduledDate ? j.scheduledDate.split('T')[0] : '';
                const isAssigned = !currentUser.id || 
                    (j.segments && j.segments.some(s => s.engineerId === currentUser.engineerId || s.engineerId === currentUser.id));
                return isAssigned && jDate === dateStr;
            }).length;

            days.push({ dateStr, dayName, dayNum, isToday, count });
        }
        return days;
    }, [jobs, currentUser.id, currentUser.engineerId]);

    // Active in-progress job for engineer cockpit
    const inProgressJob = useMemo(() => {
        return jobs.find(j => {
            const isAssigned = !currentUser.id || 
                (j.segments && j.segments.some(s => s.engineerId === currentUser.engineerId || s.engineerId === currentUser.id));
            return isAssigned && j.status === 'In Progress';
        });
    }, [jobs, currentUser.id, currentUser.engineerId]);

    // Filter jobs for selected day
    const dayJobs = useMemo(() => {
        return jobs.filter(j => {
            const jDate = j.scheduledDate ? j.scheduledDate.split('T')[0] : '';
            const isAssigned = !currentUser.id || 
                (j.segments && j.segments.some(s => s.engineerId === currentUser.engineerId || s.engineerId === currentUser.id));
            
            const matchDay = jDate === selectedDate || (j.status === 'In Progress' && selectedDate === new Date().toISOString().split('T')[0]);
            if (!matchDay || !isAssigned) return false;

            if (searchFilter.trim()) {
                const q = searchFilter.toLowerCase().trim();
                const veh = vehicles.find(v => v.id === j.vehicleId);
                const reg = (veh?.registration || j.vehicleRegistration || '').toLowerCase();
                const desc = (j.description || '').toLowerCase();
                return reg.includes(q) || desc.includes(q) || j.id.toLowerCase().includes(q);
            }
            return true;
        });
    }, [jobs, selectedDate, currentUser.id, currentUser.engineerId, vehicles, searchFilter]);

    // Handle job status change with offline outbox fallback
    const handleUpdateJobStatus = async (job: Job, newStatus: Job['status'], reason?: string) => {
        const updatedJob: Job = {
            ...job,
            status: newStatus,
            completedAt: newStatus === 'Complete' ? new Date().toISOString() : job.completedAt,
            notes: reason ? `${job.notes || ''}\n[Status: ${newStatus}] ${reason} (${new Date().toLocaleTimeString()})`.trim() : job.notes
        };

        if (isOnline) {
            try {
                await onSaveJob(updatedJob);
                toast.success(`Job #${job.id} marked as ${newStatus}`);
            } catch (err) {
                console.warn('Direct save failed, queuing offline:', err);
                await enqueueOfflineAction({
                    actionType: 'UPDATE_JOB_STATUS',
                    collectionKey: 'jobs',
                    entityId: job.id,
                    payload: updatedJob,
                    description: `Change Job #${job.id} to ${newStatus}`
                });
                toast.info(`⚡ Saved to local vault (queued for sync)`);
            }
        } else {
            await enqueueOfflineAction({
                actionType: 'UPDATE_JOB_STATUS',
                collectionKey: 'jobs',
                entityId: job.id,
                payload: updatedJob,
                description: `Change Job #${job.id} to ${newStatus}`
            });
            await onSaveJob(updatedJob);
            toast.info(`⚡ Offline: Job #${job.id} updated locally and queued.`);
        }
    };

    // Calculate Director KPIs
    const directorKPIs = useMemo(() => {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const todayStr = now.toISOString().split('T')[0];

        const monthlyInvoices = invoices.filter(inv => {
            if (selectedEntityId && selectedEntityId !== 'all' && inv.entityId !== selectedEntityId) return false;
            if (!inv.issueDate) return false;
            const d = new Date(inv.issueDate);
            return d.getFullYear() === curYear && d.getMonth() === curMonth;
        });

        const totalInvoiced = monthlyInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.grandTotal || 0), 0);
        const netLabor = monthlyInvoices.reduce((sum, inv) => {
            const laborLines = (inv.lineItems || []).filter(li => li.isLabor || li.partNumber === 'LABOUR');
            return sum + laborLines.reduce((s, li) => s + ((li.quantity || 1) * (li.unitPrice || 0)), 0);
        }, 0);

        const openEstimates = estimates.filter(e => {
            if (selectedEntityId && selectedEntityId !== 'all' && e.entityId !== selectedEntityId) return false;
            return e.status === 'Draft' || e.status === 'Sent';
        });
        const openEstimatesTotal = openEstimates.reduce((sum, e) => {
            return sum + (e.lineItems || []).reduce((s, li) => s + ((li.quantity || 1) * (li.unitPrice || 0)), 0);
        }, 0);

        const activeJobs = jobs.filter(j => {
            if (selectedEntityId && selectedEntityId !== 'all' && j.entityId !== selectedEntityId) return false;
            return j.status === 'In Progress';
        });

        const completedToday = jobs.filter(j => {
            if (selectedEntityId && selectedEntityId !== 'all' && j.entityId !== selectedEntityId) return false;
            return j.status === 'Complete' && (j.completedAt?.startsWith(todayStr) || j.scheduledDate?.startsWith(todayStr));
        });

        const urgentInquiries = inquiries.filter(i => {
            if (selectedEntityId && selectedEntityId !== 'all' && i.entityId && i.entityId !== selectedEntityId) return false;
            return i.status === 'Inbox' || i.status === 'New Requests' || (i as any).isUrgent;
        }).slice(0, 6);

        const urgentFindingsCount = jobs.flatMap(j => (j.inspectionFindings || []).filter(f => f.severity === 'urgent')).length;

        return {
            totalInvoiced,
            netLabor,
            openEstimatesCount: openEstimates.length,
            openEstimatesTotal,
            activeJobsCount: activeJobs.length,
            completedTodayCount: completedToday.length,
            urgentInquiries,
            urgentFindingsCount
        };
    }, [invoices, estimates, jobs, inquiries, selectedEntityId]);

    // Render UK Registration Plate badge
    const renderUKPlate = (vrm: string) => {
        const cleanVrm = (vrm || 'NO REG').toUpperCase().trim();
        return (
            <div className="inline-flex items-center rounded-md overflow-hidden shadow-xs border border-slate-700/60 font-mono font-bold text-xs select-none shrink-0">
                <div className="bg-blue-700 text-white px-1 py-0.5 text-[9px] font-black flex flex-col items-center justify-center leading-none">
                    <span className="text-[7px]">🇬🇧</span>
                    <span className="text-[7px] tracking-tighter">UK</span>
                </div>
                <div className="bg-gradient-to-b from-amber-300 to-amber-400 text-slate-950 px-2 py-0.5 tracking-wider font-black">
                    {cleanVrm}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-24">
            {/* Top Bar: Frosted Glass & Safe Area */}
            <header className="sticky top-0 z-30 bg-slate-900/85 backdrop-blur-xl border-b border-slate-800/80 px-3.5 py-2.5 shadow-md">
                <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
                    {/* Brand & User Chip */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-600/30">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'B'}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black uppercase tracking-wider text-white">
                                    {currentUser.name || 'Technician'}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {currentUser.role || 'Bay'}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                                Brookspeed Intelligent Scheduler
                            </p>
                        </div>
                    </div>

                    {/* Offline / Online Pill & Desktop Switcher */}
                    <div className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                            isOnline
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            <span>{isOnline ? 'Online' : 'Offline'}</span>
                            {pendingCount > 0 && (
                                <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[9px] font-black ml-0.5">
                                    {pendingCount}
                                </span>
                            )}
                        </div>

                        {pendingCount > 0 && isOnline && (
                            <button
                                onClick={() => triggerSync()}
                                disabled={isSyncing}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
                                title="Sync pending changes"
                            >
                                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-indigo-400' : ''} />
                            </button>
                        )}

                        <button
                            onClick={onSwitchToDesktop}
                            className="p-1.5 px-2 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition"
                            title="Return to Desktop View"
                        >
                            <Monitor size={13} />
                            <span className="hidden sm:inline">Desktop</span>
                        </button>
                    </div>
                </div>

                {/* Offline Alert Strip */}
                {!isOnline && (
                    <div className="mt-2 p-1.5 px-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-[11px] flex items-center justify-between max-w-2xl mx-auto">
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                            <span>Holding 7 days offline. Status & findings queued safely.</span>
                        </div>
                        {pendingCount > 0 && (
                            <span className="font-bold text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full">
                                {pendingCount} queued
                            </span>
                        )}
                    </div>
                )}
            </header>

            {/* TAB 1: SCHEDULE / BAY VIEW */}
            {activeTab === 'schedule' && (
                <div className="flex flex-col flex-1">
                    {/* Compact 7-Day Rolling Selector (48px high) */}
                    <div className="bg-slate-900/40 border-b border-slate-800/80 py-2 px-3 shrink-0">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide max-w-2xl mx-auto px-1">
                            {weekDays.map(d => {
                                const isSelected = selectedDate === d.dateStr;
                                return (
                                    <button
                                        key={d.dateStr}
                                        onClick={() => setSelectedDate(d.dateStr)}
                                        className={`flex flex-col items-center justify-center min-w-[54px] py-1.5 px-1 rounded-xl transition-all relative border active:scale-95 cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                                                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800'
                                        }`}
                                    >
                                        <span className="text-[10px] font-bold tracking-tight uppercase opacity-85">
                                            {d.dayName}
                                        </span>
                                        <span className="text-sm font-black mt-0.5">
                                            {d.dayNum}
                                        </span>
                                        {d.count > 0 && (
                                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shadow-xs ${
                                                isSelected ? 'bg-amber-400 text-slate-950' : 'bg-indigo-600 text-white'
                                            }`}>
                                                {d.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Job Stream Content */}
                    <main className="flex-1 p-3.5 max-w-2xl w-full mx-auto space-y-3">
                        {/* Quick Filter Input */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                placeholder="Filter jobs by VRM, make, or task..."
                                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            {searchFilter && (
                                <button 
                                    onClick={() => setSearchFilter('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Active In-Progress Quick Banner (if any) */}
                        {inProgressJob && (
                            <div 
                                onClick={() => setActiveTab('cockpit')}
                                className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/50 rounded-2xl p-3 shadow-lg shadow-indigo-950/40 flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                                        <PlayCircle size={20} className="animate-pulse" />
                                    </div>
                                    <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-400">
                                                Active Cockpit
                                            </span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        </div>
                                        <p className="text-xs font-bold text-white truncate">
                                            {vehicles.find(v => v.id === inProgressJob.vehicleId)?.registration || inProgressJob.vehicleRegistration || 'Vehicle'} • {inProgressJob.description}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1 shrink-0 ml-2">
                                    View <ChevronRight size={14} />
                                </span>
                            </div>
                        )}

                        {/* Jobs List */}
                        {dayJobs.length === 0 ? (
                            <div className="text-center py-14 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/60">
                                <CheckCircle2 size={36} className="mx-auto text-slate-600 mb-2" />
                                <h3 className="text-sm font-bold text-slate-300">No Jobs Scheduled</h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                                    No tasks allocated to your bay for {formatReadableDate(selectedDate)}.
                                </p>
                            </div>
                        ) : (
                            dayJobs.map(job => {
                                const vehicle = vehicles.find(v => v.id === job.vehicleId);
                                const customer = customers.find(c => c.id === job.customerId);
                                const isInProgress = job.status === 'In Progress';
                                const isCompleted = job.status === 'Complete';
                                const isPaused = job.status === 'Paused';
                                const lift = job.segments?.[0]?.allocatedLift;

                                return (
                                    <div 
                                        key={job.id}
                                        className={`rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden border ${
                                            isInProgress
                                                ? 'bg-slate-900/90 border-indigo-500/70 shadow-indigo-950/50 ring-1 ring-indigo-500/30'
                                                : isCompleted
                                                ? 'bg-slate-900/50 border-emerald-900/40 opacity-90'
                                                : 'bg-slate-900/70 border-slate-800/90'
                                        }`}
                                    >
                                        {/* Header: VRM, Model, Status */}
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {renderUKPlate(vehicle?.registration || job.vehicleRegistration || '')}
                                                <span className="text-xs font-bold text-slate-200">
                                                    {vehicle?.make || ''} {vehicle?.model || ''}
                                                </span>
                                                {lift && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                                                        Lift {lift}
                                                    </span>
                                                )}
                                            </div>

                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                                                isInProgress
                                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                                                    : isCompleted
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                    : isPaused
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                            }`}>
                                                {job.status}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <h3 className="text-sm font-bold text-white mt-2 leading-snug">
                                            {job.description}
                                        </h3>

                                        {/* Customer & Parts Pill Row */}
                                        <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5 pt-2 border-t border-slate-800/70">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <UserIcon size={12} className="text-slate-500 shrink-0" />
                                                <span className="truncate">{customer ? `${customer.forename} ${customer.surname}` : 'Customer'}</span>
                                                {customer?.phone && (
                                                    <a 
                                                        href={`tel:${customer.phone}`}
                                                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-indigo-400 ml-1 inline-flex items-center"
                                                        title="Call Customer"
                                                    >
                                                        <Phone size={10} />
                                                    </a>
                                                )}
                                            </div>

                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                                job.partsStatus === 'Fully Received'
                                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                                                    : job.partsStatus === 'Awaiting Order'
                                                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                                {job.partsStatus || 'No Parts'}
                                            </span>
                                        </div>

                                        {/* Primary Time-Clock Action */}
                                        <div className="mt-3">
                                            {!isInProgress && !isCompleted && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateJobStatus(job, 'In Progress')}
                                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-[0.98] transition cursor-pointer"
                                                >
                                                    <Play size={14} /> Clock In / Start Work
                                                </button>
                                            )}

                                            {isInProgress && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const reason = window.prompt('Reason for pausing (e.g. Parts, Customer Approval):');
                                                            handleUpdateJobStatus(job, 'Paused', reason || undefined);
                                                        }}
                                                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                                                    >
                                                        <PauseCircle size={14} /> Pause
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateJobStatus(job, 'Complete')}
                                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-[0.98] transition cursor-pointer"
                                                    >
                                                        <CheckCircle2 size={14} /> Complete Job
                                                    </button>
                                                </div>
                                            )}

                                            {isPaused && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateJobStatus(job, 'In Progress')}
                                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                                                >
                                                    <PlayCircle size={14} /> Resume Work
                                                </button>
                                            )}

                                            {isCompleted && (
                                                <div className="w-full py-1.5 bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                                                    <Check size={13} /> Completed & Signed Off
                                                </div>
                                            )}
                                        </div>

                                        {/* Secondary Tool Chips Row */}
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60">
                                            <button
                                                type="button"
                                                onClick={() => setActiveFindingJob(job)}
                                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                                            >
                                                <AlertOctagon size={13} className="text-rose-400 shrink-0" />
                                                <span>Ramp Finding</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveInspectionJob(job)}
                                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                                            >
                                                <ClipboardCheck size={13} className="text-indigo-400 shrink-0" />
                                                <span>Inspection</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </main>
                </div>
            )}

            {/* TAB 2: ACTIVE COCKPIT MODE */}
            {activeTab === 'cockpit' && (
                <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
                    {inProgressJob ? (
                        <div className="space-y-4">
                            {/* Live Cockpit Card */}
                            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                        In Progress on Lift
                                    </span>
                                    {inProgressJob.segments?.[0]?.allocatedLift && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            Lift {inProgressJob.segments[0].allocatedLift}
                                        </span>
                                    )}
                                </div>

                                <div className="my-2">
                                    {renderUKPlate(vehicles.find(v => v.id === inProgressJob.vehicleId)?.registration || inProgressJob.vehicleRegistration || '')}
                                    <h2 className="text-lg font-black text-white mt-2">
                                        {vehicles.find(v => v.id === inProgressJob.vehicleId)?.make} {vehicles.find(v => v.id === inProgressJob.vehicleId)?.model}
                                    </h2>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        {inProgressJob.description}
                                    </p>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                                        <p className="font-semibold text-slate-200">
                                            {customers.find(c => c.id === inProgressJob.customerId)?.forename} {customers.find(c => c.id === inProgressJob.customerId)?.surname}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Parts Status</span>
                                        <p className="font-semibold text-slate-200">
                                            {inProgressJob.partsStatus || 'No Parts'}
                                        </p>
                                    </div>
                                </div>

                                {/* Cockpit Direct Actions */}
                                <div className="grid grid-cols-2 gap-2.5 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const reason = window.prompt('Reason for pausing:');
                                            handleUpdateJobStatus(inProgressJob, 'Paused', reason || undefined);
                                        }}
                                        className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                                    >
                                        <PauseCircle size={16} /> Pause Job
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateJobStatus(inProgressJob, 'Complete')}
                                        className="py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/40 active:scale-95 transition"
                                    >
                                        <CheckCircle2 size={16} /> Sign Off
                                    </button>
                                </div>
                            </div>

                            {/* Cockpit Toolset: Findings & Inspection */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveFindingJob(inProgressJob)}
                                    className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/60 to-slate-900 border border-rose-700/50 flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center border border-rose-500/40">
                                        <AlertOctagon size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-white uppercase tracking-wider block">
                                            Ramp Finding
                                        </span>
                                        <span className="text-[10px] text-rose-300">
                                            Snap defect photo
                                        </span>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveInspectionJob(inProgressJob)}
                                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/40">
                                        <ClipboardCheck size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-white uppercase tracking-wider block">
                                            Inspection
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Checklist & Tyres
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 px-4 bg-slate-900/40 rounded-3xl border border-slate-800/80">
                            <Clock size={42} className="mx-auto text-slate-600 mb-3" />
                            <h3 className="text-base font-bold text-slate-200">No Job Clocked In</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                You are not currently clocked in to an active job. Select a job from your schedule to start work.
                            </p>
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className="mt-4 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider active:scale-95 transition"
                            >
                                Open Bay Schedule
                            </button>
                        </div>
                    )}
                </main>
            )}

            {/* TAB 3: QUICK RAMP FINDING STUDIO */}
            {activeTab === 'finding' && (
                <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-2">
                            <Camera size={24} />
                        </div>
                        <h2 className="text-base font-black text-white uppercase tracking-wider">
                            Ramp Finding Camera
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                            Snap immediate vehicle defect photos, assign severity, and notify front desk.
                        </p>

                        <div className="mt-4 space-y-2 text-left">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                                Select Vehicle / Job:
                            </span>
                            {jobs.filter(j => j.status === 'In Progress' || j.status === 'Allocated').map(j => {
                                const veh = vehicles.find(v => v.id === j.vehicleId);
                                return (
                                    <button
                                        key={j.id}
                                        type="button"
                                        onClick={() => setActiveFindingJob(j)}
                                        className="w-full p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between active:scale-95 transition text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {renderUKPlate(veh?.registration || j.vehicleRegistration || '')}
                                            <div>
                                                <span className="text-xs font-bold text-white block">
                                                    {veh?.make} {veh?.model}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {j.description}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-500" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </main>
            )}

            {/* TAB 4: INSPECTION STUDIO */}
            {activeTab === 'inspection' && (
                <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <ClipboardCheck size={16} className="text-indigo-400" />
                            Inspection Sheets
                        </h2>
                        <span className="text-[10px] text-slate-400">
                            Select a job to inspect
                        </span>
                    </div>

                    {jobs.filter(j => j.status !== 'Complete' && j.status !== 'Closed').map(j => {
                        const veh = vehicles.find(v => v.id === j.vehicleId);
                        const hasChecklist = (j.inspectionChecklist || []).length > 0;
                        const hasTyres = Boolean(j.tyreCheck);

                        return (
                            <div 
                                key={j.id}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3"
                            >
                                <div className="truncate">
                                    <div className="flex items-center gap-2 mb-1">
                                        {renderUKPlate(veh?.registration || j.vehicleRegistration || '')}
                                        <span className="text-xs font-bold text-slate-200">
                                            {veh?.make} {veh?.model}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 truncate">
                                        {j.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            hasChecklist ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            {hasChecklist ? 'Checklist Active' : 'No Checklist'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            hasTyres ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            {hasTyres ? 'Tyres Logged' : 'No Tyres'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setActiveInspectionJob(j)}
                                    className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 active:scale-95 transition cursor-pointer"
                                >
                                    Inspect
                                </button>
                            </div>
                        );
                    })}
                </main>
            )}

            {/* TAB 5: DIRECTOR POCKET */}
            {activeTab === 'director' && (
                <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
                    {/* Entity Switcher */}
                    {businessEntities.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
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

                    {/* MTD Revenue Hero Card */}
                    <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-900/60 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                            <span className="flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-indigo-400" />
                                Month to Date Billing
                            </span>
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>

                        <div className="text-3xl font-black text-white tracking-tight mt-1">
                            {formatCurrency(directorKPIs.totalInvoiced)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Labor Produced</span>
                                <span className="font-bold text-slate-200">{formatCurrency(directorKPIs.netLabor)}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Open Quotes ({directorKPIs.openEstimatesCount})</span>
                                <span className="font-bold text-slate-200">{formatCurrency(directorKPIs.openEstimatesTotal)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Workshop Live Status Grid */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                            <Wrench size={18} className="mx-auto text-indigo-400 mb-1" />
                            <span className="text-xl font-black text-white">{directorKPIs.activeJobsCount}</span>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">On Lifts</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                            <CheckCircle2 size={18} className="mx-auto text-emerald-400 mb-1" />
                            <span className="text-xl font-black text-white">{directorKPIs.completedTodayCount}</span>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">Done Today</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center shadow-xs">
                            <AlertOctagon size={18} className="mx-auto text-rose-400 mb-1" />
                            <span className="text-xl font-black text-white">{directorKPIs.urgentFindingsCount}</span>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase mt-0.5">Urgent Fixes</span>
                        </div>
                    </div>

                    {/* Urgent Inquiries Stream */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-400" />
                                Action Inquiries ({directorKPIs.urgentInquiries.length})
                            </h3>
                            <span className="text-[10px] text-slate-400">Tap to dial</span>
                        </div>

                        <div className="space-y-2">
                            {directorKPIs.urgentInquiries.length === 0 ? (
                                <p className="text-xs text-slate-500 py-3 text-center">No urgent inquiries waiting.</p>
                            ) : (
                                directorKPIs.urgentInquiries.map(inq => (
                                    <div 
                                        key={inq.id}
                                        className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2"
                                    >
                                        <div 
                                            onClick={() => onOpenInquiry?.(inq)}
                                            className="truncate cursor-pointer flex-1"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-white truncate">{inq.fromName}</span>
                                                {inq.vehicleRegistration && (
                                                    <span className="text-[9px] font-mono font-bold px-1 rounded bg-yellow-400 text-black">
                                                        {inq.vehicleRegistration}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{inq.subject || inq.message}</p>
                                        </div>

                                        {(inq.fromPhone || inq.fromContact) && (
                                            <a 
                                                href={`tel:${inq.fromPhone || inq.fromContact}`}
                                                className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg active:scale-95 transition shrink-0"
                                                title="Call Client"
                                            >
                                                <Phone size={13} />
                                            </a>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            )}

            {/* FLOATING GLASSMORPHIC BOTTOM NAVIGATION BAR */}
            <nav className="fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-1.5 flex items-center justify-around">
                {/* 1. Schedule Tab */}
                <button
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-90 cursor-pointer ${
                        activeTab === 'schedule' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <CalendarDays size={20} />
                    <span className="text-[10px] mt-0.5">Schedule</span>
                </button>

                {/* 2. Cockpit Tab */}
                <button
                    type="button"
                    onClick={() => setActiveTab('cockpit')}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-90 relative cursor-pointer ${
                        activeTab === 'cockpit' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Wrench size={20} />
                    {inProgressJob && (
                        <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                    <span className="text-[10px] mt-0.5">Cockpit</span>
                </button>

                {/* 3. Hero Center Action: Fast Defect Camera */}
                <button
                    type="button"
                    onClick={() => {
                        if (inProgressJob) {
                            setActiveFindingJob(inProgressJob);
                        } else if (jobs.length > 0) {
                            setActiveTab('finding');
                        } else {
                            toast.info('No jobs available to log defect');
                        }
                    }}
                    className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-tr from-rose-600 via-amber-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 active:scale-90 transition cursor-pointer border-2 border-slate-900"
                    title="Quick Ramp Defect Camera"
                >
                    <Camera size={22} />
                </button>

                {/* 4. Inspection Tab */}
                <button
                    type="button"
                    onClick={() => setActiveTab('inspection')}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-90 cursor-pointer ${
                        activeTab === 'inspection' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <ClipboardCheck size={20} />
                    <span className="text-[10px] mt-0.5">Inspect</span>
                </button>

                {/* 5. Director Tab */}
                <button
                    type="button"
                    onClick={() => setActiveTab('director')}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-90 cursor-pointer ${
                        activeTab === 'director' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <BarChart3 size={20} />
                    <span className="text-[10px] mt-0.5">Director</span>
                </button>
            </nav>

            {/* Fast-Track Ramp Finding Modal */}
            {activeFindingJob && (
                <FastTrackFindingModal
                    isOpen={true}
                    onClose={() => setActiveFindingJob(null)}
                    job={activeFindingJob}
                    vehicle={vehicles.find(v => v.id === activeFindingJob.vehicleId)}
                    customer={customers.find(c => c.id === activeFindingJob.customerId)}
                    onSaveJob={async (updated) => {
                        await handleUpdateJobStatus(updated, updated.status || activeFindingJob.status);
                        setActiveFindingJob(null);
                    }}
                />
            )}

            {/* Full Mobile Inspection Studio Modal */}
            {activeInspectionJob && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
                    <div className="bg-slate-900 text-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-800 overflow-hidden max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {renderUKPlate(vehicles.find(v => v.id === activeInspectionJob.vehicleId)?.registration || activeInspectionJob.vehicleRegistration || '')}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Vehicle Inspection
                                    </h3>
                                    <p className="text-[10px] text-slate-400">
                                        Job #{activeInspectionJob.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveInspectionJob(null)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            >
                                Done
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1 bg-slate-900">
                            <JobInspectionTab
                                checklistData={activeInspectionJob.inspectionChecklist || []}
                                tyreData={activeInspectionJob.tyreCheck || {}}
                                damagePoints={activeInspectionJob.damagePoints || []}
                                vehicleModel={vehicles.find(v => v.id === activeInspectionJob.vehicleId)?.model}
                                vehicleColor={vehicles.find(v => v.id === activeInspectionJob.vehicleId)?.colour}
                                diagramImageId={null}
                                isReadOnly={false}
                                onChecklistUpdate={async (updated) => {
                                    const updatedJob = { ...activeInspectionJob, inspectionChecklist: updated };
                                    setActiveInspectionJob(updatedJob);
                                    await handleUpdateJobStatus(updatedJob, updatedJob.status);
                                }}
                                onTyreUpdate={async (updated) => {
                                    const updatedJob = { ...activeInspectionJob, tyreCheck: updated };
                                    setActiveInspectionJob(updatedJob);
                                    await handleUpdateJobStatus(updatedJob, updatedJob.status);
                                }}
                                onDamageReportUpdate={async (updated) => {
                                    const updatedJob = { ...activeInspectionJob, damagePoints: updated };
                                    setActiveInspectionJob(updatedJob);
                                    await handleUpdateJobStatus(updatedJob, updatedJob.status);
                                }}
                                onApplyTemplate={async (template) => {
                                    const updatedJob = { 
                                        ...activeInspectionJob, 
                                        inspectionChecklist: template.sections || [] 
                                    };
                                    setActiveInspectionJob(updatedJob);
                                    await handleUpdateJobStatus(updatedJob, updatedJob.status);
                                    toast.success(`Applied template: ${template.name}`);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileAppShell;

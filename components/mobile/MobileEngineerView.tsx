import React, { useState, useMemo, useEffect } from 'react';
import { Job, Vehicle, Customer, InspectionTemplate, InspectionDiagram, User } from '../../types';
import { 
    Wrench, Car, User as UserIcon, Clock, AlertOctagon, CheckCircle2, 
    PauseCircle, PlayCircle, ClipboardCheck, Phone, RefreshCw, 
    Wifi, WifiOff, Monitor, ChevronRight, AlertTriangle, ShieldCheck,
    Camera, FileText, Check, Plus, MessageSquare, CalendarDays
} from 'lucide-react';
import { formatReadableDate, formatScheduledArrivalDate } from '../../core/utils/dateUtils';
import { TIME_SEGMENTS } from '../../constants';
import { cacheWeeklyJobs, getCachedWeeklyVault, useOfflineSyncStatus, enqueueOfflineAction } from '../../core/services/offlineSyncService';
import FastTrackFindingModal from '../jobs/FastTrackFindingModal';
import { JobInspectionTab } from '../jobs/tabs/JobInspectionTab';
import { toast } from 'react-toastify';

interface MobileEngineerViewProps {
    currentUser: User;
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
    onSaveJob: (job: Job) => Promise<void> | void;
    onSwitchToDesktop: () => void;
}

export const MobileEngineerView: React.FC<MobileEngineerViewProps> = ({
    currentUser,
    jobs,
    vehicles,
    customers,
    inspectionTemplates,
    inspectionDiagrams,
    onSaveJob,
    onSwitchToDesktop
}) => {
    const { isOnline, pendingCount, triggerSync, isSyncing } = useOfflineSyncStatus(async (col, rec) => {
        if (col === 'jobs') {
            await onSaveJob(rec);
        }
    });

    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [activeFindingJob, setActiveFindingJob] = useState<Job | null>(null);
    const [activeInspectionJob, setActiveInspectionJob] = useState<Job | null>(null);
    const [searchFilter, setSearchFilter] = useState('');

    // Pre-cache the 7-day vault whenever online and jobs change
    useEffect(() => {
        if (isOnline && jobs.length > 0) {
            cacheWeeklyJobs(currentUser.id, jobs, vehicles, customers, inspectionTemplates, inspectionDiagrams)
                .then(() => console.log('[Mobile Engine] 7-Day Vault cached successfully.'))
                .catch(err => console.warn('[Mobile Engine] Failed to cache vault:', err));
        }
    }, [currentUser.id, jobs, vehicles, customers, inspectionTemplates, inspectionDiagrams, isOnline]);

    // Build rolling 7-day selector (yesterday, today, +6 days)
    const weekDays = useMemo(() => {
        const days = [];
        const base = new Date();
        base.setDate(base.getDate() - 1); // include yesterday
        for (let i = 0; i < 8; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const dayName = isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            
            // Count jobs for this day
            const count = jobs.filter(j => {
                const jDate = j.scheduledDate ? j.scheduledDate.split('T')[0] : '';
                const isDirectorOrAdmin = currentUser.role === 'Director' || currentUser.role === 'Admin' || currentUser.role === 'admin' || currentUser.role !== 'Engineer';
                const isAssigned = isDirectorOrAdmin || !currentUser.id || 
                    (j.segments && j.segments.some(s => s.engineerId === currentUser.engineerId || s.engineerId === currentUser.id));
                return isAssigned && jDate === dateStr;
            }).length;

            days.push({ dateStr, dayName, dayNum, isToday, count });
        }
        return days;
    }, [jobs, currentUser.id, currentUser.engineerId, currentUser.role]);

    // Filter jobs for selected day
    const dayJobs = useMemo(() => {
        const isDirectorOrAdmin = currentUser.role === 'Director' || currentUser.role === 'Admin' || currentUser.role === 'admin' || currentUser.role !== 'Engineer';
        return jobs.filter(j => {
            const jDate = j.scheduledDate ? j.scheduledDate.split('T')[0] : '';
            const isAssigned = isDirectorOrAdmin || !currentUser.id || 
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
    }, [jobs, selectedDate, currentUser.id, vehicles, searchFilter]);

    // Handle job status mutation with offline queue fallback
    const handleUpdateJobStatus = async (job: Job, newStatus: Job['status'], reason?: string) => {
        const timestamp = new Date().toISOString();
        const updatedJob: Job = {
            ...job,
            status: newStatus,
            notes: reason ? `${job.notes || ''}\n[Status: ${newStatus}] ${reason} (${new Date().toLocaleTimeString()})`.trim() : job.notes
        };

        if (isOnline) {
            try {
                await onSaveJob(updatedJob);
                toast.success(`Job #${job.id} marked as ${newStatus}`);
            } catch (err) {
                console.warn('Direct save failed, queueing offline:', err);
                await enqueueOfflineAction({
                    actionType: 'UPDATE_JOB_STATUS',
                    collectionKey: 'jobs',
                    entityId: job.id,
                    payload: updatedJob,
                    description: `Change Job #${job.id} status to ${newStatus}`
                });
                toast.info(`⚡ Saved to Offline Vault (queued for sync)`);
            }
        } else {
            await enqueueOfflineAction({
                actionType: 'UPDATE_JOB_STATUS',
                collectionKey: 'jobs',
                entityId: job.id,
                payload: updatedJob,
                description: `Change Job #${job.id} status to ${newStatus}`
            });
            await onSaveJob(updatedJob); // updates local optimistic state
            toast.info(`⚡ Offline: Job #${job.id} updated locally and queued.`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
            {/* Top Bar / Offline Monitor */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow">
                            <Wrench size={18} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                Engineer Bay
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    7-Day Vault
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400 font-medium">
                                {currentUser.name || 'Technician'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Offline / Online indicator */}
                        <div 
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                                isOnline
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : 'bg-amber-950/90 text-amber-300 border-amber-600/80 animate-pulse'
                            }`}
                        >
                            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                            <span>{isOnline ? 'Online' : 'Offline'}</span>
                            {pendingCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </div>

                        {pendingCount > 0 && isOnline && (
                            <button
                                onClick={() => triggerSync()}
                                disabled={isSyncing}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                                title="Sync pending changes"
                            >
                                <RefreshCw size={15} className={isSyncing ? 'animate-spin text-indigo-400' : ''} />
                            </button>
                        )}

                        <button
                            onClick={onSwitchToDesktop}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                            title="Switch to Full Desktop View"
                        >
                            <Monitor size={15} />
                            <span className="hidden sm:inline">Desktop</span>
                        </button>
                    </div>
                </div>

                {/* Offline Banner Alert */}
                {!isOnline && (
                    <div className="mt-2.5 p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                            <span><strong>Offline Mode:</strong> Holding jobs for the week. Inspections & findings queued safely.</span>
                        </div>
                        {pendingCount > 0 && (
                            <span className="font-bold text-[11px] bg-amber-400 text-black px-2 py-0.5 rounded-full">
                                {pendingCount} queued
                            </span>
                        )}
                    </div>
                )}
            </header>

            {/* Rolling 7-Day Selector Bar */}
            <div className="bg-slate-900/60 border-b border-slate-800/80 px-2 py-2.5 overflow-x-auto scrollbar-hide shrink-0">
                <div className="flex items-center gap-2 min-w-max px-2">
                    {weekDays.map(d => {
                        const isSelected = selectedDate === d.dateStr;
                        return (
                            <button
                                key={d.dateStr}
                                onClick={() => setSelectedDate(d.dateStr)}
                                className={`px-3 py-2 rounded-xl text-center transition flex flex-col items-center justify-center min-w-[70px] border cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/30'
                                        : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                                }`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                                    {d.dayName}
                                </span>
                                <span className="text-xs font-black">
                                    {d.dayNum}
                                </span>
                                {d.count > 0 && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full mt-0.5 ${
                                        isSelected ? 'bg-white text-indigo-700' : 'bg-slate-700 text-slate-300'
                                    }`}>
                                        {d.count} {d.count === 1 ? 'job' : 'jobs'}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Job Stream */}
            <main className="flex-1 p-3 sm:p-4 max-w-3xl w-full mx-auto space-y-3.5 pb-20">
                {/* Search / Filter */}
                <div className="relative">
                    <input 
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Filter by VRM, job description..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {dayJobs.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-slate-800/60">
                        <CheckCircle2 size={42} className="mx-auto text-slate-600 mb-3" />
                        <h3 className="text-base font-bold text-slate-300">No Jobs Scheduled</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                            No active or allocated tasks assigned to you for {formatReadableDate(selectedDate)}.
                        </p>
                    </div>
                ) : (
                    dayJobs.map(job => {
                        const vehicle = vehicles.find(v => v.id === job.vehicleId);
                        const customer = customers.find(c => c.id === job.customerId);
                        const isInProgress = job.status === 'In Progress';
                        const isCompleted = job.status === 'Complete';
                        const isPaused = job.status === 'Paused';

                        return (
                            <div 
                                key={job.id} 
                                className={`rounded-2xl border transition-all p-4 shadow-sm relative overflow-hidden ${
                                    isInProgress
                                        ? 'bg-slate-900 border-indigo-500/80 shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                                        : isCompleted
                                        ? 'bg-slate-900/60 border-emerald-900/50 opacity-90'
                                        : 'bg-slate-900 border-slate-800'
                                }`}
                            >
                                {/* Top Header: Reg, Make/Model, Status */}
                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-yellow-400 text-black border border-yellow-500 shadow-xs">
                                                {vehicle?.registration || job.vehicleRegistration || 'NO REG'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-200">
                                                {vehicle?.make || ''} {vehicle?.model || ''}
                                            </span>
                                            {job.segments?.[0]?.allocatedLift && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                    Lift {job.segments[0].allocatedLift}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-sm font-bold text-white mt-1.5 leading-snug">
                                            {job.description}
                                        </h2>

                                        {/* Scheduled Arrival Date & Vehicle Status Badge */}
                                        {(() => {
                                            const rawDate = job.scheduledDate || job.segments?.[0]?.date;
                                            const arrivalDateFormatted = formatScheduledArrivalDate(rawDate);
                                            const startSeg = job.segments?.find(s => s.scheduledStartSegment !== null && s.scheduledStartSegment !== undefined)?.scheduledStartSegment;
                                            const timeStr = (startSeg !== undefined && startSeg !== null && TIME_SEGMENTS[startSeg]) ? TIME_SEGMENTS[startSeg] : null;
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const isToday = rawDate ? rawDate.split('T')[0] === todayStr : false;

                                            return (
                                                <div className="flex items-center justify-between gap-2 text-[11px] bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800/80 my-2">
                                                    <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                                                        <CalendarDays size={12} className="text-indigo-400 shrink-0" />
                                                        <span className="text-slate-400 font-medium">Arrival:</span>
                                                        <span className={`font-bold truncate ${isToday ? 'text-indigo-300' : 'text-slate-200'}`}>
                                                            {arrivalDateFormatted}
                                                        </span>
                                                        {timeStr && (
                                                            <span className="text-indigo-400 font-bold shrink-0 flex items-center gap-0.5 ml-1">
                                                                <Clock size={10} /> {timeStr}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {job.vehicleStatus && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                                            job.vehicleStatus === 'On Site'
                                                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                                                : job.vehicleStatus === 'Awaiting Arrival'
                                                                ? 'bg-sky-950/70 text-sky-300 border-sky-800/60'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {job.vehicleStatus}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                            isInProgress
                                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                                : isCompleted
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                : isPaused
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}>
                                            {job.status}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            #{job.id}
                                        </span>
                                    </div>
                                </div>

                                {/* Customer info & Parts status */}
                                <div className="flex items-center justify-between text-xs text-slate-400 py-2 border-t border-b border-slate-800/80 mb-3 gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <UserIcon size={12} className="text-slate-500 shrink-0" />
                                        <span className="truncate">{customer ? `${customer.forename} ${customer.surname}` : 'Customer'}</span>
                                        {customer?.phone && (
                                            <a 
                                                href={`tel:${customer.phone}`}
                                                className="p-1 rounded bg-slate-800 text-indigo-400 hover:text-indigo-300 ml-1"
                                                title="Call Customer"
                                            >
                                                <Phone size={11} />
                                            </a>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                                        job.partsStatus === 'Fully Received'
                                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                                            : job.partsStatus === 'Awaiting Order'
                                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                        {job.partsStatus || 'No Parts Required'}
                                    </span>
                                </div>

                                {/* Full Workflow Action Bar */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {/* 1. Urgent Fix / Ramp Findings */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveFindingJob(job)}
                                        className="p-2.5 rounded-xl bg-gradient-to-r from-rose-900/60 to-rose-950/80 hover:from-rose-900 hover:to-rose-950 text-rose-200 border border-rose-700/60 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider shadow transition cursor-pointer"
                                    >
                                        <AlertOctagon size={15} className="text-rose-400 shrink-0" />
                                        <span>Ramp Finding</span>
                                    </button>

                                    {/* 2. Inspection Sheet / Checklists */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveInspectionJob(job)}
                                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer"
                                    >
                                        <ClipboardCheck size={15} className="text-indigo-400 shrink-0" />
                                        <span>Inspection Sheet</span>
                                    </button>
                                </div>

                                {/* Status Progress Action Buttons */}
                                <div className="flex items-center gap-2 pt-1">
                                    {!isInProgress && !isCompleted && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateJobStatus(job, 'In Progress')}
                                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                                        >
                                            <PlayCircle size={15} /> Clock In / Start
                                        </button>
                                    )}

                                    {isInProgress && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const reason = window.prompt('Reason for pausing (e.g. Parts, Customer Approval):');
                                                    handleUpdateJobStatus(job, 'Paused', reason || undefined);
                                                }}
                                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                                            >
                                                <PauseCircle size={15} /> Pause
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateJobStatus(job, 'Complete')}
                                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                                            >
                                                <CheckCircle2 size={15} /> Complete Job
                                            </button>
                                        </>
                                    )}

                                    {isPaused && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateJobStatus(job, 'In Progress')}
                                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                                        >
                                            <PlayCircle size={15} /> Resume Work
                                        </button>
                                    )}

                                    {isCompleted && (
                                        <div className="w-full py-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                                            <Check size={14} /> Completed & Signed Off
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </main>

            {/* Fast-Track Urgent Finding Modal */}
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

            {/* Full Inspection Sheet Modal */}
            {activeInspectionJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
                        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                                    Inspection Sheet • Job #{activeInspectionJob.id}
                                </h3>
                                <p className="text-xs text-slate-300">
                                    {vehicles.find(v => v.id === activeInspectionJob.vehicleId)?.registration || 'Vehicle'} • Checklists, Tyres & Damage Points
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveInspectionJob(null)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
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

export default MobileEngineerView;

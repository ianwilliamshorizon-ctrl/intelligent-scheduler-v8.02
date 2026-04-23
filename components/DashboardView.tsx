import React, { useMemo, useEffect } from 'react';
import * as T from '../types';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { getRelativeDate, formatReadableDate } from '../core/utils/dateUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { SummaryJobCard } from './shared/SummaryJobCard';
import { applyStorageRateToJob } from '../core/utils/jobUtils';
import AsyncImage from './AsyncImage';
import { X, Key, LayoutGrid, BarChart, Users, FileText, Briefcase, Car, CalendarCheck, CheckCircle, Clock, LogIn, PlayCircle, PauseCircle, Tag, MessageSquare, Wrench, UserCheck, AlertCircle, Play, ClipboardCheck, Wand2, Camera, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PrintableOnSiteList } from './PrintableOnSiteList';

// Main Dashboard Component Props
interface DashboardViewProps {
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason: string) => void;
    onRestartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: T.Job, segmentId: string) => void;
    onOpenInquiry: (inquiry: Partial<T.Inquiry>) => void;
    onOpenAssistant: (jobId: string) => void;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; colorClass: string; onClick?: () => void }> = ({ title, value, icon: Icon, colorClass, onClick }) => (
    <div 
        className={`bg-white p-4 rounded-xl shadow-md flex items-center gap-4 animate-fade-in-up ${onClick ? 'cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1' : ''}`}
        onClick={onClick}
    >
        <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon size={24} className="text-white" />
        </div>
        <div>
            <p className="text-gray-500 font-medium text-sm">{title}</p>
            <p className="text-gray-800 font-bold text-2xl">{value}</p>
        </div>
    </div>
);

const ActionButton: React.FC<{ title: string; icon: React.ElementType; onClick: () => void }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="p-4 bg-white rounded-xl shadow-md flex flex-col items-center justify-center gap-2 text-center hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border hover:border-indigo-200">
        <Icon size={28} className="text-indigo-600" />
        <span className="font-semibold text-gray-700">{title}</span>
    </button>
);

const SummaryMetrics: React.FC<{
    jobs: T.Job[];
    selectedEntityId: string;
    today: string;
    setCurrentView: (view: string) => void;
    storageBookings: T.StorageBooking[];
}> = ({ jobs, selectedEntityId, today, setCurrentView, storageBookings }) => {
    const stats = useMemo(() => {
        const activeJobs = jobs.filter(j => (selectedEntityId === 'all' || j.entityId === selectedEntityId) && j.status !== 'Cancelled');
        const jobsToday = activeJobs.flatMap(j => j.segments || []).filter(s => s.date === today && s.allocatedLift).length;
        const vehiclesOnSiteJobs = activeJobs.filter(j => j.vehicleStatus === 'On Site').length;
        
        // Add active storage bookings
        const activeStorageCount = storageBookings.filter(b => !b.endDate && (selectedEntityId === 'all' || b.entityId === selectedEntityId || selectedEntityId === 'ent_storage')).length;
        
        const vehiclesOnSite = vehiclesOnSiteJobs + activeStorageCount;
        const pendingQC = activeJobs.filter(j => j.status === 'Pending QC').length;
        const unallocatedJobs = activeJobs.filter(j => (j.segments || []).some(s => s.status === 'Unallocated')).length;
        return { jobsToday, vehiclesOnSite, pendingQC, unallocatedJobs };
    }, [jobs, selectedEntityId, today, storageBookings]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard title="Jobs Today" value={stats.jobsToday} icon={CalendarCheck} colorClass="bg-blue-500" onClick={() => setCurrentView('dispatch')} />
            <StatCard title="Vehicles On Site" value={stats.vehiclesOnSite} icon={Car} colorClass="bg-green-500" onClick={() => setCurrentView('concierge')} />
            <StatCard title="Pending QC" value={stats.pendingQC} icon={ClipboardCheck} colorClass="bg-orange-500" onClick={() => setCurrentView('concierge')} />
            <StatCard title="Unallocated Jobs" value={stats.unallocatedJobs} icon={AlertCircle} colorClass="bg-red-500" onClick={() => setCurrentView('dispatch')} />
        </div>
    );
};

const OnSiteByDivisionCard: React.FC<{ 
    jobs: T.Job[]; 
    businessEntities: T.BusinessEntity[];
    storageBookings: T.StorageBooking[];
    onSelectDivision: (entityId: string, entityName: string) => void;
}> = ({ jobs, businessEntities, storageBookings, onSelectDivision }) => {
    const data = useMemo(() => {
        const counts: Record<string, { count: number, id: string }> = {};
        jobs.forEach(job => {
            if (job.vehicleStatus === 'On Site' && job.status !== 'Cancelled') {
                const entityId = job.entityId || 'unknown';
                if (!counts[entityId]) counts[entityId] = { count: 0, id: entityId };
                counts[entityId].count++;
            }
        });

        // Add storage bookings to counts
        storageBookings.forEach(b => {
            if (!b.endDate) {
                const entityId = b.entityId || 'ent_storage';
                if (!counts[entityId]) counts[entityId] = { count: 0, id: entityId };
                counts[entityId].count++;
            }
        });

        return Object.values(counts).map(item => ({
            id: item.id,
            name: businessEntities.find(e => e.id === item.id)?.name || 'Unknown Division',
            count: item.count,
            color: businessEntities.find(e => e.id === item.id)?.color || '#6366f1'
        })).sort((a, b) => b.count - a.count);
    }, [jobs, businessEntities]);

    return (
        <Widget title="Vehicles On Site by Division" icon={LayoutGrid}>
            <div className="space-y-4">
                {data.length > 0 ? data.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-gray-700">{item.name}</span>
                            <button 
                                onClick={() => onSelectDivision(item.id, item.name)}
                                className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                            >
                                {item.count}
                            </button>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all duration-1000 ease-out" 
                                style={{ 
                                    width: `${(item.count / Math.max(...data.map(d => d.count))) * 100}%`,
                                    backgroundColor: item.color 
                                }}
                            />
                        </div>
                    </div>
                )) : <p className="text-sm text-gray-500 text-center py-8">No vehicles currently on site.</p>}
            </div>
        </Widget>
    );
};

const VehiclesOnSiteModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    entityName: string;
    jobs: T.Job[];
    storageBookings: T.StorageBooking[];
    vehicles: T.Vehicle[];
}> = ({ isOpen, onClose, entityName, jobs, storageBookings, vehicles }) => {
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `OnSite_Vehicles_${entityName}_${new Date().toISOString().split('T')[0]}`,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-500 rounded-lg text-white">
                            <Car size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-tight">Vehicles On Site</h2>
                            <p className="text-sm text-indigo-600 font-bold">{entityName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => handlePrint()}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mr-2"
                        >
                            <Printer size={18} />
                            <span>Print List</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="grid grid-cols-1 gap-3">
                        {jobs.map(job => {
                            const vehicle = vehicles.find(v => v.id === job.vehicleId);
                            return (
                                <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white px-3 py-1.5 rounded-lg border-2 border-gray-900 shadow-sm">
                                            <span className="font-black text-lg tracking-wider text-gray-900">{vehicle?.registration || 'UNKNOWN'}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">{vehicle?.make} {vehicle?.model}</p>
                                            <p className="text-sm font-medium text-gray-700">Job #{job.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1 rounded-lg border border-amber-200">
                                            <Key size={16} />
                                            <span className="font-black text-lg">{job.keyNumber || 'N/A'}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Key Cabinet No.</span>
                                    </div>
                                </div>
                            );
                        })}
                        {storageBookings.filter(b => !b.endDate && (entityName === 'All' || entityName === 'Storage' || entityName.toLowerCase().includes('storage'))).map(booking => {
                             const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                             return (
                                <div key={booking.id} className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-all shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white px-3 py-1.5 rounded-lg border-2 border-indigo-900 shadow-sm">
                                            <span className="font-black text-lg tracking-wider text-indigo-900">{vehicle?.registration || 'UNKNOWN'}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-indigo-500 font-bold uppercase tracking-tight">{vehicle?.make} {vehicle?.model}</p>
                                            <p className="text-sm font-black text-indigo-700">VEHICLE STORAGE</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1 rounded-lg border border-amber-200">
                                            <Key size={16} />
                                            <span className="font-black text-lg">{booking.keyNumber || 'N/A'}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Key Cabinet No.</span>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                </div>
                <footer className="p-4 border-t bg-gray-50 text-center">
                    <p className="text-xs text-gray-500 font-medium italic">Showing all vehicles currently marked as 'On Site' for this division.</p>
                </footer>
            </div>

            {/* Hidden printable component */}
            <div className="hidden">
                <div ref={printRef}>
                    <PrintableOnSiteList 
                        entityName={entityName}
                        jobs={jobs}
                        storageBookings={storageBookings}
                        vehicles={vehicles}
                    />
                </div>
            </div>
        </div>
    );
};

const Widget: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; }> = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-xl shadow-md flex flex-col h-full animate-fade-in-up">
        <h3 className="text-lg font-bold p-4 flex items-center gap-2 text-gray-800 border-b">
            <Icon size={20} className="text-indigo-600" /> {title}
        </h3>
        <div className="flex-grow p-4 overflow-y-auto">
            {children}
        </div>
    </div>
);

// --- Role-Specific Dashboards ---

const AdminDispatcherDashboard: React.FC<DashboardViewProps & { onSelectDivision: (id: string, name: string) => void }> = ({ onEditJob, onCheckIn, onStartWork, onPause, onRestartWork, onEngineerComplete, onOpenInquiry, onOpenAssistant, onSelectDivision }) => {
    const { jobs, inquiries, vehicles, customers, roles, engineers, purchaseOrders, storageLocations, storageBookings, saveRecord, businessEntities } = useData();
    const { selectedEntityId, setCurrentView, currentUser } = useApp();
    const today = getRelativeDate(0);

    const stats = useMemo(() => {
        const entityJobs = jobs.filter(j => j.entityId === selectedEntityId && j.status !== 'Cancelled');
        const jobsToday = entityJobs.flatMap(j => j.segments || []).filter(s => s.date === today && s.allocatedLift).length;
        const vehiclesOnSite = entityJobs.filter(j => j.vehicleStatus === 'On Site').length;
        const pendingQC = entityJobs.filter(j => j.status === 'Pending QC').length;
        const unallocatedJobs = entityJobs.filter(j => (j.segments || []).some(s => s.status === 'Unallocated')).length;
        return { jobsToday, vehiclesOnSite, pendingQC, unallocatedJobs };
    }, [jobs, selectedEntityId, today]);

    const openInquiries = useMemo(() => {
        return inquiries.filter(i => (i.status === 'New' || i.status === 'In Progress') && (selectedEntityId === 'all' || i.entityId === selectedEntityId))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    }, [inquiries, selectedEntityId]);

    const unallocatedJobList = useMemo(() => {
        return jobs.filter(j => (selectedEntityId === 'all' || j.entityId === selectedEntityId) && j.status !== 'Cancelled' && (j.segments || []).some(s => s.status === 'Unallocated')).slice(0, 5);
    }, [jobs, selectedEntityId]);
    
    const userRoleDef = roles.find(r => r.name === currentUser.role);
    const effectiveAllowedViews = currentUser.allowedViews || userRoleDef?.defaultAllowedViews || [];

    const quickActions: { id: T.ViewType, label: string, icon: React.ElementType }[] = [
        { id: 'dispatch', label: 'Dispatch', icon: CalendarCheck },
        { id: 'concierge', label: 'Service Stream', icon: Wrench },
        { id: 'inquiries', label: 'Inquiries', icon: MessageSquare },
    ];

    const allowedActions = quickActions.filter(action => 
        currentUser.role === 'Admin' || effectiveAllowedViews.includes(action.id)
    );

    return (
        <div className="space-y-6">
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} storageBookings={storageBookings} />

            <div className="mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {allowedActions.map(action => (
                        <ActionButton key={action.id} title={action.label} icon={action.icon} onClick={() => setCurrentView(action.id)} />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '400px' }}>
                <OnSiteByDivisionCard jobs={jobs} businessEntities={businessEntities} storageBookings={storageBookings} onSelectDivision={onSelectDivision} />
                <Widget title="Open Inquiries" icon={MessageSquare}>
                    <div className="space-y-3">
                        {openInquiries.length > 0 ? openInquiries.map(inq => (
                             <div 
                                key={inq.id} 
                                className="p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 hover:border-red-400 group transition-all duration-200 shadow-sm hover:shadow-md" 
                                onClick={(e) => { e.stopPropagation(); onOpenInquiry(inq); }}
                                title="Click to view inquiry"
                             >
                                 <div className="flex justify-between items-start">
                                     <div>
                                        <p className="font-semibold text-sm text-red-900 group-hover:underline group-hover:text-red-700">{inq.fromName}</p>
                                        <p className="text-xs text-red-700">{inq.fromContact}</p>
                                     </div>
                                 </div>
                                 <p className="text-xs text-gray-600 truncate mt-2">{inq.message}</p>
                             </div>
                        )) : <p className="text-sm text-gray-500 text-center py-8">No open inquiries.</p>}
                    </div>
                </Widget>
                <Widget title="Unallocated Job Queue" icon={Clock}>
                    <div className="space-y-3">
                        {unallocatedJobList.length > 0 ? unallocatedJobList.map(job => (
                             <SummaryJobCard 
                                key={job.id}
                                job={job}
                                vehicle={vehicles.find(v => v.id === job.vehicleId)}
                                customer={customers.find(c => c.id === job.customerId)}
                                purchaseOrders={purchaseOrders}
                                engineers={engineers}
                                currentUser={currentUser}
                                onEdit={onEditJob}
                                onCheckIn={onCheckIn}
                                onOpenPurchaseOrder={() => {}}
                                onOpenAssistant={onOpenAssistant}
                                onStartWork={onStartWork}
                                onPause={onPause}
                                onRestart={onRestartWork}
                                onQcApprove={() => {}}
                                onEngineerComplete={onEngineerComplete}
                                storageLocations={storageLocations}
                                onUpdateJob={(updatedJob) => saveRecord('jobs', updatedJob)}
                             />
                        )) : <p className="text-sm text-gray-500 text-center py-8">No unallocated jobs.</p>}
                    </div>
                </Widget>
            </div>
        </div>
    );
};

const EngineerDashboard: React.FC<DashboardViewProps> = (props) => {
    const { onStartWork, onPause, onEngineerComplete, onEditJob, onOpenAssistant, onRestartWork, onCheckIn } = props;
    const { currentUser, setCurrentView, selectedEntityId } = useApp();
    const { jobs, vehicles, lifts, customers, purchaseOrders, engineers, storageLocations, storageBookings, saveRecord } = useData();
    const today = getRelativeDate(0);

    const myJobsToday = useMemo(() => {
        if (!currentUser.engineerId) return [];
        return jobs.filter(job => 
            (job.segments || []).some(seg => seg.engineerId === currentUser.engineerId && seg.date === today)
        ).sort((a, b) => {
            const segA = a.segments?.find(s => s.engineerId === currentUser.engineerId && s.date === today);
            const segB = b.segments?.find(s => s.engineerId === currentUser.engineerId && s.date === today);
            return (segA?.scheduledStartSegment || 99) - (segB?.scheduledStartSegment || 99);
        });
    }, [jobs, currentUser.engineerId, today]);
    
    return (
        <div className="space-y-6">
             <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId || 'all'} today={today} setCurrentView={setCurrentView} storageBookings={storageBookings} />
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="My Jobs Today" value={myJobsToday.length} icon={Wrench} colorClass="bg-indigo-500" onClick={() => setCurrentView('concierge')} />
            </div>
            <Widget title="My Jobs for Today" icon={CalendarCheck}>
                <div className="space-y-2">
                    {myJobsToday.length > 0 ? myJobsToday.map((job) => (
                        <SummaryJobCard 
                            key={job.id}
                            job={job}
                            vehicle={vehicles.find(v => v.id === job.vehicleId)}
                            customer={customers.find(c => c.id === job.customerId)}
                            purchaseOrders={purchaseOrders}
                            engineers={engineers}
                            currentUser={currentUser}
                            onEdit={onEditJob}
                            onCheckIn={onCheckIn}
                            onOpenPurchaseOrder={() => {}}
                            onOpenAssistant={onOpenAssistant}
                            onStartWork={onStartWork}
                            onPause={(jId, sId) => onPause(jId, sId, 'Paused from dashboard')}
                            onRestart={onRestartWork}
                            onQcApprove={() => {}}
                            onEngineerComplete={onEngineerComplete}
                            storageLocations={storageLocations}
                            onUpdateJob={(updatedJob) => saveRecord('jobs', updatedJob)}
                        />
                    )) : <p className="text-sm text-gray-500 text-center py-8">You have no jobs scheduled for today.</p>}
                </div>
            </Widget>
        </div>
    );
};

const SalesDashboard: React.FC<DashboardViewProps & { onSelectDivision: (id: string, name: string) => void }> = (props) => {
    const { onSelectDivision } = props;
    const { jobs, vehicles, customers, purchaseOrders, engineers, storageLocations, storageBookings, saveRecord, businessEntities } = useData();
    const { selectedEntityId, setCurrentView, currentUser } = useApp();
    const today = getRelativeDate(0);

    const jobsToday = useMemo(() => {
        return jobs.filter(j => 
            (selectedEntityId === 'all' || j.entityId === selectedEntityId) && 
            j.status !== 'Cancelled' &&
            (j.segments || []).some(s => s.date === today)
        ).sort((a,b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
    }, [jobs, selectedEntityId, today]);

    return (
        <div className="space-y-6">
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} storageBookings={storageBookings} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <OnSiteByDivisionCard jobs={jobs} businessEntities={businessEntities} storageBookings={storageBookings} onSelectDivision={onSelectDivision} />
                <Widget title="Scheduled for Today" icon={CalendarCheck}>
                    <div className="space-y-2">
                        {jobsToday.length > 0 ? jobsToday.map(job => (
                             <SummaryJobCard 
                                key={job.id}
                                job={job}
                                vehicle={vehicles.find(v => v.id === job.vehicleId)}
                                customer={customers.find(c => c.id === job.customerId)}
                                purchaseOrders={purchaseOrders}
                                engineers={engineers}
                                currentUser={currentUser}
                                onEdit={props.onEditJob}
                                onCheckIn={props.onCheckIn}
                                onOpenPurchaseOrder={() => {}}
                                onOpenAssistant={props.onOpenAssistant}
                                onStartWork={props.onStartWork}
                                onPause={(jId, sId) => props.onPause(jId, sId, 'Paused from dashboard')}
                                onRestart={props.onRestartWork}
                                onQcApprove={() => {}}
                                onEngineerComplete={props.onEngineerComplete}
                                storageLocations={storageLocations}
                                onUpdateJob={(updatedJob) => saveRecord('jobs', updatedJob)}
                            />
                        )) : <p className="text-sm text-gray-500 text-center py-8">No jobs scheduled for today.</p>}
                    </div>
                </Widget>
                <Widget title="Quick Support" icon={Users}>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col items-center justify-center text-center gap-4">
                        <Users size={48} className="text-indigo-400 opacity-50" />
                        <div>
                            <p className="font-bold text-indigo-900">Need help with a job?</p>
                            <p className="text-sm text-indigo-700">Use the context-aware assistant on any job card for technical info or service package details.</p>
                        </div>
                        <button onClick={() => setCurrentView('inquiries')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition">View Inquiries</button>
                    </div>
                </Widget>
            </div>
        </div>
    );
};

const ConciergeDashboard: React.FC<DashboardViewProps & { onSelectDivision: (id: string, name: string) => void }> = (props) => {
    const { onSelectDivision } = props;
    const { jobs, vehicles, customers, purchaseOrders, engineers, storageLocations, storageBookings, saveRecord, businessEntities } = useData();
    const { selectedEntityId, setCurrentView, currentUser } = useApp();
    const today = getRelativeDate(0);

    const arrivalsToday = useMemo(() => {
        return jobs.filter(j => 
            j.entityId === selectedEntityId && 
            j.vehicleStatus === 'Awaiting Arrival' && 
            (j.segments || []).some(s => s.date === today)
        );
    }, [jobs, selectedEntityId, today]);

    return (
        <div className="space-y-6">
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} storageBookings={storageBookings} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OnSiteByDivisionCard jobs={jobs} businessEntities={businessEntities} storageBookings={storageBookings} onSelectDivision={onSelectDivision} />
                <Widget title="Today's Arrivals" icon={LogIn}>
                <div className="space-y-2">
                    {arrivalsToday.length > 0 ? arrivalsToday.map(job => (
                         <SummaryJobCard 
                            key={job.id}
                            job={job}
                            vehicle={vehicles.find(v => v.id === job.vehicleId)}
                            customer={customers.find(c => c.id === job.customerId)}
                            purchaseOrders={purchaseOrders}
                            engineers={engineers}
                            currentUser={currentUser}
                            onEdit={props.onEditJob}
                            onCheckIn={props.onCheckIn}
                            onOpenPurchaseOrder={() => {}}
                            onOpenAssistant={props.onOpenAssistant}
                            onStartWork={props.onStartWork}
                            onPause={(jId, sId) => props.onPause(jId, sId, 'Paused from dashboard')}
                            onRestart={props.onRestartWork}
                            onQcApprove={() => {}}
                            onEngineerComplete={props.onEngineerComplete}
                            highlightAction="checkIn"
                            storageLocations={storageLocations}
                            onUpdateJob={(updatedJob) => saveRecord('jobs', updatedJob)}
                        />
                    )) : <p className="text-sm text-gray-500 text-center py-8">No vehicles are awaiting arrival today.</p>}
                </div>
            </Widget>
            </div>
        </div>
    );
};

// DashboardView component continues below

const DashboardView: React.FC<DashboardViewProps> = (props) => {
    const { currentUser } = useApp();
    const { roles, forceRefresh, jobs, vehicles } = useData();
    const [selectedDivision, setSelectedDivision] = React.useState<{ id: string, name: string } | null>(null);
    
    const onSelectDivision = (id: string, name: string) => {
        setSelectedDivision({ id, name });
    };

    const divisionJobs = useMemo(() => {
        if (!selectedDivision) return [];
        return jobs.filter(j => 
            (selectedDivision.id === 'unknown' ? !j.entityId : j.entityId === selectedDivision.id) && 
            j.vehicleStatus === 'On Site' &&
            j.status !== 'Cancelled'
        );
    }, [jobs, selectedDivision]);

    // Auto-refresh data every 30 seconds to keep all users in sync
    useEffect(() => {
        const interval = setInterval(() => {
            // We refresh the core entities used in this view
            forceRefresh('brooks_jobs' as any);
            forceRefresh('brooks_vehicles' as any);
            forceRefresh('brooks_customers' as any);
            forceRefresh('brooks_inquiries' as any);
        }, 30000); 
        return () => clearInterval(interval);
    }, [forceRefresh]);
    const today = getRelativeDate(0);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const renderDashboardByRole = () => {
        // Determine the base role type for the current user
        const userRole = roles.find(r => r.name === currentUser.role);
        const baseRole = userRole ? userRole.baseRole : 'Dispatcher'; // Default fallback

        switch (baseRole) {
            case 'Admin':
            case 'Dispatcher':
                return <AdminDispatcherDashboard {...props} onOpenInquiry={props.onOpenInquiry as any} onSelectDivision={onSelectDivision} />;
            case 'Engineer':
                return <EngineerDashboard {...props} />;
            case 'Sales':
                return <SalesDashboard {...props} onSelectDivision={onSelectDivision} />;
            case 'Garage Concierge':
                return <ConciergeDashboard {...props} onSelectDivision={onSelectDivision} />;
            default:
                return <p>No dashboard configured for your role.</p>;
        }
    };

    return (
        <div className="w-full h-full overflow-y-auto p-6 bg-gray-50">
            <header className="mb-6">
                <h1 className="text-xl md:text-3xl font-bold text-gray-800">
                    <span className="md:hidden">Brookspeed</span>
                    <span className="hidden md:inline">{getGreeting()}, {currentUser.name}!</span>
                </h1>
                <p className="text-gray-500">{formatReadableDate(today)}</p>
            </header>
            {renderDashboardByRole()}

            <VehiclesOnSiteModal 
                isOpen={!!selectedDivision}
                onClose={() => setSelectedDivision(null)}
                entityName={selectedDivision?.name || ''}
                jobs={divisionJobs}
                storageBookings={useData().storageBookings}
                vehicles={vehicles}
            />
        </div>
    );
};

export default DashboardView;
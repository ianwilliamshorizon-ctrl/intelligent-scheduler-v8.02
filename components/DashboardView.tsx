import React, { useMemo, useEffect } from 'react';
import * as T from '../types';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { getRelativeDate, formatReadableDate } from '../core/utils/dateUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { Job, Inquiry } from '../types';
import {
    LayoutGrid, BarChart, Users, FileText, Briefcase, Car, CalendarCheck, CheckCircle, Clock,
    LogIn, PlayCircle, PauseCircle, Tag, MessageSquare, Wrench, UserCheck, AlertCircle, Play,
    ClipboardCheck, Wand2
} from 'lucide-react';

import { SummaryJobCard } from './shared/SummaryJobCard';
import { applyStorageRateToJob } from '../core/utils/jobUtils';

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
}> = ({ jobs, selectedEntityId, today, setCurrentView }) => {
    const stats = useMemo(() => {
        const entityJobs = jobs.filter(j => (selectedEntityId === 'all' || j.entityId === selectedEntityId) && j.status !== 'Cancelled');
        const jobsToday = entityJobs.flatMap(j => j.segments || []).filter(s => s.date === today && s.allocatedLift).length;
        const vehiclesOnSite = entityJobs.filter(j => j.vehicleStatus === 'On Site').length;
        const pendingQC = entityJobs.filter(j => j.status === 'Pending QC').length;
        const unallocatedJobs = entityJobs.filter(j => (j.segments || []).some(s => s.status === 'Unallocated')).length;
        return { jobsToday, vehiclesOnSite, pendingQC, unallocatedJobs };
    }, [jobs, selectedEntityId, today]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard title="Jobs Today" value={stats.jobsToday} icon={CalendarCheck} colorClass="bg-blue-500" onClick={() => setCurrentView('dispatch')} />
            <StatCard title="Vehicles On Site" value={stats.vehiclesOnSite} icon={Car} colorClass="bg-green-500" onClick={() => setCurrentView('concierge')} />
            <StatCard title="Pending QC" value={stats.pendingQC} icon={ClipboardCheck} colorClass="bg-orange-500" onClick={() => setCurrentView('concierge')} />
            <StatCard title="Unallocated Jobs" value={stats.unallocatedJobs} icon={AlertCircle} colorClass="bg-red-500" onClick={() => setCurrentView('dispatch')} />
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

const AdminDispatcherDashboard: React.FC<{
    onEditJob: (jobId: string) => void;
    onOpenInquiry: (inquiry: Inquiry) => void;
    onOpenAssistant: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason: string) => void;
    onRestartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
}> = ({ onEditJob, onOpenInquiry, onOpenAssistant, onCheckIn, onStartWork, onPause, onRestartWork, onEngineerComplete }) => {
    const { jobs, inquiries, vehicles, customers, roles, engineers, purchaseOrders, storageLocations, saveRecord } = useData();
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
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} />

            <div className="mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {allowedActions.map(action => (
                        <ActionButton key={action.id} title={action.label} icon={action.icon} onClick={() => setCurrentView(action.id)} />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: '400px' }}>
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
    const { jobs, vehicles, lifts, customers, purchaseOrders, engineers, storageLocations, saveRecord } = useData();
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
             <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId || 'all'} today={today} setCurrentView={setCurrentView} />
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

const SalesDashboard: React.FC<DashboardViewProps> = (props) => {
    const { jobs, vehicles, customers, purchaseOrders, engineers, storageLocations, saveRecord } = useData();
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
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

const ConciergeDashboard: React.FC<DashboardViewProps> = (props) => {
    const { jobs, vehicles, customers, purchaseOrders, engineers, storageLocations, saveRecord } = useData();
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
            <SummaryMetrics jobs={jobs} selectedEntityId={selectedEntityId} today={today} setCurrentView={setCurrentView} />
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
    );
}

// Main Dashboard Component
interface DashboardViewProps {
    onEditJob: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason: string) => void;
    onRestartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onOpenInquiry: (inquiry: Partial<Inquiry>) => void;
    onOpenAssistant: (jobId: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = (props) => {
    const { currentUser } = useApp();
    const { roles, forceRefresh } = useData();
    
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
                return <AdminDispatcherDashboard {...props} onOpenInquiry={props.onOpenInquiry as any} />;
            case 'Engineer':
                return <EngineerDashboard {...props} />;
            case 'Sales':
                return <SalesDashboard {...props} />;
            case 'Garage Concierge':
                return <ConciergeDashboard {...props} />;
            default:
                return <p>No dashboard configured for your role.</p>;
        }
    };

    return (
        <div className="w-full h-full overflow-y-auto p-6 bg-gray-50">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{getGreeting()}, {currentUser.name}!</h1>
                <p className="text-gray-500">{formatReadableDate(today)}</p>
            </header>
            {renderDashboardByRole()}
        </div>
    );
};

export default DashboardView;
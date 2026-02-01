import React, { useMemo } from 'react';
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

// --- Reusable Components ---

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
}> = ({ onEditJob, onOpenInquiry, onOpenAssistant }) => {
    const { jobs, inquiries, vehicles, customers, roles } = useData();
    const { selectedEntityId, setCurrentView, currentUser } = useApp();
    const today = getRelativeDate(0);

    const stats = useMemo(() => {
        const entityJobs = jobs.filter(j => j.entityId === selectedEntityId);
        const jobsToday = entityJobs.flatMap(j => j.segments || []).filter(s => s.date === today && s.allocatedLift).length;
        const vehiclesOnSite = entityJobs.filter(j => j.vehicleStatus === 'On Site').length;
        const pendingQC = entityJobs.filter(j => j.status === 'Pending QC').length;
        const unallocatedJobs = entityJobs.filter(j => (j.segments || []).some(s => s.status === 'Unallocated')).length;
        return { jobsToday, vehiclesOnSite, pendingQC, unallocatedJobs };
    }, [jobs, selectedEntityId, today]);

    const openInquiries = useMemo(() => {
        return inquiries.filter(i => i.status === 'Open' && (selectedEntityId === 'all' || i.entityId === selectedEntityId))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    }, [inquiries, selectedEntityId]);

    const unallocatedJobList = useMemo(() => {
        return jobs.filter(j => (selectedEntityId === 'all' || j.entityId === selectedEntityId) && (j.segments || []).some(s => s.status === 'Unallocated')).slice(0, 5);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Jobs Today" value={stats.jobsToday} icon={CalendarCheck} colorClass="bg-blue-500" onClick={() => setCurrentView('dispatch')} />
                <StatCard title="Vehicles On Site" value={stats.vehiclesOnSite} icon={Car} colorClass="bg-green-500" onClick={() => setCurrentView('dispatch')} />
                <StatCard title="Pending QC" value={stats.pendingQC} icon={ClipboardCheck} colorClass="bg-orange-500" onClick={() => setCurrentView('concierge')} />
                <StatCard title="Unallocated Jobs" value={stats.unallocatedJobs} icon={AlertCircle} colorClass="bg-red-500" onClick={() => setCurrentView('dispatch')} />
            </div>

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
                             <div key={inq.id} className="p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100" onClick={() => onOpenInquiry(inq)}>
                                 <div className="flex justify-between items-start">
                                     <div>
                                        <p className="font-semibold text-sm text-red-900">{inq.fromName}</p>
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
                        {unallocatedJobList.length > 0 ? unallocatedJobList.map(job => {
                             const vehicle = vehicles.find(v => v.id === job.vehicleId);
                             return (
                                <div key={job.id} className="p-2 bg-gray-50 rounded-lg border cursor-pointer hover:bg-gray-100" onClick={() => onEditJob(job.id)}>
                                    <p className="font-semibold text-sm">{vehicle?.registration} - {job.description}</p>
                                    <p className="text-xs text-gray-600">{job.estimatedHours} hours</p>
                                </div>
                             )
                        }) : <p className="text-sm text-gray-500 text-center py-8">No unallocated jobs.</p>}
                    </div>
                </Widget>
            </div>
        </div>
    );
};

const EngineerDashboard: React.FC<{
    onStartWork: (jobId: string, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onEditJob: (jobId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onRestartWork: (jobId: string, segmentId: string) => void;
}> = (props) => {
    const { onStartWork, onPause, onEngineerComplete, onEditJob, onOpenAssistant, onRestartWork } = props;
    const { currentUser, setCurrentView } = useApp();
    const { jobs, vehicles, lifts } = useData();
    const today = getRelativeDate(0);

    const myJobsToday = useMemo(() => {
        if (!currentUser.engineerId) return [];
        return jobs.flatMap(job => 
            (job.segments || []).map(seg => ({ job, seg }))
        ).filter(({ job, seg }) => 
            seg.engineerId === currentUser.engineerId && seg.date === today && seg.allocatedLift
        ).sort((a,b) => (a.seg.scheduledStartSegment || 99) - (b.seg.scheduledStartSegment || 99));
    }, [jobs, currentUser.engineerId, today]);
    
    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="My Jobs Today" value={myJobsToday.length} icon={Wrench} colorClass="bg-indigo-500" onClick={() => setCurrentView('concierge')} />
            </div>
            <Widget title="My Jobs for Today" icon={CalendarCheck}>
                <div className="space-y-4">
                    {myJobsToday.length > 0 ? myJobsToday.map(({ job, seg }) => {
                        const vehicle = vehicles.find(v => v.id === job.vehicleId);
                        const lift = lifts.find(l => l.id === seg.allocatedLift);
                        return (
                            <div key={seg.segmentId} className="p-3 bg-gray-50 rounded-lg border">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold">{vehicle?.registration} - {job.description}</p>
                                        <p className="text-sm text-gray-600">On {lift?.name}</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${seg.status === 'In Progress' || seg.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{seg.status}</span>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                                    <button onClick={() => onOpenAssistant(job.id)} title="Technical Assistant" className="text-sm font-semibold p-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200"><Wand2 size={14} /></button>
                                    <button onClick={() => onEditJob(job.id)} className="text-sm font-semibold py-1 px-3 bg-gray-200 rounded-md hover:bg-gray-300">View Details</button>
                                    {seg.status === 'Allocated' && <button onClick={() => onStartWork(job.id, seg.segmentId)} className="text-sm font-semibold py-1 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-1"><PlayCircle size={14}/> Start</button>}
                                    {seg.status === 'Paused' && <button onClick={() => onRestartWork(job.id, seg.segmentId)} className="text-sm font-semibold py-1 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-1"><Play size={14}/> Restart</button>}
                                    {seg.status === 'In Progress' && <button onClick={() => onPause(job.id, seg.segmentId, 'Paused by user')} className="text-sm font-semibold py-1 px-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center gap-1"><PauseCircle size={14}/> Pause</button>}
                                    {seg.status === 'In Progress' && <button onClick={() => onEngineerComplete(job, seg.segmentId)} className="text-sm font-semibold py-1 px-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-1"><CheckCircle size={14}/> Complete</button>}
                                </div>
                            </div>
                        )
                    }) : <p className="text-sm text-gray-500 text-center py-8">You have no jobs scheduled for today.</p>}
                </div>
            </Widget>
        </div>
    );
};

const SalesDashboard = () => <div className="text-center p-8 bg-white rounded-lg shadow-md">Sales Dashboard coming soon.</div>;

const ConciergeDashboard: React.FC<{
    onCheckIn: (jobId: string) => void;
    onEditJob: (jobId: string) => void;
}> = ({ onCheckIn, onEditJob }) => {
    const { jobs, vehicles } = useData();
    const { selectedEntityId, setCurrentView } = useApp();
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="Arrivals Today" value={arrivalsToday.length} icon={LogIn} colorClass="bg-cyan-500" onClick={() => setCurrentView('concierge')} />
            </div>
            <Widget title="Today's Arrivals" icon={LogIn}>
                <div className="space-y-3">
                    {arrivalsToday.length > 0 ? arrivalsToday.map(job => {
                        const vehicle = vehicles.find(v => v.id === job.vehicleId);
                        return (
                            <div key={job.id} className="p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
                                <div>
                                    <p className="font-bold">{vehicle?.registration} - {job.description}</p>
                                    <p className="text-sm text-gray-600">{job.id}</p>
                                </div>
                                <div className="flex gap-2">
                                     <button onClick={() => onEditJob(job.id)} className="text-sm font-semibold py-1 px-3 bg-gray-200 rounded-md hover:bg-gray-300">Details</button>
                                     <button onClick={() => onCheckIn(job.id)} className="text-sm font-semibold py-1 px-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-1"><LogIn size={14}/> Check In</button>
                                </div>
                            </div>
                        )
                    }) : <p className="text-sm text-gray-500 text-center py-8">No vehicles are awaiting arrival today.</p>}
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
    const { roles } = useData();
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
                return <AdminDispatcherDashboard onEditJob={props.onEditJob} onOpenInquiry={props.onOpenInquiry as any} onOpenAssistant={props.onOpenAssistant}/>;
            case 'Engineer':
                return <EngineerDashboard {...props} />;
            case 'Sales':
                return <SalesDashboard />;
            case 'Garage Concierge':
                return <ConciergeDashboard onCheckIn={props.onCheckIn} onEditJob={props.onEditJob} />;
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
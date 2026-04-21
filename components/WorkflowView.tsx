import React, { useMemo, useState, useEffect } from 'react';
import { Job, Vehicle, Customer, Engineer, User, PurchaseOrder } from '../types';
import { ClipboardCheck, FileText, CheckCircle, Car, User as UserIcon, MessageSquare, Clock, Wrench, PlayCircle, Search, X, PauseCircle, Wand2, Package as PackageIcon, UserPlus } from 'lucide-react';
import { formatReadableDate, getRelativeDate } from '../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES, END_HOUR, END_MINUTE } from '../constants';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { getPoStatusColor } from '../core/utils/statusUtils';
import { HoverInfo } from '../components/shared/HoverInfo';
import { SummaryJobCard } from './shared/SummaryJobCard';
import { applyStorageRateToJob } from '../core/utils/jobUtils';
import LiveAssistant from './LiveAssistant'; // Make sure this path is correct

const WorkflowJobCard: React.FC<{
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    children?: React.ReactNode;
    statusColorClass: string;
    onEdit: (jobId: string, initialTab?: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    purchaseOrders: PurchaseOrder[];
    onUpdateJob?: (job: Job) => void;
    today: string;
}> = ({ job, vehicle, customer, children, statusColorClass, onEdit, onOpenAssistant, onOpenPurchaseOrder, purchaseOrders, onUpdateJob, today }) => {
    
    const { partsStatus } = job;
    
    const partsStatusColor = () => {
        switch (partsStatus) {
            case 'Awaiting Order': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'Ordered': return 'bg-sky-100 text-sky-800 border-sky-200';
            case 'Partially Received': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Fully Received': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const associatedPOs = (job.purchaseOrderIds || []).map(id => (purchaseOrders || []).find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    
    return (
        <div 
            className={`p-4 rounded-xl shadow-sm border ${statusColorClass} cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 relative overflow-hidden group mb-3`}
            onClick={() => onEdit(job.id)}
        >
            {/* Parts Status Badge */}
            <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-bl-lg shadow-sm ${partsStatusColor()}`}>
                {partsStatus || 'No Parts'}
            </div>

            <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 pr-8">
                    <h3 className="text-sm font-bold uppercase tracking-tight leading-tight mb-1 truncate text-gray-900">
                        {job.description}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        {vehicle && (
                             <HoverInfo title="Vehicle Details" data={{ make: vehicle.make, model: vehicle.model, year: vehicle.year, vin: vehicle.vin }}>
                                <span className="flex items-center gap-1.5"><Car size={13}/> {vehicle.registration}</span>
                            </HoverInfo>
                        )}
                        <span className="opacity-40">•</span>
                       {customer && (
                            <HoverInfo title="Customer Details" data={{ name: `${customer.forename} ${customer.surname}`, phone: customer.mobile || customer.phone }}>
                                <span className="flex items-center gap-1.5 truncate"><UserIcon size={13}/> {customer.forename} {customer.surname}</span>
                           </HoverInfo>
                       )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="font-mono text-xs font-bold bg-white/50 px-2 py-0.5 rounded-full border border-gray-200 tracking-tighter text-gray-600">#{job.id}</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} 
                        className="p-1.5 bg-white/50 hover:bg-white text-indigo-600 border border-indigo-100 rounded-lg transition-colors shadow-xs"
                        title="Technical Assistant"
                    >
                        <Wand2 size={14} />
                    </button>
                </div>
            </div>

            {associatedPOs && associatedPOs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-2 py-2 border-t border-gray-100">
                    {associatedPOs.map(po => (
                        <button
                            key={po.id}
                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-white/20`}
                            title={`View PO #${po.id} (${po.status})`}
                        >
                            <PackageIcon size={10} />
                            <span className="font-mono">{po.id}</span>
                        </button>
                    ))}
                </div>
            )}
            
            <div className="space-y-2">
                {children}
            </div>
            
            {/* Status Visual Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10"></div>
        </div>
    );
};


interface WorkflowViewProps {
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
    engineers: Engineer[];
    currentUser: User;
    onQcApprove: (jobId: string) => void;
    onGenerateInvoice: (jobId: string) => void;
    onEditJob: (jobId: string, initialTab?: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
}

const WorkflowView: React.FC<WorkflowViewProps> = ({ jobs, vehicles, customers, engineers, onQcApprove, onGenerateInvoice, onEditJob, onOpenAssistant, onStartWork, onEngineerComplete, onPause, onRestart, onOpenPurchaseOrder }) => {
    const { purchaseOrders, saveRecord, forceRefresh, storageLocations } = useData();
    
    // Auto-refresh data every 30 seconds to keep all users in sync
    useEffect(() => {
        const interval = setInterval(() => {
            // We refresh the core entities used in this view
            forceRefresh('brooks_jobs' as any);
            forceRefresh('brooks_vehicles' as any);
            forceRefresh('brooks_customers' as any);
        }, 30000); 
        return () => clearInterval(interval);
    }, [forceRefresh]);
    const { currentUser, users } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState<string>('all');
    const [assistantJobId, setAssistantJobId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'standard' | 'summary'>('standard');

    const handleOpenAssistant = (jobId: string) => setAssistantJobId(jobId);
    const handleCloseAssistant = () => setAssistantJobId(null);
    
    const handleAddNoteFromAssistant = (note: string) => {
        if (!assistantJobId) return;
        const job = jobs.find(j => j.id === assistantJobId);
        if (job) {
            const newNotes = `${job.notes || ''}\n\n--- Assistant Note ---\n${note}`;
            saveRecord('jobs', { ...job, notes: newNotes });
        }
    };

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    
    const allEngineers = useMemo(() => {
        const dispatchers = users.filter(u => u.role === 'Dispatcher').map(u => ({ 
            id: u.id, 
            name: u.name || u.email || 'Dispatcher',
            specialization: 'Dispatcher'
        }));
        const existingEngineerIds = new Set(engineers.map(e => e.id));
        const combined = [...engineers];
        dispatchers.forEach(d => {
            if (!existingEngineerIds.has(d.id)) {
                combined.push(d as Engineer);
            }
        });
        return combined;
    }, [engineers, users]);

    const engineersById = useMemo(() => new Map(allEngineers.map(e => [e.id, e])), [allEngineers]);
    
    const isEngineerView = currentUser.role === 'Engineer';

    const { workflowJobs, today } = useMemo(() => {
        let filteredJobs = jobs.filter(job => !['Unallocated', 'Invoiced', 'Closed', 'Cancelled'].includes(job.status));
        
        const engineerFilterId = isEngineerView ? currentUser.engineerId : (selectedEngineerId !== 'all' ? selectedEngineerId : null);
        if (engineerFilterId) {
            filteredJobs = filteredJobs.filter(job => 
                (job.segments || []).some(s => s.engineerId === engineerFilterId)
            );
        }

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filteredJobs = filteredJobs.filter(job => {
                const vehicle = vehiclesById.get(job.vehicleId);
                const customer = customersById.get(job.customerId);
                return (
                    job.id.toLowerCase().includes(lowerSearch) ||
                    job.description.toLowerCase().includes(lowerSearch) ||
                    (vehicle && vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerSearch.replace(/\s/g, ''))) ||
                    (customer && `${String(customer.forename)} ${String(customer.surname)}`.toLowerCase().includes(lowerSearch))
                );
            });
        }

        const today = getRelativeDate(0);
        
        const inProgress = filteredJobs.filter(job => job.status === 'In Progress' || (job.segments || []).some(s => s.status === 'Paused'));
        const pendingQC = filteredJobs.filter(job => job.status === 'Pending QC');
        const allocated = filteredJobs.filter(job => job.status === 'Allocated');
        const complete = filteredJobs.filter(job => job.status === 'Complete');
        
        return { 
            workflowJobs: { inProgress, pendingQC, allocated, complete },
            today
        };

    }, [jobs, isEngineerView, currentUser.engineerId, selectedEngineerId, searchTerm, vehiclesById, customersById, purchaseOrders]);
    
    const statusColumns: { title: string; jobs: Job[]; color: string; bgColor: string; icon: React.ElementType }[] = [
        { title: 'Allocated', jobs: workflowJobs.allocated, color: 'border-blue-200', bgColor: 'bg-blue-50 text-blue-900 border-blue-200', icon: Clock },
        { title: 'In Progress', jobs: workflowJobs.inProgress, color: 'border-amber-200', bgColor: 'bg-amber-50 text-amber-900 border-amber-200', icon: Wrench },
        { title: 'Pending QC', jobs: workflowJobs.pendingQC, color: 'border-orange-200', bgColor: 'bg-orange-50 text-orange-900 border-orange-200', icon: ClipboardCheck },
        { title: 'Complete', jobs: workflowJobs.complete, color: 'border-emerald-200', bgColor: 'bg-emerald-50 text-emerald-900 border-emerald-200', icon: CheckCircle },
    ];

    const canControlJob = (engineerId?: string | null) => {
        if (!engineerId) return false;
        if (currentUser.role === 'Engineer') return engineerId === currentUser.engineerId;
        return currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    };

    const renderJobCard = (job: Job, bgColor: string, title?: string) => {
        const commonProps = {
            job,
            vehicle: vehiclesById.get(job.vehicleId),
            customer: customersById.get(job.customerId),
            purchaseOrders: purchaseOrders || [],
            engineers: allEngineers,
            storageLocations: storageLocations || [],
            currentUser,
            onEdit: onEditJob,
            onOpenAssistant: handleOpenAssistant,
            onOpenPurchaseOrder,
            onStartWork,
            onEngineerComplete,
            onPause: (id: string, sId: string) => onPause(id, sId),
            onRestart,
            onCheckIn: (id: string) => {}, // Not used here but needed by SummaryJobCard Props
            onQcApprove,
            onUpdateJob: (updatedJob: Job) => saveRecord('jobs', updatedJob),
        };

        if (viewMode === 'summary') {
            return <SummaryJobCard key={job.id} {...commonProps} />;
        }

        return (
            <WorkflowJobCard
                key={job.id}
                job={job}
                vehicle={commonProps.vehicle}
                customer={commonProps.customer}
                statusColorClass={bgColor}
                onEdit={onEditJob}
                onOpenAssistant={handleOpenAssistant}
                onOpenPurchaseOrder={onOpenPurchaseOrder}
                purchaseOrders={purchaseOrders || []}
                onUpdateJob={commonProps.onUpdateJob}
                today={today}
            >
                <div className="mt-2 text-xs space-y-1">
                    {(job.segments || []).filter(s => s.allocatedLift).map(seg => {
                        const startSegmentIndex = seg.scheduledStartSegment;
                        let timeString = `${seg.duration} hrs`;
                        if (startSegmentIndex !== null && startSegmentIndex !== undefined) {
                            const startTime = TIME_SEGMENTS[startSegmentIndex];
                            const numberOfSegments = seg.duration ? seg.duration * (60 / SEGMENT_DURATION_MINUTES) : 0;
                            const endSegmentIndex = startSegmentIndex + numberOfSegments;
                            let endTime = `${(END_HOUR % 12 === 0 ? 12 : END_HOUR % 12)}:${String(END_MINUTE).padStart(2,'0')} PM`;
                            if (endSegmentIndex < TIME_SEGMENTS.length) {
                                endTime = TIME_SEGMENTS[endSegmentIndex];
                            }
                            timeString = `${startTime} - ${endTime}`;
                        }
                        
                        const engineerName = engineersById.get(seg.engineerId!)?.name;

                        return (
                             <div key={seg.segmentId} className="p-1.5 bg-gray-100 rounded-md">
                                 <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {engineerName ? (
                                            <span className="font-semibold flex items-center gap-1.5"><UserIcon size={12}/>{engineerName}</span>
                                        ) : (
                                            <span className="font-semibold flex items-center gap-1.5 text-red-600"><UserPlus size={12}/>Unassigned</span>
                                        )}
                                        <span className="text-gray-500">on {seg.allocatedLift}</span>
                                    </div>
                                     <span className={`font-semibold ${seg.status === 'Paused' ? 'text-orange-600 animate-pulse' : 'text-indigo-700'}`}>{seg.status === 'Paused' ? 'PAUSED' : timeString}</span>
                                 </div>
                                 {seg.date !== today && <div className="text-xs text-gray-600 font-semibold pt-1">{formatReadableDate(seg.date)}</div>}
                                 
                                {canControlJob(seg.engineerId) && (
                                    <div className="mt-2 flex items-center justify-end gap-1.5">
                                        {seg.status === 'Allocated' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onStartWork(job.id, seg.segmentId); }} 
                                                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"
                                            >
                                                <PlayCircle size={14} /> Start
                                            </button>
                                        )}
                                        {seg.status === 'Paused' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRestart(job.id, seg.segmentId); }} 
                                                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"
                                            >
                                                <PlayCircle size={14} /> Restart
                                            </button>
                                        )}
                                        {seg.status === 'In Progress' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onPause(job.id, seg.segmentId); }} 
                                                className="flex items-center gap-1 px-2 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm text-[10px] font-bold uppercase tracking-tight transition-transform active:scale-95"
                                            >
                                                <PauseCircle size={14} /> Pause
                                            </button>
                                        )}
                                        {seg.status === 'In Progress' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEngineerComplete(job, seg.segmentId); }} 
                                                className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 shadow-sm text-[10px] font-bold uppercase tracking-tight border border-indigo-200 transition-transform active:scale-95"
                                            >
                                                <CheckCircle size={14} /> Complete
                                            </button>
                                        )}
                                    </div>
                                )}
                             </div>
                        );
                    })}
                </div>
                 {job.technicianObservations && job.technicianObservations.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                         <p className="text-xs font-bold text-gray-600 flex items-center gap-1"><MessageSquare size={12}/> Observations:</p>
                         <p className="text-xs text-gray-600 truncate">{job.technicianObservations.join(', ')}</p>
                    </div>
                 )}
                {title === 'Pending QC' && !isEngineerView && (
                    <div className="mt-2 pt-2 border-t text-right">
                        <button onClick={(e) => { e.stopPropagation(); onQcApprove(job.id); }} className="px-3 py-1.5 text-xs bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm transition-all active:scale-95">Quality Sign-off</button>
                    </div>
                )}
                {title === 'Complete' && !isEngineerView && (
                    <div className="mt-2 pt-2 border-t text-right">
                        <button onClick={(e) => { e.stopPropagation(); onGenerateInvoice(job.id); }} className="px-3 py-1.5 text-xs bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-sm transition-all active:scale-95 flex items-center gap-1 ml-auto">
                            <FileText size={12}/> Generate Invoice
                        </button>
                    </div>
                )}
            </WorkflowJobCard>
        );
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-100 p-4">
            <header className="flex-shrink-0 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 flex-shrink-0">
                                 <Wrench size={20} />
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Workshop Workflow</h2>
                        </div>
                        
                        <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
                            {(['standard', 'summary'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${viewMode === mode ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search tasks..."
                                className="w-full p-2 pl-9 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                             {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={16}/>
                                </button>
                            )}
                        </div>
                        {!isEngineerView && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select
                                    id="engineer-filter"
                                    value={selectedEngineerId}
                                    onChange={(e) => setSelectedEngineerId(e.target.value)}
                                    className="w-full sm:w-auto p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                >
                                    <option value="all">All Engineers</option>
                                    {allEngineers.map(eng => (
                                        <option key={eng.id} value={eng.id}>{eng.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <main className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full">
                    {statusColumns.map(({ title, jobs, color, bgColor, icon: Icon }) => (
                        <div key={title} className="bg-gray-200 rounded-lg flex flex-col">
                            <h3 className={`flex items-center gap-2 font-bold text-gray-700 p-3 border-b-2 ${color}`}>
                                <Icon size={16}/> {title} ({jobs.length})
                            </h3>
                            <div className="p-3 space-y-3 overflow-y-auto">
                                {jobs.map(job => renderJobCard(job, bgColor, title))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
            <LiveAssistant 
                isOpen={!!assistantJobId} 
                onClose={handleCloseAssistant} 
                jobId={assistantJobId} 
                onAddNote={handleAddNoteFromAssistant} 
            />
        </div>
    );
};

export default WorkflowView;

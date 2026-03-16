import React, { useMemo, useState } from 'react';
import { Job, Vehicle, Customer, Engineer, User, PurchaseOrder } from '../types';
import { ClipboardCheck, FileText, CheckCircle, Car, User as UserIcon, MessageSquare, Clock, Wrench, PlayCircle, Search, X, PauseCircle, Wand2, Package as PackageIcon, UserPlus } from 'lucide-react';
import { formatReadableDate, getRelativeDate } from '../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES, END_HOUR, END_MINUTE } from '../constants';
import { useData } from '../core/state/DataContext';
import { getPoStatusColor } from '../core/utils/statusUtils';
import { HoverInfo } from '../components/shared/HoverInfo';
import LiveAssistant from './LiveAssistant'; // Make sure this path is correct

const WorkflowJobCard: React.FC<{
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    children?: React.ReactNode;
    statusColorClass: string;
    onEdit: (jobId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    purchaseOrders: PurchaseOrder[];
    today: string;
}> = ({ job, vehicle, customer, children, statusColorClass, onEdit, onOpenAssistant, onOpenPurchaseOrder, purchaseOrders, today }) => {
    
    const { partsStatus } = job;
    const cardBgClass = () => {
        switch (partsStatus) {
            case 'Awaiting Order': return 'bg-red-50';
            case 'Ordered': return 'bg-blue-50';
            case 'Partially Received': return 'bg-amber-50';
            case 'Fully Received': return 'bg-green-50';
            default: return 'bg-white';
        }
    };

    const associatedPOs = (job.purchaseOrderIds || []).map(id => (purchaseOrders || []).find(po => po.id === id)).filter(Boolean) as PurchaseOrder[];
    
    return (
        <div 
            className={`${cardBgClass()} p-3 rounded-lg shadow border-l-4 ${statusColorClass} cursor-pointer hover:shadow-md transition`}
            onClick={() => onEdit(job.id)}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xs text-gray-800">{job.description}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        {vehicle && (
                             <HoverInfo title="Vehicle Details" data={{ make: vehicle.make, model: vehicle.model, year: vehicle.year, vin: vehicle.vin }}>
                                <span className="flex items-center gap-1"><Car size={12}/> {vehicle.registration}</span>
                            </HoverInfo>
                        )}
                       {customer && (
                            <HoverInfo title="Customer Details" data={{ name: `${customer.forename} ${customer.surname}`, phone: customer.mobile || customer.phone }}>
                                <span className="flex items-center gap-1"><UserIcon size={12}/> {customer.forename} {customer.surname}</span>
                           </HoverInfo>
                       )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="font-mono text-sm font-bold bg-gray-200 px-1.5 py-0.5 rounded">#{job.id}</span>
                    <button onClick={(e) => { e.stopPropagation(); onOpenAssistant(job.id); }} className="p-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200" title="Technical Assistant"><Wand2 size={14} /></button>
                </div>
            </div>

            {associatedPOs && associatedPOs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-black/5">
                    {associatedPOs.map(po => (
                        <button
                            key={po.id}
                            onClick={(e) => { e.stopPropagation(); onOpenPurchaseOrder(po); }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] transition-colors ${getPoStatusColor(po.status, 'bg')} ${getPoStatusColor(po.status, 'text')} border-current opacity-90 hover:opacity-100`}
                            title={`View PO #${po.id} (${po.status})`}
                        >
                            <PackageIcon size={10} />
                            <span className="font-mono font-semibold">{po.id}</span>
                        </button>
                    ))}
                </div>
            )}
            {children}
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
    onEditJob: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onOpenAssistant: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
}

const WorkflowView: React.FC<WorkflowViewProps> = ({ jobs, vehicles, customers, engineers, onQcApprove, onGenerateInvoice, onEditJob, currentUser, onStartWork, onEngineerComplete, onPause, onRestart, onOpenPurchaseOrder }) => {
    const { purchaseOrders, saveRecord } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState<string>('all');
    const [assistantJobId, setAssistantJobId] = useState<string | null>(null);

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
    const engineersById = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers]);
    
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
    
    const statusColumns: { title: string; jobs: Job[]; color: string; icon: React.ElementType }[] = [
        { title: 'Allocated', jobs: workflowJobs.allocated, color: 'border-blue-500', icon: Clock },
        { title: 'In Progress', jobs: workflowJobs.inProgress, color: 'border-yellow-500', icon: Wrench },
        { title: 'Pending QC', jobs: workflowJobs.pendingQC, color: 'border-orange-500', icon: ClipboardCheck },
        { title: 'Complete', jobs: workflowJobs.complete, color: 'border-green-500', icon: CheckCircle },
    ];

    const canControlJob = (engineerId?: string | null) => {
        if (!engineerId) return false;
        if (currentUser.role === 'Engineer') return engineerId === currentUser.engineerId;
        return currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-100 p-4">
            <header className="flex-shrink-0 mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Workshop Workflow</h2>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search by job, vehicle, or customer..."
                                className="w-64 p-1.5 pl-9 border rounded-lg bg-white text-sm"
                            />
                             {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={16}/>
                                </button>
                            )}
                        </div>
                        {!isEngineerView && (
                            <div className="flex items-center gap-2">
                                <label htmlFor="engineer-filter" className="text-sm font-medium text-gray-700">Filter by Engineer:</label>
                                <select
                                    id="engineer-filter"
                                    value={selectedEngineerId}
                                    onChange={(e) => setSelectedEngineerId(e.target.value)}
                                    className="p-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">All Engineers</option>
                                    {engineers.map(eng => (
                                        <option key={eng.id} value={eng.id}>{eng.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <main className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
                    {statusColumns.map(({ title, jobs, color, icon: Icon }) => (
                        <div key={title} className="bg-gray-200 rounded-lg flex flex-col">
                            <h3 className={`flex items-center gap-2 font-bold text-gray-700 p-3 border-b-2 ${color}`}>
                                <Icon size={16}/> {title} ({jobs.length})
                            </h3>
                            <div className="p-3 space-y-3 overflow-y-auto">
                                {jobs.map(job => (
                                    <WorkflowJobCard
                                        key={job.id}
                                        job={job}
                                        vehicle={vehiclesById.get(job.vehicleId)}
                                        customer={customersById.get(job.customerId)}
                                        statusColorClass={color}
                                        onEdit={onEditJob}
                                        onOpenAssistant={handleOpenAssistant}
                                        onOpenPurchaseOrder={onOpenPurchaseOrder}
                                        purchaseOrders={purchaseOrders || []}
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
                                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                                {seg.status === 'Allocated' && (
                                                                    <button onClick={(e) => { e.stopPropagation(); onStartWork(job.id, seg.segmentId); }} className="w-full flex items-center justify-center gap-2 py-1 px-2 bg-yellow-500 text-white font-semibold rounded-lg text-xs hover:bg-yellow-600 transition shadow">
                                                                        <PlayCircle size={14} /> Start Work
                                                                    </button>
                                                                )}
                                                                {seg.status === 'In Progress' && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); onPause(job.id, seg.segmentId); }} className="flex items-center justify-center gap-1 py-1 px-2 bg-orange-500 text-white font-semibold rounded-lg text-xs hover:bg-orange-600 transition shadow">
                                                                            <PauseCircle size={14} /> Pause
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onEngineerComplete(job, seg.segmentId); }} className="w-full flex items-center justify-center gap-2 py-1 px-2 bg-green-600 text-white font-semibold rounded-lg text-xs hover:bg-green-700 transition shadow">
                                                                            <CheckCircle size={14} /> Complete Work
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {seg.status === 'Paused' && (
                                                                     <button onClick={(e) => { e.stopPropagation(); onRestart(job.id, seg.segmentId); }} className="w-full flex items-center justify-center gap-2 py-1 px-2 bg-green-500 text-white font-semibold rounded-lg text-xs hover:bg-green-600 transition shadow">
                                                                        <PlayCircle size={14} /> Restart Work
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
                                            <div className="mt-2 pt-2 border-t">
                                                <button onClick={(e) => { e.stopPropagation(); onQcApprove(job.id); }} className="w-full py-1 text-xs bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">Quality Sign-off</button>
                                            </div>
                                        )}
                                        {title === 'Complete' && !isEngineerView && (
                                            <div className="mt-2 pt-2 border-t">
                                                <button onClick={(e) => { e.stopPropagation(); onGenerateInvoice(job.id); }} className="w-full py-1 text-xs bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700">
                                                    <FileText size={12} className="inline mr-1"/> Generate Invoice
                                                </button>
                                            </div>
                                        )}
                                    </WorkflowJobCard>
                                ))}
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

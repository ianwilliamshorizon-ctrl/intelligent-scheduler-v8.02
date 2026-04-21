import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Job, PurchaseOrder } from '../types';
import { Search, X } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { getRelativeDate } from '../core/utils/dateUtils';
import PauseReasonModal from './PauseReasonModal';
import { ConciergeJobCard } from './concierge/ConciergeJobCard';
import { SummaryJobCard } from './shared/SummaryJobCard';
import { KanbanColumn } from './concierge/KanbanColumn';
import LiveAssistant from './LiveAssistant';

interface ConciergeViewProps {
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onOpenAssistant: (jobId: string) => void;
    onGenerateInvoice?: (jobId: string) => void;
    onCollect?: (jobId: string) => void;
    onQcApprove: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
}

const ConciergeView: React.FC<ConciergeViewProps> = (props) => {
    const { jobs, customers, vehicles, purchaseOrders, invoices, engineers, saveRecord, forceRefresh, storageLocations } = useData();
    
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
    const { selectedEntityId, currentUser } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [pauseData, setPauseData] = useState<{ jobId: string, segmentId: string } | null>(null);
    const [arrivalFilter, setArrivalFilter] = useState<'today' | '7days' | '14days'>('today');
    const [assistantJobId, setAssistantJobId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'standard' | 'summary'>('standard');

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

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

    const filteredJobs = useMemo(() => {
        let relevantJobs = jobs.filter(job => 
            (selectedEntityId === 'all' || job.entityId === selectedEntityId) && 
            job.status !== 'Archived' &&
            // Only show cancelled jobs if they are ready for collection
            (job.status !== 'Cancelled' || job.vehicleStatus === 'Awaiting Collection')
        );
        
        if (currentUser.role === 'Engineer' && currentUser.engineerId) {
            relevantJobs = relevantJobs.filter(job => 
                (job.segments || []).some(segment => segment.engineerId === currentUser.engineerId)
            );
        }

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            relevantJobs = relevantJobs.filter(job => {
                const vehicle = vehiclesById.get(job.vehicleId);
                const customer = customersById.get(job.customerId);
                return (
                    job.description.toLowerCase().includes(lowerSearch) ||
                    (vehicle && vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerSearch.replace(/\s/g, ''))) ||
                    (customer && getCustomerDisplayName(customer).toLowerCase().includes(lowerSearch))
                );
            });
        }
        return relevantJobs.sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
    }, [jobs, selectedEntityId, searchTerm, vehiclesById, customersById, currentUser]);

    const { arrivals, allocated, inProgress, pendingQC, invoicing, handover } = useMemo(() => {
        const arrivals: Job[] = [];
        const allocated: Job[] = [];
        const inProgress: Job[] = [];
        const pendingQC: Job[] = [];
        const invoicing: Job[] = [];
        const handover: Job[] = [];
        const today = getRelativeDate(0);
        let filterEndDate = today;

        if (arrivalFilter === '7days') filterEndDate = getRelativeDate(6);
        if (arrivalFilter === '14days') filterEndDate = getRelativeDate(13);

        filteredJobs.forEach(job => {
            if (job.vehicleStatus === 'Awaiting Arrival') {
                const isDue = (job.segments || []).some(s => s.date && s.date <= filterEndDate);
                if (isDue) {
                    arrivals.push(job);
                }
                return; 
            }

            if (job.vehicleStatus === 'Awaiting Collection' || (job.vehicleStatus === 'On Site' && job.invoiceId)) {
                handover.push(job);
                return;
            }

            if (job.status === 'Pending QC') {
                pendingQC.push(job);
                return;
            }

            if (job.status === 'Complete' && !job.invoiceId) {
                invoicing.push(job);
                return;
            }

            if (job.status === 'In Progress' || (job.segments || []).some(s => s.status === 'Paused')) {
                inProgress.push(job);
                return;
            }

            if (job.status === 'Allocated' || job.status === 'Unallocated') {
                allocated.push(job);
                return;
            }
        });
        
        return { arrivals, allocated, inProgress, pendingQC, invoicing, handover }; 
    }, [filteredJobs, arrivalFilter]);

    const handlePauseClick = (jobId: string, segmentId: string) => {
        setPauseData({ jobId, segmentId });
    };

    const handleConfirmPause = (reason: string) => {
        if (pauseData) {
            props.onPause(pauseData.jobId, pauseData.segmentId, reason);
            setPauseData(null);
        }
    };
    
    const renderJobCard = (job: Job, highlight?: 'checkIn' | 'invoice' | 'collect') => {
        const commonProps = {
            key: job.id,
            job,
            vehicle: vehiclesById.get(job.vehicleId),
            customer: customersById.get(job.customerId),
            purchaseOrders,
            engineers,
            currentUser,
            ...props,
            onPause: handlePauseClick,
            onEdit: props.onEditJob,
            highlightAction: highlight,
            onOpenAssistant: handleOpenAssistant,
            storageLocations: storageLocations || [],
            onUpdateJob: (updatedJob: Job) => saveRecord('jobs', updatedJob),
        };

        if (viewMode === 'summary') {
            return <SummaryJobCard {...commonProps} />;
        }

        return <ConciergeJobCard {...commonProps} />;
    };

    const arrivalsTitle = useMemo(() => {
        if (arrivalFilter === 'today') return "Due Today / Arrivals";
        if (arrivalFilter === '7days') return "Due 7 Days / Arrivals";
        return "Due 14 Days / Arrivals";
    }, [arrivalFilter]);

    return (
        <div className="w-full h-full flex flex-col p-2 sm:p-4 bg-gray-50">
            <header className="flex flex-col gap-3 mb-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                            {currentUser.role === 'Engineer' ? 'My Stream' : 'Service Stream'}
                        </h2>
                        
                        <div className="flex bg-gray-200 rounded-lg p-0.5 sm:p-1">
                            {(['standard', 'summary'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-2 sm:px-4 py-1 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-md transition ${viewMode === mode ? 'bg-indigo-600 shadow text-white' : 'text-gray-600 hover:text-gray-800'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex bg-gray-200 rounded-lg p-0.5 sm:p-1">
                            {(['today', '7days', '14days'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setArrivalFilter(opt)}
                                    className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition ${arrivalFilter === opt ? 'bg-white shadow text-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
                                >
                                    {opt === 'today' ? 'Today' : opt === '7days' ? '7D' : '14D'}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                            <input 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="w-full sm:w-48 md:w-64 p-1.5 pl-8 border rounded-lg text-xs sm:text-sm"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={14}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="flex-grow overflow-x-auto pb-2">
                <div className="flex gap-3 h-full min-w-full">
                    <KanbanColumn title={arrivalsTitle} count={arrivals.length} colorClass="border-blue-400">
                        {arrivals.length > 0 ? arrivals.map(j => renderJobCard(j, 'checkIn')) : <p className="text-center text-gray-400 py-4 text-xs">No pending arrivals.</p>}
                    </KanbanColumn>
                    <KanbanColumn title="Allocated / Unallocated" count={allocated.length} colorClass="border-cyan-400">
                        {allocated.map(j => renderJobCard(j))}
                    </KanbanColumn>
                    <KanbanColumn title="In Progress" count={inProgress.length} colorClass="border-yellow-400">
                        {inProgress.map(j => renderJobCard(j))}
                    </KanbanColumn>
                     <KanbanColumn title="Pending QC" count={pendingQC.length} colorClass="border-orange-400">
                        {pendingQC.map(j => renderJobCard(j))}
                    </KanbanColumn>
                    <KanbanColumn title="Ready to Invoice" count={invoicing.length} colorClass="border-indigo-500">
                         {invoicing.length > 0 ? invoicing.map(j => renderJobCard(j, 'invoice')) : <p className="text-center text-gray-400 py-4 text-xs">No jobs awaiting invoice.</p>}
                    </KanbanColumn>
                    <KanbanColumn title="Ready for Collection" count={handover.length} colorClass="border-green-500">
                         {handover.length > 0 ? handover.map(j => renderJobCard(j, 'collect')) : <p className="text-center text-gray-400 py-4 text-xs">No vehicles ready for collection.</p>}
                    </KanbanColumn>
                </div>
            </main>
            {pauseData && (
                <PauseReasonModal
                    isOpen={!!pauseData}
                    onClose={() => setPauseData(null)}
                    onConfirm={handleConfirmPause}
                />
            )}
            <LiveAssistant 
                isOpen={!!assistantJobId} 
                onClose={handleCloseAssistant} 
                jobId={assistantJobId} 
                onAddNote={handleAddNoteFromAssistant} 
            />
        </div>
    );
};
export default ConciergeView;

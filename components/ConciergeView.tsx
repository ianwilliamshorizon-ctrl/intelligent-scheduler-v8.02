
import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Job, PurchaseOrder } from '../types';
import { Search, X } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { getRelativeDate } from '../core/utils/dateUtils';
import PauseReasonModal from './PauseReasonModal';
import { ConciergeJobCard } from './concierge/ConciergeJobCard';
import { KanbanColumn } from './concierge/KanbanColumn';

interface ConciergeViewProps {
    onEditJob: (jobId: string) => void;
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
    const { jobs, customers, vehicles, purchaseOrders, invoices, engineers } = useData();
    const { selectedEntityId, currentUser } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [pauseData, setPauseData] = useState<{ jobId: string, segmentId: string } | null>(null);
    const [arrivalFilter, setArrivalFilter] = useState<'today' | '7days' | '14days'>('today');
    
    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const filteredJobs = useMemo(() => {
        let relevantJobs = jobs.filter(job => (selectedEntityId === 'all' || job.entityId === selectedEntityId) && job.vehicleStatus !== 'Collected' && job.status !== 'Cancelled');
        
        // --- ENGINEER FILTERING LOGIC ---
        // If current user is an Engineer, only show jobs assigned to them
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
            // 1. Arrivals
            if (job.vehicleStatus === 'Awaiting Arrival') {
                const isDue = (job.segments || []).some(s => s.date && s.date <= filterEndDate);
                if (isDue) {
                    arrivals.push(job);
                }
                return; 
            }

            // 2. Handover (Ready for Collection) - PRIORITIZED
            if (job.vehicleStatus === 'Awaiting Collection' || (job.vehicleStatus === 'On Site' && job.invoiceId)) {
                handover.push(job);
                return;
            }

            // 3. Pending QC
            if (job.status === 'Pending QC') {
                pendingQC.push(job);
                return;
            }

            // 4. Invoicing (Complete but no invoice yet)
            if (job.status === 'Complete' && !job.invoiceId) {
                invoicing.push(job);
                return;
            }

            // 5. In Progress
            if (job.status === 'In Progress' || (job.segments || []).some(s => s.status === 'Paused')) {
                inProgress.push(job);
                return;
            }

            // 6. Allocated / Unallocated
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
    
    const renderJobCard = (job: Job, highlight?: 'checkIn' | 'invoice' | 'collect') => (
        <ConciergeJobCard
            key={job.id}
            job={job}
            vehicle={vehiclesById.get(job.vehicleId)}
            customer={customersById.get(job.customerId)}
            purchaseOrders={purchaseOrders}
            engineers={engineers}
            currentUser={currentUser}
            {...props}
            onPause={handlePauseClick}
            onEdit={props.onEditJob}
            highlightAction={highlight}
        />
    );

    const arrivalsTitle = useMemo(() => {
        if (arrivalFilter === 'today') return "Due Today / Arrivals";
        if (arrivalFilter === '7days') return "Due 7 Days / Arrivals";
        return "Due 14 Days / Arrivals";
    }, [arrivalFilter]);

    return (
        <div className="w-full h-full flex flex-col p-4 bg-gray-50">
            <header className="flex justify-between items-center mb-3 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800">
                    {currentUser.role === 'Engineer' ? 'My Job Stream' : 'Service Stream'}
                </h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-200 rounded-lg p-1">
                        {(['today', '7days', '14days'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setArrivalFilter(opt)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${arrivalFilter === opt ? 'bg-white shadow text-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
                            >
                                {opt === 'today' ? 'Today' : opt === '7days' ? '7 Days' : '14 Days'}
                            </button>
                        ))}
                    </div>
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by reg, customer..."
                            className="w-64 p-1.5 pl-9 border rounded-lg text-sm"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={16}/>
                            </button>
                        )}
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
        </div>
    );
};
export default ConciergeView;

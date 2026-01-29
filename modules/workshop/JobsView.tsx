
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, Vehicle, Customer } from '../../types';
import { Eye, Search, PlusCircle, Printer, Briefcase } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getRelativeDate } from '../../core/utils/dateUtils';
import PrintableJobList from '../../components/PrintableJobList';
import { usePrint } from '../../core/hooks/usePrint';

interface JobsViewProps {
    onEditJob: (jobId: string) => void;
    onSmartCreateClick: () => void;
}

const statusFilterOptions: readonly Job['status'][] = ['Unallocated', 'Allocated', 'In Progress', 'Pending QC', 'Complete', 'Invoiced', 'Cancelled', 'Closed'];

const JobsView: React.FC<JobsViewProps> = ({ onEditJob, onSmartCreateClick }) => {
    const { jobs, customers, vehicles, businessEntities } = useData();
    const { selectedEntityId } = useApp();
    const print = usePrint();
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Job['status'][]>([]);
    const [displayLimit, setDisplayLimit] = useState(50);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    
    const filteredJobs = useMemo(() => {
        const thirtyDaysAgo = getRelativeDate(-30);
        const selectedEntity = businessEntities.find(e => e.id === selectedEntityId);

        return jobs.filter(job => {
            // Business Entity Filter (using shortCode prefix)
            if (selectedEntityId !== 'all' && selectedEntity?.shortCode) {
                if (!job.id.startsWith(selectedEntity.shortCode)) return false;
            } else if (selectedEntityId !== 'all') {
                // Fallback to entityId if shortCode is missing
                if (job.entityId !== selectedEntityId) return false;
            }

            // Date Filter
            if (job.createdAt < thirtyDaysAgo) return false;
            
            // Status Filter
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(job.status);
            if (!matchesStatus) return false;

            // Search Filter
            const lowerFilter = filter.toLowerCase();
            const vehicle = vehicleMap.get(job.vehicleId);
            const customer = customerMap.get(job.customerId);
            
            const customerName = customer ? getCustomerDisplayName(customer).toLowerCase() : '';
            const description = job.description ? String(job.description).toLowerCase() : '';
            const jobId = String(job.id).toLowerCase();
            
            const reg = vehicle?.registration ? String(vehicle.registration).toLowerCase().replace(/\s/g, '') : '';
            const filterNoSpace = lowerFilter.replace(/\s/g, '');
            const prevRegMatch = (vehicle?.previousRegistrations || []).some(pr => 
                String(pr.registration).toLowerCase().replace(/\s/g, '').includes(filterNoSpace)
            );

            return filter === '' ||
                jobId.includes(lowerFilter) ||
                description.includes(lowerFilter) ||
                customerName.includes(lowerFilter) ||
                reg.includes(filterNoSpace) ||
                prevRegMatch;
        }).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || '').localeCompare(a.id || ''));
    }, [jobs, filter, statusFilter, customerMap, vehicleMap, selectedEntityId, businessEntities]);

    // Reset pagination when filters change
    useEffect(() => {
        setDisplayLimit(50);
    }, [filter, statusFilter, selectedEntityId]);

    const displayedJobs = filteredJobs.slice(0, displayLimit);

    const handleLoadMore = () => {
        setDisplayLimit(prev => prev + 50);
    };

    const handleStatusToggle = (status: Job['status']) => {
        setStatusFilter(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };
    
    const handlePrint = () => {
        print(
            <PrintableJobList 
                jobs={filteredJobs} 
                vehicles={vehicleMap} 
                customers={customerMap}
                title={`Job Report (Last 30 Days)`}
            />
        );
    };

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase /> All Jobs (Last 30 Days)</h2>
                <div className="flex items-center gap-2">
                     <button onClick={handlePrint} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print List
                    </button>
                    <button onClick={onSmartCreateClick} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Job
                    </button>
                </div>
            </header>
            
            <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="relative flex-grow">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="text" placeholder="Search by ID, customer, vehicle, or description..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 pl-9 border rounded-lg"/>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
                    {statusFilterOptions.map(status => (
                        <button key={status} onClick={() => handleStatusToggle(status)} className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${statusFilter.includes(status) ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            {status}
                        </button>
                    ))}
                </div>
            </div>
            
            <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden bg-white shadow">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">Job ID</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Customer</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Vehicle</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Description</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                            {displayedJobs.map(job => {
                                const vehicle = vehicleMap.get(job.vehicleId);
                                const customer = customerMap.get(job.customerId);
                                return (
                                <tr key={job.id} className="hover:bg-indigo-50">
                                    <td className="p-3 font-mono">{job.id}</td>
                                    <td className="p-3">{job.createdAt}</td>
                                    <td className="p-3">{getCustomerDisplayName(customer)}</td>
                                    <td className="p-3 font-mono">{vehicle?.registration}</td>
                                    <td className="p-3">{job.description}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            job.status === 'Complete' || job.status === 'Invoiced' ? 'bg-green-100 text-green-800' :
                                            job.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                            job.status === 'Allocated' ? 'bg-blue-100 text-blue-800' :
                                            job.status === 'Closed' ? 'bg-gray-300 text-gray-800' :
                                            'bg-gray-100'}`}>{job.status}</span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => onEditJob(job.id)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View/Edit Job"><Eye size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                         </tbody>
                    </table>
                </div>
                {filteredJobs.length > displayLimit && (
                    <div className="flex justify-center pt-4">
                        <button onClick={handleLoadMore} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 font-semibold text-sm">
                            Load More
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};
export default JobsView;

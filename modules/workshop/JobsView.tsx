
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, Vehicle, Customer, ServicePackage, Estimate } from '../../types';
import { Eye, Search, PlusCircle, Printer, Briefcase, Wand2, Loader2, CalendarDays } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getRelativeDate, formatDate, dateStringToDate, addDays, formatReadableDate } from '../../core/utils/dateUtils';
import PrintableJobList from '../../components/PrintableJobList';
import { usePrint } from '../../core/hooks/usePrint';
import { generateServicePackageName } from '../../core/services/geminiService';
import ServicePackageFormModal from '../../components/ServicePackageFormModal';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';

interface JobsViewProps {
    onEditJob: (jobId: string) => void;
    onSmartCreateClick: () => void;
}

const statusFilterOptions: readonly Job['status'][] = ['Unallocated', 'Allocated', 'In Progress', 'Pending QC', 'Complete', 'Invoiced', 'Cancelled', 'Closed'];

const dateFilterOptions = {
    'today': 'Today',
    '30days': 'Last 30 Days',
    '90days': 'Last 90 Days',
    'all': 'All Time',
};

type DateFilterOption = keyof typeof dateFilterOptions;

const JobsView: React.FC<JobsViewProps> = ({ onEditJob, onSmartCreateClick }) => {
    const { jobs, customers, vehicles, businessEntities, estimates, taxRates, inspectionTemplates, setServicePackages, parts } = useData();
    const { selectedEntityId, setConfirmation } = useApp();
    const print = usePrint();
    const { handleSaveItem } = useWorkshopActions();

    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const safeCustomers = Array.isArray(customers) ? customers : [];
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
    const safeBusinessEntities = Array.isArray(businessEntities) ? businessEntities : [];
    const safeEstimates = Array.isArray(estimates) ? estimates : [];
    const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
    const safeParts = Array.isArray(parts) ? parts : [];
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Job['status'][]>([]);
    const [dateFilter, setDateFilter] = useState<DateFilterOption>('30days');
    const [displayLimit, setDisplayLimit] = useState(50);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<ServicePackage> | null>(null);

    const customerMap = useMemo(() => new Map(safeCustomers.map(c => [c.id, c])), [safeCustomers]);
    const vehicleMap = useMemo(() => new Map(safeVehicles.map(v => [v.id, v])), [safeVehicles]);
    const estimateMap = useMemo(() => new Map(safeEstimates.map(e => [e.id, e])), [safeEstimates]);
    const standardTaxRateId = useMemo(() => safeTaxRates.find(t => t.code === 'T1')?.id, [safeTaxRates]);

    const filteredJobs = useMemo(() => {
        let dateCutoff: string | null = null;
        const isToday = dateFilter === 'today';
        const todayDate = isToday ? getRelativeDate(0) : null;

        if (dateFilter === '30days') {
            dateCutoff = getRelativeDate(-30);
        } else if (dateFilter === '90days') {
            dateCutoff = getRelativeDate(-90);
        }

        const initialFilter = safeJobs.filter(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) {
                return false;
            }
            
            if (isToday) {
                if (job.scheduledDate !== todayDate) return false;
            } else if (dateCutoff && job.createdAt < dateCutoff) {
                return false;
            }

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(job.status);
            if (!matchesStatus) return false;

            const lowerFilter = filter.toLowerCase();
            if (lowerFilter) {
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

                return jobId.includes(lowerFilter) ||
                    description.includes(lowerFilter) ||
                    customerName.includes(lowerFilter) ||
                    reg.includes(filterNoSpace) ||
                    prevRegMatch;
            }

            return true; 
        });

        const jobIdsInInitialFilter = new Set(initialFilter.map(j => j.id));
        const supplementaryJobsToAdd: Job[] = [];

        if (filter.trim()) {
            safeJobs.forEach(job => {
                const description = job.description || '';
                if (description.toLowerCase().includes('supplementary for job #')) {
                    const parentIdMatch = description.match(/#(\S+)/);
                    if (parentIdMatch && parentIdMatch[1]) {
                        const parentId = parentIdMatch[1];
                        if (jobIdsInInitialFilter.has(parentId) && !jobIdsInInitialFilter.has(job.id)) {
                           supplementaryJobsToAdd.push(job);
                        }
                    }
                }
            });
        }

        const finalJobs = [...initialFilter, ...supplementaryJobsToAdd].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || '').localeCompare(a.id || ''));

        const uniqueJobs = finalJobs.filter((job, index, self) =>
            index === self.findIndex((j) => j.id === job.id)
        );

        return uniqueJobs;

    }, [safeJobs, filter, statusFilter, dateFilter, customerMap, vehicleMap, selectedEntityId, safeBusinessEntities]);


    useEffect(() => {
        setDisplayLimit(50);
    }, [filter, statusFilter, selectedEntityId, dateFilter]);

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
                title={`Job Report (${dateFilterOptions[dateFilter]})`}
            />
        );
    };

    const handleCreatePackage = async (job: Job) => {
        const estimate = estimateMap.get(job.estimateId || '');
        if (!estimate || !estimate.lineItems || estimate.lineItems.length === 0) {
            setConfirmation({ isOpen: true, title: 'No Line Items', message: 'This job has no estimate or line items to create a package from.', type: 'info' });
            return;
        }

        const vehicle = vehicleMap.get(job.vehicleId);
        if (!vehicle) {
            setConfirmation({ isOpen: true, title: 'Error', message: "Cannot create a package without an associated vehicle.", type: 'warning' });
            return;
        }

        setIsCreatingPackage(true);
        try {
            const { name, description } = await generateServicePackageName(estimate.lineItems, vehicle.make, vehicle.model, vehicle.cc);
            const totalNet = (estimate.lineItems || []).filter(item => !item.isPackageComponent).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            const costItems = (estimate.lineItems || [])
                .filter(item => !item.servicePackageId || item.isPackageComponent)
                .map(li => ({
                    ...li,
                    id: crypto.randomUUID(),
                    servicePackageId: undefined,
                    servicePackageName: undefined,
                    isPackageComponent: false,
                    isOptional: false
                }));

            const newPackage: Partial<ServicePackage> = {
                entityId: job.entityId,
                name,
                description,
                totalPrice: totalNet,
                costItems: costItems,
                applicableMake: vehicle.make,
                applicableModel: vehicle.model,
                applicableEngineSize: vehicle.cc,
                taxCodeId: standardTaxRateId
            };
            
            setSuggestedPackage(newPackage);
            setIsPackageModalOpen(true);

        } catch (error: any) {
             setConfirmation({ isOpen: true, title: 'AI Error', message: `AI failed to create package: ${error.message}`, type: 'warning' });
        } finally {
            setIsCreatingPackage(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase /> Jobs <span className="text-gray-500 font-medium text-lg">({dateFilterOptions[dateFilter]})</span></h2>
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
                <div className='flex gap-4'>
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input type="text" placeholder="Search by ID, customer, vehicle, or description..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 pl-9 border rounded-lg"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700"><CalendarDays size={16} className="inline-block mr-1"/>Date Range:</span>
                        <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                            {Object.keys(dateFilterOptions).map((key) => (
                                <button 
                                    key={key}
                                    onClick={() => setDateFilter(key as DateFilterOption)}
                                    className={`py-1 px-3 rounded-md font-semibold text-xs transition ${dateFilter === key ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
                                    {dateFilterOptions[key as DateFilterOption]}
                                </button>
                            ))}
                        </div>
                    </div>
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
                                    <td className="p-3">{job.createdAt ? formatReadableDate(job.createdAt) : 'N/A'}</td>
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
                                            <button onClick={() => handleCreatePackage(job)} disabled={isCreatingPackage} className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-full disabled:opacity-50" title="Create Service Package">
                                                {isCreatingPackage ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                            </button>
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
            {isPackageModalOpen && (
                <ServicePackageFormModal
                    isOpen={isPackageModalOpen}
                    onClose={() => setIsPackageModalOpen(false)}
                    onSave={async (pkg) => {
                        try {
                            await handleSaveItem(setServicePackages, pkg, 'brooks_servicePackages');
                            setConfirmation({
                                isOpen: true,
                                title: 'Service Package Created',
                                message: `Service Package "${pkg.name}" has been saved successfully.`,
                                type: 'success'
                            });
                            setIsPackageModalOpen(false);
                        } catch (e) {
                             setConfirmation({
                                isOpen: true,
                                title: 'Error',
                                message: 'Failed to save service package.',
                                type: 'warning'
                            });
                        }
                    }}
                    servicePackage={suggestedPackage}
                    taxRates={safeTaxRates}
                    entityId={selectedEntityId === 'all' ? (businessEntities[0]?.id || '') : selectedEntityId}
                    businessEntities={safeBusinessEntities}
                    parts={safeParts}
                />
            )}
        </div>
    );
};
export default JobsView;

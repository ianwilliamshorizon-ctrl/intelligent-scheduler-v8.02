
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, Vehicle, Customer, ServicePackage, Estimate, PurchaseOrder } from '../../types';
import { Eye, Search, PlusCircle, Printer, Briefcase, Wand2, Loader2, CalendarDays, Camera, LayoutList, LayoutGrid, MessageSquare } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getRelativeDate, formatDate, dateStringToDate, addDays, formatReadableDate, isWithinDateRange } from '../../core/utils/dateUtils';
import PrintableJobList from '../../components/PrintableJobList';
import { usePrint } from '../../core/hooks/usePrint';
import { generateServicePackageName } from '../../core/services/geminiService';
import ServicePackageFormModal from '../../components/ServicePackageFormModal';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';
import { JobsBoard } from './components/JobsBoard';

interface JobsViewProps {
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn?: (jobId: string) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onSmartCreateClick: () => void;
    onOpenInquiry?: (inquiry: any) => void;
}

const statusFilterOptions: readonly Job['status'][] = ['Unallocated', 'Allocated', 'In Progress', 'Pending QC', 'Complete', 'Invoiced', 'Cancelled', 'Closed'];

const dateFilterOptions = {
    'today': 'Today',
    '7days': '7 Days',
    '30days': '30 Days',
    'all': 'All Time',
    'custom': 'Custom',
};

type DateFilterOption = keyof typeof dateFilterOptions;

const JobsView: React.FC<JobsViewProps> = ({ onEditJob, onCheckIn, onOpenPurchaseOrder, onSmartCreateClick, onOpenInquiry }) => {
    const { jobs, customers, vehicles, businessEntities, estimates, taxRates, inspectionTemplates, setServicePackages, parts, purchaseOrders, inquiries } = useData();
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
    const [statusFilter, setStatusFilter] = useState<Job['status'][]>(['Unallocated', 'Allocated', 'In Progress', 'Pending QC', 'Complete', 'Invoiced']);
    const [showOnSiteOnly, setShowOnSiteOnly] = useState(false);
    const [dateFilter, setDateFilter] = useState<DateFilterOption>('30days');
    const [startDate, setStartDate] = useState(() => getRelativeDate(-30));
    const [endDate, setEndDate] = useState(() => getRelativeDate(0));
    const [displayLimit, setDisplayLimit] = useState(50);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const { setCurrentView } = useApp();

    React.useEffect(() => {
        if (dateFilter === 'today') {
            setStartDate(getRelativeDate(0));
            setEndDate(getRelativeDate(0));
        } else if (dateFilter === '7days') {
            setStartDate(getRelativeDate(-7));
            setEndDate(''); // Show all future scheduled jobs
        } else if (dateFilter === '30days') {
            setStartDate(getRelativeDate(-30));
            setEndDate(''); // Show all future scheduled jobs
        } else if (dateFilter === 'all') {
            setStartDate('');
            setEndDate('');
        }
    }, [dateFilter]);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<ServicePackage> | null>(null);

    const customerMap = useMemo(() => new Map(safeCustomers.map(c => [c.id, c])), [safeCustomers]);
    const vehicleMap = useMemo(() => new Map(safeVehicles.map(v => [v.id, v])), [safeVehicles]);
    const estimateMap = useMemo(() => new Map(safeEstimates.map(e => [e.id, e])), [safeEstimates]);
    const standardTaxRateId = useMemo(() => safeTaxRates.find(t => t.code === 'T1')?.id, [safeTaxRates]);

    const filteredJobs = useMemo(() => {
        const initialFilter = safeJobs.filter(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) {
                return false;
            }
            
            if (showOnSiteOnly && job.vehicleStatus !== 'On-Site') {
                return false;
            }
            
            let dateToUse = job.scheduledDate || job.createdAt;
            if (job.segments && job.segments.length > 0) {
                const dates = job.segments.filter(s => s.date).map(s => s.date!);
                if (dates.length > 0) {
                    dates.sort();
                    dateToUse = dates[0];
                }
            }
            
            if (!isWithinDateRange(dateToUse, startDate, endDate)) {
                return false;
            }

            const isExcludedByDefault = ['Closed', 'Cancelled'].includes(job.status);
            const matchesStatus = statusFilter.length === 0 
                ? !isExcludedByDefault 
                : statusFilter.includes(job.status);
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
                    prevRegMatch ||
                    (job.keyNumber ? String(job.keyNumber).toLowerCase().includes(lowerFilter) : false);
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

    }, [safeJobs, filter, statusFilter, showOnSiteOnly, startDate, endDate, customerMap, vehicleMap, selectedEntityId, safeBusinessEntities]);


    useEffect(() => {
        setDisplayLimit(50);
    }, [filter, statusFilter, showOnSiteOnly, selectedEntityId, startDate, endDate]);

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
                title={`Job Report (${startDate || "Any"} to ${endDate || "Any"})`}
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
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="md:hidden">Brookspeed</span>
                    <span className="hidden md:inline"><Briefcase /> Jobs <span className="text-gray-500 font-medium text-lg">({`${startDate || "Any"} to ${endDate || "Any"}`})</span></span>
                </h2>
                <div className="flex items-center gap-2">
                     <button onClick={handlePrint} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print List
                    </button>
                    <button onClick={onSmartCreateClick} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Job
                    </button>
                    <div className="flex bg-gray-200 p-1 rounded-lg ml-2">
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-300'}`}
                            title="List View"
                        >
                            <LayoutList size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('board')} 
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-300'}`}
                            title="Board View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
            </header>
            
            <div className="flex gap-2 mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-lg shadow-sm">
                <span className="text-sm font-bold text-indigo-900 flex items-center gap-1.5 mr-2">
                    <CalendarDays size={18} /> Capacity & Scheduling
                </span>
                <button 
                    onClick={() => setCurrentView('dispatch')} 
                    className="px-4 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded shadow-sm text-xs font-bold transition-colors flex items-center gap-2"
                >
                    View Dispatch Board (Weekly / Monthly)
                </button>
            </div>
            
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
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-2 ml-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                                <span className="text-gray-500 text-xs">to</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
                    {statusFilterOptions.map(status => (
                        <button key={status} onClick={() => handleStatusToggle(status)} className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${statusFilter.includes(status) ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            {status}
                        </button>
                    ))}
                    <div className="h-4 w-px bg-gray-300 mx-2"></div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={showOnSiteOnly} onChange={e => setShowOnSiteOnly(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        Checked In (On-Site)
                    </label>
                </div>
            </div>
            
            <main className="flex-grow overflow-y-auto">
                {viewMode === 'list' ? (
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
                                    <td className="p-3 font-mono flex items-center gap-2">
                                        {job.id}
                                        {job.checkInPhotos && job.checkInPhotos.length > 0 && (
                                            <button 
                                                onClick={() => onEditJob(job.id, 'media')}
                                                className="text-indigo-600 hover:text-indigo-800" 
                                                title={`${job.checkInPhotos.length} Condition Photos - Click to View`}
                                            >
                                                <Camera size={14} />
                                            </button>
                                        )}
                                    </td>
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
                                            {onOpenInquiry && (() => {
                                                const hasInquiry = (inquiries || []).some(i => i.linkedJobId === job.id);
                                                return (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const existingInquiry = (inquiries || []).find(inq => inq.linkedJobId === job.id);
                                                            if (existingInquiry) {
                                                                onOpenInquiry(existingInquiry);
                                                            } else {
                                                                onOpenInquiry({ entityId: job.entityId, linkedJobId: job.id, linkedCustomerId: job.customerId, linkedVehicleId: job.vehicleId, message: `Question regarding Job #${job.id}` });
                                                            }
                                                        }}
                                                        className={`p-1.5 rounded-full ${hasInquiry ? 'text-green-600 bg-green-100 hover:bg-green-200' : 'text-orange-600 hover:bg-orange-100'}`} 
                                                        title={hasInquiry ? 'View/Update Linked Inquiry' : 'Log Inquiry'}
                                                    >
                                                        <MessageSquare size={16} />
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                </tr>
                            )})}
                         </tbody>
                    </table>
                </div>
                ) : (
                    <JobsBoard 
                        jobs={displayedJobs} 
                        vehicleMap={vehicleMap} 
                        customerMap={customerMap} 
                        onEditJob={onEditJob}
                        onCheckIn={onCheckIn}
                        onOpenPurchaseOrder={onOpenPurchaseOrder}
                        purchaseOrders={purchaseOrders}
                        onGoToDispatch={(id) => {
                            // This routes to dispatch view if setCurrentView is available
                            setCurrentView('dispatch');
                        }}
                    />
                )}
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

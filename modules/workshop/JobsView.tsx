
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../core/state/AppContext';
import { useData } from '../../core/state/DataContext';
import { Job, Vehicle, Customer, ServicePackage, Estimate, PurchaseOrder } from '../../types';
import { Eye, Search, PlusCircle, Printer, Briefcase, Wand2, Loader2, CalendarDays, Camera, LayoutList, LayoutGrid, MessageSquare, FileText, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { getRelativeDate, formatDate, dateStringToDate, addDays, formatReadableDate, isWithinDateRange, getEffectiveJobScheduledDate, formatScheduledArrivalDate } from '../../core/utils/dateUtils';
import PrintableJobList from '../../components/PrintableJobList';
import { usePrint } from '../../core/hooks/usePrint';
import { generateServicePackageName } from '../../core/services/geminiService';
import ServicePackageFormModal from '../../components/ServicePackageFormModal';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';
import { JobsBoard } from './components/JobsBoard';
import { HoverInfo } from '../../components/shared/HoverInfo';

interface JobsViewProps {
    onEditJob: (jobId: string, initialTab?: string) => void;
    onCheckIn?: (jobId: string) => void;
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onSmartCreateClick: () => void;
    onOpenInquiry?: (inquiry: any) => void;
    onCreateInvoice?: (job: Job) => void;
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

const JobsView: React.FC<JobsViewProps> = ({ onEditJob, onCheckIn, onOpenPurchaseOrder, onSmartCreateClick, onOpenInquiry, onCreateInvoice }) => {
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

    type SortField = 'scheduledDate' | 'createdAt' | 'id' | 'customer' | 'vehicle' | 'status';
    const [sortField, setSortField] = useState<SortField>('scheduledDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'scheduledDate' ? 'asc' : 'desc');
        }
    };

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
            
            let dateToUse = getEffectiveJobScheduledDate(job) || job.scheduledDate || job.createdAt;
            
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

        const finalJobs = [...initialFilter, ...supplementaryJobsToAdd].sort((a, b) => {
            if (sortField === 'scheduledDate') {
                const dateA = getEffectiveJobScheduledDate(a) || a.scheduledDate || null;
                const dateB = getEffectiveJobScheduledDate(b) || b.scheduledDate || null;

                if (dateA && dateB) {
                    const cleanA = dateA.split('T')[0];
                    const cleanB = dateB.split('T')[0];
                    if (cleanA !== cleanB) {
                        return sortOrder === 'asc' ? cleanA.localeCompare(cleanB) : cleanB.localeCompare(cleanA);
                    }
                } else if (dateA && !dateB) {
                    // Scheduled jobs appear first
                    return -1;
                } else if (!dateA && dateB) {
                    return 1;
                }
                return (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || '').localeCompare(a.id || '');
            }

            if (sortField === 'createdAt') {
                const timeA = a.createdAt || '';
                const timeB = b.createdAt || '';
                return sortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
            }

            if (sortField === 'id') {
                return sortOrder === 'asc' ? (a.id || '').localeCompare(b.id || '') : (b.id || '').localeCompare(a.id || '');
            }

            if (sortField === 'customer') {
                const custA = (customerMap.get(a.customerId) ? getCustomerDisplayName(customerMap.get(a.customerId)!) : '').toLowerCase();
                const custB = (customerMap.get(b.customerId) ? getCustomerDisplayName(customerMap.get(b.customerId)!) : '').toLowerCase();
                return sortOrder === 'asc' ? custA.localeCompare(custB) : custB.localeCompare(custA);
            }

            if (sortField === 'vehicle') {
                const vehA = (vehicleMap.get(a.vehicleId)?.registration || '').toLowerCase();
                const vehB = (vehicleMap.get(b.vehicleId)?.registration || '').toLowerCase();
                return sortOrder === 'asc' ? vehA.localeCompare(vehB) : vehB.localeCompare(vehA);
            }

            if (sortField === 'status') {
                return sortOrder === 'asc' ? (a.status || '').localeCompare(b.status || '') : (b.status || '').localeCompare(a.status || '');
            }

            return (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || '').localeCompare(a.id || '');
        });

        const uniqueJobs = finalJobs.filter((job, index, self) =>
            index === self.findIndex((j) => j.id === job.id)
        );

        return uniqueJobs;

    }, [safeJobs, filter, statusFilter, showOnSiteOnly, startDate, endDate, customerMap, vehicleMap, selectedEntityId, safeBusinessEntities, sortField, sortOrder]);


    useEffect(() => {
        setDisplayLimit(50);
    }, [filter, statusFilter, showOnSiteOnly, selectedEntityId, startDate, endDate, sortField, sortOrder]);

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
                    <div className="h-4 w-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center gap-1.5 bg-gray-200/80 p-1 rounded-lg">
                        <span className="text-xs font-semibold text-gray-600 px-1 flex items-center gap-1">
                            <ArrowUpDown size={13} /> Sort:
                        </span>
                        <button
                            onClick={() => handleSort('scheduledDate')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                                sortField === 'scheduledDate' ? 'bg-white text-indigo-700 shadow font-bold' : 'text-gray-600 hover:bg-gray-300'
                            }`}
                            title="Sort by Scheduled Date"
                        >
                            <span>Scheduled Date</span>
                            {sortField === 'scheduledDate' && (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                            )}
                        </button>
                        <button
                            onClick={() => handleSort('createdAt')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                                sortField === 'createdAt' ? 'bg-white text-indigo-700 shadow font-bold' : 'text-gray-600 hover:bg-gray-300'
                            }`}
                            title="Sort by Created Date"
                        >
                            <span>Created</span>
                            {sortField === 'createdAt' && (
                                sortOrder === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            <main className="flex-grow overflow-y-auto">
                {viewMode === 'list' ? (
                    <div className="border rounded-lg overflow-hidden bg-white shadow">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                <th 
                                    onClick={() => handleSort('id')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    title="Sort by Job ID"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Job ID</span>
                                        {sortField === 'id' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('scheduledDate')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none bg-indigo-50/50"
                                    title="Sort by Scheduled Date"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'scheduledDate' ? 'text-indigo-700 font-bold' : ''}>Scheduled Date</span>
                                        {sortField === 'scheduledDate' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('createdAt')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    title="Sort by Created Date"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={sortField === 'createdAt' ? 'text-indigo-700 font-bold' : ''}>Created</span>
                                        {sortField === 'createdAt' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('customer')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    title="Sort by Customer"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Customer</span>
                                        {sortField === 'customer' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('vehicle')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    title="Sort by Vehicle"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Vehicle</span>
                                        {sortField === 'vehicle' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th className="p-3 text-left font-semibold text-gray-600">Description</th>
                                <th 
                                    onClick={() => handleSort('status')} 
                                    className="p-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    title="Sort by Status"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Status</span>
                                        {sortField === 'status' ? (
                                            sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 font-bold" /> : <ArrowDown size={13} className="text-indigo-600 font-bold" />
                                        ) : (
                                            <ArrowUpDown size={13} className="text-gray-400 opacity-60" />
                                        )}
                                    </div>
                                </th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                             {displayedJobs.map(job => {
                                 const vehicle = vehicleMap.get(job.vehicleId);
                                 const customer = customerMap.get(job.customerId);
                                 const linkedInquiry = (inquiries || []).find(i => i.linkedJobId === job.id);
                                 const displayCustomerName = getCustomerDisplayName(customer) || linkedInquiry?.fromName || null;
                                 const custAddress = [customer?.addressLine1 || linkedInquiry?.addressLine1, customer?.city || linkedInquiry?.city, customer?.postcode || linkedInquiry?.postcode].filter(Boolean).join(', ');
                                 const schedDate = getEffectiveJobScheduledDate(job) || job.scheduledDate;
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
                                     <td className="p-3 whitespace-nowrap">
                                         {schedDate ? (
                                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                 <Calendar size={13} className="text-indigo-500 shrink-0" />
                                                 {formatScheduledArrivalDate(schedDate)}
                                             </span>
                                         ) : (
                                             <span className="text-gray-400 italic text-xs">Unscheduled</span>
                                         )}
                                     </td>
                                     <td className="p-3 text-xs text-gray-600 whitespace-nowrap">
                                         {job.createdAt ? formatReadableDate(job.createdAt.substring(0, 10)) : 'N/A'}
                                     </td>
                                     <td className="p-3">
                                         {(customer || linkedInquiry) ? (
                                             <HoverInfo
                                                 title="Customer Details"
                                                 data={{
                                                     name: displayCustomerName || 'N/A',
                                                     email: customer?.email || linkedInquiry?.fromEmail || 'N/A',
                                                     phone: customer?.mobile || customer?.phone || linkedInquiry?.fromPhone || 'N/A',
                                                     address: custAddress || 'N/A'
                                                 }}
                                             >
                                                 {displayCustomerName || 'Unnamed Customer'}
                                             </HoverInfo>
                                         ) : (
                                             <span className="text-gray-400 italic">No Customer</span>
                                         )}
                                     </td>
                                     <td className="p-3 font-mono">
                                         {vehicle ? (
                                             <HoverInfo
                                                 title="Vehicle Details"
                                                 data={{ 
                                                     make: vehicle.make, 
                                                     model: vehicle.model, 
                                                     year: vehicle.year, 
                                                     'Year of Manufacture': vehicle.manufactureDate,
                                                     vin: vehicle.vin, 
                                                     motExpiry: vehicle.motExpiryDate 
                                                 }}
                                             >
                                                 {vehicle.registration || 'NO REG'}
                                             </HoverInfo>
                                         ) : (
                                             <span className="text-gray-400 italic">No Vehicle</span>
                                         )}
                                     </td>
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
                                            {onCreateInvoice && (
                                                <button onClick={() => onCreateInvoice(job)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-full" title="Convert Job to Invoice"><FileText size={16} /></button>
                                            )}
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
                        onCreateInvoice={onCreateInvoice}
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

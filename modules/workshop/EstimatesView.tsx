
import React, { useState, useMemo } from 'react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { Estimate, EstimateLineItem, Vehicle, ServicePackage } from '../../types';
import { Plus, Eye, Edit, Trash2, Search, PlusCircle, Wand2, ChevronDown, ChevronUp, Loader2, Printer, CalendarCheck, XCircle, CalendarDays } from 'lucide-react';
import { formatCurrency } from '../../utils/formatUtils';
import { generateServicePackageName } from '../../core/services/geminiService';
import { getRelativeDate } from '../../core/utils/dateUtils';
import PrintableEstimateList from '../../components/PrintableEstimateList';
import { usePrint } from '../../core/hooks/usePrint';
import ServicePackageFormModal from '../../components/ServicePackageFormModal';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';
import { StatusFilter } from '../../components/shared/StatusFilter';
import { HoverInfo } from '../../components/shared/HoverInfo';

interface EstimatesViewProps {
    onOpenEstimateModal: (estimate: Partial<Estimate> | null) => void;
    onViewEstimate: (estimate: Estimate) => void;
    onSmartCreateClick: () => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void;
}

const dateFilterOptions = {
    'today': 'Today',
    '30days': 'Last 30 Days',
    '90days': 'Last 90 Days',
    'all': 'All Time',
};

type DateFilterOption = keyof typeof dateFilterOptions;

const EstimatesView: React.FC<EstimatesViewProps> = ({ onOpenEstimateModal, onViewEstimate, onSmartCreateClick, onScheduleEstimate }) => {
    const { estimates, customers, vehicles, taxRates, setServicePackages, servicePackages, businessEntities, parts, setEstimates } = useData();
    const { selectedEntityId, users, setConfirmation, currentUser } = useApp();
    const { handleSaveItem, updateLinkedInquiryStatus } = useWorkshopActions();
    const print = usePrint();
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Estimate['status'][]>([]);
    const [dateFilter, setDateFilter] = useState<DateFilterOption>('30days');
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<ServicePackage> | null>(null);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    
    const estimateStatusOptions: readonly Estimate['status'][] = ['Draft', 'Sent', 'Approved', 'Rejected', 'Converted to Job', 'Closed'];

    const filteredEstimates = useMemo(() => {
        let dateCutoff: string | null = null;
        const isToday = dateFilter === 'today';
        const todayDate = isToday ? getRelativeDate(0) : null;

        if (dateFilter === '30days') {
            dateCutoff = getRelativeDate(-30);
        } else if (dateFilter === '90days') {
            dateCutoff = getRelativeDate(-90);
        }

        return estimates.filter(estimate => {
            if (selectedEntityId !== 'all' && estimate.entityId !== selectedEntityId) {
                return false;
            }

            if (isToday) {
                if (estimate.issueDate !== todayDate) return false;
            } else if (dateCutoff && estimate.issueDate < dateCutoff) {
                return false;
            }

            const vehicle = vehicleMap.get(estimate.vehicleId);
            const customer = customerMap.get(estimate.customerId);
            const lowerFilter = filter.toLowerCase();

            const matchesSearch = filter === '' ||
                estimate.estimateNumber.toLowerCase().includes(lowerFilter) ||
                (customer && `${customer.forename} ${customer.surname}`.toLowerCase().includes(lowerFilter)) ||
                (vehicle && (
                    vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')) ||
                    (vehicle.previousRegistrations || []).some(pr => pr.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')))
                ));
            
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(estimate.status);
            return matchesSearch && matchesStatus;
        }).sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.estimateNumber || '').localeCompare(a.estimateNumber || ''));
    }, [estimates, filter, statusFilter, dateFilter, customerMap, vehicleMap, selectedEntityId, businessEntities]);

    const calculateTotal = (lineItems: EstimateLineItem[]) => {
        return (lineItems || []).filter(item => !item.isPackageComponent).reduce((sum, item) => {
            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            const rate = taxCodeId ? (taxRatesMap.get(taxCodeId) || 0) / 100 : 0;
            const itemVat = itemNet * rate;
            return sum + itemNet + itemVat;
        }, 0);
    };
    
    const handleStatusToggle = (status: Estimate['status']) => {
        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    };

    const handleCreatePackage = async (estimate: Estimate) => {
        const vehicle = vehicleMap.get(estimate.vehicleId);
        if (!vehicle) {
            setConfirmation({ isOpen: true, title: 'Error', message: "Cannot create a package without an associated vehicle.", type: 'warning' });
            return;
        }

        setIsCreatingPackage(true);
        try {
            const { name, description } = await generateServicePackageName(estimate.lineItems, vehicle.make, vehicle.model);
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
                entityId: estimate.entityId,
                name,
                description,
                totalPrice: totalNet,
                costItems: costItems,
                applicableMake: vehicle.make,
                applicableModel: vehicle.model,
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

    const handlePrintList = () => {
        print(
            <PrintableEstimateList 
                estimates={filteredEstimates} 
                customers={customerMap} 
                vehicles={vehicleMap}
                taxRates={taxRates}
                title={`Estimates Report (${dateFilterOptions[dateFilter]})`}
            />
        );
    };

    const handleQuickClose = async (e: React.MouseEvent, estimate: Estimate) => {
        e.stopPropagation();
        setConfirmation({
            isOpen: true,
            title: 'Close Estimate',
            message: 'Mark this estimate as Closed/Rejected? It will be moved to the Closed status but kept in history.',
            type: 'warning',
            onConfirm: async () => {
                await handleSaveItem(setEstimates, { ...estimate, status: 'Closed' }, 'brooks_estimates');
                await updateLinkedInquiryStatus(estimate.id, 'Closed');
                setConfirmation({ isOpen: false, title: '', message: '' });
            }
        });
    };
    
    return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Estimates <span className="text-gray-500 font-medium text-lg">({dateFilterOptions[dateFilter]})</span></h2>
                <div className="flex items-center gap-2">
                     <button onClick={handlePrintList} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print List
                    </button>
                    <button onClick={onSmartCreateClick} className="flex items-center gap-2 py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">
                        <Wand2 size={16}/> Smart Create
                    </button>
                    <button onClick={() => onOpenEstimateModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Estimate
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
                <StatusFilter statuses={estimateStatusOptions} selectedStatuses={statusFilter} onToggle={handleStatusToggle}/>
            </div>
            
             <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg bg-white shadow">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left w-8"></th>
                                <th className="p-3 text-left font-semibold text-gray-600">Number</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Customer</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Vehicle</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Total</th>
                                <th className="p-3 text-left font-semibold text-gray-600"></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                            {filteredEstimates.map(estimate => {
                                const customer = customerMap.get(estimate.customerId);
                                const vehicle = vehicleMap.get(estimate.vehicleId);
                                return (
                                <React.Fragment key={estimate.id}>
                                    <tr className="hover:bg-indigo-50 cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === estimate.id ? null : estimate.id)}>
                                        <td className="p-3 text-center">
                                            <button className="text-gray-400 hover:text-indigo-600">
                                                {expandedRowId === estimate.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </td>
                                        <td className="p-3 font-mono">{estimate.estimateNumber}</td>
                                        <td className="p-3">
                                            {customer && (
                                                <HoverInfo
                                                    title="Customer Details"
                                                    data={{
                                                        name: `${customer.forename} ${customer.surname}`,
                                                        email: customer.email,
                                                        phone: customer.mobile || customer.phone,
                                                        address: `${customer.addressLine1}, ${customer.city}, ${customer.postcode}`
                                                    }}
                                                >
                                                    {customer.forename} {customer.surname}
                                                </HoverInfo>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">
                                            {vehicle && (
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
                                                    {vehicle.registration}
                                                </HoverInfo>
                                            )}
                                        </td>
                                        <td className="p-3">{estimate.issueDate}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                estimate.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                                                estimate.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                estimate.status === 'Converted to Job' ? 'bg-purple-100 text-purple-800' :
                                                estimate.status === 'Closed' ? 'bg-gray-300 text-gray-800' :
                                                'bg-gray-100'}`}>{estimate.status}</span>
                                        </td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(calculateTotal(estimate.lineItems))}</td>
                                        <td className="p-3">
                                            <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                                                {estimate.status === 'Approved' && !estimate.jobId && onScheduleEstimate ? (
                                                    <button 
                                                        onClick={() => onScheduleEstimate(estimate)} 
                                                        className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-full" 
                                                        title="Schedule Job"
                                                    >
                                                        <CalendarCheck size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => onViewEstimate(estimate)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View"><Eye size={16} /></button>
                                                )}
                                                <button onClick={() => onOpenEstimateModal(estimate)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
                                                {estimate.status !== 'Closed' && estimate.status !== 'Converted to Job' && (
                                                    <button onClick={(e) => handleQuickClose(e, estimate)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-full" title="Close Estimate (Declined/Error)">
                                                        <XCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRowId === estimate.id && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={8} className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-semibold mb-1">Details:</h4>
                                                        <ul className="list-disc list-inside text-xs space-y-1">
                                                            {(estimate.lineItems || []).filter(i => !i.isPackageComponent).map(item => (
                                                                <li key={item.id}>{item.description} - {formatCurrency(item.unitPrice * item.quantity)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="text-xs">
                                                        <p>Created by: {userMap.get(estimate.createdByUserId || '') || 'N/A'}</p>
                                                        <p>Expires: {estimate.expiryDate}</p>
                                                         <button 
                                                            onClick={() => handleCreatePackage(estimate)}
                                                            disabled={isCreatingPackage}
                                                            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 px-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                                        >
                                                            {isCreatingPackage ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                                            {isCreatingPackage ? 'Creating...' : 'Create Service Package'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )})}
                         </tbody>
                    </table>
                </div>
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
                    taxRates={taxRates}
                    entityId={selectedEntityId === 'all' ? (businessEntities[0]?.id || '') : selectedEntityId}
                    businessEntities={businessEntities}
                    parts={parts}
                />
            )}
        </div>
    );
};

export default EstimatesView;

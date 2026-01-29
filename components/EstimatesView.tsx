import React, { useState, useMemo } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Estimate, EstimateLineItem, Vehicle } from '../types';
import { Plus, Eye, Edit, Trash2, Search, PlusCircle, Wand2, ChevronDown, ChevronUp, Loader2, Printer } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import { generateServicePackageName } from '../core/services/geminiService';
import { getRelativeDate } from '../core/utils/dateUtils';
import PrintableEstimateList from './PrintableEstimateList';
import { usePrint } from '../core/hooks/usePrint';

const StatusFilter = ({ statuses, selectedStatuses, onToggle }: { statuses: readonly Estimate['status'][]; selectedStatuses: Estimate['status'][]; onToggle: (status: Estimate['status']) => void; }) => (
    <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
        {statuses.map(status => (
            <button
                key={status}
                onClick={() => onToggle(status)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    selectedStatuses.includes(status)
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
                {status}
            </button>
        ))}
    </div>
);

const EstimatesView = ({ onOpenEstimateModal, onViewEstimate, onSmartCreateClick }: { onOpenEstimateModal: (estimate: Partial<Estimate> | null) => void; onViewEstimate: (estimate: Estimate) => void; onSmartCreateClick: () => void; }) => {
    const { estimates, customers, vehicles, taxRates, setServicePackages, servicePackages, businessEntities } = useData();
    const { selectedEntityId, users } = useApp();
    const print = usePrint();
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Estimate['status'][]>([]);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, `${String(c.forename)} ${String(c.surname)}`])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    
    const estimateStatusOptions: readonly Estimate['status'][] = ['Draft', 'Sent', 'Approved', 'Declined', 'Converted to Job', 'Closed'];

    const filteredEstimates = useMemo(() => {
        const thirtyDaysAgo = getRelativeDate(-30);
        const selectedEntity = businessEntities.find(e => e.id === selectedEntityId);

        return estimates.filter(estimate => {
            if (selectedEntityId !== 'all' && selectedEntity?.shortCode) {
                if (!estimate.estimateNumber.startsWith(selectedEntity.shortCode)) return false;
            } else if (selectedEntityId !== 'all') {
                if (estimate.entityId !== selectedEntityId) return false;
            }
            if (estimate.issueDate < thirtyDaysAgo) return false;

            const vehicle = vehicleMap.get(estimate.vehicleId);
            const customer = customerMap.get(estimate.customerId);
            const lowerFilter = filter.toLowerCase();

            const matchesSearch = filter === '' ||
                estimate.estimateNumber.toLowerCase().includes(lowerFilter) ||
                (customer && customer.toLowerCase().includes(lowerFilter)) ||
                (vehicle && (
                    vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')) ||
                    (vehicle.previousRegistrations || []).some(pr => pr.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')))
                ));
            
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(estimate.status);
            return matchesSearch && matchesStatus;
        }).sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.estimateNumber.localeCompare(a.estimateNumber));
    }, [estimates, filter, statusFilter, customerMap, vehicleMap, selectedEntityId, businessEntities]);

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
            alert("Cannot create a package without an associated vehicle.");
            return;
        }

        setIsCreatingPackage(true);
        try {
            const { name, description } = await generateServicePackageName(estimate.lineItems, vehicle.make, vehicle.model);
            const totalNet = (estimate.lineItems || []).filter(item => !item.isPackageComponent).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            const newPackage: any = {
                id: `pkg_${Date.now()}`,
                entityId: estimate.entityId,
                name,
                description,
                totalPrice: totalNet, // Using net price for simplicity
                costItems: estimate.lineItems.map(li => ({...li, id: crypto.randomUUID()})),
                applicableMake: vehicle.make,
                applicableModel: vehicle.model,
            };
            
            setServicePackages(prev => [...prev, newPackage]);
            alert(`Service Package "${name}" created successfully!`);

        } catch (error: any) {
            alert(`AI failed to create package: ${error.message}`);
        } finally {
            setIsCreatingPackage(false);
        }
    };

    const handlePrintList = () => {
        print(
            <PrintableEstimateList 
                estimates={filteredEstimates} 
                customers={customerMap as unknown as Map<string, any>} 
                vehicles={vehicleMap}
                taxRates={taxRates}
                title="Estimates Report (Last 30 Days)"
            />
        );
    };
    
    return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 bg-gray-50">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Estimates (Last 30 Days)</h2>
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
            
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <StatusFilter statuses={estimateStatusOptions} selectedStatuses={statusFilter} onToggle={handleStatusToggle}/>
                <div className="relative w-full max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="text" placeholder="Search by number, customer, or vehicle..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 pl-9 border rounded-lg"/>
                </div>
            </div>
            
             <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden bg-white shadow">
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
                            {filteredEstimates.map(estimate => (
                                <React.Fragment key={estimate.id}>
                                    <tr className="hover:bg-indigo-50 cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === estimate.id ? null : estimate.id)}>
                                        <td className="p-3 text-center">
                                            <button className="text-gray-400 hover:text-indigo-600">
                                                {expandedRowId === estimate.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </td>
                                        <td className="p-3 font-mono">{estimate.estimateNumber}</td>
                                        <td className="p-3">{customerMap.get(estimate.customerId)}</td>
                                        <td className="p-3 font-mono">{vehicleMap.get(estimate.vehicleId)?.registration}</td>
                                        <td className="p-3">{estimate.issueDate}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                estimate.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                                                estimate.status === 'Declined' ? 'bg-red-100 text-red-800' :
                                                estimate.status === 'Converted to Job' ? 'bg-purple-100 text-purple-800' :
                                                estimate.status === 'Closed' ? 'bg-gray-300 text-gray-800' :
                                                'bg-gray-100'}`}>{estimate.status}</span>
                                        </td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(calculateTotal(estimate.lineItems))}</td>
                                        <td className="p-3">
                                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => onViewEstimate(estimate)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View"><Eye size={16} /></button>
                                                <button onClick={() => onOpenEstimateModal(estimate)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
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
                            ))}
                         </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default EstimatesView;

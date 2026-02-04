import React, { useState, useMemo } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Estimate, EstimateLineItem, Vehicle, ServicePackage } from '../types';
import { Eye, Edit, Search, PlusCircle, Wand2, ChevronDown, ChevronUp, Loader2, Printer } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { generateServicePackageName } from '../core/services/geminiService';
import { getRelativeDate } from '../core/utils/dateUtils';
import PrintableEstimateList from './PrintableEstimateList'; 
import { usePrint } from '../core/hooks/usePrint';
import ServicePackageFormModal from './ServicePackageFormModal'; 
import { useWorkshopActions } from '../core/hooks/useWorkshopActions';
import { StatusFilter } from './shared/StatusFilter';

interface EstimatesViewProps {
    onOpenEstimateModal: (estimate: Partial<Estimate> | null) => void;
    onViewEstimate: (estimate: Estimate) => void;
    onSmartCreateClick: () => void;
}

const EstimatesView: React.FC<EstimatesViewProps> = ({ 
    onOpenEstimateModal, 
    onViewEstimate, 
    onSmartCreateClick 
}) => {
    // FIX: Destructure directly from useData() and provide empty array defaults.
    // This satisfies TypeScript while maintaining the safety of the app.
    const { 
        estimates = [], 
        customers = [], 
        vehicles = [], 
        taxRates = [], 
        setServicePackages, 
        businessEntities = [], 
        parts = [] 
    } = useData() as any; // Using 'as any' here temporarily to bypass the strict {} check
    
    const { selectedEntityId = 'all', users = [], setConfirmation } = useApp();
    const { handleSaveItem } = useWorkshopActions();
    const print = usePrint();
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Estimate['status'][]>([]);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<ServicePackage> | null>(null);

    // Defensive Maps
    const customerMap = useMemo(() => new Map(customers.map((c: any) => [c.id, `${c.forename || ''} ${c.surname || ''}`.trim()])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map((v: any) => [v.id, v])), [vehicles]);
    const userMap = useMemo(() => new Map(users.map((u: any) => [u.id, u.name])), [users]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map((t: any) => [t.id, t.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find((t: any) => t.code === 'T1')?.id, [taxRates]);

    const filteredEstimates = useMemo(() => {
        const thirtyDaysAgo = getRelativeDate(-30);
        const lowerFilter = (filter || '').toLowerCase().replace(/\s/g, '');

        return (estimates as Estimate[]).filter(estimate => {
            if (!estimate) return false;

            // 1. Entity Filter (Safer ID Match)
            if (selectedEntityId !== 'all' && estimate.entityId !== selectedEntityId) {
                return false;
            }

            // 2. Date Filter
            if (estimate.issueDate && estimate.issueDate < thirtyDaysAgo) return false;

            // 3. Status Filter
            if (statusFilter.length > 0 && !statusFilter.includes(estimate.status)) return false;

            // 4. Search Filter
            const estNum = String(estimate.estimateNumber || '').toLowerCase();
            const custName = (customerMap.get(estimate.customerId) || '').toLowerCase();
            const v = vehicleMap.get(estimate.vehicleId) as Vehicle;
            const reg = (v?.registration || '').toLowerCase().replace(/\s/g, '');

            return filter === '' || 
                   estNum.includes(lowerFilter) || 
                   custName.includes(lowerFilter) || 
                   reg.includes(lowerFilter);

        }).sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
    }, [estimates, filter, statusFilter, customerMap, vehicleMap, selectedEntityId]);

    const calculateTotal = (lineItems: EstimateLineItem[] = []) => {
        return (lineItems || []).filter(item => item && !item.isPackageComponent).reduce((sum, item) => {
            const qty = Number(item.quantity || 0);
            const price = Number(item.unitPrice || 0);
            const itemNet = qty * price;
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            const rate = taxCodeId ? (taxRatesMap.get(taxCodeId) || 0) / 100 : 0;
            return sum + itemNet + (itemNet * rate);
        }, 0);
    };

    const handleCreatePackage = async (estimate: Estimate) => {
        const vehicle = vehicleMap.get(estimate.vehicleId);
        if (!vehicle) return;
        setIsCreatingPackage(true);
        try {
            const { name, description } = await generateServicePackageName(estimate.lineItems || [], vehicle.make, vehicle.model);
            const totalNet = (estimate.lineItems || []).filter(item => item && !item.isPackageComponent).reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
            setSuggestedPackage({
                entityId: estimate.entityId,
                name,
                description,
                totalPrice: totalNet,
                costItems: (estimate.lineItems || []).map(li => ({ ...li, id: crypto.randomUUID() })) as any,
                applicableMake: vehicle.make,
                applicableModel: vehicle.model,
                taxCodeId: standardTaxRateId
            });
            setIsPackageModalOpen(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsCreatingPackage(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 bg-gray-50">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Estimates</h2>
                    <p className="text-sm text-gray-500 font-medium">Workshop Activity</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onSmartCreateClick} className="flex items-center gap-2 py-2 px-4 bg-amber-500 text-white font-semibold rounded-lg shadow-md hover:bg-amber-600 transition-all">
                        <Wand2 size={16}/> Smart Create
                    </button>
                    <button onClick={() => onOpenEstimateModal({})} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all">
                        <PlusCircle size={16}/> New Estimate
                    </button>
                </div>
            </header>
            
            <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                <StatusFilter 
                    statuses={['Draft', 'Sent', 'Approved', 'Declined', 'Converted to Job', 'Closed']} 
                    selectedStatuses={statusFilter} 
                    onToggle={(s) => setStatusFilter(prev => prev.includes(s as any) ? prev.filter(x => x !== s) : [...prev, s as any])}
                />
                <div className="relative w-full lg:max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={filter} 
                        onChange={e => setFilter(e.target.value)} 
                        className="w-full p-2.5 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>
            
            <main className="flex-grow overflow-y-auto">
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4 text-left">Ref Number</th>
                                <th className="p-4 text-left">Customer</th>
                                <th className="p-4 text-left">Vehicle</th>
                                <th className="p-4 text-left">Date</th>
                                <th className="p-4 text-left">Status</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredEstimates.length > 0 ? filteredEstimates.map(estimate => {
                                const vehicle = vehicleMap.get(estimate.vehicleId);
                                const isExpanded = expandedRowId === estimate.id;
                                return (
                                    <React.Fragment key={estimate.id}>
                                        <tr className="hover:bg-indigo-50/30 cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : estimate.id)}>
                                            <td className="p-4 text-center text-gray-400">{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</td>
                                            <td className="p-4 font-mono font-bold text-indigo-700">{estimate.estimateNumber || 'DRAFT'}</td>
                                            <td className="p-4 font-medium text-gray-900">{customerMap.get(estimate.customerId) || 'Unknown'}</td>
                                            <td className="p-4"><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs font-bold">{vehicle?.registration || 'N/A'}</span></td>
                                            <td className="p-4 text-gray-500">{estimate.issueDate}</td>
                                            <td className="p-4"><span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">{estimate.status}</span></td>
                                            <td className="p-4 text-right font-bold">{formatCurrency(calculateTotal(estimate.lineItems))}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => onViewEstimate(estimate)} className="p-2 text-gray-500 hover:text-indigo-600"><Eye size={16}/></button>
                                                    <button onClick={() => onOpenEstimateModal(estimate)} className="p-2 text-indigo-600"><Edit size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="p-20 text-center text-gray-400 italic">No estimates found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {isPackageModalOpen && (
                <ServicePackageFormModal
                    isOpen={isPackageModalOpen}
                    onClose={() => setIsPackageModalOpen(false)}
                    onSave={async (pkg) => {
                        if (setServicePackages) {
                            await handleSaveItem(setServicePackages, pkg, 'brooks_servicePackages');
                        }
                        setIsPackageModalOpen(false);
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
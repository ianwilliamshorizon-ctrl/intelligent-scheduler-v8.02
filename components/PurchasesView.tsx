
import React, { useState, useMemo } from 'react';
import { Purchase, Supplier, Job, Vehicle, TaxRate, BusinessEntity, PurchaseOrder } from '../types';
import { Plus, Package as PackageIcon, Search, Edit, Trash2, X, Download } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import PurchaseFormModal from './PurchaseFormModal';
import BatchAddPurchasesModal from './BatchAddPurchasesModal';
import { generatePurchaseId } from '../core/utils/numberGenerators';

interface PurchasesViewProps {
    purchases: Purchase[];
    onSavePurchase: (purchase: Purchase) => void;
    onDeletePurchase: (id: string) => void;
    onSaveMultiplePurchases: (purchases: Purchase[]) => void;
    suppliers: Supplier[];
    jobs: Job[];
    vehicles: Vehicle[];
    taxRates: TaxRate[];
    selectedEntityId: string;
    onOpenExportModal: (type: 'invoices' | 'purchases', items: any[]) => void;
    businessEntities: BusinessEntity[];
}

const StatusFilter = ({ statuses, selectedStatuses, onToggle, onClear }: { statuses: any[], selectedStatuses: any[], onToggle: any, onClear: any }) => {
    return (
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
            {statuses.map(status => {
                const isSelected = selectedStatuses.includes(status);
                return (
                    <button
                        key={status}
                        onClick={() => onToggle(status)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                            isSelected
                                ? 'bg-indigo-600 text-white shadow'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {status}
                    </button>
                );
            })}
            {selectedStatuses.length > 0 && (
                <button onClick={onClear} className="text-xs text-indigo-600 hover:underline">
                    Clear
                </button>
            )}
        </div>
    );
};

const PurchasesView: React.FC<PurchasesViewProps> = ({ purchases, onSavePurchase, onDeletePurchase, onSaveMultiplePurchases, suppliers, jobs, vehicles, taxRates, selectedEntityId, onOpenExportModal, businessEntities }) => {
    const [filter, setFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(formatDate(new Date()).substring(0, 7)); // e.g., '2024-07'
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [modal, setModal] = useState<{ type: string | null; data: any | null }>({ type: null, data: null });

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, `${vehicleMap.get(j.vehicleId)} - ${j.description}`])), [jobs, vehicleMap]);
    
    const jobInvoiceStatusMap = useMemo(() => {
        const map = new Map<string, boolean>();
        jobs.forEach(job => {
            if (job.invoiceId) {
                map.set(job.id, true);
            }
        });
        return map;
    }, [jobs]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(purchase => {
            // Month filter
            const matchesMonth = !monthFilter || purchase.purchaseDate.startsWith(monthFilter);
            if (!matchesMonth) return false;
            
            // Status calculation
            let status: 'Assigned' | 'Complete' | 'In Stock';
            if (!purchase.jobId) {
                status = 'In Stock';
            } else {
                const isComplete = jobInvoiceStatusMap.has(purchase.jobId);
                if (isComplete) {
                    status = 'Complete';
                } else {
                    status = 'Assigned';
                }
            }
            
            // Status filter
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(status);
            if (!matchesStatus) return false;

            // Text search filter
            const supplier = purchase.supplierId ? supplierMap.get(purchase.supplierId) : '';
            const job = purchase.jobId ? jobMap.get(purchase.jobId) : '';
            const lowerFilter = filter.toLowerCase();

            return filter === '' ||
                purchase.name.toLowerCase().includes(lowerFilter) ||
                (purchase.supplierReference && purchase.supplierReference.toLowerCase().includes(lowerFilter)) ||
                supplier?.toLowerCase().includes(lowerFilter) ||
                job?.toLowerCase().includes(lowerFilter);
        }).sort((a,b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    }, [purchases, filter, monthFilter, statusFilter, supplierMap, jobMap, jobInvoiceStatusMap]);

    const handleSave = (purchase: Purchase) => {
        onSavePurchase(purchase);
        setModal({ type: null, data: null });
    };
    
    // FIX: Corrected a type mismatch by adapting the `PurchaseOrder` object from the modal into an array of `Purchase` objects suitable for the view's state.
    const handleBatchSave = (purchaseOrder: Omit<PurchaseOrder, 'id'>) => {
        const entity = businessEntities.find(e => e.id === purchaseOrder.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        let currentPurchases = [...purchases];

        const newPurchases: Purchase[] = purchaseOrder.lineItems.map(item => {
            const newPurchase: Purchase = {
                id: generatePurchaseId(currentPurchases, entityShortCode),
                entityId: purchaseOrder.entityId,
                name: item.description,
                purchasePrice: item.unitPrice,
                markupPercent: 25, // Default markup
                jobId: purchaseOrder.jobId,
                invoiceId: null,
                supplierId: purchaseOrder.supplierId,
                supplierReference: purchaseOrder.supplierReference,
                purchaseDate: purchaseOrder.orderDate,
                taxCodeId: item.taxCodeId,
            };
            currentPurchases.push(newPurchase); // Add to temp array for next ID generation
            return newPurchase;
        });

        // The onSaveMultiplePurchases prop doesn't exist, so we save one by one.
        newPurchases.forEach(onSavePurchase);
        setModal({ type: null, data: null });
    }

    const handleStatusToggle = (status: string) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const purchaseStatusOptions: ('In Stock' | 'Assigned' | 'Complete')[] = ['In Stock', 'Assigned', 'Complete'];


    return (
        <div className="p-4 h-full flex flex-col">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Purchases</h2>
                 <div className="flex gap-2">
                    <button onClick={() => onOpenExportModal('purchases', filteredPurchases)} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Download size={16}/> Export for Accounts
                    </button>
                    <button onClick={() => setModal({ type: 'batch_purchase', data: null })} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <Plus size={16}/> Add Purchase
                    </button>
                </div>
            </header>

            <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="flex gap-4 items-center">
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                            type="text"
                            placeholder="Search by name, supplier, job, or reference..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full p-2 pl-9 border rounded-lg"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">Month:</label>
                        <input 
                            type="month"
                            id="month-filter"
                            value={monthFilter}
                            onChange={e => setMonthFilter(e.target.value)}
                            className="p-2 border rounded-lg bg-white"
                        />
                        <button onClick={() => setMonthFilter('')} className="p-2 text-gray-600 hover:text-indigo-600" title="Show All Months">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <StatusFilter 
                    statuses={purchaseStatusOptions}
                    selectedStatuses={statusFilter}
                    onToggle={handleStatusToggle}
                    onClear={() => setStatusFilter([])}
                />
            </div>
            
            <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Item</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Supplier</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Assigned To</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Cost Price</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Sale Price (Net)</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3 text-left font-semibold text-gray-600"></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                            {filteredPurchases.map(purchase => {
                                let status: 'Assigned' | 'Complete' | 'In Stock';
                                let statusColorClass: string;

                                if (!purchase.jobId) {
                                    status = 'In Stock';
                                    statusColorClass = 'bg-gray-200 text-gray-800';
                                } else {
                                    const isComplete = jobInvoiceStatusMap.has(purchase.jobId);
                                    if (isComplete) {
                                        status = 'Complete';
                                        statusColorClass = 'bg-green-100 text-green-800';
                                    } else {
                                        status = 'Assigned';
                                        statusColorClass = 'bg-blue-100 text-blue-800';
                                    }
                                }
                                const salePrice = purchase.purchasePrice * (1 + (purchase.markupPercent || 0) / 100);
                                return (
                                <tr key={purchase.id} className="hover:bg-indigo-50">
                                    <td className="p-3">{purchase.purchaseDate}</td>
                                    <td className="p-3">
                                        <p className="font-semibold">{purchase.name}</p>
                                        <p className="text-xs text-gray-500">{purchase.supplierReference}</p>
                                    </td>
                                    <td className="p-3">{purchase.supplierId ? supplierMap.get(purchase.supplierId) : 'N/A'}</td>
                                    <td className="p-3">{purchase.jobId ? jobMap.get(purchase.jobId) : <span className="text-xs font-semibold bg-gray-200 px-2 py-1 rounded-full">Stock</span>}</td>
                                    <td className="p-3 text-right font-semibold">{formatCurrency(purchase.purchasePrice)}</td>
                                    <td className="p-3 text-right font-semibold">{formatCurrency(salePrice)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColorClass}`}>
                                            {status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => setModal({ type: 'purchase', data: purchase })} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
                                            <button onClick={() => onDeletePurchase(purchase.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-full" title="Delete"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                         </tbody>
                    </table>
                </div>
            </main>

            {modal.type === 'purchase' && (
                <PurchaseFormModal 
                    isOpen={true}
                    onClose={() => setModal({ type: null, data: null })}
                    onSave={handleSave}
                    purchase={modal.data}
                    suppliers={suppliers}
                    jobs={jobs}
                    vehicles={vehicles}
                    taxRates={taxRates}
                    selectedEntityId={selectedEntityId}
                    purchases={purchases}
                    businessEntities={businessEntities}
                />
            )}
            
            {modal.type === 'batch_purchase' && (
                <BatchAddPurchasesModal
                    isOpen={true}
                    onClose={() => setModal({ type: null, data: null })}
                    onSave={handleBatchSave}
                    jobs={jobs}
                    vehicles={vehicles}
                    suppliers={suppliers}
                    taxRates={taxRates}
                    selectedEntityId={selectedEntityId}
                    businessEntities={businessEntities}
                />
            )}
        </div>
    );
};

export default PurchasesView;

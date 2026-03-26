
import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from '../../types';
import { Edit, Trash2, Search, PlusCircle, Download, Printer, RefreshCcw } from 'lucide-react';
import { formatCurrency } from '../../core/utils/formatUtils';
import { getRelativeDate } from '../../core/utils/dateUtils';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { usePrint } from '../../core/hooks/usePrint';
import PrintablePurchaseOrderList from '../../components/PrintablePurchaseOrderList';
import { StatusFilter } from '../../components/shared/StatusFilter';
import { useWorkshopActions } from '../../core/hooks/useWorkshopActions';

const PurchaseOrdersView = ({ onOpenPurchaseOrderModal, onExport, onOpenBatchUpdateRefModal }: { 
    onOpenPurchaseOrderModal: (po: PurchaseOrder | null) => void, 
    onViewPurchaseOrder: (po: PurchaseOrder) => void,
    onExport: (data: any[], type: string) => void, 
    onOpenBatchAddModal: () => void,
    onOpenBatchUpdateRefModal: () => void
}) => {
    const { purchaseOrders, suppliers, forceRefresh } = useData();
    const { selectedEntityId, setConfirmation } = useApp();
    const print = usePrint();
    const workshopActions = useWorkshopActions();

    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<PurchaseOrder['status'][]>([]);
    const [startDate, setStartDate] = useState(() => getRelativeDate(-30));
    const [endDate, setEndDate] = useState(() => getRelativeDate(0));

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);

    const filteredPurchaseOrders = useMemo(() => {
        return purchaseOrders.filter(po => {
            if (selectedEntityId !== 'all' && po.entityId !== selectedEntityId) {
                return false;
            }

            if (po.orderDate < startDate || po.orderDate > endDate) return false;

            const supplier = po.supplierId ? supplierMap.get(po.supplierId) : '';
            const lowerFilter = filter.toLowerCase();

            const matchesSearch = filter === '' ||
                po.id.toLowerCase().includes(lowerFilter) ||
                (po.vehicleRegistrationRef || '').toLowerCase().includes(lowerFilter) ||
                (po.supplierReference || '').toLowerCase().includes(lowerFilter) ||
                (supplier && supplier.toLowerCase().includes(lowerFilter));

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(po.status);

            return matchesSearch && matchesStatus;
        }).sort((a, b) => b.id.localeCompare(a.id));
    }, [purchaseOrders, filter, statusFilter, supplierMap, selectedEntityId, startDate, endDate]);

    const handleStatusToggle = (status: PurchaseOrder['status']) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    
    const handleDeletePurchaseOrder = (id: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Purchase Order',
            message: 'Are you sure you want to delete this purchase order? This will permanently remove it and unlink it from any jobs.',
            onConfirm: () => workshopActions.handleDeletePurchaseOrder(id),
            type: 'error'
        });
    };

    const poStatusOptions: readonly PurchaseOrder['status'][] = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];

    const calculateTotal = (lineItems: any[]) => {
        return (lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };
    
    const handlePrintList = () => {
        print(
            <PrintablePurchaseOrderList 
                purchaseOrders={filteredPurchaseOrders}
                suppliers={supplierMap}
                title={`Purchase Orders (${startDate} to ${endDate})`}
            />
        );
    }

    return (
        <div className="w-full h-full flex flex-col p-6">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Purchase Orders (Last 30 Days)</h2>
                <div className="flex gap-2">
                    <button onClick={() => onExport(filteredPurchaseOrders, 'purchases')} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Download size={16}/> Export for Accounts
                    </button>
                     <button onClick={handlePrintList} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print List
                    </button>
                    <button onClick={() => forceRefresh('brooks_purchaseOrders')} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <RefreshCcw size={16}/> Refresh Data
                    </button>
                    <button onClick={onOpenBatchUpdateRefModal} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <RefreshCcw size={16}/> Batch Update Ref
                    </button>
                    <button onClick={() => onOpenPurchaseOrderModal(null)} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Purchase Order
                    </button>
                </div>
            </header>
            <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="flex gap-4 items-center">
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                            type="text"
                            placeholder="Search by PO number, reference, or supplier..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full p-2 pl-9 border rounded-lg"
                        />
                    </div>
                     <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-sm font-medium text-gray-700">From:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                        <label className="text-sm font-medium text-gray-700">To:</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                    </div>
                </div>
                <StatusFilter
                    statuses={poStatusOptions}
                    selectedStatuses={statusFilter}
                    onToggle={handleStatusToggle}
                />
            </div>
            <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden bg-white shadow">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">PO Number</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Supplier</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Supplier Ref</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Vehicle Ref</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Total (Net)</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPurchaseOrders.map(po => (
                                <tr key={po.id} className="hover:bg-indigo-50">
                                    <td className="p-3 font-mono">{po.id}</td>
                                    <td className="p-3">{po.orderDate}</td>
                                    <td className="p-3">{po.supplierId ? supplierMap.get(po.supplierId) : 'N/A'}</td>
                                    <td className="p-3">{po.supplierReference || '-'}</td>
                                    <td className="p-3">{po.vehicleRegistrationRef}</td>
                                    <td className="p-3">
                                         <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            po.status === 'Received' ? 'bg-green-100 text-green-800' : 
                                            po.status === 'Partially Received' ? 'bg-amber-100 text-amber-800' :
                                            po.status === 'Ordered' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'}`}>{po.status}</span>
                                    </td>
                                    <td className="p-3 text-right font-semibold">{formatCurrency(calculateTotal(po.lineItems))}</td>
                                    <td className="p-3">
                                         <div className="flex gap-1 justify-end">
                                            <button onClick={() => onOpenPurchaseOrderModal(po)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
                                            <button onClick={() => handleDeletePurchaseOrder(po.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-full" title="Delete"><Trash2 size={16} /></button>
                                         </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};
export default PurchaseOrdersView;

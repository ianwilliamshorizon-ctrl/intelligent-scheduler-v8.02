import React, { useState, useMemo } from 'react';
import * as T from '../types';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { useData } from '../core/state/DataContext';
import PurchaseOrderViewModal from './PurchaseOrderViewModal';
import PurchaseOrderEditModal from './PurchaseOrderEditModal';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../core/utils/formatUtils';

const PurchaseOrdersTab: React.FC = () => {
    const { purchaseOrders, setPurchaseOrders, suppliers, parts, setParts } = useData();
    const { setConfirmation } = useApp();
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedPo, setSelectedPo] = useState<T.PurchaseOrder | null>(null);

    const handleOpenViewModal = (po: T.PurchaseOrder) => {
        setSelectedPo(po);
        setViewModalOpen(true);
    };

    const handleOpenEditModal = (po: T.PurchaseOrder) => {
        setSelectedPo(po);
        setEditModalOpen(true);
    };

    const handleCloseModals = () => {
        setSelectedPo(null);
        setViewModalOpen(false);
        setEditModalOpen(false);
    };

    const handleUpdatePo = async (updatedPo: T.PurchaseOrder, source?: string) => {
        // This is a placeholder for your actual update logic
        console.log('Updating PO:', updatedPo, 'From:', source);
        setPurchaseOrders(prev => prev.map(p => p.id === updatedPo.id ? updatedPo : p));
        setConfirmation({ 
            isOpen: true, 
            title: 'Success', 
            message: source === 'receive' ? 'Purchase Order items received into stock.' : 'Purchase Order updated.',
            type: 'success'
        });
        handleCloseModals();
    };

    const handleSendPo = (poId: string) => {
        // Placeholder for sending PO
        console.log('Sending PO:', poId);
        setConfirmation({ isOpen: true, title: 'Success', message: 'Purchase Order sent to supplier.', type: 'success' });
    };

    const handleSaveItem = async (setter: React.Dispatch<React.SetStateAction<any[]>>, item: any, collectionOverride?: string) => {
        // Placeholder for saving item
        console.log('Saving item:', item, 'to', collectionOverride);
        setter(prev => {
            const existing = prev.find(p => p.id === item.id);
            if (existing) {
                return prev.map(p => p.id === item.id ? item : p);
            } else {
                return [...prev, item];
            }
        });
        return item; 
    };

    const handleEditPart = (part: T.Part) => {
        // Placeholder for editing part
        console.log('Editing part:', part);
    };

    const sortedPurchaseOrders = useMemo(() => 
        [...purchaseOrders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    , [purchaseOrders]);

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Purchase Orders</h2>
            <div className="bg-white shadow rounded-lg">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PO #</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPurchaseOrders.map(po => {
                            const supplier = suppliers.find(s => s.id === po.supplierId);
                            const total = (po.lineItems || []).reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
                            const canEdit = po.status === 'Draft' || po.status === 'Ordered' || po.status === 'Partially Received';

                            return (
                                <tr key={po.id}>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{po.id}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{supplier?.name || 'N/A'}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{po.orderDate}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{po.status}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{formatCurrency(total)}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">

                                        {canEdit && (
                                            <button onClick={() => handleOpenEditModal(po)} className="text-gray-500 hover:text-indigo-600 p-1">
                                                <Edit size={20} />
                                            </button>
                                        )}
                                        <button onClick={() => { /* Placeholder for delete */ }} className="text-gray-500 hover:text-red-600 p-1">
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedPo && (
                <>
                    <PurchaseOrderViewModal 
                        isOpen={viewModalOpen}
                        onClose={handleCloseModals}
                        purchaseOrder={selectedPo}
                        onUpdate={handleUpdatePo}
                        onSend={handleSendPo}
                    />
                    <PurchaseOrderEditModal
                        isOpen={editModalOpen}
                        onClose={handleCloseModals}
                        purchaseOrder={selectedPo}
                        onUpdate={handleUpdatePo}
                        handleSaveItem={handleSaveItem}
                        onEditPart={handleEditPart}
                    />
                </>
            )}
        </div>
    );
};

export default PurchaseOrdersTab;

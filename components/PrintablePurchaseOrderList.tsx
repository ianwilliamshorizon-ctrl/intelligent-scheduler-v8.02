import React from 'react';
import { PurchaseOrder } from '../types';
import { formatCurrency } from '../utils/formatUtils';

interface PrintablePurchaseOrderListProps {
    purchaseOrders: PurchaseOrder[];
    suppliers: Map<string, string>; // ID to Name
    title: string;
}

const PrintablePurchaseOrderList: React.FC<PrintablePurchaseOrderListProps> = ({ purchaseOrders, suppliers, title }) => {
    
    const calculateTotal = (lineItems: any[]) => {
        return (lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };

    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', padding: '10mm', boxSizing: 'border-box' }}>
            <header className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders Report</h1>
                <h2 className="text-lg text-gray-700">{title}</h2>
                <p className="text-xs text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
            </header>
            <main>
                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border border-gray-300">PO Number</th>
                            <th className="p-2 border border-gray-300">Date</th>
                            <th className="p-2 border border-gray-300">Supplier</th>
                            <th className="p-2 border border-gray-300">Reference</th>
                            <th className="p-2 border border-gray-300">Status</th>
                            <th className="p-2 border border-gray-300 text-right">Total (Net)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchaseOrders.map(po => {
                            const total = calculateTotal(po.lineItems);
                            return (
                                <tr key={po.id}>
                                    <td className="p-2 border border-gray-300 font-mono">{po.id}</td>
                                    <td className="p-2 border border-gray-300">{po.orderDate}</td>
                                    <td className="p-2 border border-gray-300">{po.supplierId ? suppliers.get(po.supplierId) : 'N/A'}</td>
                                    <td className="p-2 border border-gray-300">{po.vehicleRegistrationRef}</td>
                                    <td className="p-2 border border-gray-300">{po.status}</td>
                                    <td className="p-2 border border-gray-300 text-right">{formatCurrency(total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </main>
        </div>
    );
};

export default PrintablePurchaseOrderList;
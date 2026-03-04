import React from 'react';
import { PurchaseOrder, Supplier, BusinessEntity } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

interface PurchaseOrderPrintProps {
    purchaseOrder: PurchaseOrder;
    supplier: Supplier;
    entityDetails: BusinessEntity & { logoUrl?: string };
    totals: { net: number; vat: number; grandTotal: number };
}

export const PurchaseOrderPrint: React.FC<PurchaseOrderPrintProps> = ({ purchaseOrder, supplier, entityDetails, totals }) => {
    return (
        <div className="bg-white text-gray-900 font-sans text-sm p-8" style={{ width: '210mm', minHeight: '297mm' }}>
            <header className="flex justify-between items-start pb-4 border-b-2 border-gray-900">
                <div className="flex items-center">
                    {entityDetails.logoUrl && <img src={entityDetails.logoUrl} alt={`${entityDetails.name} Logo`} className="h-16 mr-4" />} 
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{entityDetails.name}</h1>
                        <p>{entityDetails.addressLine1}, {entityDetails.city}, {entityDetails.postcode}</p>
                        <p>VAT Reg: {entityDetails.vatNumber}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-bold uppercase">Purchase Order</h2>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-8 mt-6">
                <div>
                    <h3 className="font-bold mb-2">Supplier:</h3>
                    <div className="p-3 border rounded-lg bg-gray-50">
                        <p className="font-bold">{supplier.name}</p>
                        <p>{supplier.addressLine1}</p>
                        {supplier.addressLine2 && <p>{supplier.addressLine2}</p>}
                        <p>{supplier.city}, {supplier.postcode}</p>
                    </div>
                </div>
                <div className="text-right">
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="font-bold">PO Number:</span>
                        <span>{purchaseOrder.id}</span>
                        <span className="font-bold">Date:</span>
                        <span>{formatDate(new Date(purchaseOrder.orderDate))}</span>
                        <span className="font-bold">Status:</span>
                        <span>{purchaseOrder.status}</span>
                    </div>
                </div>
            </section>

            <section className="mt-8">
                <table className="w-full table-auto border-collapse border border-gray-400">
                    <thead className="bg-gray-200 text-left font-bold">
                        <tr>
                            <th className="p-2 border border-gray-400">Part Number</th>
                            <th className="p-2 border border-gray-400">Description</th>
                            <th className="p-2 border border-gray-400 text-right">Quantity</th>
                            <th className="p-2 border border-gray-400 text-right">Unit Price</th>
                            <th className="p-2 border border-gray-400 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchaseOrder.lineItems.map((item, index) => (
                            <tr key={index} className="border-b">
                                <td className="p-2 border border-gray-400">{item.partNumber || 'N/A'}</td>
                                <td className="p-2 border border-gray-400">{item.description}</td>
                                <td className="p-2 border border-gray-400 text-right">{item.quantity}</td>
                                <td className="p-2 border border-gray-400 text-right">{formatCurrency(item.unitPrice)}</td>
                                <td className="p-2 border border-gray-400 text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="mt-8 flex justify-end">
                <div className="w-1/3">
                    <div className="flex justify-between py-1">
                        <span className="font-bold">Subtotal:</span>
                        <span>{formatCurrency(totals.net)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                        <span className="font-bold">VAT (20%):</span>
                        <span>{formatCurrency(totals.vat)}</span>
                    </div>
                    <div className="flex justify-between py-2 mt-2 border-t-2 border-b-2 border-gray-900 font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.grandTotal)}</span>
                    </div>
                </div>
            </section>

            <footer className="mt-12 pt-4 text-center text-xs text-gray-500 border-t">
                <p>Generated by Brookspeed Management System</p>
            </footer>
        </div>
    );
};
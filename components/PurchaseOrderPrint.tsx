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

export const PurchaseOrderPrint = React.forwardRef<HTMLDivElement, PurchaseOrderPrintProps>(({ 
    purchaseOrder, 
    supplier, 
    entityDetails, 
    totals 
}, ref) => {
    const printStyles = `
        body { margin: 0; padding: 0; background-color: #fff !important; }
        @page { size: A4; margin: 0; }
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
    `;

    return (
        <div 
            ref={ref}
            className="font-sans text-sm p-12 mx-auto"
            style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                backgroundColor: '#ffffff', 
                color: '#111827'
            }}
        >
            <style dangerouslySetInnerHTML={{ __html: printStyles }} />

            {/* Header */}
            <header className="flex justify-between items-start pb-6" style={{ borderBottom: '2px solid #111827' }}>
                <div className="flex items-center">
                    {entityDetails.logoUrl && (
                        <img src={entityDetails.logoUrl} alt={`${entityDetails.name} Logo`} className="h-20 mr-6 object-contain" />
                    )} 
                    <div>
                        <h1 className="text-2xl font-bold leading-tight" style={{ color: '#111827' }}>{entityDetails.name}</h1>
                        <p className="mt-1">{entityDetails.addressLine1}</p>
                        <p>{entityDetails.city}, {entityDetails.postcode}</p>
                        <p className="text-xs mt-1 font-semibold uppercase tracking-wider">VAT Reg: {entityDetails.vatNumber}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-black uppercase" style={{ color: '#cccccc' }}>Purchase Order</h2>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 text-right">
                        <span className="font-bold">PO Number:</span>
                        <span>{purchaseOrder.id}</span>
                        <span className="font-bold">Date:</span>
                        <span>{formatDate(new Date(purchaseOrder.orderDate || Date.now()))}</span>
                    </div>
                </div>
            </header>

            {/* Addresses */}
            <section className="grid grid-cols-2 gap-12 mt-10">
                <div>
                    <h3 className="font-bold mb-2 uppercase text-xs tracking-widest" style={{ color: '#6b7280' }}>Supplier</h3>
                    <div className="p-4 border rounded-lg" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                        <p className="font-bold text-base">{supplier.name}</p>
                        <p>{supplier.addressLine1}</p>
                        {supplier.addressLine2 && <p>{supplier.addressLine2}</p>}
                        <p>{supplier.city}, {supplier.postcode}</p>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold mb-2 uppercase text-xs tracking-widest" style={{ color: '#6b7280' }}>Deliver To</h3>
                    <div className="p-4 border rounded-lg" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                        <p className="font-bold text-base">{entityDetails.name}</p>
                        <p>{entityDetails.addressLine1}</p>
                        <p>{entityDetails.city}, {entityDetails.postcode}</p>
                    </div>
                </div>
            </section>

            {/* Line Items */}
            <section className="mt-10">
                <table className="w-full table-auto border-collapse" style={{ border: '1px solid #d1d5db' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #9ca3af' }}>
                            <th className="p-3 text-left font-bold" style={{ borderRight: '1px solid #d1d5db' }}>Part Number</th>
                            <th className="p-3 text-left font-bold" style={{ borderRight: '1px solid #d1d5db' }}>Description</th>
                            <th className="p-3 text-right font-bold" style={{ borderRight: '1px solid #d1d5db' }}>Qty</th>
                            <th className="p-3 text-right font-bold" style={{ borderRight: '1px solid #d1d5db' }}>Unit Price</th>
                            <th className="p-3 text-right font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(purchaseOrder.lineItems || []).map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td className="p-3 align-top font-mono text-xs" style={{ borderRight: '1px solid #d1d5db' }}>{item.partNumber || 'N/A'}</td>
                                <td className="p-3 align-top" style={{ borderRight: '1px solid #d1d5db' }}>{item.description}</td>
                                <td className="p-3 align-top text-right" style={{ borderRight: '1px solid #d1d5db' }}>{item.quantity}</td>
                                <td className="p-3 align-top text-right" style={{ borderRight: '1px solid #d1d5db' }}>{formatCurrency(item.unitPrice)}</td>
                                <td className="p-3 align-top text-right font-semibold">
                                    {formatCurrency(item.quantity * item.unitPrice)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* Totals */}
            <section className="mt-8 flex justify-end">
                <div className="w-64">
                    <div className="flex justify-between py-1 px-2">
                        <span style={{ color: '#4b5563' }}>Subtotal:</span>
                        <span>{formatCurrency(totals.net)}</span>
                    </div>
                    <div className="flex justify-between py-1 px-2">
                        <span style={{ color: '#4b5563' }}>VAT (20%):</span>
                        <span>{formatCurrency(totals.vat)}</span>
                    </div>
                    <div 
                        className="flex justify-between py-2 px-2 mt-2 font-bold text-xl" 
                        style={{ borderTop: '2px solid #111827', backgroundColor: '#f9fafb' }}
                    >
                        <span>Total:</span>
                        <span>{formatCurrency(totals.grandTotal)}</span>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer 
                className="mt-auto pt-8 text-center text-[10px] uppercase tracking-widest" 
                style={{ color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}
            >
                <p>Generated by Brookspeed Management System &bull; Confidential</p>
            </footer>
        </div>
    );
});
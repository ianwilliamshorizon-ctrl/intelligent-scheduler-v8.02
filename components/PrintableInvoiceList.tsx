import React from 'react';
import { Invoice, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface PrintableInvoiceListProps {
    invoices: Invoice[];
    customers: Map<string, Customer>;
    vehicles: Map<string, Vehicle>;
    taxRates: TaxRate[];
    title: string;
}

const PrintableInvoiceList: React.FC<PrintableInvoiceListProps> = ({ invoices, customers, vehicles, taxRates, title }) => {
    const taxRatesMap = new Map<string, number>(taxRates.map(t => [t.id, t.rate]));
    const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;

    const calculateTotal = (lineItems: EstimateLineItem[]) => {
        return lineItems.reduce((sum, item) => {
            if (item.isPackageComponent) return sum;
            const net = (item.quantity || 0) * (item.unitPrice || 0);
            const codeToUse = item.taxCodeId || standardTaxRateId;
            const rate = (codeToUse ? taxRatesMap.get(codeToUse) : 0) || 0;
            const vat = net * (rate / 100);
            return sum + net + vat;
        }, 0);
    };

    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
            <header className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Invoice Report</h1>
                <h2 className="text-lg text-gray-700">{title}</h2>
            </header>
            <main>
                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border">Invoice #</th>
                            <th className="p-2 border">Date</th>
                            <th className="p-2 border">Customer</th>
                            <th className="p-2 border">Vehicle</th>
                            <th className="p-2 border">Status</th>
                            <th className="p-2 border text-right">Total (Gross)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.map(inv => {
                            const customer = customers.get(inv.customerId);
                            const vehicle = inv.vehicleId ? vehicles.get(inv.vehicleId) : null;
                            const total = calculateTotal(inv.lineItems);
                            return (
                                <tr key={inv.id}>
                                    <td className="p-2 border font-mono">{inv.id}</td>
                                    <td className="p-2 border">{inv.issueDate}</td>
                                    <td className="p-2 border">{getCustomerDisplayName(customer)}</td>
                                    <td className="p-2 border">{vehicle?.registration || 'N/A'}</td>
                                    <td className="p-2 border">{inv.status}</td>
                                    <td className="p-2 border text-right">{formatCurrency(total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </main>
        </div>
    );
};

export default PrintableInvoiceList;
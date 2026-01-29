import React from 'react';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface PrintableEstimateListProps {
    estimates: Estimate[];
    customers: Map<string, Customer>;
    vehicles: Map<string, Vehicle>;
    taxRates: TaxRate[];
    title: string;
}

const PrintableEstimateList: React.FC<PrintableEstimateListProps> = ({ estimates, customers, vehicles, taxRates, title }) => {
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
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', padding: '10mm', boxSizing: 'border-box' }}>
            <header className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Estimates Report</h1>
                <h2 className="text-lg text-gray-700">{title}</h2>
                <p className="text-xs text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
            </header>
            <main>
                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border border-gray-300">Number</th>
                            <th className="p-2 border border-gray-300">Date</th>
                            <th className="p-2 border border-gray-300">Customer</th>
                            <th className="p-2 border border-gray-300">Vehicle</th>
                            <th className="p-2 border border-gray-300">Status</th>
                            <th className="p-2 border border-gray-300 text-right">Total (Gross)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {estimates.map(est => {
                            const customer = customers.get(est.customerId);
                            const vehicle = est.vehicleId ? vehicles.get(est.vehicleId) : null;
                            const total = calculateTotal(est.lineItems);
                            return (
                                <tr key={est.id}>
                                    <td className="p-2 border border-gray-300 font-mono">{est.estimateNumber}</td>
                                    <td className="p-2 border border-gray-300">{est.issueDate}</td>
                                    <td className="p-2 border border-gray-300">{getCustomerDisplayName(customer)}</td>
                                    <td className="p-2 border border-gray-300">{vehicle?.registration || 'N/A'}</td>
                                    <td className="p-2 border border-gray-300">{est.status}</td>
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

export default PrintableEstimateList;
import React from 'react';
import { Invoice, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

import { getInvoiceGrossTotal, getInvoicePaymentStatus } from '../core/utils/invoiceCalculations';

interface PrintableInvoiceListProps {
    invoices: Invoice[];
    customers: Map<string, Customer>;
    vehicles: Map<string, Vehicle>;
    taxRates: TaxRate[];
    title: string;
}

const PrintableInvoiceList: React.FC<PrintableInvoiceListProps> = ({ invoices, customers, vehicles, taxRates, title }) => {
    const calculateTotal = (inv: Invoice) => {
        return getInvoiceGrossTotal(inv, taxRates);
    };


    return (
        <div style={{ 
            backgroundColor: '#ffffff', 
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
        }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 10mm; 
                    }
                    body * { 
                        visibility: hidden; 
                    }
                    .rebuild-print-container, .rebuild-print-container * { 
                        visibility: visible !important; 
                    }
                    .rebuild-print-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                    }
                     table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        margin-top: 20px !important;
                    }
                    th { 
                        background-color: #f2f2f2 !important; 
                        -webkit-print-color-adjust: exact; 
                    }
                    td, th { 
                        border: 1px solid #333333 !important; 
                        padding: 8px !important; 
                        color: #000 !important; 
                        font-size: 10px !important;
                    }
                }
            `}} />
            <div className="rebuild-print-container bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
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
                                const total = calculateTotal(inv);
                                const paymentStatus = getInvoicePaymentStatus(inv, total);
                                return (
                                    <tr key={inv.id}>
                                        <td className="p-2 border font-mono">{inv.id}</td>
                                        <td className="p-2 border">{inv.issueDate}</td>
                                        <td className="p-2 border">{getCustomerDisplayName(customer)}</td>
                                        <td className="p-2 border">{vehicle?.registration || 'N/A'}</td>
                                        <td className="p-2 border font-semibold">
                                            {paymentStatus.statusLabel} ({inv.status})
                                        </td>
                                        <td className="p-2 border text-right font-bold">{formatCurrency(total)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </main>
            </div>
        </div>
    );
};

export default PrintableInvoiceList;

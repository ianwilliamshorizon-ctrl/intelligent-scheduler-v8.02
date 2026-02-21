import React from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, TaxRate, EstimateLineItem } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface PrintableInvoiceProps {
    invoice: Invoice;
    customer: Customer | undefined;
    vehicle: Vehicle | undefined;
    entity: BusinessEntity | undefined;
    taxRates: TaxRate[];
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, customer, vehicle, entity, taxRates }) => {
    const taxRatesMap: Map<string, TaxRate> = new Map(taxRates.map((t: TaxRate) => [t.id, t]));
    const standardTaxRate: TaxRate | undefined = taxRates.find((t: TaxRate) => t.code === 'T1');

    const subtotal = (invoice.lineItems || []).reduce((acc, item: EstimateLineItem) => acc + (item.quantity * item.unitPrice), 0);
    const vatTotal = (invoice.lineItems || []).reduce((acc, item: EstimateLineItem) => {
        const rateInfo: TaxRate | undefined = taxRatesMap.get(item.taxCodeId || '');
        const rate = rateInfo ? rateInfo.rate : (standardTaxRate?.rate || 0);
        return acc + (item.quantity * item.unitPrice * (rate / 100));
    }, 0);
    const total = subtotal + vatTotal;

    return (
        <div className="p-8 bg-white">
            <header className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Invoice</h1>
                    <p className="text-gray-500">Invoice #: {invoice.id}</p>
                    <p className="text-gray-500">Date: {invoice.issueDate}</p>
                    <p className="text-gray-500">Job ID: {invoice.jobId || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold">{entity?.name}</h2>
                    <p>{entity?.addressLine1}</p>
                    <p>{entity?.city}, {entity?.postcode}</p>
                    <p>VAT Reg: {entity?.vatNumber}</p>
                    <p>Co Reg: {entity?.companyNumber}</p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="font-bold text-gray-600 mb-2">Billed To:</h3>
                    <p className="font-semibold">{getCustomerDisplayName(customer)}</p>
                    <p>{customer?.addressLine1}</p>
                    <p>{customer?.city}, {customer?.postcode}</p>
                    <p>{customer?.email}</p>
                    <p>{customer?.phone}</p>
                </div>
                {vehicle && (
                    <div>
                        <h3 className="font-bold text-gray-600 mb-2">Vehicle Details:</h3>
                        <p><span className="font-semibold">Reg:</span> {vehicle.registration}</p>
                        <p><span className="font-semibold">Make/Model:</span> {vehicle.make} {vehicle.model}</p>
                        <p><span className="font-semibold">VIN:</span> {vehicle.vin || 'N/A'}</p>
                    </div>
                )}
            </div>

            <table className="w-full mb-8">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-right">Quantity</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">VAT</th>
                        <th className="p-2 text-right">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.lineItems || []).map((item: EstimateLineItem) => {
                        const rateInfo: TaxRate | undefined = taxRatesMap.get(item.taxCodeId || '');
                        const rate = rateInfo ? rateInfo.rate : (standardTaxRate?.rate || 0);
                        const itemVat = item.quantity * item.unitPrice * (rate / 100);
                        const lineTotal = (item.quantity * item.unitPrice) + itemVat;
                        return (
                            <tr key={item.id}>
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity}</td>
                                <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                <td className="p-2 text-right">{formatCurrency(itemVat)} ({rate}%)</td>
                                <td className="p-2 text-right">{formatCurrency(lineTotal)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="flex justify-end mb-8">
                <div className="w-1/3">
                    <div className="flex justify-between">
                        <p className="text-gray-600">Subtotal:</p>
                        <p>{formatCurrency(subtotal)}</p>
                    </div>
                    <div className="flex justify-between">
                        <p className="text-gray-600">VAT:</p>
                        <p>{formatCurrency(vatTotal)}</p>
                    </div>
                    <div className="flex justify-between font-bold text-xl mt-2">
                        <p>Total:</p>
                        <p>{formatCurrency(total)}</p>
                    </div>
                </div>
            </div>

            {invoice.notes && (
                <div className="mb-8">
                    <h3 className="font-bold text-gray-600 mb-2">Notes:</h3>
                    <p className="text-gray-500 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
            )}

            <footer className="text-center text-xs text-gray-400">
                <p>{entity?.invoiceFooterText}</p>
            </footer>
        </div>
    );
};

export default PrintableInvoice;

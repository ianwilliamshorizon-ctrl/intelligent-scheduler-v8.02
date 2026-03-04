import React, { useState, useMemo } from 'react';
import { Invoice, Customer, Vehicle, EstimateLineItem, TaxRate, ServicePackage } from '../types';
import { Eye, Trash2, Search, Download, PlusCircle, Edit } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

const StatusFilter = ({ statuses, selectedStatuses, onToggle }: { statuses: readonly Invoice['status'][]; selectedStatuses: Invoice['status'][]; onToggle: (status: Invoice['status']) => void; }) => {
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
        </div>
    );
};


const InvoicesView = ({ invoices, customers, vehicles, onViewInvoice, onEditInvoice, onOpenExportModal, onCreateAdhocInvoice, taxRates, servicePackages }: { invoices: Invoice[]; customers: Customer[]; vehicles: Vehicle[]; onViewInvoice: (invoice: Invoice) => void; onEditInvoice: (invoice: Invoice) => void; onOpenExportModal: (type: string, items: any[]) => void; onCreateAdhocInvoice: () => void; taxRates: TaxRate[]; servicePackages: ServicePackage[] }) => {
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Invoice['status'][]>([]);
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, `${c.forename} ${c.surname}`])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    const t99RateId = useMemo(() => taxRates.find(t => t.code === 'T99')?.id, [taxRates]);

    const calculateGrossTotal = (lineItems: EstimateLineItem[]) => {
        let totalNet = 0;
        let totalVat = 0;

        if (!lineItems) return 0;

        const billableItems = lineItems.filter(item => !item.isPackageComponent);

        billableItems.forEach(item => {
            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            totalNet += itemNet;

            if (item.taxCodeId === t99RateId) {
                totalVat += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;

                const rate = taxRatesMap.get(taxCodeId);
                if (rate === undefined) return;

                totalVat += itemNet * (rate / 100);
            }
        });

        return totalNet + totalVat;
    };

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice => {
            const customer = customerMap.get(invoice.customerId);
            const vehicleReg = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : '';
            const lowerFilter = filter.toLowerCase();

            const matchesDate = (!startDate || invoice.issueDate >= startDate) && (!endDate || invoice.issueDate <= endDate);
            if (!matchesDate) return false;

            const matchesSearch = filter === '' ||
                invoice.id.toLowerCase().includes(lowerFilter) ||
                customer?.toLowerCase().includes(lowerFilter) ||
                (vehicleReg && vehicleReg.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')));
            
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(invoice.status);

            return matchesSearch && matchesStatus;
        }).sort((a,b) => b.issueDate.localeCompare(a.issueDate) || b.id.localeCompare(a.id));
    }, [invoices, filter, statusFilter, customerMap, vehicleMap, startDate, endDate]);

    const handleStatusToggle = (status: Invoice['status']) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    
    const invoiceStatusOptions: readonly Invoice['status'][] = ['Draft', 'Sent', 'Paid', 'Overdue'];

    return (
        <div className="w-full p-4 h-full flex flex-col">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={() => onOpenExportModal('invoices', filteredInvoices)} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Download size={16}/> Export for Accounts
                    </button>
                    <button onClick={onCreateAdhocInvoice} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> Create Ad-hoc Invoice
                    </button>
                </div>
            </header>

            <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="flex gap-4 items-center">
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                            type="text"
                            placeholder="Search by invoice number, customer, or vehicle..."
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
                    statuses={invoiceStatusOptions}
                    selectedStatuses={statusFilter}
                    onToggle={handleStatusToggle}
                />
            </div>
            
            <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">Number</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Customer</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Vehicle</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Total (Gross)</th>
                                <th className="p-3 text-left font-semibold text-gray-600"></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                            {filteredInvoices.map(invoice => (
                                <tr key={invoice.id} className="hover:bg-indigo-50">
                                    <td className="p-3 font-mono">{invoice.id}</td>
                                    <td className="p-3">{customerMap.get(invoice.customerId)}</td>
                                    <td className="p-3 font-mono">{invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : 'N/A'}</td>
                                    <td className="p-3">{invoice.issueDate}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                                            invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100'}`}>{invoice.status}</span>
                                    </td>
                                    <td className="p-3 text-right font-semibold">
                                        {formatCurrency(calculateGrossTotal(invoice.lineItems))}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => onViewInvoice(invoice)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View"><Eye size={16} /></button>
                                            <button onClick={() => onEditInvoice(invoice)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
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

export default InvoicesView;

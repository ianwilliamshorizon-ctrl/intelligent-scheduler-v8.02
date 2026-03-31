
import React, { useState, useMemo } from 'react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { Invoice, Customer, Vehicle, EstimateLineItem } from '../../types';
import { Eye, Search, Download, PlusCircle, Edit, CalendarDays } from 'lucide-react';
import { formatCurrency } from '../../core/utils/formatUtils';
import { formatDate, getRelativeDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { StatusFilter } from '../../components/shared/StatusFilter';

interface InvoicesViewProps {
    onViewInvoice: (invoice: Invoice) => void;
    onEditInvoice: (invoice: Invoice) => void;
    onOpenExportModal: (type: 'invoices', items: any[]) => void;
    onCreateAdhocInvoice: () => void;
}

const dateFilterOptions = {
    'today': 'Today',
    'this_month': 'This Month',
    'last_month': 'Last Month',
    'all': 'All Time',
};

type DateFilterOption = keyof typeof dateFilterOptions;

const InvoicesView: React.FC<InvoicesViewProps> = ({ onViewInvoice, onEditInvoice, onOpenExportModal, onCreateAdhocInvoice }) => {
    const { invoices, customers, vehicles, businessEntities, taxRates } = useData();
    const { selectedEntityId } = useApp();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Invoice['status'][]>([]);
    const [dateFilter, setDateFilter] = useState<DateFilterOption>('this_month');
    
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRate = useMemo(() => taxRates.find(t => t.code === 'T1')?.rate || 0, [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    const calculateGrossTotal = (lineItems: EstimateLineItem[]) => {
        return (lineItems || []).reduce((sum, item) => {
            if (item.isPackageComponent) return sum;
            const net = (item.quantity || 0) * (item.unitPrice || 0);
            const rate = taxRatesMap.get(item.taxCodeId || standardTaxRateId) ?? standardTaxRate;
            const vat = net * (rate / 100);
            return sum + net + vat;
        }, 0);
    };

    const filteredInvoices = useMemo(() => {
        let startDate: string | null = null;
        let endDate: string | null = null;
        const today = new Date();

        switch (dateFilter) {
            case 'today':
                startDate = getRelativeDate(0);
                endDate = getRelativeDate(0);
                break;
            case 'this_month':
                startDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
                endDate = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
                break;
            case 'last_month':
                startDate = formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
                endDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 0));
                break;
        }

        return invoices.filter(invoice => {
            if (selectedEntityId !== 'all' && invoice.entityId !== selectedEntityId) {
                return false;
            }

            const customer = customerMap.get(invoice.customerId);
            const vehicle = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : null;
            const lowerFilter = filter.toLowerCase();

            const matchesDate = (!startDate || invoice.issueDate >= startDate) && (!endDate || invoice.issueDate <= endDate);
            if (!matchesDate) return false;

            const matchesSearch = filter === '' ||
                invoice.id.toLowerCase().includes(lowerFilter) ||
                (customer && getCustomerDisplayName(customer).toLowerCase().includes(lowerFilter)) ||
                (vehicle && (
                    vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')) ||
                    (vehicle.previousRegistrations || []).some(pr => pr.registration.toLowerCase().replace(/\s/g, '').includes(lowerFilter.replace(/\s/g, '')))
                ));
            
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(invoice.status);

            return matchesSearch && matchesStatus;
        }).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.id || '').localeCompare(a.id || ''));
    }, [invoices, filter, statusFilter, customerMap, vehicleMap, selectedEntityId, businessEntities, dateFilter]);

    const handleStatusToggle = (status: Invoice['status']) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    
    const invoiceStatusOptions: readonly Invoice['status'][] = ['Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue', 'Archived', 'Archived Not Paid'];

    return (
        <div className="w-full p-4 h-full flex flex-col">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Invoices <span className="text-gray-500 font-medium text-lg">({dateFilterOptions[dateFilter]})</span></h2>
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
                   <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700"><CalendarDays size={16} className="inline-block mr-1"/>Date Range:</span>
                        <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                            {Object.keys(dateFilterOptions).map((key) => (
                                <button 
                                    key={key}
                                    onClick={() => setDateFilter(key as DateFilterOption)}
                                    className={`py-1 px-3 rounded-md font-semibold text-xs transition ${dateFilter === key ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
                                    {dateFilterOptions[key as DateFilterOption]}
                                </button>
                            ))}
                        </div>
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
                            {filteredInvoices.map(invoice => {
                                const customer = customerMap.get(invoice.customerId);
                                const vehicle = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : null;
                                return (
                                <tr key={invoice.id} className="hover:bg-indigo-50">
                                    <td className="p-3 font-mono">{invoice.id}</td>
                                    <td className="p-3">{getCustomerDisplayName(customer)}</td>
                                    <td className="p-3 font-mono">{invoice.vehicleId ? vehicle?.registration : 'N/A'}</td>
                                    <td className="p-3">{invoice.issueDate}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                                            invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' : 
                                            invoice.status === 'Part Paid' ? 'bg-amber-100 text-amber-800' : 
                                            invoice.status === 'Sent' ? 'bg-blue-100 text-blue-800' : 
                                            invoice.status === 'Archived' ? 'bg-slate-300 text-slate-800' :
                                            invoice.status === 'Archived Not Paid' ? 'bg-slate-200 text-slate-700 font-bold' :
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
                            )})}
                         </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default InvoicesView;

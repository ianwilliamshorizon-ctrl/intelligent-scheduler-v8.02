
import React, { useState, useMemo } from 'react';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';
import { Invoice, Customer, Vehicle, EstimateLineItem, TaxRate } from '../../types';
import { Eye, Search, Download, PlusCircle, Edit, Printer } from 'lucide-react';
import { formatCurrency } from '../../core/utils/formatUtils';
import { formatDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import PrintableInvoiceList from '../../components/PrintableInvoiceList';
import { usePrint } from '../../core/hooks/usePrint';
import { StatusFilter } from '../../components/shared/StatusFilter';
import PrintableInvoice from '../../components/PrintableInvoice';

interface InvoicesViewProps {
    onViewInvoice: (invoice: Invoice) => void;
    onEditInvoice: (invoice: Invoice) => void;
    onOpenExportModal: (type: 'invoices', items: any[]) => void;
    onCreateAdhocInvoice: () => void;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ onViewInvoice, onEditInvoice, onOpenExportModal, onCreateAdhocInvoice }) => {
    const { invoices, customers, vehicles, businessEntities, taxRates } = useData();
    const { selectedEntityId } = useApp();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<Invoice['status'][]>([]);
    
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), 0, 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));
    
    const print = usePrint();

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRate = useMemo(() => taxRates.find(t => t.code === 'T1')?.rate || 0, [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    const entityMap = useMemo(() => new Map(businessEntities.map(e => [e.id, e])), [businessEntities]);

    const calculateGrossTotal = (lineItems: EstimateLineItem[]) => {
        return (lineItems || []).reduce((sum, item) => {
            if (item.isPackageComponent) return sum;
            const net = (item.quantity || 0) * (item.unitPrice || 0);
            const rate = taxRatesMap.get(item.taxCodeId || standardTaxRateId) || standardTaxRate;
            const vat = net * (rate / 100);
            return sum + net + vat;
        }, 0);
    };

    const filteredInvoices = useMemo(() => {
        const selectedEntity = businessEntities.find(e => e.id === selectedEntityId);

        return invoices.filter(invoice => {
            if (selectedEntityId !== 'all' && selectedEntity?.shortCode) {
                if (!invoice.id.startsWith(selectedEntity.shortCode)) return false;
            } else if (selectedEntityId !== 'all') {
                if (invoice.entityId !== selectedEntityId) return false;
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
    }, [invoices, filter, statusFilter, customerMap, vehicleMap, selectedEntityId, businessEntities, startDate, endDate]);

    const handleStatusToggle = (status: Invoice['status']) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    
    const handlePrintList = () => {
        print(
            <PrintableInvoiceList 
                invoices={filteredInvoices} 
                customers={customerMap} 
                vehicles={vehicleMap}
                taxRates={taxRates}
                title={`Invoices (${startDate} to ${endDate})`}
            />
        );
    };

    const handleReprint = (invoice: Invoice) => {
        const customer = customerMap.get(invoice.customerId);
        const vehicle = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : undefined;
        const entity = entityMap.get(invoice.entityId);
        print(<PrintableInvoice invoice={invoice} customer={customer} vehicle={vehicle} entity={entity} taxRates={taxRates} />);
    };
    
    const invoiceStatusOptions: readonly Invoice['status'][] = ['Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue'];

    return (
        <div className="w-full p-4 h-full flex flex-col">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={handlePrintList} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print List
                    </button>
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
                                            'bg-gray-100'}`}>{invoice.status}</span>
                                    </td>
                                    <td className="p-3 text-right font-semibold">
                                        {formatCurrency(calculateGrossTotal(invoice.lineItems))}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => onViewInvoice(invoice)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View"><Eye size={16} /></button>
                                            <button onClick={() => onEditInvoice(invoice)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
                                            <button onClick={() => handleReprint(invoice)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="Reprint"><Printer size={16} /></button>
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

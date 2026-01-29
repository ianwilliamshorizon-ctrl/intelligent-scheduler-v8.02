import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Purchase, NominalCode, NominalCodeRule, Customer, TaxRate, Vehicle } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { assignNominalCode } from '../services/nominalCodeService';
import { formatDate } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';

interface ProcessedItem {
  id: string;
  sourceId: string; // Invoice or Purchase ID
  sourceDate: string;
  customerName: string;
  vehicleRegistration: string;
  description: string;
  net: number;
  vat: number;
  gross: number;
  assignedCodeId: string | null;
  originalItem: Invoice['lineItems'][0] | Purchase;
  entityId: string;
}

interface NominalCodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'invoices' | 'purchases';
  items: (Invoice | Purchase)[];
  nominalCodes: NominalCode[];
  nominalCodeRules: NominalCodeRule[];
  customers: Customer[];
  vehicles: Vehicle[];
  taxRates: TaxRate[];
}

const NominalCodeExportModal: React.FC<NominalCodeExportModalProps> = ({
  isOpen,
  onClose,
  type,
  items,
  nominalCodes,
  nominalCodeRules,
  customers,
  vehicles,
  taxRates
}) => {
    const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, `${c.forename} ${c.surname}`])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const nominalCodeMap = useMemo(() => new Map(nominalCodes.map(nc => [nc.id, nc])), [nominalCodes]);

    useEffect(() => {
        if (!isOpen) return;

        let allProcessedItems: ProcessedItem[] = [];

        if (type === 'invoices') {
            const invoices = items as Invoice[];
            invoices.forEach(invoice => {
                const vehicleReg = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) || '' : '';
                invoice.lineItems.forEach(lineItem => {
                    const assignedCodeId = assignNominalCode(lineItem, invoice.entityId, nominalCodeRules);
                    const net = lineItem.quantity * lineItem.unitPrice;
                    const taxRate = taxRatesMap.get(lineItem.taxCodeId || '');
                    const vat = taxRate ? net * (taxRate.rate / 100) : 0;
                    allProcessedItems.push({
                        id: `${invoice.id}-${lineItem.id}`,
                        sourceId: invoice.id,
                        sourceDate: invoice.issueDate,
                        customerName: customerMap.get(invoice.customerId) || 'Unknown',
                        vehicleRegistration: vehicleReg,
                        description: lineItem.description,
                        net,
                        vat,
                        gross: net + vat,
                        assignedCodeId,
                        originalItem: lineItem,
                        entityId: invoice.entityId,
                    });
                });
            });
        } else { // Purchases
            const purchases = items as Purchase[];
            purchases.forEach(purchase => {
                const assignedCodeId = assignNominalCode(purchase, purchase.entityId, nominalCodeRules);
                const net = purchase.purchasePrice;
                const taxRate = taxRatesMap.get(purchase.taxCodeId || '');
                const vat = taxRate ? net * (taxRate.rate / 100) : 0;
                allProcessedItems.push({
                    id: purchase.id,
                    sourceId: purchase.id,
                    sourceDate: purchase.purchaseDate,
                    customerName: 'N/A',
                    vehicleRegistration: '', // Purchases don't have a direct vehicle link in this context
                    description: purchase.name,
                    net,
                    vat,
                    gross: net + vat,
                    assignedCodeId,
                    originalItem: purchase,
                    entityId: purchase.entityId,
                });
            });
        }

        setProcessedItems(allProcessedItems);
    }, [isOpen, type, items, nominalCodeRules, customerMap, vehicleMap, taxRatesMap]);

    const filteredItems = useMemo(() => {
        return processedItems.filter(item => item.sourceDate >= startDate && item.sourceDate <= endDate);
    }, [processedItems, startDate, endDate]);

    const handleCodeOverride = (itemId: string, newCodeId: string | null) => {
        setProcessedItems(prev => prev.map(item => item.id === itemId ? { ...item, assignedCodeId: newCodeId } : item));
    };
    
    const downloadCSV = () => {
        const headers = ["ID", "Date", "Customer", "Vehicle Registration", "Description", "Net", "VAT", "Gross", "Nominal Code", "Nominal Name"];
        const rows = filteredItems.map(item => {
            const nominalCode = item.assignedCodeId ? nominalCodeMap.get(item.assignedCodeId) : null;
            return [
                item.sourceId,
                item.sourceDate,
                item.customerName.replace(/,/g, ''),
                item.vehicleRegistration,
                item.description.replace(/,/g, ''),
                item.net.toFixed(2),
                item.vat.toFixed(2),
                item.gross.toFixed(2),
                nominalCode?.code || '',
                nominalCode?.name || ''
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${type}_export_${formatDate(new Date())}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700 capitalize">Export {type} for Accounts</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>

                <div className="flex-shrink-0 p-4 bg-gray-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-4">
                         <label className="text-sm font-medium">Date Range:</label>
                         <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg" />
                         <span>to</span>
                         <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg" />
                    </div>
                     <button onClick={downloadCSV} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                        <Download size={16} className="mr-2"/> Download CSV
                    </button>
                </div>

                <main className="flex-grow overflow-y-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2 text-left font-semibold text-gray-600">ID</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Reg</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Description</th>
                                <th className="p-2 text-right font-semibold text-gray-600">Net</th>
                                <th className="p-2 text-right font-semibold text-gray-600">VAT</th>
                                <th className="p-2 text-right font-semibold text-gray-600">Gross</th>
                                <th className="p-2 text-left font-semibold text-gray-600 w-64">Nominal Code</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-indigo-50">
                                    <td className="p-2 font-mono">{item.sourceId}</td>
                                    <td className="p-2">{item.sourceDate}</td>
                                    <td className="p-2 font-mono">{item.vehicleRegistration}</td>
                                    <td className="p-2">{item.description}</td>
                                    <td className="p-2 text-right">{formatCurrency(item.net)}</td>
                                    <td className="p-2 text-right">{formatCurrency(item.vat)}</td>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(item.gross)}</td>
                                    <td className="p-2">
                                        <select
                                            value={item.assignedCodeId || ''}
                                            onChange={e => handleCodeOverride(item.id, e.target.value || null)}
                                            className={`w-full p-1.5 border rounded-lg text-xs ${!item.assignedCodeId ? 'border-red-500' : ''}`}
                                        >
                                            <option value="">-- Unassigned --</option>
                                            {nominalCodes.map(nc => (
                                                <option key={nc.id} value={nc.id}>{nc.code} - {nc.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>
            </div>
        </div>
    );
};

export default NominalCodeExportModal;

import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, PurchaseOrder, NominalCode, NominalCodeRule, Customer, TaxRate, Vehicle, Supplier } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { assignNominalCode } from '../services/nominalCodeService';
import { formatDate } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';

interface ProcessedItem {
  id: string;
  sourceId: string; // Invoice or PO ID
  sourceDate: string;
  customerName: string;
  supplierName?: string;
  vehicleRegistration: string;
  supplierReference: string;
  description: string;
  net: number;
  vat: number;
  gross: number;
  assignedCodeId: string | null;
  originalItem: Invoice['lineItems'][0] | PurchaseOrder['lineItems'][0] | PurchaseOrder;
  entityId: string;
}

interface NominalCodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'invoices' | 'purchases';
  items: (Invoice | PurchaseOrder)[];
  nominalCodes: NominalCode[];
  nominalCodeRules: NominalCodeRule[];
  customers: Customer[];
  vehicles: Vehicle[];
  taxRates: TaxRate[];
  suppliers: Supplier[];
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
  taxRates,
  suppliers
}) => {
    const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));
    const [rollup, setRollup] = useState(false);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, `${c.forename} ${c.surname}`])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const nominalCodeMap = useMemo(() => new Map(nominalCodes.map(nc => [nc.id, nc])), [nominalCodes]);

    useEffect(() => {
        if (!isOpen) return;

        let allProcessedItems: ProcessedItem[] = [];

        if (type === 'invoices') {
            const invoices = items as Invoice[];
            invoices.forEach(invoice => {
                const vehicleReg = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) || '' : '';
                invoice.lineItems.forEach(lineItem => {
                    const supplierName = lineItem.supplierId ? supplierMap.get(lineItem.supplierId) : '';
                    const assignedCodeId = assignNominalCode(lineItem, invoice.entityId || '', nominalCodeRules, supplierName);
                    const net = (lineItem.quantity || 0) * (lineItem.unitPrice || 0);
                    const taxRate = taxRatesMap.get(lineItem.taxCodeId || '');
                    const vat = taxRate ? net * (taxRate.rate / 100) : 0;
                    allProcessedItems.push({
                        id: `${invoice.id}-${lineItem.id}`,
                        sourceId: invoice.id,
                        sourceDate: invoice.issueDate,
                        customerName: customerMap.get(invoice.customerId) || 'Unknown',
                        vehicleRegistration: vehicleReg,
                        supplierReference: '', // Not applicable for invoices
                        description: lineItem.description,
                        net,
                        vat,
                        gross: net + vat,
                        assignedCodeId,
                        originalItem: lineItem,
                        entityId: invoice.entityId || '',
                    });
                });
            });
        } else { // Purchases (PurchaseOrders)
            const pos = items as PurchaseOrder[];
            pos.forEach(po => {
                const supplierName = po.supplierId ? supplierMap.get(po.supplierId) : '';
                const baseDate = po.orderDate || '';
                
                if (rollup) {
                    // Summarize the whole PO as one line
                    const lineItems = po.lineItems || [];
                    const net = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                    // Use the first line item's tax code or a default if not found
                    const firstTaxCodeId = lineItems[0]?.taxCodeId || po.lineItems?.[0]?.taxCodeId || '';
                    const taxRate = taxRatesMap.get(firstTaxCodeId);
                    const vat = taxRate ? net * (taxRate.rate / 100) : 0;
                    
                    // Assign nominal code based on PO description or first item
                    const assignedCodeId = assignNominalCode(lineItems[0] || po as any, po.entityId || '', nominalCodeRules, supplierName);

                    allProcessedItems.push({
                        id: po.id,
                        sourceId: po.id,
                        sourceDate: baseDate,
                        customerName: 'N/A',
                        supplierName: supplierName || 'N/A',
                        vehicleRegistration: po.vehicleRegistrationRef || '',
                        supplierReference: po.supplierReference || '',
                        description: `Purchase Order ${po.id}`,
                        net,
                        vat,
                        gross: net + vat,
                        assignedCodeId,
                        originalItem: po,
                        entityId: po.entityId || '',
                    });
                } else if (po.lineItems && po.lineItems.length > 0) {
                    po.lineItems.forEach(lineItem => {
                        const assignedCodeId = assignNominalCode(lineItem, po.entityId || '', nominalCodeRules, supplierName);
                        const net = (lineItem.quantity || 0) * (lineItem.unitPrice || 0);
                        const taxRate = taxRatesMap.get(lineItem.taxCodeId || '');
                        const vat = taxRate ? net * (taxRate.rate / 100) : 0;
                        allProcessedItems.push({
                            id: `${po.id}-${lineItem.id}`,
                            sourceId: po.id,
                            sourceDate: baseDate,
                            customerName: 'N/A',
                            supplierName: supplierName || 'N/A',
                            vehicleRegistration: po.vehicleRegistrationRef || '',
                            supplierReference: po.supplierReference || '',
                            description: lineItem.description,
                            net,
                            vat,
                            gross: net + vat,
                            assignedCodeId,
                            originalItem: lineItem,
                            entityId: po.entityId || '',
                        });
                    });
                } else {
                    // Fallback for POs without line items (though rare in PO workflow)
                    const assignedCodeId = assignNominalCode(po as any, po.entityId || '', nominalCodeRules, supplierName);
                    allProcessedItems.push({
                        id: po.id,
                        sourceId: po.id,
                        sourceDate: baseDate,
                        customerName: 'N/A',
                        supplierName: supplierName || 'N/A',
                        vehicleRegistration: po.vehicleRegistrationRef || '',
                        supplierReference: po.supplierReference || '',
                        description: `PO ${po.id}`,
                        net: 0,
                        vat: 0,
                        gross: 0,
                        assignedCodeId,
                        originalItem: po,
                        entityId: po.entityId || '',
                    });
                }
            });
        }

        setProcessedItems(allProcessedItems);
    }, [isOpen, type, items, nominalCodeRules, customerMap, vehicleMap, taxRatesMap, supplierMap, rollup]);

    const filteredItems = useMemo(() => {
        return processedItems.filter(item => item.sourceDate >= startDate && item.sourceDate <= endDate);
    }, [processedItems, startDate, endDate]);

    const handleCodeOverride = (itemId: string, newCodeId: string | null) => {
        setProcessedItems(prev => prev.map(item => item.id === itemId ? { ...item, assignedCodeId: newCodeId } : item));
    };
    
    const downloadCSV = () => {
        // --- FILE 1: XERO IMPORT DETAIL ---
        // Official Xero headers for Invoices and Bills
        const detailHeaders = [
            "ContactName", "EmailAddress", "POAddressLine1", "POAddressLine2", "POAddressLine3", "POAddressLine4", 
            "POCity", "PORegion", "POPostalCode", "POCountry", "InvoiceNumber", "Reference", 
            "InvoiceDate", "DueDate", "InventoryItemCode", "Description", "Quantity", 
            "UnitAmount", "Discount", "AccountCode", "TaxType", "TaxAmount", 
            "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2", "Currency"
        ];
        
        const detailRows = filteredItems.map(item => {
            const nominalCode = item.assignedCodeId ? nominalCodeMap.get(item.assignedCodeId) : null;
            const xeroAccountCode = nominalCode?.secondaryCode || nominalCode?.code || ''; // Prefer secondaryCode for Xero mapping
            
            // Map our tax rates to Xero tax types if possible, otherwise use original code/rate
            const taxRate = taxRates.find(t => {
                const itemTaxId = (item.originalItem as any).taxCodeId;
                return t.id === itemTaxId;
            });
            const xeroTaxType = taxRate ? taxRate.name : '20% (VAT on Income)'; // Fallback

            return [
                `"${item.customerName.replace(/"/g, '""')}"`, // ContactName
                "", // EmailAddress
                "", "", "", "", "", "", "", "", // POAddress fields
                item.sourceId, // InvoiceNumber
                item.supplierReference || item.vehicleRegistration, // Reference
                item.sourceDate, // InvoiceDate
                item.sourceDate, // DueDate (Simplified)
                "", // InventoryItemCode
                `"${item.description.replace(/"/g, '""')}"`, // Description
                "1", // Quantity
                item.net.toFixed(2), // UnitAmount
                "0", // Discount
                xeroAccountCode, // AccountCode
                xeroTaxType, // TaxType
                item.vat.toFixed(2), // TaxAmount
                "Entity", // TrackingName1
                item.entityId, // TrackingOption1
                "", "", // Tracking 2
                "GBP" // Currency
            ].join(',');
        });

        const detailCsvContent = "data:text/csv;charset=utf-8," + [detailHeaders.join(','), ...detailRows].join('\n');
        const detailLink = document.createElement("a");
        detailLink.setAttribute("href", encodeURI(detailCsvContent));
        detailLink.setAttribute("download", `Xero_Import_${type}_${formatDate(new Date())}.csv`);
        document.body.appendChild(detailLink);
        detailLink.click();
        document.body.removeChild(detailLink);

        // --- FILE 2: NOMINAL SUMMARY ---
        const summaryMap = new Map<string, { code: string, name: string, net: number, vat: number, gross: number }>();
        filteredItems.forEach(item => {
            const nominalCode = item.assignedCodeId ? nominalCodeMap.get(item.assignedCodeId) : null;
            const codeKey = nominalCode?.code || 'UNASSIGNED';
            const existing = summaryMap.get(codeKey) || { code: codeKey, name: nominalCode?.name || 'Unassigned', net: 0, vat: 0, gross: 0 };
            summaryMap.set(codeKey, {
                ...existing,
                net: existing.net + item.net,
                vat: existing.vat + item.vat,
                gross: existing.gross + item.gross
            });
        });

        const summaryHeaders = ["Nominal Code", "Nominal Name", "Total Net", "Total VAT", "Total Gross"];
        const summaryRows = Array.from(summaryMap.values()).map(s => [
            s.code,
            `"${s.name.replace(/"/g, '""')}"`,
            s.net.toFixed(2),
            s.vat.toFixed(2),
            s.gross.toFixed(2)
        ].join(','));

        const summaryCsvContent = "data:text/csv;charset=utf-8," + [summaryHeaders.join(','), ...summaryRows].join('\n');
        const summaryLink = document.createElement("a");
        summaryLink.setAttribute("href", encodeURI(summaryCsvContent));
        summaryLink.setAttribute("download", `Nominal_Summary_${type}_${formatDate(new Date())}.csv`);
        
        // Small delay to ensure both downloads trigger in most browsers
        setTimeout(() => {
            document.body.appendChild(summaryLink);
            summaryLink.click();
            document.body.removeChild(summaryLink);
        }, 300);
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
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium">Date Range:</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg shadow-sm" />
                            <span>to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg shadow-sm" />
                        </div>
                        {type === 'purchases' && (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="rollupToggle" 
                                    checked={rollup} 
                                    onChange={e => setRollup(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="rollupToggle" className="text-sm font-medium text-gray-700">Rollup by PO (Sum of items)</label>
                            </div>
                        )}
                    </div>
                     <button onClick={downloadCSV} className="flex items-center py-2 px-6 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors">
                        <Download size={18} className="mr-2"/> Download CSV for Xero
                    </button>
                </div>

                <main className="flex-grow overflow-y-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2 text-left font-semibold text-gray-600">ID</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Supplier</th>
                                <th className="p-2 text-left font-semibold text-gray-600">Reference</th>
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
                                    <td className="p-2">{type === 'purchases' ? (item.supplierName || 'N/A') : item.customerName}</td>
                                    <td className="p-2 font-mono">{type === 'purchases' ? (item.supplierReference || item.vehicleRegistration || '-') : item.vehicleRegistration}</td>
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

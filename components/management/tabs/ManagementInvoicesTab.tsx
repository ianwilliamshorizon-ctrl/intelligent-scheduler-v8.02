import React, { useMemo, useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Invoice } from '../../../types';
import { Upload, RefreshCw, Eye, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { parseAndPrepareInvoiceImport } from '../../../utils/invoiceImportUtils';
import { getCustomerDisplayName } from '../../../core/utils/customerUtils';
import { formatCurrency } from '../../../utils/formatUtils';

interface ManagementInvoicesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
    onViewInvoice?: (invoice: Invoice) => void;
}

const STATUS_BADGES: Record<string, string> = {
    Paid: 'bg-green-100 text-green-800',
    'Part Paid': 'bg-amber-100 text-amber-800',
    Overdue: 'bg-red-100 text-red-800',
    Sent: 'bg-blue-100 text-blue-800',
    Draft: 'bg-gray-100 text-gray-700',
    Archived: 'bg-slate-100 text-slate-600',
    'Archived Not Paid': 'bg-rose-100 text-rose-700',
};

export const ManagementInvoicesTab: React.FC<ManagementInvoicesTabProps> = ({
    searchTerm,
    onShowStatus,
    onViewInvoice,
}) => {
    const { invoices, customers, vehicles, forceRefresh } = useData();
    const [isImporting, setIsImporting] = useState(false);

    const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

    const filteredInvoices = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const sorted = [...invoices].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
        if (!q) return sorted;
        return sorted.filter((inv) => {
            const cust = customerMap.get(inv.customerId);
            const veh = vehicleMap.get(inv.vehicleId);
            const custText = cust ? getCustomerDisplayName(cust).toLowerCase() : inv.customerId.toLowerCase();
            const vehText = veh ? `${veh.registration} ${veh.make} ${veh.model}`.toLowerCase() : inv.vehicleId.toLowerCase();
            return (
                inv.id.toLowerCase().includes(q) ||
                inv.status.toLowerCase().includes(q) ||
                custText.includes(q) ||
                vehText.includes(q) ||
                (inv.notes || '').toLowerCase().includes(q)
            );
        });
    }, [invoices, searchTerm, customerMap, vehicleMap]);

    const handleImportInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        onShowStatus('Processing batch invoice import...', 'info');
        try {
            const result = await parseAndPrepareInvoiceImport(file, invoices, customers, vehicles);
            if (!result.valid) {
                const errMsg = result.error || 'Invalid invoice import file.';
                toast.error(errMsg);
                onShowStatus(errMsg, 'error');
                return;
            }

            const batchLimit = 400;
            let currentBatch = writeBatch(db);
            let batchCount = 0;

            for (const inv of result.invoices) {
                currentBatch.set(doc(collection(db, 'brooks_invoices'), inv.id), inv);
                batchCount++;
                if (batchCount >= batchLimit) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    batchCount = 0;
                }
            }
            if (batchCount > 0) await currentBatch.commit();

            const details: string[] = [];
            if (result.duplicateCount > 0) details.push(`${result.duplicateCount} duplicate(s) skipped`);
            if (result.rejectedCount > 0) details.push(`${result.rejectedCount} invalid row(s) skipped`);
            if (result.unmatchedLinksCount > 0) details.push(`${result.unmatchedLinksCount} unmatched Customer/Vehicle fallback(s)`);
            const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';

            if (result.invoices.length > 0) {
                await forceRefresh('brooks_invoices');
                onShowStatus(`Imported ${result.invoices.length} invoice(s).${suffix}`, 'success');
            } else {
                onShowStatus(
                    details.length > 0 ? `No new invoices imported.${suffix}` : 'No new invoices found.',
                    'info'
                );
            }
        } catch (err) {
            console.error('Invoice import failed:', err);
            toast.error('Invoice import failed. Check console for details.');
            onShowStatus('Invoice import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={20} className="text-indigo-600" />
                        Invoices ({filteredInvoices.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                        Safely import transformed JSON/CSV from <code className="bg-gray-100 px-1 rounded">import-tools/</code> or raw legacy Invoice CSVs. Duplicates are automatically skipped.
                    </p>
                </div>

                <label
                    className={`cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 text-sm font-semibold transition-all ${
                        isImporting ? 'opacity-60 pointer-events-none' : 'active:scale-95'
                    }`}
                    title="Import Invoices from .csv or .json (safely merges and skips duplicates)"
                >
                    {isImporting ? <RefreshCw size={17} className="animate-spin" /> : <Upload size={17} />}
                    {isImporting ? 'Importing...' : 'Import Invoices (CSV / JSON)'}
                    <input
                        type="file"
                        accept=".csv,.json"
                        onChange={handleImportInvoices}
                        className="hidden"
                        disabled={isImporting}
                    />
                </label>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="max-h-[58vh] overflow-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0 border-b">
                            <tr>
                                <th className="px-4 py-3">Invoice #</th>
                                <th className="px-4 py-3">Issue Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Vehicle</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3">Details</th>
                                <th className="px-4 py-3 text-right">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                                        No invoices found.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.slice(0, 300).map((inv) => {
                                    const cust = customerMap.get(inv.customerId);
                                    const veh = vehicleMap.get(inv.vehicleId);
                                    const total = inv.grandTotal ?? inv.totalAmount ?? 0;
                                    return (
                                        <tr key={inv.id} className="hover:bg-indigo-50/40">
                                            <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{inv.id}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{inv.issueDate}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[inv.status] || 'bg-gray-100 text-gray-700'}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-700">
                                                {cust ? getCustomerDisplayName(cust) : <span className="font-mono text-xs text-amber-700">{inv.customerId}</span>}
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                                                {veh ? veh.registration : <span className="text-amber-700">{inv.vehicleId}</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                                {formatCurrency(total)}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[260px] truncate" title={inv.notes || ''}>
                                                {inv.notes || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {onViewInvoice && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewInvoice(inv)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                        title="View Invoice"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

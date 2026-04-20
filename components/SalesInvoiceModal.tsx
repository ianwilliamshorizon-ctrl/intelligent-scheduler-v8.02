import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, Invoice, TaxRate } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

interface SalesInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    invoice?: Invoice;
    vehicle?: Vehicle;
    buyer?: Customer;
    entity?: BusinessEntity;
    taxRates: TaxRate[];
    onUpdateInvoice: (invoice: Invoice) => void;
}

const PrintableSalesInvoice: React.FC<any> = ({ invoice, vehicle, buyer, entity, taxRates, totals }) => {
    return (
        <PrintableDocumentLayout 
            entity={entity} 
            title="SALES INVOICE" 
            subtitle={`Invoice: #${invoice?.id}`}
        >
            <div className="space-y-8 py-4">
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded border">
                        <h3 className="text-xs font-black text-gray-500 uppercase mb-2">Invoice To</h3>
                        <p className="font-bold text-lg">{buyer?.forename} {buyer?.surname}</p>
                        {buyer?.companyName && <p className="font-semibold text-gray-700">{buyer.companyName}</p>}
                        <p>{buyer?.addressLine1}</p>
                        <p>{buyer?.city}, {buyer?.postcode}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border">
                        <h3 className="text-xs font-black text-gray-500 uppercase mb-2">Vehicle Information</h3>
                        <p className="font-bold text-lg">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-gray-700">Reg: {vehicle?.registration}</p>
                        <p className="text-xs mt-1 italic text-gray-500">VIN: {vehicle?.vin || 'N/A'}</p>
                    </div>
                </section>

                <section>
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-2 border-y bg-gray-50">
                        <div className="col-span-7">Description</div>
                        <div className="col-span-1 text-right">Qty</div>
                        <div className="col-span-2 text-right">Unit Price</div>
                        <div className="col-span-2 text-right">Total</div>
                    </div>
                    {(invoice?.lineItems || []).map((item: any) => {
                        const isDeposit = item.unitPrice < 0;
                        const net = item.quantity * item.unitPrice;
                        return (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 items-start px-2 py-3 border-b text-sm ${isDeposit ? 'font-bold text-red-600 bg-red-50' : 'text-gray-800'}`}>
                                <div className="col-span-7 font-semibold">{item.description}</div>
                                <div className="col-span-1 text-right">{item.quantity}</div>
                                <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
                                <div className="col-span-2 text-right">{formatCurrency(net)}</div>
                            </div>
                        );
                    })}
                </section>

                <section className="no-break flex justify-end">
                    <div className="w-80 space-y-2 text-sm bg-gray-50 p-4 rounded-lg border-2">
                        <div className="flex justify-between text-gray-600"><span>Subtotal (Net)</span><span className="font-bold">{formatCurrency(totals?.subtotal)}</span></div>
                        {totals?.vatBreakdown?.map((b: any) => (
                            <div key={b.name} className="flex justify-between text-gray-500 italic text-xs">
                                <span>VAT @ {b.rate}%</span>
                                <span>{formatCurrency(b.vat)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between font-black border-t pt-2 text-gray-900">
                            <span>Invoice Total</span>
                            <span>{formatCurrency(totals?.total)}</span>
                        </div>
                        {totals?.deposit > 0 && (
                            <div className="flex justify-between font-bold text-red-600 border-t border-dashed pt-1">
                                <span>Less: Deposit Paid</span>
                                <span>({formatCurrency(totals.deposit)})</span>
                            </div>
                        )}
                        <div className="flex justify-between font-black text-2xl mt-2 pt-2 border-t-2 border-indigo-600 text-indigo-700">
                            <span>Balance Due</span>
                            <span>{formatCurrency(totals?.grandTotal)}</span>
                        </div>
                    </div>
                </section>

                <section className="no-break pt-8">
                    <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <h4 className="text-xs font-black text-gray-800 uppercase mb-2">Payment Methods</h4>
                        {entity?.bankAccountName && (
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-gray-500">Bank Transfer (BACS):</p>
                                    <p className="font-bold">{entity.bankAccountName}</p>
                                </div>
                                <div className="grid grid-cols-2">
                                    <div><p className="text-gray-500">Sort Code:</p><p className="font-bold">{entity.bankSortCode}</p></div>
                                    <div><p className="text-gray-500">Account No:</p><p className="font-bold">{entity.bankAccountNumber}</p></div>
                                </div>
                            </div>
                        )}
                        <p className="mt-4 text-[10px] text-gray-400 italic font-medium uppercase tracking-tight">Please use Invoice #{invoice?.id} as payment reference.</p>
                    </div>
                </section>
            </div>
        </PrintableDocumentLayout>
    );
};

const SalesInvoiceModal: React.FC<SalesInvoiceModalProps> = ({ isOpen, onClose, saleVehicle, invoice, vehicle, buyer, entity, taxRates, onUpdateInvoice }) => {
    const [isPrinting, setIsPrinting] = useState(false);
    
    const totals = useMemo(() => {
        if (!invoice) return { subtotal: 0, total: 0, vat: 0, grandTotal: 0, deposit: 0, vatBreakdown: [] };

        const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));
        const vatBreakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        
        let subtotal = 0;
        let deposit = 0;

        (invoice.lineItems || []).forEach(item => {
            const itemNet = item.quantity * item.unitPrice;
            if (item.unitPrice < 0) {
                deposit += -itemNet;
            } else {
                subtotal += itemNet;

                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;
                const taxRate = taxRatesMap.get(taxCodeId) as TaxRate | undefined;
                if (!taxRate || taxRate.rate === 0) return;

                if (!vatBreakdown[taxCodeId]) {
                    vatBreakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }
                const itemVat = itemNet * (taxRate.rate / 100);
                vatBreakdown[taxCodeId].net += itemNet;
                vatBreakdown[taxCodeId].vat += itemVat;
            }
        });

        const finalVatBreakdown = Object.values(vatBreakdown);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        
        return {
            subtotal,
            total: subtotal + totalVat,
            deposit,
            grandTotal: subtotal + totalVat - deposit,
            vatBreakdown: finalVatBreakdown,
        };
    }, [invoice, taxRates]);

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableSalesInvoice {...{ invoice, vehicle, buyer, entity, taxRates, totals }} />
            </React.StrictMode>
        );

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                root.unmount();
                document.body.removeChild(printMountPoint);
                setIsPrinting(false);
            }, 500);
        }, 1000);
    };

    if (!isOpen || !invoice) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">Sales Invoice Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableSalesInvoice {...{ invoice, vehicle, buyer, entity, taxRates, totals }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">* Turn off headers/footers in browser print settings.</div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePrint} 
                            disabled={isPrinting}
                            className="flex items-center py-2 px-6 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isPrinting ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Printer size={16} className="mr-2" />}
                            Print Invoice
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SalesInvoiceModal;


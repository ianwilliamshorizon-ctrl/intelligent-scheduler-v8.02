import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, Invoice, TaxRate, EstimateLineItem } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

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
    const taxRatesMap = new Map(taxRates.map((t: TaxRate) => [t.id, t]));
    return (
        <div className="bg-white font-sans text-sm text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}</p>
                    <p>{entity?.city}, {entity?.postcode}</p>
                    {entity?.vatNumber && <p className="mt-1">VAT No: {entity.vatNumber}</p>}
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">INVOICE</h2>
                    <p>#{invoice?.id}</p>
                    <p className="mt-2">Date: {invoice?.issueDate}</p>
                    <p>Due: {invoice?.dueDate}</p>
                </div>
            </header>
            <main className="space-y-4 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Bill To</h3>
                        <p className="font-bold text-gray-800">{buyer?.forename} {buyer?.surname}</p>
                        <p>{buyer?.addressLine1}</p>
                        <p>{buyer?.city}, {buyer?.postcode}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                    </div>
                </section>
                <section className="mt-6">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1.5 py-1 border-y bg-gray-50">
                        <div className="col-span-7">Description</div>
                        <div className="col-span-1 text-right">Qty</div>
                        <div className="col-span-2 text-right">Unit Price (Net)</div>
                        <div className="col-span-2 text-right">Total (Net)</div>
                    </div>
                    {(invoice?.lineItems || []).map(item => {
                        const isDeposit = item.unitPrice < 0;
                        const net = item.quantity * item.unitPrice;
                        return (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 items-start p-1.5 border-b text-sm ${isDeposit ? 'font-bold' : ''}`}>
                                <div className="col-span-7">{item.description}</div>
                                <div className="col-span-1 text-right">{item.quantity}</div>
                                <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
                                <div className="col-span-2 text-right">{formatCurrency(net)}</div>
                            </div>
                        );
                    })}
                </section>
            </main>
            <footer className="mt-auto pt-4 border-t flex justify-between">
                <div>
                    {entity?.bankAccountName && (
                        <div className="text-xs text-gray-600">
                            <h4 className="font-semibold text-gray-800">Payment Details:</h4>
                            <p>Account Name: {entity.bankAccountName}</p>
                            <p>Sort Code: {entity.bankSortCode}</p>
                            <p>Account No: {entity.bankAccountNumber}</p>
                        </div>
                    )}
                </div>
                <div className="w-64 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatCurrency(totals?.subtotal)}</span></div>
                    {totals?.vatBreakdown?.map((b: any) => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                    <div className="flex justify-between font-semibold border-t mt-1 pt-1"><span>Total</span><span>{formatCurrency(totals?.total)}</span></div>
                    {totals?.deposit > 0 && <div className="flex justify-between font-semibold text-red-600"><span>Deposit Paid</span><span>({formatCurrency(totals.deposit)})</span></div>}
                    <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Balance Due</span><span>{formatCurrency(totals?.grandTotal)}</span></div>
                </div>
            </footer>
        </div>
    );
};

const SalesInvoiceModal: React.FC<SalesInvoiceModalProps> = ({ isOpen, onClose, saleVehicle, invoice, vehicle, buyer, entity, taxRates, onUpdateInvoice }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
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
                // FIX: Explicitly cast the result of Map.get to the expected type to resolve 'unknown' type errors.
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

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableSalesInvoice {...{ invoice, vehicle, buyer, entity, taxRates, totals }} />
            </React.StrictMode>
        );
        await new Promise(resolve => setTimeout(resolve, 800));
        try {
            const canvas = await html2canvas(printMountPoint, {
                scale: 2,
                useCORS: true,
                windowWidth: printMountPoint.scrollWidth,
                windowHeight: printMountPoint.scrollHeight,
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgHeight / imgWidth;
            const canvasHeightOnPdf = pdfWidth * ratio;

            let heightLeft = canvasHeightOnPdf;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
                heightLeft -= pdfHeight;
            }

            pdf.save(`SalesInvoice-${invoice?.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen || !invoice) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Sales Invoice</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableSalesInvoice {...{ invoice, vehicle, buyer, entity, taxRates, totals }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div></div>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SalesInvoiceModal;

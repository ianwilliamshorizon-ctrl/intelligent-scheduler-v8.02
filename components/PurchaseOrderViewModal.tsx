import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PurchaseOrder, Supplier, BusinessEntity, TaxRate } from '../types';
import { X, Mail, Download, Loader2, Edit, Printer, Phone, PackageCheck } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import EmailPurchaseOrderModal from './EmailPurchaseOrderModal';
import { usePrint } from '../core/hooks/usePrint';

const PrintablePurchaseOrder: React.FC<any> = ({ purchaseOrder, supplier, entity, taxRates, totals }) => {
    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', padding: '15mm', boxSizing: 'border-box' }}>
            <header className="pb-6 border-b mb-6">
                <div style={{ marginBottom: '5mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                        <p>{entity?.addressLine1}</p>
                        <p>{entity?.city}, {entity?.postcode}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-gray-800">PURCHASE ORDER</h2>
                        <p className="text-lg">#{purchaseOrder?.id}</p>
                        <p className="mt-1">Date: {purchaseOrder?.orderDate}</p>
                    </div>
                </div>
            </header>
            
            <main>
                <section style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Supplier</h3>
                        <p className="font-bold text-gray-900 text-base">{supplier?.name}</p>
                        {purchaseOrder.supplierReference && (
                            <p className="text-xs mt-1">Ref: <span className="font-mono">{purchaseOrder.supplierReference}</span></p>
                        )}
                        {supplier?.addressLine1 && <p>{supplier.addressLine1}</p>}
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Reference</h3>
                        <p className="font-bold text-gray-900 text-base">{purchaseOrder.vehicleRegistrationRef}</p>
                        {purchaseOrder.jobId && <p className="text-xs">Job ID: <span className="font-mono">{purchaseOrder.jobId}</span></p>}
                    </div>
                </section>

                <section>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ textAlign: 'left', padding: '8px', color: '#4b5563' }}>Part Number</th>
                                <th style={{ textAlign: 'left', padding: '8px', color: '#4b5563', width: '40%' }}>Description</th>
                                <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Qty</th>
                                <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Unit Cost</th>
                                <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(purchaseOrder?.lineItems || []).map((item: any) => {
                                const net = item.quantity * item.unitPrice;
                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>{item.partNumber || 'N/A'}</td>
                                        <td style={{ padding: '8px' }}>{item.description}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(net)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>
            </main>

            <footer style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '250px', fontSize: '14px' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                             <span>Net Total</span>
                             <span className="font-semibold">{formatCurrency(totals.totalNet)}</span>
                         </div>
                        {totals.vatBreakdown.map((b: any) => (
                            <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#4b5563' }}>
                                <span>VAT @ {b.rate}%</span>
                                <span>{formatCurrency(b.vat)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #d1d5db', marginTop: '8px', fontWeight: 'bold', fontSize: '16px' }}>
                            <span>Total</span>
                            <span>{formatCurrency(totals.grandTotal)}</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const PurchaseOrderViewModal: React.FC<{ isOpen: boolean; onClose: () => void; purchaseOrder: PurchaseOrder; supplier?: Supplier; entity?: BusinessEntity; taxRates: TaxRate[]; onSetStatusToOrdered: (po: PurchaseOrder) => void; onOpenForEditing?: (po: PurchaseOrder) => void; }> = ({ isOpen, onClose, purchaseOrder, supplier, entity, taxRates, onSetStatusToOrdered, onOpenForEditing }) => {
    const [isEmailing, setIsEmailing] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const print = usePrint();

    const totals = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));
        let totalNet = 0;

        (purchaseOrder.lineItems || []).forEach(item => {
            const net = item.quantity * item.unitPrice;
            totalNet += net;

            const taxRate = taxRatesMap.get(item.taxCodeId || '') as TaxRate | undefined;
            if (taxRate && taxRate.rate > 0) {
                if (!breakdown[taxRate.id]) {
                    breakdown[taxRate.id] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }
                const vatAmount = net * (taxRate.rate / 100);
                breakdown[taxRate.id].net += net;
                breakdown[taxRate.id].vat += vatAmount;
            }
        });

        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        return { totalNet, grandTotal: totalNet + totalVat, vatBreakdown: finalVatBreakdown };
    }, [purchaseOrder, taxRates]);

    const handlePrint = () => {
        print(
            <PrintablePurchaseOrder {...{ purchaseOrder, supplier, entity, taxRates, totals }} />
        );
    };

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintablePurchaseOrder {...{ purchaseOrder, supplier, entity, taxRates, totals }} />
            </React.StrictMode>
        );

        await new Promise(resolve => setTimeout(resolve, 800));
        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`PurchaseOrder-${purchaseOrder.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };
    
    const handleEmailSuccess = () => {
        // Automatically mark as ordered if it was in draft
        if (purchaseOrder.status === 'Draft') {
            onSetStatusToOrdered({ ...purchaseOrder, status: 'Ordered' });
        }
        setIsEmailing(false);
        onClose(); 
    };

    const handlePhoneOrder = () => {
        if (purchaseOrder.status === 'Draft') {
            onSetStatusToOrdered({ ...purchaseOrder, status: 'Ordered' });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                        <h2 className="text-xl font-bold text-indigo-700">Purchase Order #{purchaseOrder.id}</h2>
                        <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                    </header>
                    <main className="flex-grow overflow-y-auto">
                        <div className="scale-95 origin-top p-4">
                            <PrintablePurchaseOrder {...{ purchaseOrder, supplier, entity, taxRates, totals }} />
                        </div>
                    </main>
                    <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                        <div className="flex gap-2">
                             {onOpenForEditing && purchaseOrder.status !== 'Received' && purchaseOrder.status !== 'Cancelled' && (
                                <button
                                    onClick={() => onOpenForEditing(purchaseOrder)}
                                    className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
                                >
                                    <Edit size={16} className="mr-2" /> Edit
                                </button>
                            )}
                             {(purchaseOrder.status === 'Ordered' || purchaseOrder.status === 'Partially Received') && onOpenForEditing && (
                                <button
                                    onClick={() => { onOpenForEditing(purchaseOrder); onClose(); }}
                                    className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                                >
                                    <PackageCheck size={16} className="mr-2" /> Receive Goods
                                </button>
                            )}
                            {purchaseOrder.status === 'Draft' && (
                                <button 
                                    onClick={handlePhoneOrder}
                                    className="flex items-center py-2 px-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700"
                                >
                                    <Phone size={16} className="mr-2" /> Ordered via Phone
                                </button>
                            )}
                            <button 
                                onClick={() => setIsEmailing(true)} 
                                disabled={purchaseOrder.status === 'Received' || purchaseOrder.status === 'Cancelled'}
                                className="flex items-center py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Mail size={16} className="mr-2" /> {purchaseOrder.status === 'Draft' ? 'Email & Mark Ordered' : 'Resend Email'}
                            </button>
                             <button onClick={handlePrint} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">
                                <Printer size={16} className="mr-2" /> Print
                            </button>
                            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                                {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                            </button>
                        </div>
                        <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                    </footer>
                </div>
            </div>
            {isEmailing && (
                <EmailPurchaseOrderModal
                    isOpen={isEmailing}
                    onClose={() => setIsEmailing(false)}
                    onSend={handleEmailSuccess}
                    purchaseOrder={purchaseOrder}
                    supplier={supplier}
                />
            )}
        </>
    );
};

export default PurchaseOrderViewModal;
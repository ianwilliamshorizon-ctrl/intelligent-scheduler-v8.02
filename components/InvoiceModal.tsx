import React, { useState, useMemo } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, ServicePackage, InspectionTemplate, InspectionDiagram } from '../types';
import { X, Printer, CheckCircle, Wallet, Mail, Edit } from 'lucide-react';
import { usePrint } from '../core/hooks/usePrint';
import PrintableInvoice from './PrintableInvoice';
import PaymentModal from './PaymentModal';
import EmailInvoiceModal from './EmailInvoiceModal';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    job?: Job | null;
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
    onUpdateInvoice: (invoice: Invoice) => void;
    onInvoiceAction?: (jobId: string) => void;
    onEdit?: (invoice: Invoice) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, onUpdateInvoice, onInvoiceAction, onEdit }) => {
    const print = usePrint();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEmailing, setIsEmailing] = useState(false);
    const [printOptions, setPrintOptions] = useState({
        showInvoice: true,
        showTechNotes: true,
        showInspections: true,
        showMedia: true
    });

    // Calculate Grand Total including VAT (Mirroring PrintableInvoice logic)
    const grandTotal = useMemo(() => {
        if (!invoice) return 0;
        if (invoice.totalAmount) return invoice.totalAmount;

        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const standardTaxRateId = safeTaxRates.find(t => t.code === 'T1')?.id;
        const t99RateId = safeTaxRates.find(t => t.code === 'T99')?.id;
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));

        let total = 0;
        const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

        lineItems.forEach(item => {
            if (item.isPackageComponent) return;

            const net = (item.quantity || 0) * (item.unitPrice || 0);
            total += net;

            if (item.taxCodeId === t99RateId) {
                total += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                const taxRate = taxCodeId ? taxRatesMap.get(taxCodeId) : null;
                if (taxRate && taxRate.rate > 0) {
                    total += net * (taxRate.rate / 100);
                }
            }
        });

        return total;
    }, [invoice, taxRates]);

    const handlePrint = () => {
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, printOptions }} />);
    };

    const handleMarkAsPaid = () => {
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = (payment: any, financeNotes?: string) => {
        if (invoice) {
            const updatedPayments = [...(invoice.payments || []), payment];
            const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
            
            // Calculate total amount from line items if not present
            const calculatedTotal = grandTotal;
            
            let newStatus = invoice.status;
            if (totalPaid >= calculatedTotal) {
                newStatus = 'Paid';
            } else if (totalPaid > 0) {
                newStatus = 'Part Paid';
            }

            onUpdateInvoice({ 
                ...invoice, 
                payments: updatedPayments,
                status: newStatus,
                totalAmount: calculatedTotal,
                financeNotes: financeNotes || invoice.financeNotes
            });
            
            if (job && onInvoiceAction) {
                onInvoiceAction(job.id);
            }
        }
    };

    const handleEmailSuccess = (recipients: string) => {
        if (invoice) {
            onUpdateInvoice({ ...invoice, status: invoice.status === 'Draft' ? 'Sent' : invoice.status });
        }
        setIsEmailing(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
                    <header className="flex-shrink-0 flex flex-col p-4 border-b bg-gray-50 rounded-t-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setIsEmailing(true)}
                                    className="flex items-center py-2 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <Mail size={16} className="mr-2"/> 
                                    <span>Email</span>
                                </button>
                                <button 
                                    onClick={handlePrint} 
                                    className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                                >
                                    <Printer size={16} className="mr-2"/> 
                                    <span>Print Document</span>
                                </button>
                                {invoice.status !== 'Paid' && (
                                    <button 
                                        onClick={handleMarkAsPaid} 
                                        className="flex items-center py-2 px-6 bg-green-600 text-white font-bold rounded-lg shadow-sm hover:bg-green-700 transition-all gap-2"
                                    >
                                        <Wallet size={16} />
                                        <span>Record Payment</span>
                                    </button>
                                )}

                                {onEdit && (
                                    <button 
                                        onClick={() => { onEdit(invoice); onClose(); }} 
                                        className="flex items-center py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 shadow-sm transition-colors"
                                    >
                                        <Edit size={16} className="mr-2"/> 
                                        <span>Edit Invoice</span>
                                    </button>
                                )}
                                
                                <div className="w-px h-8 bg-gray-300 mx-1"></div>
                                <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={28} className="text-gray-400 hover:text-gray-800" /></button>
                            </div>
                        </div>

                        {/* Print Options Selection */}
                        <div className="flex items-center gap-6 px-4 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mr-2">Print Sections:</span>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={printOptions.showInvoice} onChange={(e) => setPrintOptions(prev => ({ ...prev, showInvoice: e.target.checked }))} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Invoice</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={printOptions.showTechNotes} onChange={(e) => setPrintOptions(prev => ({ ...prev, showTechNotes: e.target.checked }))} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Tech Notes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={printOptions.showInspections} onChange={(e) => setPrintOptions(prev => ({ ...prev, showInspections: e.target.checked }))} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Inspections</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={printOptions.showMedia} onChange={(e) => setPrintOptions(prev => ({ ...prev, showMedia: e.target.checked }))} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Media Shots</span>
                            </label>
                        </div>
                    </header>
                    <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                        <div className="scale-90 origin-top shadow-xl">
                            <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, printOptions }} />
                        </div>
                    </main>
                </div>

                {isPaymentModalOpen && (
                    <PaymentModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                        onSave={handleSavePayment}
                        invoice={invoice}
                        totalAmount={grandTotal}
                    />
                )}
            </div>
            {isEmailing && (
                <EmailInvoiceModal 
                    isOpen={isEmailing} 
                    onClose={() => setIsEmailing(false)} 
                    onSend={handleEmailSuccess} 
                    invoice={invoice} 
                    customer={customer} 
                    vehicle={vehicle}
                    totalAmount={grandTotal}
                />
            )}
        </>
    );
};

export default InvoiceModal;

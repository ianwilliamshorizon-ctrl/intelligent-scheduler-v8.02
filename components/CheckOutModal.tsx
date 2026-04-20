import React, { useState, useEffect } from 'react';
import { Job, Invoice, Vehicle, Customer, TaxRate } from '../types';
import { X, Save, LogOut, Car, User, FileText, AlertTriangle, KeyRound, CheckCircle, Wallet } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import PaymentModal from './PaymentModal';

interface CheckOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    job: Job | null;
    invoice: Invoice | null;
    vehicle: Vehicle | null;
    customer: Customer | null;
    onUpdateInvoice: (invoice: Invoice) => void;
    taxRates: TaxRate[];
}

const CheckOutModal: React.FC<CheckOutModalProps> = ({ isOpen, onClose, onSave, job, invoice, vehicle, customer, onUpdateInvoice, taxRates }) => {
    const [collectedBy, setCollectedBy] = useState<string>('');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    useEffect(() => {
        if (job) {
            setCollectedBy(job.collectedBy || `${customer?.forename} ${customer?.surname}`);
        }
    }, [job, customer]);

    const handleSave = () => {
        if (!job) return;

        const updatedJob: Job = {
            ...job,
            collectedBy: collectedBy,
            status: 'Closed',
            vehicleStatus: 'Collected'
        };
        onSave(updatedJob);
        onClose();
    };
    
    const handleMarkAsPaid = () => {
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = (payment: any, financeNotes?: string) => {
        if (invoice) {
            const updatedPayments = [...(invoice.payments || []), payment];
            const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
            
            // Re-calculate the grand total to ensure status is correct
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
        }
    };

    if (!isOpen || !job) return null;

    const isPaid = invoice?.status === 'Paid';

    // Calculate Grand Total including VAT
    const grandTotal = React.useMemo(() => {
        if (!invoice) return 0;
        if (invoice.totalAmount) return invoice.totalAmount;
        
        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const standardTaxRateId = safeTaxRates.find(t => t.code === 'T1')?.id;
        const t99RateId = safeTaxRates.find(t => t.code === 'T99')?.id;
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));

        let netSum = 0;
        let vatSum = 0;

        const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

        lineItems.forEach(item => {
            if (item.isPackageComponent) return;

            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            netSum += itemNet;

            if (item.taxCodeId === t99RateId) {
                vatSum += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;

                const taxRate = taxRatesMap.get(taxCodeId);
                if (!taxRate) return;

                if (taxRate.rate > 0) {
                    vatSum += itemNet * (taxRate.rate / 100);
                }
            }
        });

        return netSum + vatSum;
    }, [invoice, taxRates]);

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[70] flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50/50 rounded-t-2xl sm:rounded-t-xl">
                    <h2 className="text-lg sm:text-xl font-bold text-indigo-700 truncate pr-4">Check-Out: {job.id}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs sm:text-sm space-y-2">
                        <p className="flex items-center gap-2 font-semibold text-gray-700"><Car size={14} className="text-gray-400"/> {vehicle?.registration} • {vehicle?.make} {vehicle?.model}</p>
                        <p className="flex items-center gap-2 font-semibold text-gray-700"><User size={14} className="text-gray-400"/> {customer?.forename} {customer?.surname}</p>
                        {job.keyNumber && (
                            <div className="pt-2 mt-2 border-t flex items-center justify-between">
                                <span className="flex items-center gap-1.5 font-bold text-gray-800">
                                    <KeyRound size={16} className="text-amber-600"/> Key Number
                                </span>
                                <span className="text-xl font-black text-indigo-700">{job.keyNumber}</span>
                            </div>
                        )}
                    </div>

                    {!isPaid && (
                        <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-100 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
                            <AlertTriangle size={24} className="flex-shrink-0 text-rose-500 mt-0.5"/>
                            <div>
                                <p className="font-extrabold uppercase tracking-tight mb-0.5">Invoice Unpaid</p>
                                <p className="opacity-90 leading-snug">Invoice #{invoice?.id} is currently '{invoice?.status}'. Confirm payment before release.</p>
                            </div>
                        </div>
                    )}
                    
                    {invoice && (
                         <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="flex items-center gap-2 font-bold text-indigo-900 mb-0.5"><FileText size={14}/> Invoice #{invoice.id}</p>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {invoice.status}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Grand Total</span>
                                    <span className="font-black text-2xl text-indigo-900 tracking-tighter">
                                        {formatCurrency(grandTotal)}
                                    </span>
                                </div>
                            </div>

                             {!isPaid && (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                         <button 
                                            onClick={() => handleSavePayment({ amount: (grandTotal || 0) - (invoice.payments?.reduce((s, p) => s + p.amount, 0) || 0), method: 'BACS', date: new Date().toISOString().split('T')[0], notes: 'Full Payment (Quick Pay)' })} 
                                            className="flex-1 py-3 px-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 text-[10px] transition-all shadow-md active:scale-95"
                                        >
                                            PAID FULL BACS
                                        </button>
                                         <button 
                                            onClick={() => handleSavePayment({ amount: (grandTotal || 0) - (invoice.payments?.reduce((s, p) => s + p.amount, 0) || 0), method: 'Card', date: new Date().toISOString().split('T')[0], notes: 'Full Payment (Quick Pay)' })} 
                                            className="flex-1 py-3 px-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 text-[10px] transition-all shadow-md active:scale-95"
                                        >
                                            PAID FULL CARD
                                        </button>
                                    </div>
                                    <button 
                                        onClick={handleMarkAsPaid} 
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-all text-xs uppercase tracking-wider shadow-sm"
                                    >
                                        <Wallet size={14} /> Other Payment Method
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                     <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <label htmlFor="collectedBy" className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Collected By</label>
                        <input
                            id="collectedBy"
                            type="text"
                            value={collectedBy}
                            onChange={e => setCollectedBy(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                            placeholder="e.g. John Smith"
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between gap-3 p-4 border-t bg-gray-50/50">
                    <button onClick={onClose} className="flex-1 py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]">
                        <LogOut size={18} /> Confirm Collection
                    </button>
                </footer>
            </div>

            {isPaymentModalOpen && invoice && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSave={handleSavePayment}
                    invoice={invoice}
                    totalAmount={grandTotal}
                />
            )}
        </div>
    );
};

export default CheckOutModal;
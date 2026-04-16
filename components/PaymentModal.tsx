import React, { useState, useEffect } from 'react';
import { X, DollarSign, Wallet, CreditCard, Landmark, FileText, AlertCircle } from 'lucide-react';
import { Invoice, Payment } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payment: Payment, financeNotes?: string) => void;
    invoice: Invoice;
    totalAmount: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSave, invoice, totalAmount }) => {
    const existingPaymentsTotal = (invoice?.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const safeTotal = totalAmount || 0;
    const balance = Math.max(0, safeTotal - existingPaymentsTotal);
    
    const [amount, setAmount] = useState<number>(balance);
    const [method, setMethod] = useState<Payment['method']>('BACS');
    const [notes, setNotes] = useState('');
    const [financeNotes, setFinanceNotes] = useState(invoice?.financeNotes || '');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        setAmount(balance);
        setFinanceNotes(invoice?.financeNotes || '');
    }, [balance, isOpen, invoice]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            amount,
            method,
            date,
            notes: notes.trim() || undefined
        }, financeNotes.trim());
        onClose();
    };

    const getMethodIcon = (m: Payment['method']) => {
        switch (m) {
            case 'Card': return <CreditCard size={18} />;
            case 'BACS': return <Landmark size={18} />;
            case 'Cash': return <Wallet size={18} />;
            case 'Bank Transfer': return <Landmark size={18} />;
            default: return <DollarSign size={18} />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                <header className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Wallet className="text-indigo-600" size={24} />
                        Add Payment
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Summary Card */}
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-indigo-700 font-medium">Invoice Total</span>
                            <span className="font-bold text-indigo-900">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-indigo-700 font-medium">Already Paid</span>
                            <span className="font-bold text-green-600">{formatCurrency(existingPaymentsTotal)}</span>
                        </div>
                        <div className="pt-2 border-t border-indigo-200 flex justify-between items-center">
                            <span className="text-indigo-800 font-black uppercase text-[10px] tracking-wider">Balance Remaining</span>
                            <span className="text-lg font-black text-indigo-900">{formatCurrency(balance)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Payment Date</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Payment Method</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['BACS', 'Card', 'Cash', 'Bank Transfer', 'Other'] as Payment['method'][]).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMethod(m)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-bold transition-all ${
                                            method === m 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]' 
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white hover:border-indigo-300'
                                        }`}
                                    >
                                        {getMethodIcon(m)}
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Amount to Pay</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg select-all"
                                    required 
                                />
                            </div>
                            {amount < balance && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-amber-600">
                                    <AlertCircle size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Creating a Part-Payment</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Payment Reference / Note (for this payment)</label>
                            <input 
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Check #, Auth Code, etc."
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                            />
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-black uppercase tracking-widest text-indigo-500 mb-1.5 flex items-center gap-1.5">
                                <FileText size={12} />
                                Invoice Finance Notes (Internal)
                            </label>
                            <textarea 
                                value={financeNotes}
                                onChange={(e) => setFinanceNotes(e.target.value)}
                                placeholder="Why is this a part payment? Re-collection date? Credit agreement?"
                                className="w-full px-4 py-2.5 bg-indigo-50/30 border border-indigo-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] resize-none text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                            <FileText size={16} />
                            Record Payment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;

import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Mail } from 'lucide-react';
import { Invoice, Customer, Vehicle } from '../types';

interface EmailInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipients: string) => void;
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    totalAmount: number;
}

const EmailInvoiceModal: React.FC<EmailInvoiceModalProps> = ({ isOpen, onClose, onSend, invoice, customer, vehicle, totalAmount }) => {
    const [recipients, setRecipients] = useState('');

    const customerEmail = useMemo(() => {
        return customer?.email || `${String(customer?.forename || '').toLowerCase()}.${String(customer?.surname || '').toLowerCase()}@example.com`;
    }, [customer]);

    useEffect(() => {
        if (isOpen && customerEmail) {
            setRecipients(customerEmail);
        }
    }, [isOpen, customerEmail]);

    if (!isOpen) return null;

    const total = totalAmount || 0;

    const handleSend = () => {
        onSend(recipients);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center">
                        <Send size={20} className="mr-2"/>
                        Email Invoice {invoice.id}
                    </h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                <div className="space-y-4 text-sm">
                    <div className="flex flex-col p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                        <div className="flex items-center mb-1">
                            <Mail size={14} className="text-indigo-600 mr-2" />
                            <span className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider">Recipients</span>
                        </div>
                        <div className="relative">
                            <input 
                                type="text"
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800 transition-all shadow-sm"
                                placeholder="customer@example.com, secondary@example.com"
                            />
                            <div className="mt-1 text-[10px] text-indigo-400 font-medium italic">Separate multiple email addresses with commas</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-100">
                        <span className="font-bold text-gray-400 w-20 uppercase text-[10px]">From:</span>
                        <span className="text-gray-700 font-medium">BROOKSPEED &lt;no-reply@brookspeed.com&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-100">
                        <span className="font-bold text-gray-400 w-20 uppercase text-[10px]">Subject:</span>
                        <span className="text-gray-800 font-semibold tracking-tight">Your Invoice #{invoice.id} from BROOKSPEED</span>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg mt-4 h-80 overflow-y-auto bg-white shadow-inner">
                        <p className="mb-4">Dear {customer?.forename || 'Customer'},</p>
                        <p className="mb-4">Please find attached your invoice for recent work completed on your {vehicle?.make} {vehicle?.model} ({vehicle?.registration || 'TBA'}).</p>
                        <div className="p-4 bg-gray-50 my-4 rounded-xl border border-gray-100 shadow-sm text-center">
                            <h4 className="font-bold text-indigo-900 text-sm mb-3 border-b border-gray-200 pb-2">Invoice Summary</h4>
                            <div className="inline-block bg-white px-6 py-3 rounded-lg border border-gray-100">
                                <span className="text-gray-600 font-medium mr-4">Total Amount Due:</span>
                                <span className="font-black text-lg text-indigo-700">£{total.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 italic uppercase tracking-widest font-black">Full details are in the attached PDF</p>
                        </div>
                        <p>If you have any questions, please don't hesitate to contact us.</p>
                        <p className="mt-6 text-gray-400">Kind regards,</p>
                        <p className="font-bold text-indigo-900">The BROOKSPEED Team</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                    <button type="button" onClick={onClose} className="py-2.5 px-5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-bold transition-colors">Cancel</button>
                    <button onClick={handleSend} className="flex items-center py-2.5 px-6 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all hover:scale-105 active:scale-95 border-b-4 border-green-800">
                        <Send size={16} className="mr-2"/> Send Email
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailInvoiceModal;
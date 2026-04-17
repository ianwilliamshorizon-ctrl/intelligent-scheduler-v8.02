import React, { useMemo, useState, useEffect } from 'react';
import { X, Send, UserPlus, Mail } from 'lucide-react';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';

interface EmailEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipients: string) => void;
    onViewAsCustomer: () => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    taxRates: TaxRate[];
}

const EmailEstimateModal: React.FC<EmailEstimateModalProps> = ({ isOpen, onClose, onSend, onViewAsCustomer, estimate, customer, vehicle, taxRates }) => {
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

    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    const calculateTotal = (lineItems: EstimateLineItem[]) => {
        return lineItems.reduce((sum, item) => {
            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            const rate = taxCodeId ? (taxRatesMap.get(taxCodeId) || 0) / 100 : 0;
            const itemVat = itemNet * rate;
            return sum + itemNet + itemVat;
        }, 0);
    };
    
    const total = calculateTotal(estimate.lineItems);

    const handleSend = () => {
        onSend(recipients);
    };

    // Z-Index raised to 90 to be higher than EstimateViewModal (Z-60)
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[90] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center">
                        <Send size={20} className="mr-2"/>
                        Email Estimate {estimate.estimateNumber}
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
                        <span className="text-gray-800 font-semibold tracking-tight">Your Estimate #{estimate.estimateNumber} from BROOKSPEED</span>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg mt-4 h-80 overflow-y-auto bg-white shadow-inner">
                        <p className="mb-4">Dear {customer?.forename || 'Customer'},</p>
                        <p className="mb-4">Thank you for choosing BROOKSPEED. Please find below the details of your estimate for the work on your {vehicle?.make} {vehicle?.model} ({vehicle?.registration || 'TBA'}).</p>
                        <div className="p-4 bg-gray-50 my-4 rounded-xl border border-gray-100 shadow-sm">
                            <h4 className="font-bold text-indigo-900 text-sm mb-3 border-b border-gray-200 pb-2 flex items-center">
                                <span className="bg-indigo-100 p-1 rounded-md mr-2"><Mail size={14} className="text-indigo-600" /></span>
                                Estimate Summary
                            </h4>
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100">
                                <span className="text-gray-600 font-medium">Total Estimate Amount:</span>
                                <span className="font-black text-lg text-indigo-700">£{total.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 italic text-center uppercase tracking-widest font-black">Inclusive of VAT where applicable</p>
                        </div>
                        <p className="mb-4">You can view, approve, or decline your detailed estimate online by clicking the link below:</p>
                        <div className="text-center my-6">
                            <button 
                                type="button"
                                onClick={onViewAsCustomer}
                                className="inline-block py-3 px-8 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
                                title="Simulate customer view (Test Mode)"
                            >
                                View Estimate Online
                            </button>
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

export default EmailEstimateModal;
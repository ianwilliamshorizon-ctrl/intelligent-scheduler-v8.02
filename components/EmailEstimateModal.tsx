import React, { useMemo } from 'react';
import { X, Send } from 'lucide-react';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';

interface EmailEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: () => void;
    onViewAsCustomer: () => void;
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    taxRates: TaxRate[];
}

const EmailEstimateModal: React.FC<EmailEstimateModalProps> = ({ isOpen, onClose, onSend, onViewAsCustomer, estimate, customer, vehicle, taxRates }) => {
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

    const customerEmail = customer?.email || `${String(customer?.forename || '').toLowerCase()}.${String(customer?.surname || '').toLowerCase()}@example.com`;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center">
                        <Send size={20} className="mr-2"/>
                        Email Estimate {estimate.estimateNumber}
                    </h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                <div className="space-y-4 text-sm">
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">To:</span>
                        <span>{customer?.forename} {customer?.surname} &lt;{customerEmail}&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">From:</span>
                        <span>BROOKSPEED &lt;no-reply@brookspeed.com&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">Subject:</span>
                        <span>Your Estimate #{estimate.estimateNumber} from BROOKSPEED</span>
                    </div>

                    <div className="p-4 border rounded-md mt-4 h-80 overflow-y-auto">
                        <p className="mb-4">Dear {customer?.forename},</p>
                        <p className="mb-4">Thank you for choosing BROOKSPEED. Please find below the details of your estimate for the work on your {vehicle?.make} {vehicle?.model} ({vehicle?.registration}).</p>
                        <div className="p-4 bg-gray-50 my-4 rounded-lg">
                            <h4 className="font-semibold text-base mb-2">Estimate Summary</h4>
                            <div className="flex justify-between border-b pb-1">
                                <span>Total Estimate Amount:</span>
                                <span className="font-bold">£{total.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">This total is inclusive of VAT where applicable.</p>
                        </div>
                        <p className="mb-4">You can view, approve, or decline your detailed estimate online by clicking the link below:</p>
                        <div className="text-center my-6">
                            <button 
                                type="button"
                                onClick={onViewAsCustomer}
                                className="inline-block py-2 px-6 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition"
                                title="Simulate customer view (Test Mode)"
                            >
                                View Estimate Online
                            </button>
                        </div>
                        <p>If you have any questions, please don't hesitate to contact us.</p>
                        <p className="mt-4">Kind regards,</p>
                        <p className="font-semibold">The BROOKSPEED Team</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                    <button onClick={onSend} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                        <Send size={16} className="mr-2"/> Send Email
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailEstimateModal;

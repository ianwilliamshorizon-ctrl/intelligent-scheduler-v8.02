import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Mail } from 'lucide-react';
import { PurchaseOrder, Supplier, BusinessEntity } from '../types';

interface EmailPurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipients: string) => void;
    purchaseOrder: PurchaseOrder;
    supplier?: Supplier | null;
    businessEntity: BusinessEntity;
}

const EmailPurchaseOrderModal: React.FC<EmailPurchaseOrderModalProps> = ({ isOpen, onClose, onSend, purchaseOrder, supplier, businessEntity }) => {
    const [recipients, setRecipients] = useState('');

    const supplierEmail = useMemo(() => {
        return supplier?.email || 'supplier@example.com';
    }, [supplier]);

    useEffect(() => {
        if (isOpen && supplierEmail) {
            setRecipients(supplierEmail);
        }
    }, [isOpen, supplierEmail]);

    if (!isOpen) return null;

    const handleSend = () => {
        onSend(recipients);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center">
                        <Send size={20} className="mr-2"/>
                        Email Purchase Order {purchaseOrder.id}
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
                                placeholder="supplier@example.com, accounts@supplier.com"
                            />
                            <div className="mt-1 text-[10px] text-indigo-400 font-medium italic">Separate multiple email addresses with commas</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-100">
                        <span className="font-bold text-gray-400 w-20 uppercase text-[10px]">From:</span>
                        <span className="text-gray-700 font-medium">{businessEntity.name} &lt;{businessEntity.email || 'no-reply@brookspeed.com'}&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-100">
                        <span className="font-bold text-gray-400 w-20 uppercase text-[10px]">Subject:</span>
                        <span className="text-gray-800 font-semibold tracking-tight">Purchase Order #{purchaseOrder.id} from {businessEntity.name}</span>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg mt-4 h-64 overflow-y-auto bg-white shadow-inner">
                        <p className="mb-4">Dear {supplier?.name || 'Supplier'},</p>
                        <p className="mb-4">Please find attached our purchase order #{purchaseOrder.id}.</p>
                        {purchaseOrder.supplierReference && <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4 inline-block"><span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Your Reference</span><span className="font-bold text-gray-800">{purchaseOrder.supplierReference}</span></div>}
                        <div className="flex items-center gap-2 mb-4 p-2 bg-indigo-50 rounded-md inline-flex border border-indigo-100">
                            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-tighter">Vehicle Reference</span>
                            <span className="font-bold text-indigo-700">{purchaseOrder.vehicleRegistrationRef || 'Stock'}</span>
                        </div>
                        <p className="mb-4">Please confirm receipt and provide an estimated delivery date.</p>
                        <p>If you have any questions, please don't hesitate to contact us.</p>
                        <p className="mt-6 text-gray-400">Kind regards,</p>
                        <p className="font-bold text-indigo-900">The {businessEntity.name} Team</p>
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

export default EmailPurchaseOrderModal;
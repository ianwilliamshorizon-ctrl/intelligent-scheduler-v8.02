import React from 'react';
import { X, Send } from 'lucide-react';
import { PurchaseOrder, Supplier } from '../types';

interface EmailPurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: () => void;
    purchaseOrder: PurchaseOrder;
    supplier?: Supplier | null;
}

const EmailPurchaseOrderModal: React.FC<EmailPurchaseOrderModalProps> = ({ isOpen, onClose, onSend, purchaseOrder, supplier }) => {
    if (!isOpen) return null;

    const supplierEmail = `accounts@${supplier?.name.toLowerCase().replace(/\s/g, '')}.com` || 'supplier@example.com';

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
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">To:</span>
                        <span>{supplier?.name} &lt;{supplierEmail}&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">From:</span>
                        <span>BROOKSPEED &lt;no-reply@brookspeed.com&gt;</span>
                    </div>
                    <div className="flex items-center p-2 bg-gray-100 rounded-md">
                        <span className="font-semibold text-gray-600 w-20">Subject:</span>
                        <span>Purchase Order #{purchaseOrder.id} from BROOKSPEED</span>
                    </div>

                    <div className="p-4 border rounded-md mt-4 h-64 overflow-y-auto">
                        <p className="mb-4">Dear {supplier?.name},</p>
                        <p className="mb-4">Please find attached our purchase order #{purchaseOrder.id}.</p>
                        <p>This order is in relation to vehicle: <strong>{purchaseOrder.vehicleRegistrationRef}</strong>.</p>
                        <p className="mb-4">Please confirm receipt and provide an estimated delivery date.</p>
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

export default EmailPurchaseOrderModal;

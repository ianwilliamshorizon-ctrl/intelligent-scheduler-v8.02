import React, { useMemo, useState } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, ServicePackage } from '../types';
import { X, Printer, CheckCircle } from 'lucide-react';
import { usePrint } from '../core/hooks/usePrint';
import PrintableInvoice from './PrintableInvoice';

// Define props interface
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
    onUpdateInvoice: (invoice: Invoice) => void;
    onInvoiceAction?: (jobId: string) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice, customer, vehicle, entity, job, taxRates, servicePackages, onUpdateInvoice, onInvoiceAction }) => {
    const print = usePrint();

    const handlePrint = () => {
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages }} />);
    };
    
    const handleMarkAsPaid = () => {
        if (invoice) {
            onUpdateInvoice({ ...invoice, status: 'Paid' });
            if (job && onInvoiceAction) {
                onInvoiceAction(job.id);
            }
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                        {invoice.status !== 'Paid' && (
                            <button onClick={handleMarkAsPaid} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                                <CheckCircle size={16} className="mr-2"/> Mark as Paid
                            </button>
                        )}
                        <button onClick={handlePrint} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">
                            <Printer size={16} className="mr-2"/> Print / PDF
                        </button>
                    </div>
                    <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                </footer>
            </div>
        </div>
    );
};

export default InvoiceModal;

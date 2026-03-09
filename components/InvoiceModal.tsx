import React from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, ServicePackage, InspectionTemplate } from '../types';
import { X, Printer, CheckCircle } from 'lucide-react';
import { usePrint } from '../core/hooks/usePrint';
import PrintableInvoice from './PrintableInvoice';

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
    onUpdateInvoice: (invoice: Invoice) => void;
    onInvoiceAction?: (jobId: string) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, onUpdateInvoice, onInvoiceAction }) => {
    const print = usePrint();

    const handlePrint = () => {
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, isStandalone: false }} />);
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                    <div className="flex items-center gap-4">
                         <button onClick={handlePrint} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 shadow-sm">
                            <Printer size={16} className="mr-2"/> 
                            <span>Print / Save PDF</span>
                        </button>
                        {invoice.status !== 'Paid' && (
                            <button onClick={handleMarkAsPaid} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-sm">
                                <CheckCircle size={16} className="mr-2"/> Mark as Paid
                            </button>
                        )}
                        <button onClick={onClose}><X size={28} className="text-gray-400 hover:text-gray-800 transition-colors" /></button>
                    </div>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="scale-90 origin-top">
                        <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, isStandalone: false }} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default InvoiceModal;

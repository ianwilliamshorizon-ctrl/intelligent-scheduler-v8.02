import React, { useState, useEffect } from 'react';
import { Job, Invoice, Vehicle, Customer } from '../types';
import { X, Save, LogOut, Car, User, FileText, AlertTriangle, KeyRound, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';

interface CheckOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    job: Job | null;
    invoice: Invoice | null;
    vehicle: Vehicle | null;
    customer: Customer | null;
    onUpdateInvoice: (invoice: Invoice) => void;
}

const CheckOutModal: React.FC<CheckOutModalProps> = ({ isOpen, onClose, onSave, job, invoice, vehicle, customer, onUpdateInvoice }) => {
    const [collectedBy, setCollectedBy] = useState<string>('');

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
        if (invoice) {
            onUpdateInvoice({ ...invoice, status: 'Paid' });
        }
    };

    if (!isOpen || !job) return null;

    const isPaid = invoice?.status === 'Paid';

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Vehicle Check-Out: {job.id}</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-6 space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg border text-sm space-y-1">
                        <p className="flex items-center gap-2"><Car size={14}/> <strong>Vehicle:</strong> {vehicle?.registration} - {vehicle?.make} {vehicle?.model}</p>
                        <p className="flex items-center gap-2"><User size={14}/> <strong>Customer:</strong> {customer?.forename} {customer?.surname}</p>
                        {job.keyNumber && (
                            <p className="flex items-center gap-2 pt-2 mt-2 border-t font-bold text-base text-gray-800">
                                <KeyRound size={16} className="text-yellow-600"/> Key Number: {job.keyNumber}
                            </p>
                        )}
                    </div>

                    {!isPaid && (
                        <div className="p-3 bg-amber-100 text-amber-800 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle size={24}/>
                            <div>
                                <p className="font-bold">Invoice Not Paid</p>
                                <p>Invoice #{invoice?.id} has a status of '{invoice?.status}'. Please confirm payment has been taken before releasing the vehicle.</p>
                            </div>
                        </div>
                    )}
                    
                    {invoice && (
                         <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                            <p className="flex items-center gap-2 font-bold"><FileText size={14}/> Invoice #{invoice.id}</p>
                            <div className="flex justify-between items-center mt-1">
                                <span>Status: <span className={`font-semibold ${isPaid ? 'text-green-700' : 'text-red-700'}`}>{invoice.status}</span></span>
                                <span className="font-bold text-lg">
                                    {formatCurrency(invoice.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                                </span>
                            </div>
                             {!isPaid && (
                                <div className="mt-3 pt-3 border-t">
                                    <button 
                                        onClick={handleMarkAsPaid} 
                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                                    >
                                        <CheckCircle size={16} /> Mark Invoice as Paid
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                     <div>
                        <label htmlFor="collectedBy" className="text-sm font-medium text-gray-700 mb-1 block">Collected By</label>
                        <input
                            id="collectedBy"
                            type="text"
                            value={collectedBy}
                            onChange={e => setCollectedBy(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="e.g., John Smith"
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-end gap-2 p-4 border-t bg-gray-50">
                    <button onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg">
                        <LogOut size={16} /> Confirm Collection & Close Job
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CheckOutModal;
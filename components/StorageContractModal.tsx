import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { StorageBooking, Vehicle, Customer, BusinessEntity } from '../types';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const PrintableContract: React.FC<any> = ({ booking, vehicle, customer, entity }) => {
    return (
        <div className="bg-white font-sans text-sm text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">VEHICLE STORAGE AGREEMENT</h2>
                    <p>Agreement Date: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </header>

            <main className="space-y-6 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Owner</h3>
                        <p className="font-bold text-gray-800">{customer?.forename} {customer?.surname}</p>
                        <p>{customer?.addressLine1}, {customer?.city}, {customer?.postcode}</p>
                        <p>Tel: {customer?.phone}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                        <p>VIN: <span className="font-mono text-xs">{vehicle?.vin || 'N/A'}</span></p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Storage Terms</h3>
                    <div className="grid grid-cols-2 gap-x-4 p-4 bg-gray-50 rounded-lg">
                        <p className="font-semibold">Storage Start Date:</p>
                        <p className="text-right font-bold">{booking.startDate}</p>
                        <p className="font-semibold">Agreed Weekly Rate:</p>
                        <p className="text-right font-bold text-lg">{formatCurrency(booking.weeklyRate)}</p>
                        <p className="font-semibold">Storage Location / Slot:</p>
                        <p className="text-right font-bold">{booking.slotIdentifier}</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Terms & Conditions</h3>
                    <pre className="whitespace-pre-wrap font-sans text-xs bg-gray-50 p-3 rounded-md border">
                        {entity?.storageTermsAndConditions || 'Standard terms and conditions apply.'}
                    </pre>
                </section>
            </main>

            <footer className="mt-auto pt-8 text-xs text-gray-600">
                <p>By signing below, you agree to the terms outlined in this Vehicle Storage Agreement.</p>
                <div className="grid grid-cols-2 gap-8 mt-16">
                    <div><div className="border-t pt-1">Owner Signature</div></div>
                    <div><div className="border-t pt-1">For {entity?.name}</div></div>
                </div>
            </footer>
        </div>
    );
};

interface StorageContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: StorageBooking;
    vehicle?: Vehicle;
    customer?: Customer;
    entity?: BusinessEntity;
}

const StorageContractModal: React.FC<StorageContractModalProps> = ({ isOpen, onClose, booking, vehicle, customer, entity }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.getElementById('print-mount-point');
        if (!printMountPoint) {
            console.error("Print mount point not found.");
            setIsGeneratingPdf(false);
            return;
        }

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(<PrintableContract {...{ booking, vehicle, customer, entity }} />);
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`Storage_Agreement_${vehicle?.registration}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            root.unmount();
            setIsGeneratingPdf(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Storage Agreement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableContract {...{ booking, vehicle, customer, entity }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                        </button>
                    </div>
                    <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                </footer>
            </div>
        </div>
    );
};

export default StorageContractModal;
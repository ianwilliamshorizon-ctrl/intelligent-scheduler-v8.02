import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, ServicePackage, InspectionTemplate, InspectionDiagram } from '../types';
import { X, Printer, CheckCircle, Download, Loader2 } from 'lucide-react';
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
    inspectionDiagrams: InspectionDiagram[];
    onUpdateInvoice: (invoice: Invoice) => void;
    onInvoiceAction?: (jobId: string) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, onUpdateInvoice, onInvoiceAction }) => {
    const print = usePrint();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handlePrint = () => {
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams }} />);
    };

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        printMountPoint.style.top = '0';
        printMountPoint.style.width = '210mm'; // Standard A4 width for canvas rendering
        document.body.appendChild(printMountPoint);

        try {
            if (job && onInvoiceAction) {
                onInvoiceAction(job.id);
            }

            const root = ReactDOM.createRoot(printMountPoint);
            root.render(
                <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams }} />
            );

            // Wait for render, images and state settles
            await new Promise(resolve => setTimeout(resolve, 2000));

            const canvas = await html2canvas(printMountPoint, { 
                scale: 2, 
                useCORS: true, 
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasHeightOnPdf = pdfWidth * (canvas.height / canvas.width);
            
            let heightLeft = canvasHeightOnPdf;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - canvasHeightOnPdf;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Invoice-${invoice.id}.pdf`);
            root.unmount();
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Failed to generate PDF. Please use standard Print button.");
        } finally {
            if (document.body.contains(printMountPoint)) {
                document.body.removeChild(printMountPoint);
            }
            setIsGeneratingPdf(false);
        }
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
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint} 
                            className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 shadow-sm transition-colors"
                        >
                            <Printer size={16} className="mr-2"/> 
                            <span>Print</span>
                        </button>
                        <button 
                            onClick={handleDownloadPdf} 
                            disabled={isGeneratingPdf} 
                            className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors"
                        >
                            {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2"/>}
                            <span>Download PDF</span>
                        </button>
                        {invoice.status !== 'Paid' && (
                            <button onClick={handleMarkAsPaid} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-sm">
                                <CheckCircle size={16} className="mr-2"/> Mark as Paid
                            </button>
                        )}
                        <div className="w-px h-8 bg-gray-300 mx-1"></div>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={28} className="text-gray-400 hover:text-gray-800" /></button>
                    </div>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="scale-90 origin-top shadow-xl">
                        <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams }} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default InvoiceModal;

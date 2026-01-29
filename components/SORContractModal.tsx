import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, Customer, BusinessEntity } from '../types';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const PrintableContract: React.FC<any> = ({ saleVehicle, vehicle, owner, entity }) => {
    const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId);
    const listPrice = activeVersion?.listPrice || 0;
    const returnPrice = activeVersion?.sorReturnPrice || 0;

    return (
        <div className="bg-white font-sans text-sm text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">SALE OR RETURN AGREEMENT</h2>
                    <p>Agreement Date: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </header>

            <main className="space-y-6 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Owner</h3>
                        <p className="font-bold text-gray-800">{owner?.forename} {owner?.surname}</p>
                        <p>{owner?.addressLine1}, {owner?.city}, {owner?.postcode}</p>
                        <p>Contact: {owner?.mobile || owner?.phone}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                        <p>VIN: <span className="font-mono text-xs">{vehicle?.vin || 'N/A'}</span></p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Agreed Financial Terms</h3>
                    <div className="grid grid-cols-2 gap-x-4 p-4 bg-gray-50 rounded-lg">
                        <p className="font-semibold">Agreed List Price for Marketing:</p>
                        <p className="text-right font-bold text-lg">{formatCurrency(listPrice)}</p>
                        <p className="font-semibold">Agreed Return Price to Owner (before prep costs):</p>
                        <p className="text-right font-bold text-lg">{formatCurrency(returnPrice)}</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Insurance & SORN Advice</h3>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs">
                        <p className="font-bold">Important Notice:</p>
                        <p>While your vehicle is in our care for sale, it is comprehensively insured under our Motor Trade policy. You may wish to contact your insurance provider to inform them the vehicle is with us and potentially suspend your policy. Additionally, you can declare the vehicle as SORN (Statutory Off Road Notification) with the DVLA, which will pause your road tax obligation. Please consult your insurer before making any changes.</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Terms & Conditions</h3>
                    <pre className="whitespace-pre-wrap font-sans text-xs bg-gray-50 p-3 rounded-md border">
                        {entity?.sorTermsAndConditions || 'No terms specified.'}
                    </pre>
                </section>
            </main>

            <footer className="mt-auto pt-8 text-xs text-gray-600">
                <p>By signing below, you agree to the terms outlined in this Sale or Return agreement.</p>
                <div className="grid grid-cols-2 gap-8 mt-16">
                    <div><div className="border-t pt-1">Owner Signature</div></div>
                    <div><div className="border-t pt-1">For {entity?.name}</div></div>
                </div>
            </footer>
        </div>
    );
};

interface SORContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    entity?: BusinessEntity;
}

const SORContractModal: React.FC<SORContractModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, owner, entity }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(<PrintableContract {...{ saleVehicle, vehicle, owner, entity }} />);
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const canvas = await html2canvas(printMountPoint, {
                scale: 2,
                useCORS: true,
                windowWidth: printMountPoint.scrollWidth,
                windowHeight: printMountPoint.scrollHeight,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgHeight / imgWidth;
            const canvasHeightOnPdf = pdfWidth * ratio;

            let heightLeft = canvasHeightOnPdf;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeightOnPdf);
                heightLeft -= pdfHeight;
            }

            pdf.save(`SOR_Agreement_${vehicle?.registration}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Sale or Return Agreement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableContract {...{ saleVehicle, vehicle, owner, entity }} />
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

export default SORContractModal;
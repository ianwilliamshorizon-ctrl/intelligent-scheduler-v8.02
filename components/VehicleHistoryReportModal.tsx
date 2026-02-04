
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Vehicle, Customer, Job, Estimate, Invoice, User, BusinessEntity, Engineer } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import PrintableVehicleHistory from './PrintableVehicleHistory';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';

interface VehicleHistoryReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
}

const VehicleHistoryReportModal: React.FC<VehicleHistoryReportModalProps> = ({ isOpen, onClose, vehicleId }) => {
    const { vehicles, customers, jobs, estimates, invoices, businessEntities, engineers } = useData();
    const { users } = useApp();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const vehicle = useMemo(() => vehicles.find(v => v.id === vehicleId), [vehicles, vehicleId]);
    const owner = useMemo(() => vehicle ? customers.find(c => c.id === vehicle.customerId) : undefined, [vehicle, customers]);
    
    const vehicleJobs = useMemo(() => 
        jobs.filter(j => j.vehicleId === vehicleId).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')), 
    [jobs, vehicleId]);

    const financials = useMemo(() => {
        const ests = estimates.filter(e => e.vehicleId === vehicleId).map(e => ({ ...e, type: 'Estimate' as const }));
        const invs = invoices.filter(i => i.vehicleId === vehicleId).map(i => ({ ...i, type: 'Invoice' as const }));
        return [...ests, ...invs].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
    }, [estimates, invoices, vehicleId]);

    const ownership = useMemo(() => {
        if (!owner) return [];
        // Ideally we would track ownership history, for now we just show current owner
        return [{ customer: owner, firstSeen: new Date(vehicle?.manufactureDate || new Date()) }];
    }, [owner, vehicle]);

    const handleDownloadPdf = async () => {
        if (!vehicle) return;
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableVehicleHistory
                    vehicle={vehicle}
                    owner={owner}
                    jobs={vehicleJobs}
                    financials={financials}
                    ownership={ownership}
                    users={users}
                    businessEntities={businessEntities}
                    engineers={engineers}
                />
            </React.StrictMode>
        );

        await new Promise(resolve => setTimeout(resolve, 1000));

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

            pdf.save(`Vehicle_History_${vehicle.registration}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen || !vehicle) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Vehicle History Report</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableVehicleHistory
                            vehicle={vehicle}
                            owner={owner}
                            jobs={vehicleJobs}
                            financials={financials}
                            ownership={ownership}
                            users={users}
                            businessEntities={businessEntities}
                            engineers={engineers}
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-end items-center p-4 border-t bg-gray-50 gap-2">
                    <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                        {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                        {isGeneratingPdf ? 'Generating...' : 'Download PDF Report'}
                    </button>
                    <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                </footer>
            </div>
        </div>
    );
};

export default VehicleHistoryReportModal;

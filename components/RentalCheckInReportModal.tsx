import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RentalBooking, Vehicle, Customer, BusinessEntity, RentalVehicle } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import VehicleDamageReport from './VehicleDamageReport';

interface RentalCheckInReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: RentalBooking;
    rentalVehicle?: RentalVehicle;
    vehicle?: Vehicle;
    customer?: Customer;
    entity?: BusinessEntity;
}

const PrintableReport: React.FC<any> = ({ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }) => {
    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">VEHICLE RETURN REPORT</h2>
                    <p>Booking Ref: {booking.id}</p>
                    <p>Return Date: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </header>

            <main className="space-y-6 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Hirer Details</h3>
                        <p className="font-bold text-gray-800">{customer?.forename} {customer?.surname}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Check-In Details</h3>
                    <div className="grid grid-cols-2 gap-x-4 p-4 bg-gray-50 rounded-lg">
                        <p className="font-semibold">Mileage In:</p>
                        <p className="text-right font-bold">{booking.checkInDetails?.mileage || 'N/A'}</p>
                        <p className="font-semibold">Fuel Level:</p>
                        <p className="text-right font-bold">{booking.checkInDetails?.fuelLevel}%</p>
                        <p className="font-semibold">Condition Notes:</p>
                        <p className="text-right italic">{booking.checkInDetails?.conditionNotes || 'None'}</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Damage Inspection</h3>
                    <div className="h-64 border rounded bg-gray-50 relative overflow-hidden">
                         <VehicleDamageReport 
                            activePoints={booking.checkInDetails?.damagePoints || []}
                            onUpdate={() => {}}
                            isReadOnly={true}
                            vehicleModel={vehicle?.model}
                            imageId={diagramImageId}
                            activeColorClass="bg-red-500"
                            referencePoints={booking.checkOutDetails ? {
                                points: booking.checkOutDetails.damagePoints,
                                colorClass: "bg-blue-500"
                            } : undefined}
                         />
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center">
                        Blue markers indicate pre-existing damage. Red markers indicate new damage found at check-in.
                    </div>
                </section>

                {booking.additionalCharges && booking.additionalCharges.length > 0 && (
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Additional Charges</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-left">
                                    <th className="p-2">Description</th>
                                    <th className="p-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {booking.additionalCharges.map(c => (
                                    <tr key={c.id} className="border-b">
                                        <td className="p-2">{c.description}</td>
                                        <td className="p-2 text-right">{formatCurrency(c.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold">
                                    <td className="p-2 text-right">Total Additional Charges:</td>
                                    <td className="p-2 text-right">{formatCurrency(booking.additionalCharges.reduce((s,c) => s + c.amount, 0))}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                )}
            </main>

            <footer className="mt-auto pt-8 text-xs text-gray-600">
                <p>I confirm the vehicle has been returned and inspected in my presence. I accept liability for any new damage or additional charges listed above.</p>
                <div className="grid grid-cols-2 gap-8 mt-16">
                    <div><div className="border-t pt-1">Hirer Signature</div></div>
                    <div><div className="border-t pt-1">For {entity?.name}</div></div>
                </div>
            </footer>
        </div>
    );
};

const RentalCheckInReportModal: React.FC<RentalCheckInReportModalProps> = ({ isOpen, onClose, booking, rentalVehicle, vehicle, customer, entity }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const diagramImageId = useMemo(() => {
        if (!vehicle || !rentalVehicle) return null;
        if (Array.isArray(vehicle.images)) {
            const primaryVehicleImage = vehicle.images.find(img => img.isPrimaryDiagram);
            if (primaryVehicleImage) {
                return primaryVehicleImage.id;
            }
        }
        return rentalVehicle.damageCheckImageId || null;
    }, [vehicle, rentalVehicle]);

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(<PrintableReport {...{ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }} />);
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
            
            pdf.save(`Return_Report_${booking.id}.pdf`);
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
                    <h2 className="text-xl font-bold text-indigo-700">Vehicle Return Report</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableReport {...{ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }} />
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

export default RentalCheckInReportModal;
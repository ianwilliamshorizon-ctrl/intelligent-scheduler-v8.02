import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RentalBooking, Vehicle, Customer, BusinessEntity, RentalVehicle } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import VehicleDamageReport from './VehicleDamageReport';

interface RentalAgreementModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: RentalBooking;
    rentalVehicle?: RentalVehicle;
    vehicle?: Vehicle;
    customer?: Customer;
    entity?: BusinessEntity;
}

const PrintableContract: React.FC<any> = ({ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }) => {
    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">RENTAL AGREEMENT</h2>
                    <p>Agreement No: {booking.id}</p>
                    <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </header>

            <main className="space-y-6 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Hirer Details</h3>
                        <p className="font-bold text-gray-800">{customer?.forename} {customer?.surname}</p>
                        <p>{customer?.addressLine1}, {customer?.city}, {customer?.postcode}</p>
                        <p>Tel: {customer?.mobile || customer?.phone}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Rental Period & Charges</h3>
                    <div className="grid grid-cols-2 gap-x-4 p-4 bg-gray-50 rounded-lg">
                        <p className="font-semibold">Start Date/Time:</p>
                        <p className="text-right font-bold">{new Date(booking.startDate).toLocaleString()}</p>
                        <p className="font-semibold">End Date/Time:</p>
                        <p className="text-right font-bold">{new Date(booking.endDate).toLocaleString()}</p>
                        
                        {booking.bookingType === 'Rental' && (
                            <>
                                <p className="font-semibold mt-2">Daily Rate:</p>
                                <p className="text-right font-bold mt-2">{formatCurrency(rentalVehicle?.dailyRate)}</p>
                                <p className="font-semibold">Total Estimated Cost:</p>
                                <p className="text-right font-bold text-lg">{formatCurrency(booking.totalCost)}</p>
                            </>
                        )}
                        {booking.bookingType === 'Courtesy Car' && (
                            <p className="col-span-2 text-center mt-2 italic font-semibold text-blue-800">Provided as Courtesy Car (No Charge)</p>
                        )}
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Vehicle Condition on Check-Out</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-xs space-y-1">
                            <p><strong>Mileage Out:</strong> {booking.checkOutDetails?.mileage || '___'}</p>
                            <p><strong>Fuel Level:</strong> {booking.checkOutDetails?.fuelLevel ? `${booking.checkOutDetails.fuelLevel}%` : '___%'}</p>
                            <p><strong>Condition Notes:</strong> {booking.checkOutDetails?.conditionNotes || 'None'}</p>
                        </div>
                        <div className="h-40 border rounded bg-gray-50 relative overflow-hidden">
                             {/* Simplified diagram rendering for print */}
                             <VehicleDamageReport 
                                activePoints={booking.checkOutDetails?.damagePoints || []}
                                onUpdate={() => {}}
                                isReadOnly={true}
                                vehicleModel={vehicle?.model}
                                imageId={diagramImageId}
                                activeColorClass="bg-blue-500"
                             />
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Terms & Conditions</h3>
                    <pre className="whitespace-pre-wrap font-sans text-[10px] bg-gray-50 p-3 rounded-md border h-32 overflow-hidden">
                        {entity?.rentalTermsAndConditions || 'Standard rental terms apply.'}
                    </pre>
                </section>
            </main>

            <footer className="mt-auto pt-8 text-xs text-gray-600">
                <p>I agree to the terms and conditions of this rental agreement. I confirm the vehicle condition is as stated above.</p>
                <div className="grid grid-cols-2 gap-8 mt-16">
                    <div><div className="border-t pt-1">Hirer Signature</div></div>
                    <div><div className="border-t pt-1">For {entity?.name}</div></div>
                </div>
            </footer>
        </div>
    );
};

const RentalAgreementModal: React.FC<RentalAgreementModalProps> = ({ isOpen, onClose, booking, rentalVehicle, vehicle, customer, entity }) => {
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
        root.render(<PrintableContract {...{ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }} />);
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

            pdf.save(`Rental_Agreement_${booking.id}.pdf`);
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
                    <h2 className="text-xl font-bold text-indigo-700">Rental Agreement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableContract {...{ booking, rentalVehicle, vehicle, customer, entity, diagramImageId }} />
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

export default RentalAgreementModal;
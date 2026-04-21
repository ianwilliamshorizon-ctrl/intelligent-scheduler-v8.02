import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, TaxRate, SaleUpsell } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

interface VehicleOrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    buyer?: Customer;
    entity?: BusinessEntity;
    taxRates: TaxRate[];
}

const PrintableOrderForm: React.FC<any> = ({ saleVehicle, vehicle, buyer, entity, taxRates }) => {
    const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId) || saleVehicle.versions?.[0];
    const listPrice = saleVehicle.status === 'Sold' ? (saleVehicle.finalSalePrice || activeVersion?.listPrice || 0) : (activeVersion?.listPrice || 0);

    const upsellTotal = (saleVehicle.upsells || []).reduce((sum: number, u: SaleUpsell) => sum + u.salePrice, 0);
    const totalAmount = listPrice + upsellTotal;
    const deposit = saleVehicle.depositAmount || 0;
    const balance = totalAmount - deposit;

    return (
        <PrintableDocumentLayout 
            entity={entity} 
            title="VEHICLE ORDER FORM" 
            subtitle={`Reference: ${saleVehicle.id}`}
        >
            <div className="space-y-8 py-4">
                {/* Parties */}
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '2px solid black' }}>
                        <h3 className="text-xs font-black text-gray-500 uppercase mb-2">Customer Details</h3>
                        <p className="font-bold text-lg">{buyer?.forename} {buyer?.surname}</p>
                        {buyer?.companyName && <p className="font-semibold text-gray-700">{buyer.companyName}</p>}
                        <p>{buyer?.addressLine1}</p>
                        <p>{buyer?.city}, {buyer?.postcode}</p>
                        <p className="mt-2 text-xs">Email: {buyer?.email}</p>
                        <p className="text-xs">Tel: {buyer?.mobile || buyer?.phone}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '2px solid black' }}>
                        <h3 className="text-xs font-black text-gray-500 uppercase mb-2">Vehicle Details</h3>
                        <p className="font-bold text-lg">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-gray-700">Reg: {vehicle?.registration}</p>
                        <p className="text-xs mt-1">VIN: {vehicle?.vin || 'N/A'}</p>
                        <p className="text-xs">Year: {vehicle?.year || 'N/A'}</p>
                        <p className="text-xs">Mileage: {saleVehicle.mileage?.toLocaleString() || 'N/A'} miles</p>
                    </div>
                </section>

                {/* Financials */}
                <section className="no-break">
                    <h3 className="text-sm font-black text-gray-900 border-b-2 border-black pb-1 mb-4">Financial Details</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1">
                            <span>Vehicle Basic Price</span>
                            <span className="font-bold">{formatCurrency(listPrice)}</span>
                        </div>
                        
                        {(saleVehicle.upsells || []).map((u: SaleUpsell) => (
                            <div key={u.id} className="flex justify-between items-center py-1 text-gray-600 italic">
                                <span>Add-on: {u.description}</span>
                                <span>{formatCurrency(u.salePrice)}</span>
                            </div>
                        ))}

                        <div className="flex justify-between items-center py-2 border-t-2 mt-2 text-lg font-black text-gray-900">
                            <span>Total Purchase Price (inc VAT if applicable)</span>
                            <span>{formatCurrency(totalAmount)}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 text-red-600 font-semibold">
                            <span>Less: Deposit Received</span>
                            <span>({formatCurrency(deposit)})</span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-t-4 border-double mt-2 text-2xl font-black text-indigo-700">
                            <span>BALANCE DUE ON COLLECTION</span>
                            <span>{formatCurrency(balance)}</span>
                        </div>
                    </div>
                </section>

                {/* Terms and Signatures */}
                <section className="no-break pt-8">
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-900 uppercase">Declaration</h4>
                            <p className="text-[10px] text-gray-500 leading-tight">
                                I, the undersigned, agree to purchase the above vehicle at the price stated. 
                                I have been given the opportunity to inspect the vehicle and am satisfied with its condition.
                                This order is subject to the standard terms and conditions of {entity?.name}.
                            </p>
                            <div className="pt-12 border-b border-gray-400"></div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer Signature</p>
                            <p className="text-[10px] text-gray-400">Date: ____/____/________</p>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-900 uppercase">For {entity?.name}</h4>
                            <p className="text-[10px] text-gray-500 leading-tight italic">
                                Thank you for your business. We look forward to delivering your new vehicle.
                            </p>
                            <div className="pt-12 border-b border-gray-400"></div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Authorized Signature</p>
                            <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>
                </section>

                {/* T&Cs if they exist */}
                {entity?.sorTermsAndConditions && (
                    <section className="page-break-before pt-8">
                        <h3 className="text-sm font-black text-gray-900 border-b-2 border-black pb-1 mb-4">Terms & Conditions</h3>
                        <div className="text-[9px] text-gray-500 leading-relaxed columns-2 gap-8 whitespace-pre-wrap">
                            {entity.sorTermsAndConditions}
                        </div>
                    </section>
                )}
            </div>
        </PrintableDocumentLayout>
    );
};

const VehicleOrderFormModal: React.FC<VehicleOrderFormModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, buyer, entity, taxRates }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableOrderForm {...{ saleVehicle, vehicle, buyer, entity, taxRates }} />
            </React.StrictMode>
        );

        // Wait for rendering
        setTimeout(() => {
            window.print();
            // Cleanup
            setTimeout(() => {
                root.unmount();
                document.body.removeChild(printMountPoint);
                setIsPrinting(false);
            }, 500);
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">Vehicle Order Form Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableOrderForm {...{ saleVehicle, vehicle, buyer, entity, taxRates }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">
                        * Ensure "Headers and Footers" are turned OFF in your browser print settings for best results.
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePrint} 
                            disabled={isPrinting}
                            className="flex items-center py-2 px-6 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isPrinting ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Printer size={16} className="mr-2" />}
                            Print Order Form
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default VehicleOrderFormModal;

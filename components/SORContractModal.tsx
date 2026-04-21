import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, Customer, BusinessEntity } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

const PrintableContract: React.FC<{
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    entity?: BusinessEntity;
}> = ({ saleVehicle, vehicle, owner, entity }) => {
    const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId);
    const listPrice = activeVersion?.listPrice || 0;
    const returnPrice = activeVersion?.sorReturnPrice || 0;

    return (
        <PrintableDocumentLayout
            entity={entity}
            title="SALE OR RETURN AGREEMENT"
            subtitle={`Vehicle: ${vehicle?.registration}`}
        >
            <div className="space-y-8 py-4 text-xs">
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '1.5px solid black' }}>
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-2">Vehicle Owner</h3>
                        <p className="font-bold text-base text-gray-900">{owner?.forename} {owner?.surname}</p>
                        <p>{owner?.addressLine1}</p>
                        <p>{owner?.city}, {owner?.postcode}</p>
                        <p className="mt-1">Tel: {owner?.mobile || owner?.phone}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '1.5px solid black' }}>
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-2">Vehicle Details</h3>
                        <p className="font-bold text-base text-gray-900">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-gray-700">Reg: {vehicle?.registration}</p>
                        <p className="text-[10px] mt-1 text-gray-500">VIN: {vehicle?.vin || 'N/A'}</p>
                    </div>
                </section>

                <section className="no-break rounded-lg overflow-hidden" style={{ border: '2px solid black' }}>
                    <h3 className="bg-gray-900 text-white text-[10px] font-black px-4 py-1.5 uppercase" style={{ borderBottom: '2px solid black' }}>Agreed Financial Terms</h3>
                    <div className="p-4 grid grid-cols-2 gap-y-4">
                        <div className="font-bold text-gray-700">Agreed List Price for Marketing:</div>
                        <div className="text-right font-black text-lg text-indigo-700">{formatCurrency(listPrice)}</div>

                        <div className="font-bold text-gray-700">Agreed Return Price to Owner (Before Prep):</div>
                        <div className="text-right font-black text-lg text-indigo-700">{formatCurrency(returnPrice)}</div>
                    </div>
                </section>

                <section className="no-break bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-[10px] font-black text-blue-800 uppercase mb-1 italic">Insurance & SORN Notice</h4>
                    <p className="text-[10px] text-blue-700 leading-tight">
                        While your vehicle is in our care, it is comprehensively insured under our Motor Trade policy.
                        You may wish to inform your insurer and potentially suspend your private policy.
                        Declaring the vehicle SORN with the DVLA can pause your road tax obligation.
                        Please consult your insurance provider before making changes.
                    </p>
                </section>

                <section className="no-break pt-4">
                    <h3 className="text-[10px] font-black text-gray-900 uppercase border-b-2 border-gray-900 pb-1 mb-4">Terms & Conditions</h3>
                    <div className="text-[9px] text-gray-600 leading-relaxed whitespace-pre-wrap columns-2 gap-8">
                        {entity?.sorTermsAndConditions || 'Terms and conditions apply as per dealership policy.'}
                    </div>
                </section>

                <section className="no-break pt-12">
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div className="border-b border-gray-400 h-8"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Owner Signature</p>
                        </div>
                        <div className="space-y-6">
                            <div className="border-b border-gray-400 h-8"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">For {entity?.name}</p>
                        </div>
                    </div>
                </section>
            </div>
        </PrintableDocumentLayout>
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
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableContract {...{ saleVehicle, vehicle, owner, entity }} />
            </React.StrictMode>
        );

        setTimeout(() => {
            window.print();
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
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">SOR Agreement Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableContract {...{ saleVehicle, vehicle, owner, entity }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">* Turn off browser headers/footers for a cleaner print.</div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="flex items-center py-2 px-6 bg-amber-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isPrinting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Printer size={16} className="mr-2" />}
                            Print Agreement
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SORContractModal;
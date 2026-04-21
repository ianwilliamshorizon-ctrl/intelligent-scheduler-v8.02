import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, SalePrepCost } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

const PrintableOwnerStatement: React.FC<{
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    entity?: BusinessEntity;
    financials: any;
    isFinal: boolean;
}> = ({ saleVehicle, vehicle, owner, entity, financials, isFinal }) => {
    return (
        <PrintableDocumentLayout
            entity={entity}
            title={isFinal ? "FINAL SALE STATEMENT" : "PROVISIONAL SALE STATEMENT"}
            subtitle={`Vehicle: ${vehicle?.registration}`}
        >
            <div className="space-y-8 py-4 text-xs">
                <section className="grid grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ border: '1.5px solid black' }}>
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-2">Vehicle Owner</h3>
                        <p className="font-bold text-base text-gray-900">{owner?.forename} {owner?.surname}</p>
                        <p>{owner?.addressLine1}</p>
                        <p>{owner?.city}, {owner?.postcode}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-right" style={{ border: '1.5px solid black' }}>
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-2">Vehicle Details</h3>
                        <p className="font-bold text-base text-gray-900">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-gray-700">Reg: {vehicle?.registration}</p>
                    </div>
                </section>

                <section className="no-break p-4" style={{ border: '2px solid black', borderRadius: '8px' }}>
                    <h3 className="text-[10px] font-black text-gray-900 uppercase border-b-2 border-black pb-1 mb-4">Payout Calculation</h3>
                    {isFinal && (
                        <div className="flex justify-between font-bold text-gray-600">
                            <span>Final Sale Price Achieved</span>
                            <span>{formatCurrency(financials.finalSalePrice)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-black text-lg text-gray-900 py-1 border-b">
                        <span>Agreed Return Price</span>
                        <span>{formatCurrency(financials.baseReturn)}</span>
                    </div>

                    <div className="pt-4">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Less Agreed Preparation Costs</h4>
                        <div className="space-y-1">
                            {saleVehicle.prepCosts.length > 0 ? (
                                saleVehicle.prepCosts.map((cost: SalePrepCost) => (
                                    <div key={cost.id} className="flex justify-between text-gray-600 italic pl-4">
                                        <span>{cost.description}</span>
                                        <span className="text-red-700">({formatCurrency(cost.cost)})</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 italic pl-4">No preparation costs recorded.</p>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 border-t mt-2 pt-1 pl-4">
                                <span>Total Deductions</span>
                                <span className="text-red-700">({formatCurrency(financials.prepCosts)})</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-gray-900 text-white rounded-xl shadow-lg flex justify-between items-center no-break">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Amount Payable</p>
                            <h3 className="text-2xl font-black">{isFinal ? 'FINAL PAYOUT' : 'PROVISIONAL PAYOUT'}</h3>
                        </div>
                        <div className="text-4xl font-black">
                            {formatCurrency(financials.returnToCustomer)}
                        </div>
                    </div>
                </section>

                <section className="no-break mt-12 p-4 border rounded-lg border-gray-200 bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">
                        This statement is for informational purposes. All final figures are subject to vehicle collection and final inspection.
                        Payments are usually processed within 5 working days of vehicle handover.
                    </p>
                </section>
            </div>
        </PrintableDocumentLayout>
    );
};

interface OwnerStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    entity?: BusinessEntity;
}

const OwnerStatementModal: React.FC<OwnerStatementModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, owner, entity }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    const financialSummary = useMemo(() => {
        if (!saleVehicle) return {};
        const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId) || saleVehicle.versions?.[0];
        if (!activeVersion) return {};

        const prepCosts = saleVehicle.prepCosts.reduce((sum, cost) => sum + cost.cost, 0);
        const finalSalePrice = saleVehicle.finalSalePrice || activeVersion.listPrice || 0;
        const baseReturn = activeVersion.sorReturnPrice || 0;
        const returnToCustomer = baseReturn - prepCosts;

        return { prepCosts, finalSalePrice, baseReturn, returnToCustomer };
    }, [saleVehicle]);

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableOwnerStatement
                    saleVehicle={saleVehicle}
                    vehicle={vehicle}
                    owner={owner}
                    entity={entity}
                    financials={financialSummary}
                    isFinal={saleVehicle.status === 'Sold'}
                />
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
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">Owner Statement Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableOwnerStatement
                            saleVehicle={saleVehicle}
                            vehicle={vehicle}
                            owner={owner}
                            entity={entity}
                            financials={financialSummary}
                            isFinal={saleVehicle.status === 'Sold'}
                        />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">* Professional Payout Statement.</div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="flex items-center py-2 px-6 bg-amber-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isPrinting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Printer size={16} className="mr-2" />}
                            Print Statement
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default OwnerStatementModal;


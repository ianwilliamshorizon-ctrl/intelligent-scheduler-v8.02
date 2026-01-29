import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, SalePrepCost, SaleVersion } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const PrintableOwnerStatement: React.FC<{
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    entity?: BusinessEntity;
    financials: any;
    isFinal: boolean;
}> = ({ saleVehicle, vehicle, owner, entity, financials, isFinal }) => {
    return (
        <div className="bg-white font-sans text-sm text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
            {/* Header */}
            <header className="pb-6 border-b">
                <div style={{ marginBottom: '5mm' }}>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-gray-800">{isFinal ? 'FINAL SALE STATEMENT' : 'CURRENT SALE STATEMENT'}</h2>
                    <p>For Vehicle: {vehicle?.registration}</p>
                    <p className="mt-2">Date: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </header>
            {/* Main Content */}
            <main className="space-y-4 flex-grow my-6">
                <section className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Owner</h3>
                        <p className="font-bold text-gray-800">{owner?.forename} {owner?.surname}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                    </div>
                </section>
                <section className="mt-6">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 border-b pb-1">Owner Payout Calculation</h3>
                    <div className="space-y-1 text-sm">
                        {isFinal && (
                            <div className="grid grid-cols-2 gap-x-4">
                                <p>Final Sale Price Achieved</p><p className="text-right">{formatCurrency(financials.finalSalePrice)}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4">
                            <p>Agreed Return Price</p><p className="text-right">{formatCurrency(financials.baseReturn)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 mt-2">
                            <p className="text-gray-600 col-span-2 font-semibold">Less Agreed Preparation Costs:</p>
                        </div>
                        {saleVehicle.prepCosts.length > 0 ? (
                            saleVehicle.prepCosts.map((cost: SalePrepCost) => (
                                <div key={cost.id} className="grid grid-cols-2 gap-x-4 text-xs pl-4">
                                    <p className="text-gray-500">{cost.description}</p>
                                    <p className="text-right text-red-600">({formatCurrency(cost.cost)})</p>
                                </div>
                            ))
                        ) : (
                            <div className="grid grid-cols-2 gap-x-4 text-xs pl-4">
                                <p className="text-gray-500">No preparation costs recorded.</p>
                                <p className="text-right text-red-600">({formatCurrency(0)})</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold text-gray-600">
                            <p>Total Preparation Costs</p><p className="text-right text-red-600">({formatCurrency(financials.prepCosts)})</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 border-t-2 mt-2 pt-2 font-bold text-lg">
                            <p>{isFinal ? 'Final Payment to Owner' : 'Provisional Payment to Owner'}</p>
                            <p className="text-right">{formatCurrency(financials.returnToCustomer)}</p>
                        </div>
                    </div>
                </section>
            </main>
            {/* Footer */}
            <footer className="mt-auto pt-4 border-t text-center text-xs text-gray-500">
                <p>This is not a VAT invoice. All figures are for statement purposes only.</p>
            </footer>
        </div>
    );
};

interface OwnerStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    buyer?: Customer; // passed but not used here
    entity?: BusinessEntity;
}

const OwnerStatementModal: React.FC<OwnerStatementModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, owner, entity }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.getElementById('print-mount-point');
        if (!printMountPoint) {
            setIsGeneratingPdf(false);
            return;
        }

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

        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`Owner_Statement_${vehicle?.registration}.pdf`);
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
                     <h2 className="text-xl font-bold text-indigo-700">Owner Statement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
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

export default OwnerStatementModal;

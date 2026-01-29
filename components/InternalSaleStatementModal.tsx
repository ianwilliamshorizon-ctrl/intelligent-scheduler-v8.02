import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, BusinessEntity, SalePrepCost, SaleUpsell, SaleOverhead, SaleNonRecoverableCost, SaleVersion } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const PrintableInternalStatement: React.FC<{
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    entity?: BusinessEntity;
    financials: any;
}> = ({ saleVehicle, vehicle, entity, financials }) => {
    const isSold = saleVehicle.status === 'Sold';
    return (
        <div className="bg-white font-sans text-xs text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
            <header className="pb-4 border-b mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{entity?.name}</h1>
                <h2 className="text-lg font-semibold text-gray-700">Internal Sales Statement</h2>
                <p className="text-sm text-gray-600">Statement generated on {new Date().toLocaleDateString('en-GB')}</p>
            </header>
            <main>
                <section className="mb-6">
                    <div className="grid grid-cols-2 gap-x-8 p-4 bg-gray-50 rounded-lg border">
                        <div>
                            <p className="font-bold text-base">{vehicle?.make} {vehicle?.model}</p>
                            <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                        </div>
                        <div className="text-right">
                            <p>Sale Type: <span className="font-semibold">{saleVehicle.saleType}</span></p>
                            <p>Status: <span className="font-semibold">{saleVehicle.status}</span></p>
                        </div>
                    </div>
                </section>
                <section>
                    <h3 className="font-bold text-lg text-gray-800 mb-2 border-b pb-1">Financial Breakdown</h3>
                    <div className="grid grid-cols-2 gap-x-8">
                        <div>
                            <h4 className="font-semibold text-base mb-2">Revenue</h4>
                            <div className="space-y-1 text-xs border p-3 rounded-lg">
                                <div className="flex justify-between font-semibold">
                                    <span>{isSold ? 'Final Sale Price' : 'List Price'}</span>
                                    <span>{formatCurrency(financials.finalSalePrice)}</span>
                                </div>
                                {saleVehicle.upsells.map((u: SaleUpsell) => (
                                    <div key={u.id} className="flex justify-between">
                                        <span className="text-gray-600 pl-2">Upsell: {u.description}</span>
                                        <span>{formatCurrency(u.salePrice)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold border-t mt-1 pt-1 text-sm">
                                    <span>Total Revenue</span>
                                    <span>{formatCurrency(financials.totalRevenue)}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-2">Costs</h4>
                            <div className="space-y-1 text-xs border p-3 rounded-lg text-red-700">
                                <div className="flex justify-between font-semibold">
                                    <span>{saleVehicle.saleType === 'Stock' ? 'Vehicle Purchase Price' : 'Return to Owner (After Prep)'}</span>
                                    <span>({formatCurrency(financials.baseVehicleCost)})</span>
                                </div>
                                {(saleVehicle.upsells || []).map((u: SaleUpsell) => (
                                     <div key={u.id} className="flex justify-between">
                                        <span className="text-gray-600 pl-2">Upsell Cost: {u.description}</span>
                                        <span>({formatCurrency(u.costPrice)})</span>
                                    </div>
                                ))}
                                {(saleVehicle.nonRecoverableCosts || []).map((nc: SaleNonRecoverableCost) => (
                                     <div key={nc.id} className="flex justify-between">
                                        <span className="text-gray-600 pl-2">{nc.description}</span>
                                        <span>({formatCurrency(nc.cost)})</span>
                                    </div>
                                ))}
                                {(saleVehicle.overheads || []).map((o: SaleOverhead) => (
                                     <div key={o.id} className="flex justify-between">
                                        <span className="text-gray-600 pl-2">Overhead: {o.description}</span>
                                        <span>({formatCurrency(o.cost)})</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold border-t mt-1 pt-1 text-sm">
                                    <span>Total Direct & Indirect Costs</span>
                                    <span>({formatCurrency(financials.totalAllCosts)})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t-2">
                         <div className="w-1/2 ml-auto space-y-1 text-sm">
                            <div className="flex justify-between font-semibold">
                                <span>Gross Profit</span>
                                <span>{formatCurrency(financials.grossProfit)}</span>
                            </div>
                             <div className="flex justify-between text-gray-600">
                                <span>Less: VAT on Margin (Est.)</span>
                                <span className="text-red-700">({formatCurrency(financials.vatOnMargin)})</span>
                            </div>
                            <div className={`flex justify-between font-bold text-lg border-t mt-1 pt-1 ${financials.netSalesProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                <span>Estimated Net Profit</span>
                                <span>{formatCurrency(financials.netSalesProfit)}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

interface InternalSaleStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    entity?: BusinessEntity;
}

const InternalSaleStatementModal: React.FC<InternalSaleStatementModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, entity }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const financialSummary = useMemo(() => {
        if (!saleVehicle) return {};
        const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId) || saleVehicle.versions?.[0];
        if (!activeVersion) return {};
    
        const prepCostsTotal = saleVehicle.prepCosts.reduce((sum, cost) => sum + cost.cost, 0);
        const upsellCostsTotal = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.costPrice, 0);
        const upsellRevenueTotal = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.salePrice, 0);
        const totalOverheads = saleVehicle.overheads.reduce((sum, overhead) => sum + overhead.cost, 0);
        const totalNonRecoverableCosts = (saleVehicle.nonRecoverableCosts || []).reduce((sum, cost) => sum + cost.cost, 0);
        const finalSalePrice = saleVehicle.status === 'Sold' ? (saleVehicle.finalSalePrice || activeVersion.listPrice) : activeVersion.listPrice;
        
        const totalRevenue = finalSalePrice + upsellRevenueTotal;
        
        let grossProfit = 0;
        let baseVehicleCost = 0; // The primary cost of the car itself

        if (saleVehicle.saleType === 'Sale or Return') {
            baseVehicleCost = (activeVersion.sorReturnPrice || 0) - prepCostsTotal; // Final payout to owner is the core cost
            grossProfit = totalRevenue - baseVehicleCost - upsellCostsTotal - totalNonRecoverableCosts;
        } else { // Stock
            baseVehicleCost = (saleVehicle.purchasePrice || 0) + prepCostsTotal;
            grossProfit = totalRevenue - baseVehicleCost - upsellCostsTotal - totalNonRecoverableCosts;
        }

        const totalAllCosts = baseVehicleCost + upsellCostsTotal + totalNonRecoverableCosts + totalOverheads;
    
        const vatOnMargin = grossProfit > 0 ? grossProfit / 6 : 0;
        const netSalesProfit = grossProfit - vatOnMargin - totalOverheads;
    
        return { 
            finalSalePrice, totalRevenue, baseVehicleCost, totalAllCosts,
            grossProfit, totalOverheads, vatOnMargin, netSalesProfit 
        };
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
                <PrintableInternalStatement saleVehicle={saleVehicle} vehicle={vehicle} entity={entity} financials={financialSummary} />
            </React.StrictMode>
        );
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`Internal_Statement_${saleVehicle.id}.pdf`);
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
                     <h2 className="text-xl font-bold text-indigo-700">Internal Sales Statement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                         <PrintableInternalStatement saleVehicle={saleVehicle} vehicle={vehicle} entity={entity} financials={financialSummary} />
                    </div>
                </main>
                 <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div></div>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                        </button>
                        <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                    </div>
                 </footer>
            </div>
        </div>
    );
};

export default InternalSaleStatementModal;

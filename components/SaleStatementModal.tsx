import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, SalePrepCost, SaleUpsell } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

const PrintableStatement: React.FC<any> = ({ saleVehicle, vehicle, owner, buyer, entity, financialSummary }) => {

    const renderStockBreakdown = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 text-sm">
                <p>Final Sale Price</p><p className="text-right font-bold">{formatCurrency(financialSummary.finalSalePrice)}</p>
                <p>Upsell Revenue</p><p className="text-right font-bold">{formatCurrency(financialSummary.upsellRevenue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 border-t-2 border-gray-900 mt-1 pt-1 font-black text-lg">
                <p>Total Revenue</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice + financialSummary.upsellRevenue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 mt-4 text-gray-700 bg-gray-50 p-3 rounded-lg border">
                <p>Vehicle Cost (Purchase + Prep)</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalVehicleCost)})</p>
                <p>Upsell Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.upsellCosts)})</p>
                <p>Non-recoverable Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalNonRecoverableCosts)})</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-bold text-gray-900">
                <p>Gross Profit</p><p className="text-right">{formatCurrency(financialSummary.grossProfit)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 mt-3 text-gray-500 italic">
                <p>Less: VAT on Margin (Est.)</p><p className="text-right">({formatCurrency(financialSummary.vatOnMargin)})</p>
                <p>Less: Overheads</p><p className="text-right">({formatCurrency(financialSummary.totalOverheads)})</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 border-t-4 border-double mt-4 pt-2 font-black text-2xl text-green-700">
                <p>Net Profit</p><p className="text-right">{formatCurrency(financialSummary.netSalesProfit)}</p>
            </div>
        </div>
    );

    const renderSoRBreakdown = () => (
        <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
                <h4 className="text-sm font-black text-indigo-900 uppercase mb-4 tracking-widest">Payout to Owner</h4>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold text-indigo-700">Agreed Return Price</span>
                        <span className="font-black text-indigo-900">{formatCurrency(financialSummary.baseReturn)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                        <span className="font-semibold">Less: Preparation Costs</span>
                        <span className="font-black">({formatCurrency(financialSummary.prepCosts)})</span>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-indigo-400 pt-4 mt-2 text-2xl font-black text-indigo-900">
                        <span>FINAL PAYMENT TO OWNER</span>
                        <span>{formatCurrency(financialSummary.returnToCustomer)}</span>
                    </div>
                </div>
            </div>

            <div className="page-break-before pt-8">
                <h4 className="text-sm font-black text-gray-800 uppercase mb-4 border-b pb-2">Dealership Profit Calculation</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <p>Sale Price</p><p className="text-right font-bold">{formatCurrency(financialSummary.finalSalePrice)}</p>
                    <p>Upsell Revenue</p><p className="text-right font-bold">{formatCurrency(financialSummary.upsellRevenue)}</p>
                    <div className="col-span-2 border-t mt-1 pt-1 flex justify-between font-bold">
                        <span>Total Revenue</span><span>{formatCurrency(financialSummary.finalSalePrice + financialSummary.upsellRevenue)}</span>
                    </div>
                    <p className="text-gray-500 mt-2 italic">Less: Payment to Owner</p><p className="text-right text-red-600 mt-2">({formatCurrency(financialSummary.returnToCustomer)})</p>
                    <p className="text-gray-500 italic">Less: Upsell Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.upsellCosts)})</p>
                    <p className="text-gray-500 italic">Less: Non-recoverable Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalNonRecoverableCosts)})</p>
                    <div className="col-span-2 border-t mt-1 pt-1 flex justify-between font-bold">
                        <span>Gross Profit</span><span>{formatCurrency(financialSummary.grossProfit)}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">VAT on Margin (Est.)</p><p className="text-right text-gray-400 text-xs mt-1">({formatCurrency(financialSummary.vatOnMargin)})</p>
                    <p className="text-gray-400 text-xs">Overheads</p><p className="text-right text-gray-400 text-xs">({formatCurrency(financialSummary.totalOverheads)})</p>
                    <div className="col-span-2 border-t-2 mt-2 pt-2 flex justify-between font-black text-xl text-green-700 uppercase tracking-tight">
                        <span>Estimated Net Profit</span><span>{formatCurrency(financialSummary.netSalesProfit)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <PrintableDocumentLayout
            entity={entity}
            title="SALES STATEMENT"
            subtitle={`Vehicle: ${vehicle?.registration} • ${saleVehicle?.saleType}`}
        >
            <div className="space-y-8 py-4">
                <section className="grid grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-3 rounded border">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-1">Vehicle</h3>
                        <p className="font-bold text-gray-900">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-xs text-gray-700">{vehicle?.registration}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-1">{saleVehicle?.saleType === 'Stock' ? 'Stock Source' : 'Seller'}</h3>
                        {saleVehicle?.saleType === 'Stock' ? (
                            <p className="font-bold text-gray-900">{entity?.name}</p>
                        ) : (
                            <>
                                <p className="font-bold text-gray-900">{owner?.forename} {owner?.surname}</p>
                                <p className="text-[10px] text-gray-600 truncate">{owner?.addressLine1}</p>
                            </>
                        )}
                    </div>
                    <div className="bg-gray-50 p-3 rounded border">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase mb-1">Buyer</h3>
                        <p className="font-bold text-gray-900">{buyer?.forename} {buyer?.surname}</p>
                        <p className="text-[10px] text-gray-600 truncate">{buyer?.addressLine1}</p>
                    </div>
                </section>

                <section className="no-break">
                    <h3 className="text-sm font-black text-gray-900 border-b-2 border-indigo-600 pb-1 mb-4">Financial Breakdown</h3>
                    {saleVehicle.saleType === 'Stock' ? renderStockBreakdown() : renderSoRBreakdown()}
                </section>

                <section className="no-break">
                    <h3 className="text-sm font-black text-gray-900 border-b-2 border-indigo-600 pb-1 mb-4">Preparation Costs Included</h3>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {(saleVehicle.prepCosts || []).map((cost: SalePrepCost) => (
                            <div key={cost.id} className="flex justify-between border-b pb-1">
                                <span className="text-gray-600 truncate mr-4">{cost.description}</span>
                                <span className="font-bold">{formatCurrency(cost.cost)}</span>
                            </div>
                        ))}
                        {(!saleVehicle.prepCosts || saleVehicle.prepCosts.length === 0) && <p className="col-span-2 text-gray-400 italic">No prep costs recorded.</p>}
                    </div>
                </section>
            </div>
        </PrintableDocumentLayout>
    );
};

interface SaleStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    owner?: Customer;
    buyer?: Customer;
    entity?: BusinessEntity;
}

const SaleStatementModal: React.FC<SaleStatementModalProps> = ({ isOpen, onClose, saleVehicle, vehicle, owner, buyer, entity }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    const financialSummary = useMemo(() => {
        if (!saleVehicle) return {};
        const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId) || saleVehicle.versions?.[saleVehicle.versions.length - 1];
        if (!activeVersion) return {};

        const prepCosts = saleVehicle.prepCosts.reduce((sum, cost) => sum + cost.cost, 0);
        const upsellCosts = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.costPrice, 0);
        const upsellRevenue = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.salePrice, 0);
        const totalOverheads = saleVehicle.overheads.reduce((sum, overhead) => sum + overhead.cost, 0);
        const totalNonRecoverableCosts = (saleVehicle.nonRecoverableCosts || []).reduce((sum, cost) => sum + cost.cost, 0);
        const finalSalePrice = saleVehicle.finalSalePrice || 0;

        let grossProfit = 0;
        let returnToCustomer = 0;
        let baseReturn = 0;
        let totalVehicleCost = 0;
        const purchasePrice = saleVehicle.purchasePrice || 0;

        if (saleVehicle.saleType === 'Sale or Return') {
            baseReturn = activeVersion.sorReturnPrice || 0;
            returnToCustomer = baseReturn - prepCosts;
            grossProfit = (finalSalePrice + upsellRevenue) - (returnToCustomer + upsellCosts + totalNonRecoverableCosts);
        } else { // Stock
            totalVehicleCost = purchasePrice + prepCosts;
            const totalDealCost = totalVehicleCost + upsellCosts + totalNonRecoverableCosts;
            grossProfit = (finalSalePrice + upsellRevenue) - totalDealCost;
        }

        const vatOnMargin = grossProfit > 0 ? grossProfit / 6 : 0;
        const netSalesProfit = grossProfit - vatOnMargin - totalOverheads;

        return { prepCosts, upsellRevenue, upsellCosts, returnToCustomer, grossProfit, totalOverheads, vatOnMargin, netSalesProfit, finalSalePrice, baseReturn, purchasePrice, totalVehicleCost, totalNonRecoverableCosts };
    }, [saleVehicle]);

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableStatement {...{ saleVehicle, vehicle, owner, buyer, entity, financialSummary }} />
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">Sales Statement Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableStatement {...{ saleVehicle, vehicle, owner, buyer, entity, financialSummary }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">* Turn off headers/footers in browser print settings.</div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="flex items-center py-2 px-6 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
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

export default SaleStatementModal;
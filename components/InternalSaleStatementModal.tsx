import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { SaleVehicle, Vehicle, BusinessEntity, SaleUpsell, SaleNonRecoverableCost, SaleOverhead } from '../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { PrintableDocumentLayout } from './shared/PrintableDocumentLayout';

const PrintableInternalStatement: React.FC<{
    saleVehicle: SaleVehicle;
    vehicle?: Vehicle;
    entity?: BusinessEntity;
    financials: any;
}> = ({ saleVehicle, vehicle, entity, financials }) => {
    const isSold = saleVehicle.status === 'Sold';
    return (
        <PrintableDocumentLayout
            entity={entity}
            title="INTERNAL SALES STATEMENT"
            subtitle={`Vehicle: ${vehicle?.registration} • ${saleVehicle.saleType}`}
        >
            <div className="space-y-8 py-4 text-xs">
                <section
                    className="grid grid-cols-2 gap-x-8 p-4 bg-gray-50 rounded-lg"
                    style={{ border: '2px solid black' }}
                >
                    <div>
                        <p className="font-bold text-base text-gray-900">{vehicle?.make} {vehicle?.model}</p>
                        <p className="font-mono text-gray-600">Reg: {vehicle?.registration}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-500 uppercase tracking-tighter">Status</p>
                        <p className="font-black text-indigo-700 text-lg uppercase">{saleVehicle.status}</p>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-black text-gray-900 uppercase border-b-2 border-black print-border-b pb-1">Revenue</h3>
                        <div
                            className="space-y-1 bg-white p-3 rounded-lg"
                            style={{ border: '2px solid black' }}
                        >
                            <div className="flex justify-between font-bold text-gray-800">
                                <span>{isSold ? 'Final Sale Price' : 'List Price'}</span>
                                <span>{formatCurrency(financials.finalSalePrice)}</span>
                            </div>
                            {saleVehicle.upsells.map((u: SaleUpsell) => (
                                <div key={u.id} className="flex justify-between text-gray-500 italic">
                                    <span>Upsell: {u.description}</span>
                                    <span>{formatCurrency(u.salePrice)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-black border-t mt-1 pt-1 text-sm text-gray-900">
                                <span>Total Revenue</span>
                                <span>{formatCurrency(financials.totalRevenue)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-black text-gray-900 uppercase border-b-2 border-black print-border-b pb-1">Costs</h3>
                        <div
                            className="space-y-1 bg-white p-3 rounded-lg text-red-700"
                            style={{ border: '2px solid black' }}
                        >
                            <div className="flex justify-between font-bold">
                                <span>{saleVehicle.saleType === 'Stock' ? 'Vehicle Purchase + Prep' : 'Payout to Owner'}</span>
                                <span>({formatCurrency(financials.baseVehicleCost)})</span>
                            </div>
                            {(saleVehicle.upsells || []).map((u: SaleUpsell) => (
                                <div key={u.id} className="flex justify-between text-red-500 italic">
                                    <span>Upsell Cost: {u.description}</span>
                                    <span>({formatCurrency(u.costPrice)})</span>
                                </div>
                            ))}
                            {(saleVehicle.nonRecoverableCosts || []).map((nc: SaleNonRecoverableCost) => (
                                <div key={nc.id} className="flex justify-between text-red-500">
                                    <span>{nc.description}</span>
                                    <span>({formatCurrency(nc.cost)})</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-black border-t mt-1 pt-1 text-sm text-red-800">
                                <span>Total Direct Costs</span>
                                <span>({formatCurrency(financials.totalAllCosts - financials.totalOverheads)})</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="no-break border-t-2 pt-6">
                    <div
                        className="w-1/2 ml-auto space-y-2 bg-gray-50 p-4 rounded-xl"
                        style={{ border: '3px solid black' }}
                    >
                        <div className="flex justify-between font-bold text-gray-700">
                            <span>Gross Profit</span>
                            <span>{formatCurrency(financials.grossProfit)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400 italic">
                            <span>VAT on Margin (Est.)</span>
                            <span>({formatCurrency(financials.vatOnMargin)})</span>
                        </div>
                        <div className="flex justify-between text-gray-400 italic">
                            <span>Overheads</span>
                            <span>({formatCurrency(financials.totalOverheads)})</span>
                        </div>
                        <div className={`flex justify-between font-black text-2xl border-t-2 mt-2 pt-2 ${financials.netSalesProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            <span>NET PROFIT</span>
                            <span>{formatCurrency(financials.netSalesProfit)}</span>
                        </div>
                    </div>
                </section>

                <section className="no-break mt-8 p-4 border rounded-lg border-amber-200 bg-amber-50">
                    <h4 className="text-[10px] font-black text-amber-800 uppercase mb-2">Internal Note</h4>
                    <p className="text-[10px] text-amber-700 leading-tight">
                        This document is for internal dealership use only. It contains sensitive financial data including purchase costs, preparation overheads, and margin calculations.
                        Do not share with external parties or customers.
                    </p>
                </section>
            </div>
        </PrintableDocumentLayout>
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
    const [isPrinting, setIsPrinting] = useState(false);

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
        let baseVehicleCost = 0;

        if (saleVehicle.saleType === 'Sale or Return') {
            baseVehicleCost = (activeVersion.sorReturnPrice || 0) - prepCostsTotal;
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

    const handlePrint = () => {
        setIsPrinting(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.id = 'print-mount-point-wrapper';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableInternalStatement saleVehicle={saleVehicle} vehicle={vehicle} entity={entity} financials={financialSummary} />
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
                    <h2 className="text-xl font-bold text-indigo-700 uppercase tracking-tight">Internal Statement Preview</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                    <div className="shadow-2xl mx-auto" style={{ width: '210mm' }}>
                        <PrintableInternalStatement saleVehicle={saleVehicle} vehicle={vehicle} entity={entity} financials={financialSummary} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 italic">* Confidental: Internal Use Only.</div>
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

export default InternalSaleStatementModal;


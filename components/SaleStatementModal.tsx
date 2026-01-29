import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, Customer, BusinessEntity, SalePrepCost } from '../types';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const PrintableStatement: React.FC<any> = ({ saleVehicle, vehicle, owner, buyer, entity, financialSummary }) => {
    
    const renderStockBreakdown = () => (
        <>
            <div className="grid grid-cols-2 gap-x-4">
                <p>Final Sale Price</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice)}</p>
                <p>Upsell Revenue</p><p className="text-right">{formatCurrency(financialSummary.upsellRevenue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold">
                <p>Total Revenue</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice + financialSummary.upsellRevenue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 mt-3">
                <p className="text-gray-600">Less: Vehicle Cost (Purchase + Prep)</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalVehicleCost)})</p>
                <p className="text-gray-600">Less: Upsell Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.upsellCosts)})</p>
                <p className="text-gray-600">Less: Non-recoverable Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalNonRecoverableCosts)})</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold">
                <p>Gross Profit</p><p className="text-right">{formatCurrency(financialSummary.grossProfit)}</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 mt-3">
                 <p className="text-gray-600">Less: VAT on Margin (Est.)</p><p className="text-right text-red-600">({formatCurrency(financialSummary.vatOnMargin)})</p>
                <p className="text-gray-600">Less: Overheads</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalOverheads)})</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t-2 mt-2 pt-2 font-bold text-lg text-green-700">
                <p>Estimated Net Profit</p><p className="text-right">{formatCurrency(financialSummary.netSalesProfit)}</p>
            </div>
        </>
    );

    const renderSoRBreakdown = () => (
        <>
            <div className="grid grid-cols-2 gap-x-4">
                <p>Final Sale Price</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice)}</p>
                <p className="text-gray-600">Less: Agreed Prep Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.prepCosts)})</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold">
                <p>Amount after Prep</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice - financialSummary.prepCosts)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 border-t-2 mt-2 pt-2 font-bold text-lg">
                <p>Payment to Owner</p><p className="text-right">{formatCurrency(financialSummary.returnToCustomer)}</p>
            </div>

            <h4 className="font-bold text-gray-800 mt-6 mb-2 border-b pb-1">Dealership Profit Calculation</h4>
            <div className="grid grid-cols-2 gap-x-4">
                <p>Sale Price</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice)}</p>
                <p>Upsell Revenue</p><p className="text-right">{formatCurrency(financialSummary.upsellRevenue)}</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold">
                <p>Total Revenue</p><p className="text-right">{formatCurrency(financialSummary.finalSalePrice + financialSummary.upsellRevenue)}</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 mt-3">
                 <p className="text-gray-600">Less: Payment to Owner</p><p className="text-right text-red-600">({formatCurrency(financialSummary.returnToCustomer)})</p>
                <p className="text-gray-600">Less: Upsell Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.upsellCosts)})</p>
                <p className="text-gray-600">Less: Non-recoverable Costs</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalNonRecoverableCosts)})</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t mt-1 pt-1 font-semibold">
                <p>Gross Profit</p><p className="text-right">{formatCurrency(financialSummary.grossProfit)}</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 mt-3">
                 <p className="text-gray-600">Less: VAT on Margin (Est.)</p><p className="text-right text-red-600">({formatCurrency(financialSummary.vatOnMargin)})</p>
                <p className="text-gray-600">Less: Overheads</p><p className="text-right text-red-600">({formatCurrency(financialSummary.totalOverheads)})</p>
            </div>
             <div className="grid grid-cols-2 gap-x-4 border-t-2 mt-2 pt-2 font-bold text-lg text-green-700">
                <p>Estimated Net Profit</p><p className="text-right">{formatCurrency(financialSummary.netSalesProfit)}</p>
            </div>
        </>
    );
    
    return (
        <div className="bg-white font-sans text-sm text-gray-800" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
            <header className="flex justify-between items-start pb-6 border-b">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                    <p>{entity?.addressLine1}</p>
                    <p>{entity?.city}, {entity?.postcode}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-semibold text-gray-800">SALES STATEMENT</h2>
                    <p>Ref: {saleVehicle?.id}</p>
                    <p className="mt-2">Date: {saleVehicle?.soldDate}</p>
                </div>
            </header>
            <main className="space-y-4 flex-grow my-6">
                <section className="grid grid-cols-3 gap-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle</h3>
                        <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                        <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                        <p>VIN: <span className="font-mono text-xs">{vehicle?.vin}</span></p>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">{saleVehicle?.saleType === 'Stock' ? 'Dealership Stock' : 'Seller'}</h3>
                        {saleVehicle?.saleType === 'Stock' ? (
                            <p className="font-bold text-gray-800">{entity?.name}</p>
                        ) : (
                            <>
                                <p className="font-bold text-gray-800">{owner?.forename} {owner?.surname}</p>
                                <p>{owner?.addressLine1}</p>
                            </>
                        )}
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Buyer</h3>
                        <p className="font-bold text-gray-800">{buyer?.forename} {buyer?.surname}</p>
                        <p>{buyer?.addressLine1}</p>
                    </div>
                </section>
                <section className="mt-6">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 border-b pb-1">Financial Breakdown</h3>
                    {saleVehicle.saleType === 'Stock' ? renderStockBreakdown() : renderSoRBreakdown()}
                </section>
            </main>
            <footer className="mt-auto pt-4 border-t text-center text-xs text-gray-500">
                <p>{entity?.invoiceFooterText}</p>
            </footer>
        </div>
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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
    
    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableStatement {...{ saleVehicle, vehicle, owner, buyer, entity, financialSummary }} />
            </React.StrictMode>
        );

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

            pdf.save(`SaleStatement-${saleVehicle.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try using the 'Print' button and saving as PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                     <h2 className="text-xl font-bold text-indigo-700">Sales Statement</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    {/* Render the printable content directly inside the modal */}
                    <div className="scale-95 origin-top">
                         <PrintableStatement {...{ saleVehicle, vehicle, owner, buyer, entity, financialSummary }} />
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

export default SaleStatementModal;
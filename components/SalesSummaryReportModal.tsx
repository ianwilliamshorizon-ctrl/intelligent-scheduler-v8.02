
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaleVehicle, Vehicle, BusinessEntity, SaleVersion } from '../types';
import { X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

// The printable component
const PrintableReport: React.FC<{ reportData: any, totals: any, entity: BusinessEntity | undefined, startDate: string, endDate: string }> = ({ reportData, totals, entity, startDate, endDate }) => (
    <div className="bg-white font-sans text-xs text-gray-800" style={{ width: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
        <header className="pb-4 border-b mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{entity?.name}</h1>
            <h2 className="text-lg font-semibold text-gray-700">Sales Summary Report</h2>
            <p className="text-sm text-gray-600">Showing 'For Sale' vehicles and sales completed between {startDate} and {endDate}</p>
        </header>
        <main>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-2 border-b">Date / Status</th>
                        <th className="p-2 border-b">Reg</th>
                        <th className="p-2 border-b">Vehicle</th>
                        <th className="p-2 border-b">Type</th>
                        <th className="p-2 border-b text-right">Sale/List Price</th>
                        <th className="p-2 border-b text-right">Total Costs</th>
                        <th className="p-2 border-b text-right">Gross Profit</th>
                        <th className="p-2 border-b text-right">Overheads</th>
                        <th className="p-2 border-b text-right">Est. Net Profit</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map((row: any) => (
                        <tr key={row.saleVehicle.id}>
                            <td className="p-2 border-b">{row.saleVehicle.soldDate || row.saleVehicle.status}</td>
                            <td className="p-2 border-b font-mono">{row.vehicle.registration}</td>
                            <td className="p-2 border-b">{row.vehicle.make} {row.vehicle.model}</td>
                            <td className="p-2 border-b">{row.saleVehicle.saleType === 'Sale or Return' ? 'SOR' : 'Stock'}</td>
                            <td className="p-2 border-b text-right">{formatCurrency(row.financials.finalSalePrice)}</td>
                            <td className="p-2 border-b text-right text-red-600">({formatCurrency(row.financials.totalCosts)})</td>
                            <td className="p-2 border-b text-right font-semibold">{formatCurrency(row.financials.grossProfit)}</td>
                            <td className="p-2 border-b text-right text-red-600">({formatCurrency(row.financials.totalOverheads)})</td>
                            <td className={`p-2 border-b text-right font-bold ${row.financials.netSalesProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(row.financials.netSalesProfit)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                    <tr>
                        <td colSpan={4} className="p-2">Totals</td>
                        <td className="p-2 text-right">{formatCurrency(totals.finalSalePrice)}</td>
                        <td className="p-2 text-right text-red-600">({formatCurrency(totals.totalCosts)})</td>
                        <td className="p-2 text-right">{formatCurrency(totals.grossProfit)}</td>
                        <td className="p-2 text-right text-red-600">({formatCurrency(totals.totalOverheads)})</td>
                        <td className={`p-2 text-right ${totals.netSalesProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totals.netSalesProfit)}</td>
                    </tr>
                </tfoot>
            </table>
        </main>
    </div>
);


const calculateSaleFinancials = (saleVehicle: SaleVehicle) => {
    const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId);
    
    // Fallback for older data or if activeVersionId is somehow invalid
    const versionToUse = activeVersion || saleVehicle.versions?.[saleVehicle.versions.length - 1];

    if (!versionToUse) {
        return { totalCosts: 0, grossProfit: 0, totalOverheads: 0, netSalesProfit: 0, finalSalePrice: 0 };
    }

    const prepCosts = saleVehicle.prepCosts.reduce((sum, cost) => sum + cost.cost, 0);
    const upsellCosts = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.costPrice, 0);
    const upsellRevenue = saleVehicle.upsells.reduce((sum, upsell) => sum + upsell.salePrice, 0);
    const totalOverheads = saleVehicle.overheads.reduce((sum, overhead) => sum + overhead.cost, 0);
    const totalNonRecoverableCosts = (saleVehicle.nonRecoverableCosts || []).reduce((sum, cost) => sum + cost.cost, 0);
    const finalSalePrice = saleVehicle.status === 'Sold' ? (saleVehicle.finalSalePrice || versionToUse.listPrice) : versionToUse.listPrice;
    
    let grossProfit = 0;
    let totalCosts = 0;

    if (saleVehicle.saleType === 'Sale or Return') {
        const baseReturn = versionToUse.sorReturnPrice || 0;
        const returnToCustomer = baseReturn - prepCosts;
        totalCosts = returnToCustomer + upsellCosts + totalNonRecoverableCosts;
        grossProfit = (finalSalePrice + upsellRevenue) - totalCosts;
    } else { // Stock
        const purchasePrice = saleVehicle.purchasePrice || 0;
        const totalVehicleCost = purchasePrice + prepCosts;
        totalCosts = totalVehicleCost + upsellCosts + totalNonRecoverableCosts;
        grossProfit = (finalSalePrice + upsellRevenue) - totalCosts;
    }

    // Simplified VAT calculation on margin, only if profit
    const vatOnMargin = grossProfit > 0 ? grossProfit / 6 : 0; 
    const netSalesProfit = grossProfit - vatOnMargin - totalOverheads;

    return { totalCosts, grossProfit, totalOverheads, netSalesProfit, finalSalePrice };
};

interface SalesSummaryReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleVehicles: SaleVehicle[];
    vehicles: Vehicle[];
    entity?: BusinessEntity;
}

const SalesSummaryReportModal: React.FC<SalesSummaryReportModalProps> = ({ isOpen, onClose, saleVehicles, vehicles, entity }) => {
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), 0, 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

    const reportData = useMemo(() => {
        return saleVehicles
            .filter(sv => 
                (sv.status === 'Sold' && sv.soldDate && sv.soldDate >= startDate && sv.soldDate <= endDate) ||
                sv.status === 'For Sale'
            )
            .map(sv => {
                const vehicle = vehiclesById.get(sv.vehicleId);
                if (!vehicle) return null;
                return {
                    saleVehicle: sv,
                    vehicle,
                    financials: calculateSaleFinancials(sv)
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => {
                // 'For Sale' items come before 'Sold' items
                if (a.saleVehicle.status === 'For Sale' && b.saleVehicle.status === 'Sold') return -1;
                if (a.saleVehicle.status === 'Sold' && b.saleVehicle.status === 'For Sale') return 1;
    
                // If both are 'Sold', sort by soldDate descending (most recent first)
                if (a.saleVehicle.status === 'Sold' && b.saleVehicle.status === 'Sold') {
                    return (b.saleVehicle.soldDate || '').localeCompare(a.saleVehicle.soldDate || '');
                }
    
                // If both are 'For Sale', sort by registration
                return (a.vehicle.registration || '').localeCompare(b.vehicle.registration || '');
            });
    }, [saleVehicles, vehiclesById, startDate, endDate]);

    const totals = useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.finalSalePrice += row.financials.finalSalePrice;
            acc.totalCosts += row.financials.totalCosts;
            acc.grossProfit += row.financials.grossProfit;
            acc.totalOverheads += row.financials.totalOverheads;
            acc.netSalesProfit += row.financials.netSalesProfit;
            return acc;
        }, { finalSalePrice: 0, totalCosts: 0, grossProfit: 0, totalOverheads: 0, netSalesProfit: 0 });
    }, [reportData]);

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableReport reportData={reportData} totals={totals} entity={entity} startDate={startDate} endDate={endDate}/>
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
            const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
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
            
            pdf.save(`Sales_Summary_Report_${formatDate(new Date())}.pdf`);
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Sales Summary Report</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <div className="flex-shrink-0 p-4 bg-gray-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Date Range (for sold vehicles):</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg" />
                        <span>to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg" />
                    </div>
                    <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50">
                        {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                        {isGeneratingPdf ? 'Generating...' : 'Download PDF Report'}
                    </button>
                </div>
                <main className="flex-grow overflow-y-auto p-4">
                    {/* Re-using printable component for preview */}
                    <div className="scale-95 origin-top">
                        <PrintableReport reportData={reportData} totals={totals} entity={entity} startDate={startDate} endDate={endDate} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SalesSummaryReportModal;

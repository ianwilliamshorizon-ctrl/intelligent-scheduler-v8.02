import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PurchaseOrder, Supplier, User, BusinessEntity } from '../types';
import { X, Download, Mail, RefreshCw, Loader2, Info } from 'lucide-react';
import { useData } from '../core/state/DataContext';
import { AppContext } from '../core/state/AppContext';
import EmailPurchaseOrderModal from './EmailPurchaseOrderModal';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../core/config/firebaseConfig';
import { PurchaseOrderPrint } from './PurchaseOrderPrint';

interface PurchaseOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: PurchaseOrder | null;
    onUpdatePO?: (updatedPO: PurchaseOrder) => void;
}

const PDFViewer: React.FC<{ src: string }> = ({ src }) => (
    <iframe src={src} className="w-full h-full" title="Purchase Order Preview" />
);

const VAT_RATE = 0.20; // 20% VAT

export const PurchaseOrderViewModal: React.FC<PurchaseOrderViewModalProps> = ({ isOpen, onClose, purchaseOrder, onUpdatePO }) => {

    const { setPurchaseOrders, suppliers, businessEntities } = useData();
    const appContext = useContext(AppContext);
    const users = appContext?.users ?? [];
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isEmailing, setIsEmailing] = useState(false);
    const [currentPo, setCurrentPo] = useState<PurchaseOrder | null>(purchaseOrder);

    const getUsername = (userId: string) => (users.find(u => u.id === userId) as User)?.name || 'Unknown User';

    const poTotals = useMemo(() => {
        if (!currentPo) return { net: 0, vat: 0, grandTotal: 0 };
        const net = currentPo.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const vat = net * VAT_RATE;
        const grandTotal = net + vat;
        return { net, vat, grandTotal };
    }, [currentPo]);

    const entityDetails = useMemo(() => 
        businessEntities.find(e => e.id === currentPo?.entityId)
    , [businessEntities, currentPo]);

    const lastUpdatedBy = useMemo(() => {
        if (!currentPo?.history?.length) return null;
        const lastEvent = currentPo.history[currentPo.history.length - 1];
        return {
            user: getUsername(lastEvent.userId),
            timestamp: new Date(lastEvent.timestamp).toLocaleString(),
            status: lastEvent.status
        };
    }, [currentPo, users]);

    const generatePurchaseOrderDataUrl = useCallback(async (po: PurchaseOrder, supplier: Supplier, entity: BusinessEntity, totals: { net: number, vat: number, grandTotal: number }): Promise<string> => {
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PurchaseOrderPrint 
                    purchaseOrder={po} 
                    supplier={supplier}
                    entityDetails={entity}
                    totals={totals}
                />
            </React.StrictMode>
        );

        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const canvas = await html2canvas(printMountPoint.children[0] as HTMLElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasHeightOnPdf = pdfWidth * (canvas.height / canvas.width);
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvasHeightOnPdf);

            if (canvasHeightOnPdf > pdfHeight) {
                console.warn("Purchase order content is longer than one page. Consider a multi-page solution if needed.");
            }

            return pdf.output('datauristring');
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
        }
    }, []);

    const handleGeneratePdf = useCallback(async (po: PurchaseOrder) => {
        const poSupplier = suppliers.find(s => s.id === po.supplierId);
        const poEntity = businessEntities.find(e => e.id === po.entityId);

        if (!po || !poSupplier || !poEntity) {
            console.warn("Could not generate PDF, missing data for PO:", po);
            return;
        }

        setIsGeneratingPdf(true);
        try {
            const url = await generatePurchaseOrderDataUrl(po, poSupplier, poEntity, poTotals);
            setPdfUrl(url);
            const updatedPo = { ...po, pdfUrl: url, pdfGeneratedAt: new Date().toISOString() };
            setCurrentPo(updatedPo);
            if (onUpdatePO) {
                onUpdatePO(updatedPo);
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [generatePurchaseOrderDataUrl, onUpdatePO, suppliers, businessEntities, poTotals]);

    const loadFreshPoAndGeneratePdf = useCallback(async (poId: string) => {
        setIsGeneratingPdf(true);
        try {
            const docRef = doc(db, 'brooks_purchaseOrders', poId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const freshPoFromDb = { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;
                setPurchaseOrders(prev => prev.map(p => p.id === freshPoFromDb.id ? freshPoFromDb : p));
                setCurrentPo(freshPoFromDb);
                await handleGeneratePdf(freshPoFromDb);
            } else if (purchaseOrder) {
                await handleGeneratePdf(purchaseOrder);
            }
        } catch (error) {
            console.error("Failed to load fresh PO and generate PDF", error);
            if (purchaseOrder) await handleGeneratePdf(purchaseOrder);
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [handleGeneratePdf, purchaseOrder, setPurchaseOrders]);

    const handleRefresh = () => {
        if (currentPo) {
            loadFreshPoAndGeneratePdf(currentPo.id);
        }
    };

    useEffect(() => {
        if (isOpen && purchaseOrder?.id) {
            loadFreshPoAndGeneratePdf(purchaseOrder.id);
        }

        if (!isOpen) {
            setCurrentPo(null);
            setPdfUrl(null);
        }
    }, [isOpen, purchaseOrder?.id]);

    if (!isOpen || !currentPo) return null;

    const handleEmailSuccess = () => {
        setIsEmailing(false);
        if (onUpdatePO && currentPo) {
            onUpdatePO(currentPo);
        }
    };
    
    const handleDownloadPdf = async () => {
        if (!currentPo || !currentSupplier || !entityDetails) return;
        
        setIsGeneratingPdf(true);
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PurchaseOrderPrint 
                    purchaseOrder={currentPo} 
                    supplier={currentSupplier}
                    entityDetails={entityDetails}
                    totals={poTotals}
                />
            </React.StrictMode>
        );

        await new Promise(resolve => setTimeout(resolve, 800));
    
        try {
            const canvas = await html2canvas(printMountPoint.children[0] as HTMLElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasHeightOnPdf = pdfWidth * (canvas.height / canvas.width);

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvasHeightOnPdf);

            pdf.save(`PO-${currentPo.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF for download:", error);
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };

    const currentSupplier = suppliers.find(s => s.id === currentPo.supplierId);

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-800">Purchase Order: #{currentPo.id}</h2>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                currentPo.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                                    currentPo.status === 'Ordered' ? 'bg-blue-100 text-blue-700' :
                                        currentPo.status === 'Partially Received' ? 'bg-yellow-100 text-yellow-800' :
                                            currentPo.status === 'Received' ? 'bg-green-100 text-green-700' :
                                                'bg-red-100 text-red-700'
                                }`}>{currentPo.status}</span>
                        </div>
                        <button type="button" onClick={onClose}><X size={24} /></button>
                    </header>
                    <main className="flex-grow bg-gray-100 overflow-hidden">
                        {isGeneratingPdf && !pdfUrl && (
                            <div className="w-full h-full flex justify-center items-center">
                                <Loader2 size={32} className="animate-spin text-indigo-600" />
                                <p className="ml-4 text-lg">Generating up-to-date PDF...</p>
                            </div>
                        )}
                        {pdfUrl && <PDFViewer src={pdfUrl} />}
                        {!isGeneratingPdf && !pdfUrl && (
                            <div className="w-full h-full flex justify-center items-center flex-col">
                                <Info size={32} className="text-gray-500" />
                                <p className="mt-4 text-lg text-gray-600">Could not load PDF.</p>
                                <button onClick={handleRefresh} className="mt-4 flex items-center justify-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                                    <RefreshCw size={16} className="mr-2" /> Try Again
                                </button>
                            </div>
                        )}
                    </main>
                    <footer className="flex-shrink-0 flex justify-between items-center gap-2 p-4 border-t bg-white">
                        <div className='text-xs text-gray-500'>
                            {lastUpdatedBy ? `Last status change to '${lastUpdatedBy.status}' by ${lastUpdatedBy.user} at ${lastUpdatedBy.timestamp}` : 'No history'}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleRefresh} className="flex items-center justify-center py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all" disabled={isGeneratingPdf}>
                                {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
                                {isGeneratingPdf ? 'Reloading...' : 'Reload'}
                            </button>
                            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center justify-center py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-all">
                                <Download size={16} className="mr-2" />
                                Download PDF
                            </button>
                            <button onClick={() => setIsEmailing(true)} disabled={!pdfUrl || isGeneratingPdf} className="flex items-center justify-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-all">
                                <Mail size={16} className="mr-2" />
                                Email to Supplier
                            </button>
                            <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                        </div>
                    </footer>
                </div>
            </div>
            {isEmailing && currentSupplier && (
                <EmailPurchaseOrderModal
                    isOpen={isEmailing}
                    onClose={() => setIsEmailing(false)}
                    onSend={handleEmailSuccess}
                    purchaseOrder={currentPo}
                    supplier={currentSupplier}
                />
            )}
        </>
    );
};

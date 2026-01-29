
import React, { useState, useMemo } from 'react';
// FIX: Add missing imports for PDF generation
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PurchaseOrder, Supplier } from '../types';
import { Edit, Trash2, Search, PlusCircle, Eye, Download, Printer } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';

const StatusFilter = ({ statuses, selectedStatuses, onToggle }: { statuses: readonly PurchaseOrder['status'][]; selectedStatuses: PurchaseOrder['status'][]; onToggle: (status: PurchaseOrder['status']) => void; }) => {
    return (
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
            {statuses.map(status => {
                const isSelected = selectedStatuses.includes(status);
                return (
                    <button
                        key={status}
                        onClick={() => onToggle(status)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                            isSelected
                                ? 'bg-indigo-600 text-white shadow'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {status}
                    </button>
                );
            })}
        </div>
    );
};

const PrintableTable = ({ data, suppliers: supplierMapData, startDate, endDate }: { data: PurchaseOrder[], suppliers: Map<string, string>, startDate: string, endDate: string }) => (
    <div style={{ padding: '20px', backgroundColor: 'white' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Purchase Order Report</h1>
        <p style={{marginBottom: '10px'}}>Date Range: {startDate} to {endDate}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>PO Number</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Supplier</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Reference</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Total</th>
                </tr>
            </thead>
            <tbody>
                {data.map(po => (
                    <tr key={po.id}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{po.id}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{po.orderDate}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{po.supplierId ? supplierMapData.get(po.supplierId) : 'N/A'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{po.vehicleRegistrationRef}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{po.status}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{formatCurrency((po.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const PrintableTableWithDetails = ({ data, suppliers: supplierMapData, startDate, endDate }: { data: PurchaseOrder[], suppliers: Map<string, string>, startDate: string, endDate: string }) => (
    <div style={{ padding: '20px', backgroundColor: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Purchase Order Report (with Details)</h1>
        <p style={{marginBottom: '10px'}}>Date Range: {startDate} to {endDate}</p>
        {data.map(po => (
            <div key={po.id} style={{ border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                <div style={{ padding: '10px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #ccc', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div><strong>PO Number:</strong> {po.id}</div>
                    <div><strong>Date:</strong> {po.orderDate}</div>
                    <div><strong>Supplier:</strong> {po.supplierId ? supplierMapData.get(po.supplierId) : 'N/A'}</div>
                    <div><strong>Reference:</strong> {po.vehicleRegistrationRef}</div>
                    <div><strong>Status:</strong> {po.status}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#fafafa' }}>
                            <th style={{ padding: '5px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Part Number</th>
                            <th style={{ padding: '5px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '5px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '5px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>Unit Price</th>
                            <th style={{ padding: '5px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(po.lineItems || []).map(item => (
                            <tr key={item.id}>
                                <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{item.partNumber || 'N/A'}</td>
                                <td style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{item.description}</td>
                                <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '5px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(item.quantity * item.unitPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ padding: '10px', backgroundColor: '#f3f4f6', borderTop: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}>
                    PO Total: {formatCurrency((po.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                </div>
            </div>
        ))}
    </div>
);


const PurchaseOrdersView = ({ purchaseOrders, suppliers, onOpenPurchaseOrderModal, onDeletePurchaseOrder, onViewPurchaseOrder, onExport, onOpenBatchAddModal }: { purchaseOrders: PurchaseOrder[], suppliers: Supplier[], onOpenPurchaseOrderModal: (po: PurchaseOrder | null) => void, onDeletePurchaseOrder: (id: string) => void, onViewPurchaseOrder: (po: PurchaseOrder) => void, onExport: (data: any[], filename: string) => void, onOpenBatchAddModal: () => void }) => {
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<PurchaseOrder['status'][]>([]);
    const [startDate, setStartDate] = useState(() => formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [endDate, setEndDate] = useState(() => formatDate(new Date()));

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);

    const filteredPurchaseOrders = useMemo(() => {
        return purchaseOrders.filter(po => {
            const supplier = po.supplierId ? supplierMap.get(po.supplierId) : '';
            const lowerFilter = filter.toLowerCase();

            const matchesDate = (!startDate || po.orderDate >= startDate) && (!endDate || po.orderDate <= endDate);
            if (!matchesDate) return false;

            const matchesSearch = filter === '' ||
                po.id.toLowerCase().includes(lowerFilter) ||
                po.vehicleRegistrationRef.toLowerCase().includes(lowerFilter) ||
                supplier?.toLowerCase().includes(lowerFilter);

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(po.status);

            return matchesSearch && matchesStatus;
        }).sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    }, [purchaseOrders, filter, statusFilter, supplierMap, startDate, endDate]);

    const handleStatusToggle = (status: PurchaseOrder['status']) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const poStatusOptions: readonly PurchaseOrder['status'][] = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];

    const calculateTotal = (lineItems: any[]) => {
        return (lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };
    
    const handlePrintPdf = async () => {
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(<PrintableTable data={filteredPurchaseOrders} suppliers={supplierMap} startDate={startDate} endDate={endDate} />);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
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
            pdf.save(`Purchase_Orders_${formatDate(new Date())}.pdf`);
        } catch(error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
        }
    };

    const handlePrintPdfWithDetails = async () => {
        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);
    
        const root = ReactDOM.createRoot(printMountPoint);
        root.render(<PrintableTableWithDetails data={filteredPurchaseOrders} suppliers={supplierMap} startDate={startDate} endDate={endDate} />);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(printMountPoint, { scale: 2 });
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
            pdf.save(`Purchase_Orders_Details_${formatDate(new Date())}.pdf`);
        } catch(error) {
            console.error("Error generating PDF with details:", error);
            alert("Failed to generate detailed PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-6">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Purchase Orders (Last 30 Days)</h2>
                <div className="flex gap-2">
                    <button onClick={() => onExport(filteredPurchaseOrders, 'purchase_orders.csv')} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Download size={16}/> Export CSV
                    </button>
                    <button onClick={handlePrintPdfWithDetails} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print Detailed
                    </button>
                     <button onClick={handlePrintPdf} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <Printer size={16}/> Print Summary
                    </button>
                    <button onClick={onOpenBatchAddModal} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Purchase Order
                    </button>
                </div>
            </header>
            <div className="space-y-4 mb-4 flex-shrink-0">
                <div className="flex gap-4 items-center">
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                            type="text"
                            placeholder="Search by PO number, reference, or supplier..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full p-2 pl-9 border rounded-lg"
                        />
                    </div>
                     <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-sm font-medium text-gray-700">From:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                        <label className="text-sm font-medium text-gray-700">To:</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                    </div>
                </div>
                <StatusFilter
                    statuses={poStatusOptions}
                    selectedStatuses={statusFilter}
                    onToggle={handleStatusToggle}
                />
            </div>
            <main className="flex-grow overflow-y-auto">
                <div className="border rounded-lg overflow-hidden bg-white shadow">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">PO Number</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Date</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Supplier</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Reference</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Total (Net)</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPurchaseOrders.map(po => (
                                <tr key={po.id} className="hover:bg-indigo-50">
                                    <td className="p-3 font-mono">{po.id}</td>
                                    <td className="p-3">{po.orderDate}</td>
                                    <td className="p-3">{po.supplierId ? supplierMap.get(po.supplierId) : 'N/A'}</td>
                                    <td className="p-3">{po.vehicleRegistrationRef}</td>
                                    <td className="p-3">
                                         <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            po.status === 'Received' ? 'bg-green-100 text-green-800' : 
                                            po.status === 'Partially Received' ? 'bg-amber-100 text-amber-800' :
                                            po.status === 'Ordered' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'}`}>{po.status}</span>
                                    </td>
                                    <td className="p-3 text-right font-semibold">{formatCurrency(calculateTotal(po.lineItems))}</td>
                                    <td className="p-3">
                                         <div className="flex gap-1 justify-end">
                                            <button onClick={() => onViewPurchaseOrder(po)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full" title="View"><Eye size={16} /></button>
                                            <button onClick={() => onOpenPurchaseOrderModal(po)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full" title="Edit"><Edit size={16} /></button>
                                            <button onClick={() => onDeletePurchaseOrder(po.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-full" title="Delete"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};
export default PurchaseOrdersView;

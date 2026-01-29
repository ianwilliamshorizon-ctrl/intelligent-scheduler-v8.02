
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, EstimateLineItem, ChecklistSection } from '../types';
import { X, Download, Loader2, Printer, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { usePrint } from '../core/hooks/usePrint';
import InspectionChecklist from './InspectionChecklist';
import VehicleDamageReport from './VehicleDamageReport';
import TyreCheck from './TyreCheck';
import AsyncImage from './AsyncImage';

// Define props interface
interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    job?: Job | null;
    taxRates: TaxRate[];
    onUpdateInvoice: (invoice: Invoice) => void;
    onInvoiceAction?: (jobId: string) => void;
}

const PrintableInvoice: React.FC<any> = ({ invoice, customer, vehicle, entity, job, taxRates, totals }) => {
    const groupedItems = useMemo(() => {
        const rows: { header?: EstimateLineItem, children?: EstimateLineItem[], standalone?: EstimateLineItem }[] = [];
        const allItems = invoice.lineItems || [];
        
        const packageHeaders = allItems.filter((item: EstimateLineItem) => item.servicePackageId && !item.isPackageComponent);
        
        packageHeaders.forEach((header: EstimateLineItem) => {
            const children = allItems.filter((item: EstimateLineItem) => item.isPackageComponent && item.servicePackageId === header.servicePackageId);
            rows.push({ header, children });
        });

        allItems.forEach((item: EstimateLineItem) => {
            if (!item.servicePackageId && !item.isPackageComponent) {
                rows.push({ standalone: item });
            }
        });
        
        return rows;
    }, [invoice.lineItems]);

    // Resolve diagram image for damage report if needed
    const diagramImageId = useMemo(() => {
        return vehicle?.images?.find((img: any) => img.isPrimaryDiagram)?.id ?? null;
    }, [vehicle]);

    const hasTechnicianNotes = job && job.technicianObservations && job.technicianObservations.length > 0;
    
    // Split inspection checklist into groups for paging
    const inspectionGroups = useMemo(() => {
        if (!job?.inspectionChecklist) return { part1: [], part2: [], part3: [], part4: [] };
        
        const part1: ChecklistSection[] = []; // Interior, Exterior
        const part2: ChecklistSection[] = []; // Engine
        const part3: ChecklistSection[] = []; // Below
        const part4: ChecklistSection[] = []; // Final + others
        
        job.inspectionChecklist.forEach((s: ChecklistSection) => {
            if (['section_interior_electrics', 'section_exterior'].includes(s.id)) part1.push(s);
            else if (s.id === 'section_engine_compartment') part2.push(s);
            else if (s.id === 'section_vehicle_below') part3.push(s);
            else part4.push(s);
        });
        
        return { part1, part2, part3, part4 };
    }, [job?.inspectionChecklist]);

    const hasAnyInspectionData = job && (
        (job.inspectionChecklist && job.inspectionChecklist.some((s: any) => s.items.some((i: any) => i.status !== 'na'))) ||
        (job.tyreCheck && Object.values(job.tyreCheck).some((t: any) => t.indicator !== 'na')) ||
        (job.damagePoints && job.damagePoints.length > 0)
    );

    const hasPart1 = inspectionGroups.part1.length > 0;
    const hasPart2 = inspectionGroups.part2.length > 0;
    const hasPart3 = inspectionGroups.part3.length > 0;
    const hasPart4 = inspectionGroups.part4.length > 0 || (job && job.tyreCheck);
    const hasDamageReport = job && job.damagePoints && job.damagePoints.length > 0;

    const pageStyle = {
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm',
        boxSizing: 'border-box' as const,
        backgroundColor: 'white',
        position: 'relative' as const,
    };

    const renderHeader = (title: string) => (
        <div className="flex justify-between items-center mb-6 border-b pb-2">
             <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
             <div className="text-right text-sm">
                 <p><strong>Ref:</strong> {invoice.id}</p>
                 <p><strong>Job:</strong> {job?.id}</p>
             </div>
        </div>
    );

    return (
        <div className="bg-gray-100 font-sans text-sm text-gray-800">
            {/* 1. INVOICE SECTION (Page 1+) */}
            <div className="printable-page invoice-section" style={{ ...pageStyle, display: 'flex', flexDirection: 'column' }}>
                <div className="invoice-content flex-grow flex flex-col">
                    <header className="pb-6 border-b">
                        <div className="flex justify-between items-start">
                            <div style={{ marginBottom: '5mm' }}>
                                <h1 className="text-3xl font-bold text-gray-900">{entity?.name}</h1>
                                <p>{entity?.addressLine1}</p>
                                <p>{entity?.city}, {entity?.postcode}</p>
                                {entity?.vatNumber && <p className="mt-1">VAT No: {entity.vatNumber}</p>}
                            </div>
                            {entity?.logoImageId && (
                                <div style={{ width: '70mm', height: '35mm', display: 'flex', justifyContent: 'flex-end', marginRight: '15mm' }}>
                                    <AsyncImage imageId={entity.logoImageId} className="max-w-full max-h-full object-contain" />
                                </div>
                            )}
                        </div>
                        <div className="mt-6">
                            <h2 className="text-2xl font-semibold text-gray-800">INVOICE</h2>
                            <p>#{invoice?.id}</p>
                            <p className="mt-2">Date: {invoice?.issueDate}</p>
                            <p>Due: {invoice?.dueDate}</p>
                        </div>
                    </header>
                    <main className="space-y-4 my-6 flex-grow">
                        <section className="grid grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase">Bill To</h3>
                                <p className="font-bold text-gray-800">{customer?.forename} {customer?.surname}</p>
                                <p>{customer?.addressLine1}</p>
                                <p>{customer?.city}, {customer?.postcode}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase">Vehicle Details</h3>
                                <p className="font-bold text-gray-800">{vehicle?.make} {vehicle?.model}</p>
                                <p>Reg: <span className="font-mono">{vehicle?.registration}</span></p>
                                <p>Job Ref: <span className="font-mono">{job?.id}</span></p>
                            </div>
                        </section>
                        <section className="mt-6">
                            <div className="grid grid-cols-12 gap-2 items-center text-xs font-semibold text-gray-500 px-1.5 py-1 border-y bg-gray-50">
                                <div className="col-span-7">Description</div>
                                <div className="col-span-1 text-right">Qty</div>
                                <div className="col-span-2 text-right">Unit Price (Net)</div>
                                <div className="col-span-2 text-right">Total (Net)</div>
                            </div>
                            {groupedItems.map((row, index) => {
                                if (row.standalone) {
                                    const item = row.standalone;
                                    const net = item.quantity * item.unitPrice;
                                    return (
                                        <div key={`standalone-${item.id}`} className="grid grid-cols-12 gap-2 items-center px-1.5 py-1.5 text-sm">
                                            <div className="col-span-7">{item.description}</div>
                                            <div className="col-span-1 text-right">{item.quantity}</div>
                                            <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
                                            <div className="col-span-2 text-right">{formatCurrency(net)}</div>
                                        </div>
                                    );
                                } else if (row.header && row.children) {
                                    const header = row.header;
                                    const net = header.quantity * header.unitPrice;
                                    return (
                                        <React.Fragment key={`pkg-${header.id}`}>
                                            {/* Spacer to prevent PDF rendering overlap */}
                                            <div className="h-2"></div>
                                            <div className="grid grid-cols-12 gap-2 items-center px-1.5 py-1.5 text-sm bg-gray-100 font-bold">
                                                <div className="col-span-7">{header.description}</div>
                                                <div className="col-span-1 text-right">{header.quantity}</div>
                                                <div className="col-span-2 text-right">{formatCurrency(header.unitPrice)}</div>
                                                <div className="col-span-2 text-right">{formatCurrency(net)}</div>
                                            </div>
                                            {row.children.map(child => (
                                                <div key={`child-${child.id}`} className="grid grid-cols-12 gap-2 items-center pl-6 pr-1.5 py-1 text-xs text-gray-600">
                                                    <div className="col-span-7">- {child.description}</div>
                                                    <div className="col-span-1 text-right">{child.quantity}</div>
                                                    <div className="col-span-2 text-right italic">Included</div>
                                                    <div className="col-span-2 text-right"></div>
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    );
                                }
                                return null;
                            })}
                        </section>

                        <div className="mt-4 pt-4 border-t flex justify-between page-break-inside-avoid">
                            <div>
                                {entity?.bankAccountName && (
                                    <div className="text-xs text-gray-600">
                                        <h4 className="font-semibold text-gray-800">Payment Details:</h4>
                                        <p>Account Name: {entity.bankAccountName}</p>
                                        <p>Sort Code: {entity.bankSortCode}</p>
                                        <p>Account No: {entity.bankAccountNumber}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-64 text-sm">
                                <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatCurrency(totals?.subtotal)}</span></div>
                                {totals?.vatBreakdown?.map((b: any) => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Total Due</span><span>{formatCurrency(totals?.grandTotal)}</span></div>
                            </div>
                        </div>
                    </main>
                    
                    <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                        <p>{entity?.invoiceFooterText}</p>
                    </footer>
                </div>
            </div>

            {/* 2. TECHNICIAN NOTES SECTION (New Page) */}
            {hasTechnicianNotes && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {renderHeader('Technician Report')}

                    <section className="mb-8">
                        <h3 className="text-lg font-bold text-gray-700 mb-3 bg-gray-100 p-2 rounded">Notes & Observations</h3>
                        <ul className="list-disc list-inside space-y-2 ml-2">
                            {job.technicianObservations.map((obs: string, i: number) => (
                                <li key={i} className="text-gray-800">{obs}</li>
                            ))}
                        </ul>
                    </section>
                </div>
            )}

            {/* 3. INSPECTION RESULTS SECTION(S) - Split into pages */}
            
            {/* Page for Interior/Exterior */}
            {hasAnyInspectionData && hasPart1 && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {renderHeader('Inspection: Interior & Exterior')}
                    <section>
                         <InspectionChecklist checklistData={inspectionGroups.part1} onUpdate={()=>{}} isReadOnly={true} />
                    </section>
                </div>
            )}

            {/* Page for Engine */}
            {hasAnyInspectionData && hasPart2 && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {renderHeader('Inspection: Engine Compartment')}
                    <section>
                         <InspectionChecklist checklistData={inspectionGroups.part2} onUpdate={()=>{}} isReadOnly={true} />
                    </section>
                </div>
            )}

            {/* Page for Underbody */}
            {hasAnyInspectionData && hasPart3 && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {renderHeader('Inspection: Underbody')}
                    <section>
                         <InspectionChecklist checklistData={inspectionGroups.part3} onUpdate={()=>{}} isReadOnly={true} />
                    </section>
                </div>
            )}

            {/* Page for Final Checks & Tyres (Without Bodywork) */}
            {hasAnyInspectionData && hasPart4 && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {renderHeader('Inspection: Final Checks & Tyres')}
                    <section>
                        {inspectionGroups.part4.length > 0 && (
                            <div className="mb-6">
                                <InspectionChecklist checklistData={inspectionGroups.part4} onUpdate={()=>{}} isReadOnly={true} />
                            </div>
                        )}

                        {job.tyreCheck && (
                            <div className="mb-6 page-break-inside-avoid">
                                <TyreCheck tyreData={job.tyreCheck} onUpdate={()=>{}} isReadOnly={true} />
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Page for Bodywork Inspection (Separate Page) */}
            {hasDamageReport && (
                 <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page' }}>
                     {renderHeader('Inspection: Bodywork Report')}
                     <section>
                         <div className="mb-6 break-inside-avoid page-break-inside-avoid">
                            <h4 className="font-bold text-gray-600 mb-2 ml-1">Bodywork Inspection</h4>
                            <div className="border rounded-lg bg-white overflow-hidden p-4">
                                <VehicleDamageReport 
                                    activePoints={job.damagePoints || []} 
                                    onUpdate={()=>{}} 
                                    isReadOnly={true} 
                                    vehicleModel={vehicle?.model} 
                                    imageId={diagramImageId}
                                />
                            </div>
                         </div>
                     </section>
                 </div>
            )}
        </div>
    );
};

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice, customer, vehicle, entity, job, taxRates, onUpdateInvoice, onInvoiceAction }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const print = usePrint();

    const totals = useMemo(() => {
        if (!invoice) return { subtotal: 0, total: 0, grandTotal: 0, vatBreakdown: [] };
        const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));
        const vatBreakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        let subtotal = 0;
        
        (invoice.lineItems || []).forEach(item => {
            if (item.isPackageComponent) return; // Only sum headers and standalone items

            const itemNet = item.quantity * item.unitPrice;
            subtotal += itemNet;

            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId) as TaxRate | undefined;
            if (!taxRate || taxRate.rate === 0) return;
            if (!vatBreakdown[taxCodeId]) {
                vatBreakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            }
            const itemVat = itemNet * (taxRate.rate / 100);
            vatBreakdown[taxCodeId].net += itemNet;
            vatBreakdown[taxCodeId].vat += itemVat;
        });

        const finalVatBreakdown = Object.values(vatBreakdown);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        return { subtotal, total: subtotal + totalVat, grandTotal: subtotal + totalVat, vatBreakdown: finalVatBreakdown };
    }, [invoice, taxRates]);

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        // Trigger status update
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }

        const printMountPoint = document.createElement('div');
        printMountPoint.style.position = 'absolute';
        printMountPoint.style.left = '-9999px';
        document.body.appendChild(printMountPoint);

        const root = ReactDOM.createRoot(printMountPoint);
        root.render(
            <React.StrictMode>
                <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, totals }} />
            </React.StrictMode>
        );

        await new Promise(resolve => setTimeout(resolve, 1500)); // Increased timeout for images and layout

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

            pdf.save(`Invoice-${invoice.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try using the 'Print' button and saving as PDF.");
        } finally {
            root.unmount();
            document.body.removeChild(printMountPoint);
            setIsGeneratingPdf(false);
        }
    };

    const handlePrintInvoice = () => {
        // Trigger status update
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, totals }} />);
    };
    
    const handleMarkAsPaid = () => {
        if (invoice) {
            onUpdateInvoice({ ...invoice, status: 'Paid' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                <main className="flex-grow overflow-y-auto">
                    <div className="scale-95 origin-top">
                        <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, totals }} />
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                        {invoice.status !== 'Paid' && (
                            <button onClick={handleMarkAsPaid} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                                <CheckCircle size={16} className="mr-2"/> Mark as Paid
                            </button>
                        )}
                        <button onClick={handlePrintInvoice} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">
                            <Printer size={16} className="mr-2"/> Print
                        </button>
                        <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex items-center py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50">
                            {isGeneratingPdf ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Download size={16} className="mr-2" />}
                            PDF
                        </button>
                    </div>
                    <button onClick={onClose} className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Close</button>
                </footer>
            </div>
        </div>
    );
};

export default InvoiceModal;

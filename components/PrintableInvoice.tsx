import React, { useMemo } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, EstimateLineItem, ChecklistSection, ServicePackage, InspectionTemplate } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import InspectionChecklist from './InspectionChecklist';
import VehicleDamageReport from './VehicleDamageReport';
import TyreCheck from './TyreCheck';
import AsyncImage from './AsyncImage';

interface PrintableInvoiceProps {
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    job?: Job | null;
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    inspectionTemplates: InspectionTemplate[];
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates }) => {

    const inspectionTemplate = useMemo(() => {
        if (!job?.inspectionTemplateId || !inspectionTemplates) return null;
        return inspectionTemplates.find(t => t.id === job.inspectionTemplateId);
    }, [job?.inspectionTemplateId, inspectionTemplates]);

    const inspectionTitle = useMemo(() => {
        return inspectionTemplate?.name ?? 'Inspection Report';
    }, [inspectionTemplate]);

    const totals = useMemo(() => {
        if (!invoice) return { subtotal: 0, grandTotal: 0, vatBreakdown: [] };

        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const standardTaxRateId = safeTaxRates.find(t => t.code === 'T1')?.id;
        const t99RateId = safeTaxRates.find(t => t.code === 'T99')?.id;
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));

        const vatBreakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        let subtotal = 0;

        const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

        lineItems.forEach(item => {
            if (item.isPackageComponent) return;

            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            subtotal += itemNet;

            if (item.taxCodeId === t99RateId) {
                const taxCodeId = t99RateId;
                if (!vatBreakdown[taxCodeId]) {
                    vatBreakdown[taxCodeId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' };
                }
                vatBreakdown[taxCodeId].net += itemNet;
                vatBreakdown[taxCodeId].vat += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;

                const taxRate = taxRatesMap.get(taxCodeId);
                if (!taxRate) return;

                if (!vatBreakdown[taxCodeId]) {
                    vatBreakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }

                vatBreakdown[taxCodeId].net += itemNet;
                if (taxRate.rate > 0) {
                    vatBreakdown[taxCodeId].vat += itemNet * (taxRate.rate / 100);
                }
            }
        });

        const finalVatBreakdown = Object.values(vatBreakdown).filter(b => b.net > 0 || b.vat > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        return { subtotal, grandTotal: subtotal + totalVat, vatBreakdown: finalVatBreakdown };
    }, [invoice, taxRates]);

    const groupedItems = useMemo(() => {
        const rows: { header?: EstimateLineItem, children?: EstimateLineItem[], standalone?: EstimateLineItem }[] = [];
        const allItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
        
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
    }, [invoice?.lineItems]);

    const diagramImageId = useMemo(() => {
        const images = Array.isArray(vehicle?.images) ? vehicle.images : [];
        return images.find((img: any) => img.isPrimaryDiagram)?.id ?? null;
    }, [vehicle]);

    const hasTechnicianNotes = job && Array.isArray(job.technicianObservations) && job.technicianObservations.length > 0;
    
    const hasAnyInspectionData = job && (
        (Array.isArray(job.inspectionChecklist) && job.inspectionChecklist.some((s: any) => s.items?.some((i: any) => i.status !== 'na'))) ||
        (job.tyreCheck && Object.values(job.tyreCheck).some((t: any) => t.indicator !== 'na')) ||
        (Array.isArray(job.damagePoints) && job.damagePoints.length > 0)
    );
    
    const hasDamageReport = job && Array.isArray(job.damagePoints) && job.damagePoints.length > 0;

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

    const inspectionPages = useMemo(() => {
        if (!job?.inspectionChecklist) return [];
        const templateSections = inspectionTemplate?.sections || [];
        const pages: { sections: ChecklistSection[] }[] = [];
        let currentPage: { sections: ChecklistSection[] } = { sections: [] };

        job.inspectionChecklist.forEach(section => {
            const templateSection = templateSections.find(t => t.id === section.id);
            if (templateSection?.pageBreakBefore && currentPage.sections.length > 0) {
                pages.push(currentPage);
                currentPage = { sections: [section] };
            } else {
                currentPage.sections.push(section);
            }
        });

        if (currentPage.sections.length > 0) {
            pages.push(currentPage);
        }

        return pages;
    }, [job?.inspectionChecklist, inspectionTemplate]);

    return (
        <div className="bg-gray-100 font-sans text-sm text-gray-800">
            <div className="printable-page invoice-section" style={{ ...pageStyle, display: 'flex', flexDirection: 'column' }}>
                
                {invoice.status === 'Paid' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-[12px] border-green-600 p-8 opacity-15 rounded-2xl -rotate-[25deg] pointer-events-none z-0">
                        <h1 className="text-9xl font-black text-green-600 m-0 leading-none">PAID</h1>
                        <p className="text-center text-2xl text-green-600 font-bold uppercase tracking-widest mt-2">{invoice.issueDate}</p>
                    </div>
                )}

                <div className="invoice-content flex-grow flex flex-col z-10">
                    <header className="border-b" style={{ paddingBottom: '25mm' }}>
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
                                {job?.mileage && <p>Mileage: <span className="font-mono">{job.mileage.toLocaleString()} miles</span></p>}
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
                                    const net = (item.quantity || 0) * (item.unitPrice || 0);
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
                                    const net = (header.quantity || 0) * (header.unitPrice || 0);
                                    return (
                                        <React.Fragment key={`pkg-${header.id}`}>
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
                                {Array.isArray(totals?.vatBreakdown) && totals.vatBreakdown.map((b: any) => (
                                    <div key={b.name} className="flex justify-between text-gray-600">
                                        <span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span>
                                        <span>{formatCurrency(b.vat)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Total Due</span><span>{formatCurrency(totals?.grandTotal)}</span></div>
                            </div>
                        </div>
                    </main>
                    
                    <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                        <p>{entity?.invoiceFooterText}</p>
                    </footer>
                </div>
            </div>

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

            {hasAnyInspectionData && inspectionPages.length > 0 && (
                <React.Fragment>
                    {inspectionPages.map((page, pageIndex) => (
                        <div key={`inspection-page-${pageIndex}`} className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page', marginTop: '30mm' }}>
                            {renderHeader(inspectionTitle)}
                            <section>
                                <InspectionChecklist checklistData={page.sections} onUpdate={() => { }} isReadOnly={true} />
                            </section>
                        </div>
                    ))}
                </React.Fragment>
            )}

            {job?.tyreCheck && (
                <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page', marginTop: '30mm' }}>
                    {renderHeader(`${inspectionTitle}: Tyre Check`)}
                    <section>
                        <div className="mb-6 page-break-inside-avoid"><TyreCheck tyreData={job.tyreCheck} onUpdate={()=>{}} isReadOnly={true} /></div>
                    </section>
                </div>
            )}

            {hasDamageReport && (
                 <div className="printable-page pdf-page-section" style={{ ...pageStyle, pageBreakBefore: 'always', breakBefore: 'page', marginTop: '30mm' }}>
                    {renderHeader(`${inspectionTitle}: Bodywork Report`)}
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

export default PrintableInvoice;

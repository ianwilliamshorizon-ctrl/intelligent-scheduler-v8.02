import React, { useMemo, useState, useEffect } from 'react';
import { 
    Invoice, 
    Customer, 
    Vehicle, 
    BusinessEntity, 
    Job, 
    TaxRate, 
    EstimateLineItem, 
    ChecklistSection, 
    ServicePackage, 
    InspectionTemplate, 
    InspectionDiagram, 
    PrintOptions,
    DocumentBlockConfig
} from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import InspectionChecklist from './InspectionChecklist';
import VehicleDamageReport from './VehicleDamageReport';
import TyreCheck from './TyreCheck';
import { getImage } from '../utils/imageStore';
import { useData } from '../core/state/DataContext';
import { 
    COLOR_PALETTES, 
    DEFAULT_INVOICE_BLOCKS, 
    getContainerStyleClasses 
} from '../core/utils/documentTemplateDefaults';

interface PrintableInvoiceProps {
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    job?: Job | null;
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
    printOptions?: PrintOptions;
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ 
    invoice, 
    customer, 
    vehicle, 
    entity, 
    job, 
    taxRates = [], 
    servicePackages = [], 
    inspectionTemplates = [], 
    inspectionDiagrams = [], 
    printOptions = { showInvoice: true, showTechNotes: true, showInspections: true, showMedia: true } 
}) => {
    const data = useData();
    const resolvedEntity = useMemo(() => {
        if (entity) return entity;
        const businessEntities = data?.businessEntities || [];
        const entityId = invoice?.entityId || job?.entityId;
        if (entityId) {
            const found = businessEntities.find(e => e.id === entityId);
            if (found) return found;
        }
        return businessEntities[0];
    }, [entity, invoice?.entityId, job?.entityId, data?.businessEntities]);

    const vehicleImage = useMemo(() => {
        if (vehicle && Array.isArray(vehicle.images)) {
            return vehicle.images.find(img => img.isPrimaryDiagram) || vehicle.images[0];
        }
        return null;
    }, [vehicle]);

    const matchedLibraryDiagram = useMemo(() => {
        if (!vehicle || !inspectionDiagrams || vehicleImage) return null;
        return inspectionDiagrams.find(d => 
            d.make?.toLowerCase() === vehicle.make?.toLowerCase() && 
            d.model?.toLowerCase() === vehicle.model?.toLowerCase()
        ) || inspectionDiagrams.find(d => 
            d.make?.toLowerCase() === vehicle.make?.toLowerCase()
        ) || null;
    }, [vehicle, inspectionDiagrams, vehicleImage]);

    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadLogo = async () => {
            const anyEntity = resolvedEntity as any;
            if (anyEntity?.tempLogoUrl) {
                setLogoUrl(anyEntity.tempLogoUrl);
                return;
            }

            if (resolvedEntity?.logoImageId) {
                const url = await getImage(resolvedEntity.logoImageId);
                if (url) {
                    setLogoUrl(url);
                    return;
                }
            }
            if (resolvedEntity?.logoUrl) {
                setLogoUrl(resolvedEntity.logoUrl);
            } else {
                setLogoUrl(null);
            }
        };
        loadLogo();
    }, [resolvedEntity]);

    const inspectionTemplate = useMemo(() => {
        if (!job?.inspectionTemplateId || !inspectionTemplates) return null;
        return inspectionTemplates.find(t => t.id === job.inspectionTemplateId);
    }, [job?.inspectionTemplateId, inspectionTemplates]);

    // Financial Calculation
    const totals = useMemo(() => {
        if (!invoice) return { labourSubtotal: 0, partsSubtotal: 0, netSubtotal: 0, vatTotal: 0, grandTotal: 0, vatBreakdown: [] };
        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));
        const vatBreakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        
        let labourSubtotal = 0;
        let partsSubtotal = 0;
        let netSubtotal = 0;

        (invoice.lineItems || []).forEach(item => {
            if (item.isPackageComponent) return;
            const itemNet = (item.quantity || 1) * (item.unitPrice || 0);
            netSubtotal += itemNet;

            if (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || item.partNumber === 'MOT') {
                labourSubtotal += itemNet;
            } else {
                partsSubtotal += itemNet;
            }

            const taxCodeId = item.taxCodeId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId);
            if (!taxRate) return;
            if (!vatBreakdown[taxCodeId]) {
                vatBreakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            }
            vatBreakdown[taxCodeId].net += itemNet;
            if (taxRate.code === 'T99') {
                vatBreakdown[taxCodeId].vat += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else if (taxRate.rate > 0) {
                vatBreakdown[taxCodeId].vat += itemNet * (taxRate.rate / 100);
            }
        });

        const finalVatBreakdown = Object.values(vatBreakdown).filter(b => b.net > 0 || b.vat > 0);
        const vatTotal = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        return {
            labourSubtotal,
            partsSubtotal,
            netSubtotal,
            vatTotal,
            grandTotal: netSubtotal + vatTotal,
            vatBreakdown: finalVatBreakdown
        };
    }, [invoice, taxRates]);

    const groupedItems = useMemo(() => {
        const labor: EstimateLineItem[] = [];
        const partsItems: EstimateLineItem[] = [];
        const packages: { header: EstimateLineItem; children: EstimateLineItem[] }[] = [];
        const allItems = invoice?.lineItems || [];
        const topLevelItems = allItems.filter(i => !i.isPackageComponent);
        const allChildren = allItems.filter(i => i.isPackageComponent);

        topLevelItems.forEach(item => {
            if (item.servicePackageId) {
                packages.push({ header: item, children: allChildren.filter(c => c.servicePackageId === item.servicePackageId) });
            } else if (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || item.partNumber === 'MOT') {
                labor.push(item);
            } else {
                partsItems.push(item);
            }
        });
        return { labor, parts: partsItems, packages };
    }, [invoice?.lineItems]);

    // Active Layout Configuration
    const layoutConfig = resolvedEntity?.invoiceLayout;
    const blocks: DocumentBlockConfig[] = useMemo(() => {
        if (layoutConfig?.blocks && Array.isArray(layoutConfig.blocks) && layoutConfig.blocks.length > 0) {
            return [...layoutConfig.blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        return DEFAULT_INVOICE_BLOCKS;
    }, [layoutConfig]);

    const accentColor = layoutConfig?.accentColor || resolvedEntity?.color || '#4f46e5';

    const pageStyle: React.CSSProperties = {
        width: '210mm',
        minHeight: '297mm',
        padding: '16mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff'
    };

    const hasTyreData = Boolean(job?.tyreCheck && Object.values(job.tyreCheck).some(t => t?.outer || t?.pressure));
    const hasDamageReport = Boolean(job?.damagePoints && job.damagePoints.length > 0);

    return (
        <div className="rebuild-print-container" style={{ backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 12mm; 
                    }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .rebuild-print-container, .rebuild-print-container * { 
                        visibility: visible !important; 
                    }
                    .rebuild-print-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                    }
                    .printable-page > div, .transition-all {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    table, tr, td, th {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .page-break-before {
                        break-before: page !important;
                        page-break-before: always !important;
                    }
                    .printable-page {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
            ` }} />

            {/* Main Invoice Page dynamically built from configured blocks */}
            <div className="bg-white font-sans text-xs text-slate-800 printable-page space-y-4" style={pageStyle}>
                {blocks.filter(b => b.visible !== false).map((block) => {
                    const cs = getContainerStyleClasses(
                        block.settings?.style,
                        block.settings?.containerColor,
                        accentColor,
                        block.settings?.textColor
                    );

                    return (
                        <div 
                            key={block.id} 
                            className={`transition-all ${block.settings?.pageBreakBefore ? 'page-break-before' : ''}`}
                            style={{ 
                                breakInside: 'avoid', 
                                pageBreakInside: 'avoid',
                                ...(block.settings?.pageBreakBefore ? { breakBefore: 'page', pageBreakBefore: 'always' } : {})
                            }}
                        >
                            {/* Block 1: Header Logo */}
                            {block.type === 'header_logo' && (
                                <div className={`flex items-start justify-between pb-3 border-b border-slate-200 gap-4 ${
                                    block.settings?.logoPosition === 'center' ? 'flex-col items-center text-center' :
                                    block.settings?.logoPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
                                }`}>
                                    <div className="space-y-1">
                                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                            {resolvedEntity?.name || 'BROOKSPEED AUTOMOTIVE'}
                                        </h1>
                                        <div className="text-[11px] text-slate-600 space-y-0.5">
                                            <div>{resolvedEntity?.addressLine1 || 'Unit 4, Speedwell Industrial Estate'}{resolvedEntity?.addressLine2 ? `, ${resolvedEntity.addressLine2}` : ''}</div>
                                            <div>{resolvedEntity?.city || 'Eastleigh'}, {resolvedEntity?.postcode || 'SO53 4NF'}</div>
                                            <div>
                                                Tel: <span className="font-semibold">{resolvedEntity?.phone || '02380 641672'}</span> | Email: <span className="font-semibold">{resolvedEntity?.email || 'accounts@brookspeed.com'}</span>
                                                {resolvedEntity?.vatNumber && <span> | VAT: <span className="font-semibold">{resolvedEntity.vatNumber}</span></span>}
                                                {resolvedEntity?.companyNumber && <span> | Reg: <span className="font-semibold">{resolvedEntity.companyNumber}</span></span>}
                                            </div>
                                        </div>
                                    </div>
                                    {logoUrl && (
                                        <img 
                                            src={logoUrl} 
                                            alt="Logo" 
                                            style={{ height: `${block.settings?.logoHeight || 65}px` }} 
                                            className="object-contain max-w-[200px]" 
                                        />
                                    )}
                                </div>
                            )}

                            {/* Block 2: Document Meta Details */}
                            {block.type === 'document_meta' && (
                                <div 
                                    className={`${cs.wrapperClass} flex flex-wrap items-center justify-between gap-3`}
                                    style={cs.wrapperStyle}
                                >
                                    <div>
                                        <span 
                                            className="text-[10px] font-black uppercase tracking-wider block"
                                            style={cs.titleStyle}
                                        >
                                            {block.title || 'INVOICE NUMBER'}
                                        </span>
                                        <span 
                                            className="text-lg font-black tracking-tight font-mono"
                                            style={cs.textStyle}
                                        >
                                            {(invoice as any).invoiceNumber || invoice.id}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-6 text-xs" style={cs.textStyle}>
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Invoice Date</span>
                                            <span className="font-bold" style={cs.textStyle}>
                                                {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        {invoice.dueDate && (
                                            <div>
                                                <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Due Date</span>
                                                <span className="font-bold" style={cs.textStyle}>
                                                    {new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Account Ref</span>
                                            <span className="font-bold font-mono" style={cs.textStyle}>{customer?.id ? `ACC-${customer.id.slice(-6).toUpperCase()}` : 'CASH'}</span>
                                        </div>
                                        {(invoice as any).poNumber && (
                                            <div>
                                                <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>PO Ref</span>
                                                <span className="font-bold font-mono" style={cs.textStyle}>{(invoice as any).poNumber}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Block 3: Customer Details */}
                            {block.type === 'customer_details' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Invoiced To'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="text-xs space-y-0.5" style={cs.textStyle}>
                                            <div className="font-bold text-sm">{customer ? `${customer.forename || ''} ${customer.surname || ''}`.trim() : 'Customer Cash Sale'}</div>
                                            {customer?.addressLine1 && <div>{customer.addressLine1}{customer.addressLine2 ? `, ${customer.addressLine2}` : ''}</div>}
                                            {(customer?.city || customer?.postcode) && <div>{customer.city || ''} {customer.postcode ? <span className="font-semibold uppercase">{customer.postcode}</span> : ''}</div>}
                                            <div style={cs.subtextStyle}>
                                                Phone: <span className="font-semibold">{customer?.mobile || customer?.phone || '—'}</span>
                                                {customer?.email && <span> | Email: <span className="font-semibold">{customer.email}</span></span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 4: Vehicle Details */}
                            {block.type === 'vehicle_details' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Vehicle Information'}
                                        </h4>
                                        <span className="inline-block bg-yellow-400 text-black font-mono font-black text-xs px-2.5 py-0.5 rounded border border-yellow-500 shadow-2xs tracking-wider uppercase">
                                            {vehicle?.registration || 'NO REG'}
                                        </span>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style={cs.textStyle}>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Make & Model:</span><strong>{vehicle?.make} {vehicle?.model || 'Vehicle'}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Year / Colour:</span><strong>{vehicle?.year || '—'} / {vehicle?.colour || '—'}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Mileage Recorded:</span><strong>{(vehicle as any)?.mileage ? `${(vehicle as any).mileage.toLocaleString()} mi` : (job?.mileage || (job as any)?.mileageIn ? `${job?.mileage || (job as any)?.mileageIn} mi` : '—')}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>VIN / Chassis:</span><strong className="font-mono">{vehicle?.vin?.slice(-8) || vehicle?.vin || '—'}</strong></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 5: Narrative Description */}
                            {block.type === 'narrative_description' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Summary of Work Carried Out'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <p className="text-xs leading-relaxed italic whitespace-pre-wrap" style={cs.textStyle}>
                                            {invoice.notes || job?.description || block.settings?.customNarrativeText || "All requested workshop operations and scheduled maintenance carried out in full accordance with manufacturer specifications."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Block 6: Tasks & Labour Packages */}
                            {block.type === 'tasks_packages' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <div className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Labour & Services Completed'}
                                        </div>
                                    </div>
                                    <div className="p-0 overflow-x-auto">
                                        <table className="w-full text-xs text-left" style={cs.textStyle}>
                                            <thead className="bg-slate-50/60 border-b text-[10px] uppercase" style={cs.subtextStyle}>
                                                <tr>
                                                    <th className="p-2">Description</th>
                                                    <th className="p-2 text-center">Hours</th>
                                                    {block.settings?.showPrices !== false && <th className="p-2 text-right">Net Price</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/60">
                                                {groupedItems.labor.length > 0 || groupedItems.packages.length > 0 ? (
                                                    <>
                                                        {groupedItems.packages.map(pkg => (
                                                            <tr key={pkg.header.id} className="bg-slate-50/40">
                                                                <td className="p-2 font-bold">
                                                                    <div>{pkg.header.description}</div>
                                                                    <div className="text-[10px] font-normal pl-2 space-y-0.5 pt-0.5" style={cs.subtextStyle}>
                                                                        {pkg.children.map(c => <div key={c.id}>• {c.description}</div>)}
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-center font-mono">1.00</td>
                                                                {block.settings?.showPrices !== false && (
                                                                    <td className="p-2 text-right font-semibold font-mono">£{((pkg.header.quantity || 1) * (pkg.header.unitPrice || 0)).toFixed(2)}</td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                        {groupedItems.labor.map(item => (
                                                            <tr key={item.id}>
                                                                <td className="p-2 font-medium">{item.description}</td>
                                                                <td className="p-2 text-center font-mono">{Number(item.quantity || 1).toFixed(2)}</td>
                                                                {block.settings?.showPrices !== false && (
                                                                    <td className="p-2 text-right font-semibold font-mono">£{((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-3 text-center italic" style={cs.subtextStyle}>
                                                            No discrete labour items recorded.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Block 7: Parts & Materials */}
                            {block.type === 'parts_items' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <div className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Parts & Consumables'}
                                        </div>
                                    </div>
                                    <div className="p-0 overflow-x-auto">
                                        <table className="w-full text-xs text-left" style={cs.textStyle}>
                                            <thead className="bg-slate-50/60 border-b text-[10px] uppercase" style={cs.subtextStyle}>
                                                <tr>
                                                    {block.settings?.showPartNumbers !== false && <th className="p-2">Part No.</th>}
                                                    <th className="p-2">Description</th>
                                                    <th className="p-2 text-center">Qty</th>
                                                    {block.settings?.showPrices !== false && <th className="p-2 text-right">Unit Net</th>}
                                                    {block.settings?.showPrices !== false && <th className="p-2 text-right">Total Net</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/60">
                                                {groupedItems.parts.length > 0 ? (
                                                    groupedItems.parts.map(item => (
                                                        <tr key={item.id}>
                                                            {block.settings?.showPartNumbers !== false && (
                                                                <td className="p-2 font-mono text-[10px]" style={cs.subtextStyle}>{item.partNumber || '—'}</td>
                                                            )}
                                                            <td className="p-2 font-medium">{item.description}</td>
                                                            <td className="p-2 text-center">{item.quantity || 1}</td>
                                                            {block.settings?.showPrices !== false && <td className="p-2 text-right font-mono">£{Number(item.unitPrice || 0).toFixed(2)}</td>}
                                                            {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold font-mono">£{((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="p-3 text-center italic" style={cs.subtextStyle}>
                                                            No parts items included on invoice.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Block 9: Financial Totals */}
                            {block.type === 'financial_totals' && (
                                <div className="flex justify-end pt-1">
                                    <div className={`w-72 ${cs.wrapperClass} p-3.5 space-y-1.5 text-xs`} style={cs.wrapperStyle}>
                                        <div className="flex justify-between" style={cs.subtextStyle}>
                                            <span>Labour Subtotal:</span>
                                            <span className="font-mono font-semibold" style={cs.textStyle}>£{totals.labourSubtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between" style={cs.subtextStyle}>
                                            <span>Parts & Materials:</span>
                                            <span className="font-mono font-semibold" style={cs.textStyle}>£{totals.partsSubtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between" style={cs.subtextStyle}>
                                            <span>Net Amount:</span>
                                            <span className="font-mono font-bold" style={cs.textStyle}>£{totals.netSubtotal.toFixed(2)}</span>
                                        </div>
                                        {totals.vatBreakdown.map((vat, idx) => (
                                            <div key={idx} className="flex justify-between" style={cs.subtextStyle}>
                                                <span>{vat.name} ({vat.rate}%):</span>
                                                <span className="font-mono font-semibold" style={cs.textStyle}>£{vat.vat.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {totals.vatBreakdown.length === 0 && (
                                            <div className="flex justify-between" style={cs.subtextStyle}>
                                                <span>VAT:</span>
                                                <span className="font-mono font-semibold" style={cs.textStyle}>£0.00</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-base font-black border-t border-slate-300 pt-1.5" style={cs.textStyle}>
                                            <span>TOTAL DUE:</span>
                                            <span className="font-mono" style={{ color: cs.titleStyle?.color || accentColor }}>£{totals.grandTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 10: Bank Remittance Details */}
                            {block.type === 'bank_details' && (
                                <div className={`${cs.wrapperClass} p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs`} style={cs.wrapperStyle}>
                                    <div>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Bank Remittance Details'}
                                        </h4>
                                        <div className="text-[11px] pt-0.5" style={cs.subtextStyle}>
                                            {block.settings?.customBankNarrative || 'Please quote invoice reference on electronic BACS transfers.'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs font-mono" style={cs.textStyle}>
                                        <div><span className="text-[10px] block" style={cs.subtextStyle}>Bank</span><strong>{block.settings?.customBankName || resolvedEntity?.bankAccountName || 'Barclays Bank UK'}</strong></div>
                                        <div><span className="text-[10px] block" style={cs.subtextStyle}>Sort Code</span><strong>{block.settings?.customSortCode || resolvedEntity?.bankSortCode || '20-45-78'}</strong></div>
                                        <div><span className="text-[10px] block" style={cs.subtextStyle}>Account No.</span><strong>{block.settings?.customAccountNumber || resolvedEntity?.bankAccountNumber || '83920194'}</strong></div>
                                    </div>
                                </div>
                            )}

                            {/* Block 11: Terms of Business Sign-Off */}
                            {block.type === 'terms_signoff' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Terms of Business'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="text-[10px] leading-tight" style={cs.subtextStyle}>
                                            {block.settings?.customTermsText || resolvedEntity?.termsAndConditions || resolvedEntity?.storageTermsAndConditions || "Payment is strictly due upon invoice date unless formal 30-day trade account credit facility is in place. Title to all goods and parts supplied remains with the workshop until paid in full."}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 12: Legal Footer */}
                            {block.type === 'footer_legal' && (
                                <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
                                    <div>
                                        {resolvedEntity?.name || 'Brookspeed Automotive Ltd'}
                                        {resolvedEntity?.companyNumber && <span> | Company Reg No: {resolvedEntity.companyNumber}</span>}
                                        {resolvedEntity?.vatNumber && <span> | VAT Reg: {resolvedEntity.vatNumber}</span>}
                                    </div>
                                    <div>{block.settings?.customFooterText || resolvedEntity?.invoiceFooterText || 'Registered in England & Wales. Thank you for your business.'}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Optional Additional Pages for Inspection, Tyre & Damage Reports if requested */}
            {printOptions.showInspections && inspectionTemplate && job?.inspectionChecklist && job.inspectionChecklist.length > 0 && (
                <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
                    <header className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">{inspectionTemplate.name}</h2>
                        <div className="text-right text-sm">
                            <p><strong>Invoice:</strong> {(invoice as any).invoiceNumber || invoice.id}</p>
                            <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                        </div>
                    </header>
                    <main>
                        <InspectionChecklist
                            checklistData={job.inspectionChecklist}
                            onUpdate={() => { }}
                            isReadOnly={true}
                        />
                    </main>
                </div>
            )}

            {printOptions.showInspections && hasTyreData && (
                <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
                    <header className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">Tyre Safety Check</h2>
                        <div className="text-right text-sm">
                            <p><strong>Invoice:</strong> {(invoice as any).invoiceNumber || invoice.id}</p>
                            <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                        </div>
                    </header>
                    <main>
                        <TyreCheck tyreData={job!.tyreCheck!} onUpdate={() => { }} isReadOnly={true} />
                    </main>
                </div>
            )}

            {printOptions.showInspections && hasDamageReport && (
                <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
                    <header className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">Vehicle Condition Report</h2>
                        <div className="text-right text-sm">
                            <p><strong>Invoice:</strong> {(invoice as any).invoiceNumber || invoice.id}</p>
                            <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                        </div>
                    </header>
                    <main>
                        <VehicleDamageReport 
                            activePoints={job!.damagePoints || []} 
                            onUpdate={() => { }} 
                            isReadOnly={true} 
                            vehicleModel={vehicle?.model} 
                            vehicleColor={vehicle?.colour} 
                            imageId={vehicle?.inspectionDiagramId || vehicleImage?.id || matchedLibraryDiagram?.imageId || null} 
                            imageUrl={vehicleImage?.dataUrl || null} 
                        />
                    </main>
                </div>
            )}
        </div>
    );
};

export default PrintableInvoice;

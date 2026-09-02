import React, { useMemo, useState, useEffect } from 'react';
import {
    Job,
    Vehicle,
    Customer,
    Estimate,
    BusinessEntity,
    Engineer,
    TaxRate,
    EstimateLineItem,
    InspectionTemplate,
    ChecklistSection,
    InspectionDiagram,
    DocumentBlockConfig
} from '../types';
import InspectionChecklist from './InspectionChecklist';
import AsyncMedia from './AsyncMedia';
import { getFile } from '../utils/imageStore';
import { 
    COLOR_PALETTES, 
    DEFAULT_JOB_CARD_BLOCKS, 
    getContainerStyleClasses 
} from '../core/utils/documentTemplateDefaults';

interface PrintableJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    estimates?: Estimate[];
    entity?: BusinessEntity;
    engineers?: Engineer[];
    taxRates?: TaxRate[];
    printBlankInspectionSheet?: boolean;
    inspectionTemplates?: InspectionTemplate[];
    inspectionDiagrams?: InspectionDiagram[];
}

const PrintableJobCard: React.FC<PrintableJobCardProps> = ({
    job,
    vehicle,
    customer,
    estimates = [],
    entity,
    engineers = [],
    taxRates = [],
    printBlankInspectionSheet,
    inspectionTemplates = [],
    inspectionDiagrams = [],
}) => {
    if (!job) return null;

    const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(entity?.logoUrl || null);

    useEffect(() => {
        if (entity?.logoImageId) {
            getFile(entity.logoImageId).then(url => {
                if (url) setResolvedLogoUrl(url);
            });
        } else if (entity?.logoUrl) {
            setResolvedLogoUrl(entity.logoUrl);
        }
    }, [entity?.logoImageId, entity?.logoUrl]);

    const jobData = job as any;
    const fName = customer?.forename || jobData.customerForename || "";
    const sName = customer?.surname || jobData.customerSurname || "";
    const customerFullName = `${fName} ${sName}`.trim();
    const displayName = customerFullName || (job.customerId ? `ACCOUNT: ${job.customerId}` : "CUSTOMER NOT SPECIFIED");

    const segments = Array.isArray(job.segments) ? job.segments : (Array.isArray(jobData.tasks) ? jobData.tasks : []);
    const technicianIds = new Set(segments.map((s: any) => s?.engineerId).filter(Boolean));
    const safeEngineers = Array.isArray(engineers) ? engineers : [];
    const technicianNames = Array.from(technicianIds)
        .map(id => safeEngineers.find(e => e.id === id)?.name)
        .filter(Boolean)
        .join(', ');

    const lineItems: EstimateLineItem[] = useMemo(() => {
        const estItems = (estimates || []).flatMap(e => e.lineItems || []);
        if (estItems.length > 0) return estItems;
        // Fallback to job segments if no estimates attached
        return segments.map((s: any, idx: number) => ({
            id: s.id || `seg_${idx}`,
            description: s.description || s.name || `Workshop Operation #${idx + 1}`,
            quantity: s.duration || s.allocatedHours || 1,
            unitPrice: s.price || 0,
            isLabor: true,
            partNumber: 'LABOUR'
        }));
    }, [estimates, segments]);

    const tasksList = useMemo(() => {
        return lineItems.filter(li => li.isLabor || li.type === 'labor' || li.partNumber === 'LABOUR' || li.partNumber === 'MOT' || li.servicePackageId);
    }, [lineItems]);

    const partsList = useMemo(() => {
        return lineItems.filter(li => !li.isLabor && li.type !== 'labor' && li.partNumber !== 'LABOUR' && li.partNumber !== 'MOT' && !li.servicePackageId);
    }, [lineItems]);

    const totalCalculatedHours = useMemo(() => {
        const hourTotal = tasksList.reduce((sum, li) => sum + Number(li.quantity || 0), 0);
        return hourTotal > 0 ? hourTotal : (job.estimatedHours || 0);
    }, [tasksList, job.estimatedHours]);

    // Active Layout Configuration
    const layoutConfig = entity?.jobCardLayout;
    const blocks: DocumentBlockConfig[] = useMemo(() => {
        if (layoutConfig?.blocks && Array.isArray(layoutConfig.blocks) && layoutConfig.blocks.length > 0) {
            return [...layoutConfig.blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        return DEFAULT_JOB_CARD_BLOCKS;
    }, [layoutConfig]);

    const accentColor = layoutConfig?.accentColor || entity?.color || '#4f46e5';
    const entityThemeKey = (layoutConfig?.accentColor || entity?.color || 'indigo').toLowerCase();
    const themeColorDef = COLOR_PALETTES[entityThemeKey] || COLOR_PALETTES['indigo'];

    const inspectionTemplate = useMemo(() => {
        if (!job?.inspectionTemplateId) return null;
        const safeTemplates = Array.isArray(inspectionTemplates) ? inspectionTemplates : [];
        return safeTemplates.find(t => t.id === job.inspectionTemplateId) || null;
    }, [job?.inspectionTemplateId, inspectionTemplates]);

    const hasFilledChecklist = useMemo(() => {
        if (!job?.inspectionChecklist) return false;
        return job.inspectionChecklist.some(section =>
            (section.items || []).some(item => item.status !== 'na' || (item.comment && item.comment.trim() !== ''))
        );
    }, [job?.inspectionChecklist]);

    const blankChecklistData: ChecklistSection[] = useMemo(() => {
        if (!inspectionTemplate || !Array.isArray(inspectionTemplate.sections)) return [];
        return inspectionTemplate.sections.map(section => ({
            id: section.id,
            title: section.title,
            items: Array.isArray(section.items) ? section.items.map(item => ({
                id: item.id,
                label: item.label,
                status: 'na',
                comment: ''
            })) : []
        }));
    }, [inspectionTemplate]);

    const pageStyle: React.CSSProperties = {
        width: '210mm',
        minHeight: '297mm',
        padding: '16mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff'
    };

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

            {/* Main Job Card Page dynamically built from configured blocks */}
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
                                            {entity?.name || 'BROOKSPEED AUTOMOTIVE'}
                                        </h1>
                                        <div className="text-[11px] text-slate-600 space-y-0.5">
                                            <div>{entity?.addressLine1 || 'Unit 4, Speedwell Industrial Estate'}{entity?.addressLine2 ? `, ${entity.addressLine2}` : ''}</div>
                                            <div>{entity?.city || 'Eastleigh'}, {entity?.postcode || 'SO53 4NF'}</div>
                                            <div>
                                                Tel: <span className="font-semibold">{entity?.phone || '02380 641672'}</span> | Email: <span className="font-semibold">{entity?.email || 'service@brookspeed.com'}</span>
                                                {entity?.vatNumber && <span> | VAT: <span className="font-semibold">{entity.vatNumber}</span></span>}
                                                {entity?.companyNumber && <span> | Reg: <span className="font-semibold">{entity.companyNumber}</span></span>}
                                            </div>
                                        </div>
                                    </div>
                                    {(resolvedLogoUrl || entity?.logoUrl) && (
                                        <img 
                                            src={resolvedLogoUrl || entity?.logoUrl || ''} 
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
                                            {block.title || 'JOB CARD NUMBER'}
                                        </span>
                                        <span 
                                            className="text-lg font-black tracking-tight font-mono"
                                            style={cs.textStyle}
                                        >
                                            {job.id || 'JOB-ACTIVE'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-6 text-xs" style={cs.textStyle}>
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Date</span>
                                            <span className="font-bold" style={cs.textStyle}>
                                                {new Date((job as any).createdDate || (job as any).createdAt || job.scheduledDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Status</span>
                                            <span className="font-bold uppercase font-mono" style={cs.textStyle}>{job.status}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Key Slot / Tag</span>
                                            <span className="font-bold font-mono" style={cs.textStyle}>{job.keyNumber || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Technician</span>
                                            <span className="font-bold" style={cs.textStyle}>{technicianNames || 'Workshop Pool'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 3: Customer Details */}
                            {block.type === 'customer_details' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Customer Details'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="text-xs space-y-0.5" style={cs.textStyle}>
                                            <div className="font-bold text-sm">{displayName}</div>
                                            {customer?.addressLine1 && <div>{customer.addressLine1}{customer.addressLine2 ? `, ${customer.addressLine2}` : ''}</div>}
                                            {(customer?.city || customer?.postcode) && <div>{customer.city || ''} {customer.postcode ? <span className="font-semibold uppercase">{customer.postcode}</span> : ''}</div>}
                                            <div style={cs.subtextStyle}>
                                                Phone: <span className="font-semibold">{customer?.mobile || customer?.phone || 'No Contact Number'}</span>
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
                                            {block.title || 'Vehicle Details'}
                                        </h4>
                                        <span className="inline-block bg-yellow-400 text-black font-mono font-black text-xs px-2.5 py-0.5 rounded border border-yellow-500 shadow-2xs tracking-wider uppercase">
                                            {vehicle?.registration || 'NO REG'}
                                        </span>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style={cs.textStyle}>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Make & Model:</span><strong>{vehicle?.make} {vehicle?.model || 'Vehicle'}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Year / Colour:</span><strong>{vehicle?.year || '—'} / {vehicle?.colour || '—'}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>Mileage / Key:</span><strong>{(vehicle as any)?.mileage ? `${(vehicle as any).mileage.toLocaleString()} mi` : (job.mileage || (job as any)?.mileageIn ? `${job.mileage || (job as any)?.mileageIn} mi` : '—')} • Key #{job.keyNumber || '—'}</strong></div>
                                            <div><span className="block text-[10px]" style={cs.subtextStyle}>VIN / Chassis:</span><strong className="font-mono">{vehicle?.vin?.slice(-8) || vehicle?.vin || '—'}</strong></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 5: Narrative Description / Work Requested */}
                            {block.type === 'narrative_description' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Work Requested & Customer Narrative'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <p className="text-xs leading-relaxed italic whitespace-pre-wrap" style={cs.textStyle}>
                                            {job.description || job.notes || block.settings?.customNarrativeText || "Customer vehicle booked in for workshop inspection and scheduled maintenance."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Block 6: Tasks & Packages */}
                            {block.type === 'tasks_packages' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <div className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Workshop Operations & Labour Tasks'}
                                        </div>
                                        <span className="text-[10px] uppercase font-bold" style={cs.subtextStyle}>
                                            Total: {totalCalculatedHours}h
                                        </span>
                                    </div>
                                    <div className="p-0 overflow-x-auto">
                                        <table className="w-full text-xs text-left" style={cs.textStyle}>
                                            <thead className="bg-slate-50/60 border-b text-[10px] uppercase" style={cs.subtextStyle}>
                                                <tr>
                                                    <th className="p-2">Description</th>
                                                    <th className="p-2 text-center">Hours</th>
                                                    {block.settings?.showPrices !== false && <th className="p-2 text-right">Net Price</th>}
                                                    <th className="p-2 text-center w-12">Done</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/60">
                                                {tasksList.length > 0 ? (
                                                    tasksList.map((item, idx) => (
                                                        <tr key={item.id || idx}>
                                                            <td className="p-2 font-medium">
                                                                <div>{item.description}</div>
                                                                {block.settings?.showTechnicianNotes !== false && (item as any).notes && (
                                                                    <div className="text-[10px] italic pt-0.5" style={cs.subtextStyle}>Note: {(item as any).notes}</div>
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-center font-mono">{Number(item.quantity || 1).toFixed(2)}h</td>
                                                            {block.settings?.showPrices !== false && (
                                                                <td className="p-2 text-right font-semibold">£{((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>
                                                            )}
                                                            <td className="p-2 text-center">
                                                                <div className="w-4 h-4 border border-slate-400 rounded mx-auto bg-white/80"></div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="p-3 text-center italic" style={cs.subtextStyle}>
                                                            No discrete operations specified. Perform primary work description.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Block 7: Parts Items */}
                            {block.type === 'parts_items' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <div className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Parts & Materials'}
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
                                                    <th className="p-2 text-center w-12">Picked</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/60">
                                                {partsList.length > 0 ? (
                                                    partsList.map((item, idx) => (
                                                        <tr key={item.id || idx}>
                                                            {block.settings?.showPartNumbers !== false && (
                                                                <td className="p-2 font-mono text-[10px]" style={cs.subtextStyle}>{item.partNumber || '—'}</td>
                                                            )}
                                                            <td className="p-2 font-medium">{item.description}</td>
                                                            <td className="p-2 text-center">{item.quantity || 1}</td>
                                                            {block.settings?.showPrices !== false && <td className="p-2 text-right font-mono">£{Number(item.unitPrice || 0).toFixed(2)}</td>}
                                                            {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold font-mono">£{((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>}
                                                            <td className="p-2 text-center">
                                                                <div className="w-4 h-4 border border-slate-400 rounded mx-auto bg-white/80"></div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="p-3 text-center italic" style={cs.subtextStyle}>
                                                            No parts or consumables allocated.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Block 8: Labour Summary */}
                            {block.type === 'labour_summary' && (
                                <div className={`${cs.wrapperClass} flex items-center justify-between`} style={cs.wrapperStyle}>
                                    <div className="p-3.5" style={cs.textStyle}>
                                        <span className="font-bold">Technician Time Allocation</span>
                                        <div className="text-[11px]" style={cs.subtextStyle}>
                                            Allocated: {totalCalculatedHours.toFixed(2)} hrs | Lead Tech: {technicianNames || 'Unassigned'}
                                        </div>
                                    </div>
                                    <div className="p-3.5 flex items-center gap-4 text-xs font-mono font-bold" style={cs.textStyle}>
                                        <span className="bg-white/80 px-2 py-1 rounded border border-slate-200">Start: ___:___</span>
                                        <span className="bg-white/80 px-2 py-1 rounded border border-slate-200">Finish: ___:___</span>
                                    </div>
                                </div>
                            )}

                            {/* Block 11: Authorisation & Sign-Off */}
                            {block.type === 'terms_signoff' && (
                                <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                    <div className={cs.headerClass} style={cs.headerStyle}>
                                        <h4 className={cs.titleClass} style={cs.titleStyle}>
                                            {block.title || 'Terms & Authorisation'}
                                        </h4>
                                    </div>
                                    <div className={cs.bodyClass}>
                                        <div className="text-[10px] leading-tight" style={cs.subtextStyle}>
                                            {block.settings?.customTermsText || entity?.termsAndConditions || entity?.storageTermsAndConditions || "I hereby authorize the repair work and acknowledge receipt of vehicle in satisfactory condition. All parts replaced remain the property of the workshop until invoice is paid in full."}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            {block.settings?.showCustomerSignature !== false && (
                                                <div className="border-t border-slate-400 pt-1 flex justify-between text-[10px]" style={cs.subtextStyle}>
                                                    <span>Customer Signature</span>
                                                    <span>Date: ____________</span>
                                                </div>
                                            )}
                                            {block.settings?.showTechnicianSignature !== false && (
                                                <div className="border-t border-slate-400 pt-1 flex justify-between text-[10px]" style={cs.subtextStyle}>
                                                    <span>Technician Signature</span>
                                                    <span>Date: ____________</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Block 12: Legal Footer */}
                            {block.type === 'footer_legal' && (
                                <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
                                    <div>
                                        {entity?.name || 'Brookspeed Automotive Ltd'}
                                        {entity?.companyNumber && <span> | Company Reg No: {entity.companyNumber}</span>}
                                        {entity?.vatNumber && <span> | VAT Reg: {entity.vatNumber}</span>}
                                    </div>
                                    <div>{block.settings?.customFooterText || entity?.invoiceFooterText || 'Registered in England & Wales. Thank you for your business.'}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Optional Additional Pages for Inspection Sheets if requested */}
            {printBlankInspectionSheet && inspectionTemplate && blankChecklistData.length > 0 && (
                <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
                    <header className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">{inspectionTemplate.name}</h2>
                        <div className="text-right text-sm">
                            <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                            <p><strong>Job:</strong> {job?.id}</p>
                        </div>
                    </header>
                    <main>
                        <InspectionChecklist
                            checklistData={blankChecklistData}
                            onUpdate={() => { }}
                            isReadOnly={true}
                        />
                    </main>
                </div>
            )}

            {hasFilledChecklist && (
                <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={pageStyle}>
                    <header className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-2xl font-bold text-gray-800">{inspectionTemplate?.name || 'Inspection Report'}</h2>
                        <div className="text-right text-sm">
                            <p><strong>Vehicle:</strong> {vehicle?.registration}</p>
                            <p><strong>Job:</strong> {job?.id}</p>
                        </div>
                    </header>
                    <main>
                        <InspectionChecklist
                            checklistData={job.inspectionChecklist || []}
                            onUpdate={() => { }}
                            isReadOnly={true}
                        />
                    </main>
                </div>
            )}
        </div>
    );
};

export default PrintableJobCard;

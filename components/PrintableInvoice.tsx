import React, { useMemo, useState, useEffect } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, EstimateLineItem, ChecklistSection, ServicePackage, InspectionTemplate, InspectionDiagram } from '../types';
import { formatCurrency } from '../core/utils/formatUtils';
import InspectionChecklist from './InspectionChecklist';
import VehicleDamageReport from './VehicleDamageReport';
import TyreCheck from './TyreCheck';
import { getImage } from '../utils/imageStore';

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
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams }) => {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadLogo = async () => {
            if (entity?.logoImageId) {
                const url = await getImage(entity.logoImageId);
                if (url) {
                    setLogoUrl(url);
                    return;
                }
            }
            if (entity?.logoUrl) {
                setLogoUrl(entity.logoUrl);
            } else {
                setLogoUrl('/logo.png'); // Global system fallback
            }
        };
        loadLogo();
    }, [entity]);

    const inspectionTemplate = useMemo(() => {
        if (!job?.inspectionTemplateId || !inspectionTemplates) return null;
        return inspectionTemplates.find(t => t.id === job.inspectionTemplateId);
    }, [job?.inspectionTemplateId, inspectionTemplates]);

    const totals = useMemo(() => {
        if (!invoice) return { subtotal: 0, grandTotal: 0, vatBreakdown: [] };
        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));
        const vatBreakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        let subtotal = 0;
        (invoice.lineItems || []).forEach(item => {
            if (item.isPackageComponent) return;
            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);
            subtotal += itemNet;
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
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        return { subtotal, grandTotal: subtotal + totalVat, vatBreakdown: finalVatBreakdown };
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
        if (currentPage.sections.length > 0) pages.push(currentPage);
        return pages;
    }, [job?.inspectionChecklist, inspectionTemplate]);

    const hasTechnicianNotes = job && Array.isArray(job.technicianObservations) && job.technicianObservations.length > 0;
    
    // Improved checks for sub-reports
    const hasTyreData = useMemo(() => {
        if (!job?.tyreCheck) return false;
        return Object.values(job.tyreCheck).some(t => t && (t.indicator !== 'na' || t.pressure || t.comments || t.outer || t.middle || t.inner));
    }, [job?.tyreCheck]);

    const hasDamageReport = useMemo(() => {
        return job && Array.isArray(job.damagePoints) && job.damagePoints.length > 0;
    }, [job?.damagePoints]);

    // --- Styling Consts (EXACTLY AS ESTIMATE) ---
    const pageStyle = {
        width: '210mm',
        boxSizing: 'border-box' as const,
        backgroundColor: '#ffffff !important', 
        margin: '0 auto',
        display: 'block' as const,
        color: '#000000 !important'
    };

    const renderLine = (item: EstimateLineItem, isChild = false) => {
        const net = (item.quantity || 0) * (item.unitPrice || 0);
        const isPackage = item.servicePackageId && !item.isPackageComponent;
        
        const rowStyle: React.CSSProperties = {
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: isPackage ? '#f1f5f9' : (isChild ? '#fafafa' : 'transparent'),
            breakInside: 'avoid'
        };

        return (
            <tr key={item.id} style={rowStyle}>
                <td style={{ padding: isPackage ? '12px 10px' : '10px 10px', fontSize: isChild ? '11px' : '12px' }}>
                    <div style={{ fontWeight: isPackage ? '800' : '500', color: isPackage ? '#000' : '#334155' }}>
                        {isChild ? <span style={{ color: '#ccc', marginRight: '8px' }}>—</span> : null}
                        {item.description}
                        {item.partNumber && item.partNumber !== 'LABOUR' && (
                            <span style={{ marginLeft: '8px', fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                [{item.partNumber}]
                            </span>
                        )}
                    </div>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>{item.quantity}</td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: '11px', color: '#64748b' }}>{formatCurrency(item.unitPrice)}</td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: '#000' }}>{formatCurrency(net)}</td>
            </tr>
        );
    };

    const renderSectionHeader = (title: string) => (
        <tr style={{ backgroundColor: '#f8fafc' }}>
            <td colSpan={4} style={{ padding: '8px 10px', borderBottom: '2px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            </td>
        </tr>
    );

    const renderHeader = () => (
        <thead>
            <tr>
                <td>
                    <div style={{ height: '10mm' }}></div>
                    <div style={{ margin: '0 15mm 20px 15mm' }}>
                        {/* Centered INVOICE title */}
                        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                            <h2 style={{ fontSize: '36px', fontWeight: '900', color: '#334155', margin: 0, opacity: 0.8, letterSpacing: '0.1em' }}>INVOICE</h2>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: '2px solid #000' }}>
                            {/* Details on Left */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '18px', fontWeight: '900', color: '#000', marginBottom: '8px' }}>{entity?.name || 'BROOKSPEED'}</div>
                                <div style={{ fontSize: '10px', color: '#000', fontWeight: '500', lineHeight: '1.4' }}>
                                    <p>{entity?.addressLine1}, {entity?.city}, {entity?.postcode}</p>
                                    <div style={{ marginTop: '5px', display: 'flex', gap: '15px' }}>
                                        {entity?.vatNumber && <p>VAT: {entity.vatNumber}</p>}
                                        {entity?.email && <p>{entity.email}</p>}
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px', borderLeft: '3px solid #000', paddingLeft: '12px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>Invoice: #{invoice?.id}</div>
                                    <div style={{ fontSize: '12px', color: '#444' }}>Date: {invoice?.issueDate}</div>
                                </div>
                            </div>

                            {/* Logo on Right */}
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" style={{ maxHeight: '90px', maxWidth: '280px', width: 'auto', display: 'block' }} />
                                ) : (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#000' }}>{entity?.name || 'BROOKSPEED'}</div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Automotive Excellence</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </thead>
    );

    const renderFooter = () => (
        <tfoot>
            <tr>
                <td>
                    <div style={{ height: '10mm' }}></div>
                    <footer style={{ margin: '0 15mm 10mm 15mm', paddingBottom: '10mm' }}>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#94a3b8' }}>
                            <div style={{ fontStyle: 'italic' }}>
                                <p>Thank you for choosing {entity?.name}. Business Registered: {entity?.name} - {entity?.vatNumber}</p>
                            </div>
                            <div style={{ fontStyle: 'normal', fontWeight: 'bold' }}>
                                Page <span className="page-counter"></span>
                            </div>
                        </div>
                    </footer>
                </td>
            </tr>
        </tfoot>
    );

    return (
        <div className="rebuild-print-container" style={pageStyle}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body { counter-reset: page; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    .page-counter:after {
                        counter-increment: page;
                        content: counter(page);
                    }
                }
                * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            ` }} />

            {/* 1. Main Invoice Table */}
            <table className="printable-page-wrapper" style={{ width: '100%', borderCollapse: 'collapse' }}>
                {renderHeader()}
                <tbody>
                    <tr>
                        <td style={{ padding: '0 15mm' }}>
                            <main style={{ paddingBottom: '30px' }}>
                                <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Customer</h3>
                                        <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>{customer?.forename} {customer?.surname}</p>
                                        <p style={{ fontSize: '11px', color: '#64748b' }}>{customer?.addressLine1}, {customer?.city}, {customer?.postcode}</p>
                                    </div>
                                    <div style={{ flex: 1, paddingLeft: '60px' }}>
                                        <h3 style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Vehicle</h3>
                                        <p style={{ display: 'inline-block', fontSize: '16px', fontWeight: '900', backgroundColor: '#FFD700', color: '#000', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}>{vehicle?.registration}</p>
                                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginTop: '4px' }}>{vehicle?.make} {vehicle?.model} {job?.mileage ? `| ${job.mileage.toLocaleString()} miles` : ''}</p>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', borderTop: '2px solid #e2e8f0' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Description of Work</th>
                                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', width: '60px' }}>Qty</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', width: '100px' }}>Unit</th>
                                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', width: '100px' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedItems.packages.length > 0 && (
                                            <>
                                                {renderSectionHeader("Service Packages")}
                                                {groupedItems.packages.map(pkg => (
                                                    <React.Fragment key={pkg.header.id}>
                                                        {renderLine(pkg.header)}
                                                        {pkg.children.map(child => renderLine(child, true))}
                                                    </React.Fragment>
                                                ))}
                                            </>
                                        )}
                                        {groupedItems.labor.length > 0 && (
                                            <>
                                                {renderSectionHeader("Labour")}
                                                {groupedItems.labor.map(item => renderLine(item))}
                                            </>
                                        )}
                                        {groupedItems.parts.length > 0 && (
                                            <>
                                                {renderSectionHeader("Parts & Materials")}
                                                {groupedItems.parts.map(item => renderLine(item))}
                                            </>
                                        )}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                    <div style={{ width: '280px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                                            <span>Subtotal Net</span>
                                            <span style={{ color: '#000', fontWeight: 'bold' }}>{formatCurrency(totals.subtotal)}</span>
                                        </div>
                                        {totals.vatBreakdown.map(b => (
                                            <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                                                <span>{b.name} ({b.rate}%)</span>
                                                <span>{formatCurrency(b.vat)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '900', color: '#000', marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #e2e8f0' }}>
                                            <span>TOTAL</span>
                                            <span>{formatCurrency(totals.grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </main>
                        </td>
                    </tr>
                </tbody>
                {renderFooter()}
            </table>

            {/* 2. Technician Notes Table */}
            {hasTechnicianNotes && (
                <table className="printable-page-wrapper" style={{ width: '100%', borderCollapse: 'collapse', breakBefore: 'page' }}>
                    {renderHeader()}
                    <tbody>
                        <tr>
                            <td style={{ padding: '0 15mm' }}>
                                <main style={{ paddingBottom: '30px' }}>
                                    <div style={{ breakInside: 'avoid' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>Technician Observations</h3>
                                        <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#334155' }}>
                                            {job.technicianObservations?.map((obs, i) => (
                                                <div key={i} style={{ marginBottom: '10px', paddingLeft: '15px', position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: 0, color: '#94a3b8' }}>•</span> {obs}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </main>
                            </td>
                        </tr>
                    </tbody>
                    {renderFooter()}
                </table>
            )}

            {/* 3. Inspection Report Tables */}
            {inspectionPages.map((page, idx) => (
                <table key={idx} className="printable-page-wrapper" style={{ width: '100%', borderCollapse: 'collapse', breakBefore: 'page' }}>
                    {renderHeader()}
                    <tbody>
                        <tr>
                            <td style={{ padding: '0 15mm' }}>
                                <main style={{ paddingBottom: '30px' }}>
                                    <div style={{ breakInside: 'avoid' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>Inspection Report</h3>
                                        <InspectionChecklist checklistData={page.sections} onUpdate={()=>{}} isReadOnly={true} />
                                    </div>
                                </main>
                            </td>
                        </tr>
                    </tbody>
                    {renderFooter()}
                </table>
            ))}

            {/* 4. Tyre Check Table */}
            {hasTyreData && (
                <table className="printable-page-wrapper" style={{ width: '100%', borderCollapse: 'collapse', breakBefore: 'page' }}>
                    {renderHeader()}
                    <tbody>
                        <tr>
                            <td style={{ padding: '0 15mm' }}>
                                <main style={{ paddingBottom: '30px' }}>
                                    <div style={{ breakInside: 'avoid' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>Tyre Safety Check</h3>
                                        <TyreCheck tyreData={job.tyreCheck!} onUpdate={()=>{}} isReadOnly={true} />
                                    </div>
                                </main>
                            </td>
                        </tr>
                    </tbody>
                    {renderFooter()}
                </table>
            )}

            {/* 5. Damage Report Table */}
            {hasDamageReport && (
                <table className="printable-page-wrapper" style={{ width: '100%', borderCollapse: 'collapse', breakBefore: 'page' }}>
                    {renderHeader()}
                    <tbody>
                        <tr>
                            <td style={{ padding: '0 15mm' }}>
                                <main style={{ paddingBottom: '30px' }}>
                                    <div style={{ breakInside: 'avoid' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>Vehicle Condition Report</h3>
                                        <VehicleDamageReport activePoints={job.damagePoints || []} onUpdate={()=>{}} isReadOnly={true} vehicleModel={vehicle?.model} vehicleColor={vehicle?.colour} imageId={null} />
                                    </div>
                                </main>
                            </td>
                        </tr>
                    </tbody>
                    {renderFooter()}
                </table>
            )}
        </div>
    );
};

export default PrintableInvoice;

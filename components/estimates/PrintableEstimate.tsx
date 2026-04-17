import React, { useMemo } from 'react';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, Part, EstimateLineItem } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';
import { getDisplayDate } from './EstimateShared';

interface PrintableEstimateProps {
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    entityDetails?: BusinessEntity;
    taxRates: TaxRate[];
    parts: Part[];
    canViewPricing: boolean;
    totals: { totalNet: number; grandTotal: number; vatBreakdown: any[] };
    depositAmount?: number;
}

export const PrintableEstimate: React.FC<PrintableEstimateProps> = ({ estimate, customer, vehicle, entityDetails, parts, canViewPricing, totals, depositAmount }) => {
    // Simplifed Body (Classic Table feel but clean)
    const allItems = estimate.lineItems || [];
    const essentialItems = allItems.filter(i => !i.isOptional);
    const optionalItems = allItems.filter(i => i.isOptional);

    const groupedEssential = useMemo(() => {
        const labor: EstimateLineItem[] = [];
        const partsItems: EstimateLineItem[] = [];
        const packages: { header: EstimateLineItem; children: EstimateLineItem[] }[] = [];
        
        const topLevel = essentialItems.filter(i => !i.isPackageComponent);
        const childMap = new Map<string, EstimateLineItem[]>();
        
        essentialItems.forEach(i => {
            if (i.isPackageComponent && i.servicePackageId) {
                const list = childMap.get(i.servicePackageId) || [];
                list.push(i);
                childMap.set(i.servicePackageId, list);
            }
        });

        topLevel.forEach(item => {
            if (item.servicePackageId) {
                packages.push({ header: item, children: childMap.get(item.servicePackageId) || [] });
            } else if (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || item.partNumber === 'MOT') {
                labor.push(item);
            } else {
                partsItems.push(item);
            }
        });
        return { labor, parts: partsItems, packages };
    }, [essentialItems]);

    const groupedOptional = useMemo(() => {
        const labor: EstimateLineItem[] = [];
        const partsItems: EstimateLineItem[] = [];
        const packages: { header: EstimateLineItem; children: EstimateLineItem[] }[] = [];
        
        const topLevel = optionalItems.filter(i => !i.isPackageComponent);
        const childMap = new Map<string, EstimateLineItem[]>();
        
        optionalItems.forEach(i => {
            if (i.isPackageComponent && i.servicePackageId) {
                const list = childMap.get(i.servicePackageId) || [];
                list.push(i);
                childMap.set(i.servicePackageId, list);
            }
        });

        topLevel.forEach(item => {
            if (item.servicePackageId) {
                packages.push({ header: item, children: childMap.get(item.servicePackageId) || [] });
            } else if (item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || item.partNumber === 'MOT') {
                labor.push(item);
            } else {
                partsItems.push(item);
            }
        });
        return { labor, parts: partsItems, packages };
    }, [optionalItems]);

    const pageStyle = {
        width: '210mm',
        boxSizing: 'border-box' as const,
        backgroundColor: '#ffffff !important', // Force white
        margin: '0 auto',
        display: 'block' as const,
        color: '#000000 !important' // Force black text
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
                        {isChild ? <span className="text-gray-300 mr-2">—</span> : null}
                        {item.optionLabel && <span style={{ color: '#4f46e5', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>{item.optionLabel}</span>}
                        {item.description}
                        {item.partNumber && <span className="ml-2 text-[9px] text-gray-400 font-mono tracking-tighter uppercase">[{item.partNumber}]</span>}
                    </div>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>{item.quantity}</td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: '11px', color: '#64748b' }}>{canViewPricing ? formatCurrency(item.unitPrice) : '---'}</td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: '#000' }}>{canViewPricing ? formatCurrency(net) : '---'}</td>
            </tr>
        );
    };

    const renderSectionHeader = (title: string) => (
        <tr className="bg-gray-100/50">
            <td colSpan={4} style={{ padding: '8px 10px', borderBottom: '2px solid #e2e8f0' }}>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</span>
            </td>
        </tr>
    );

    return (
        <div className="rebuild-print-container" style={{ ...pageStyle, display: 'block', padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead className="print-header-group">
                    <tr>
                        <td>
                             {/* HEADING REPEATS ON EVERY PAGE */}
                            <div className="print-header-padding" style={{ height: '10mm' }}></div>
                            <div id="estimate-print-header" style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: '2px solid #000', margin: '0 15mm 20px 15mm' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        {entityDetails?.logoUrl && (
                                            <img src={entityDetails.logoUrl} alt="Logo" style={{ height: '50px', marginBottom: '8px', objectFit: 'contain' }} />
                                        ) || (
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#000', marginBottom: '8px' }}>BROOKSPEED</div>
                                        )}
                                        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#000', margin: '0 0 2px 0' }}>
                                            {entityDetails?.name || 'BROOKSPEED'}
                                        </h1>
                                        <div style={{ fontSize: '10px', color: '#000', fontWeight: '500' }}>
                                            <p>{entityDetails?.addressLine1}, {entityDetails?.city}, {entityDetails?.postcode}</p>
                                            <div style={{ marginTop: '5px', display: 'flex', gap: '15px' }}>
                                                {entityDetails?.vatNumber && <p>VAT: {entityDetails.vatNumber}</p>}
                                                {entityDetails?.email && <p>{entityDetails.email}</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#475569', margin: 0, lineHeight: 1 }}>
                                            {depositAmount && depositAmount > 0 ? 'DEPOSIT RECEIPT' : 'ESTIMATE'}
                                        </h2>
                                        <div style={{ marginTop: '12px' }}>
                                            <p style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', color: '#000' }}>#{estimate?.estimateNumber}</p>
                                            <p style={{ marginTop: '2px', fontSize: '11px', color: '#6b7280' }}>Date: {getDisplayDate(estimate.issueDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                </thead>

                <tbody>
                    <tr>
                        <td style={{ padding: '0 15mm' }}>
                            <main style={{ paddingBottom: '30px' }}>
                                <div className="grid grid-cols-2 gap-10 mb-8 pb-6 border-b border-gray-100">
                                    <div>
                                        <h3 className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Customer</h3>
                                        <p className="text-sm font-bold" style={{ color: '#000' }}>{customer?.forename} {customer?.surname}</p>
                                        <p className="text-gray-600 text-[11px]">{customer?.addressLine1}, {customer?.city}, {customer?.postcode}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vehicle</h3>
                                        <p className="text-base font-black font-mono bg-[#FFD700] text-black border border-black/10 px-2 py-0.5 inline-block rounded shadow-sm">{vehicle?.registration}</p>
                                        <p className="text-gray-600 font-bold mt-1 text-[11px]">{vehicle?.make} {vehicle?.model} {vehicle?.year ? `(${vehicle.year})` : ''}</p>
                                    </div>
                                </div>

                                <table className="w-full text-left" style={{ borderCollapse: 'collapse', marginBottom: '20px' }}>
                                    <thead className="bg-gray-50 border-y-2 border-gray-200">
                                        <tr>
                                            <th className="p-2.5 text-[9px] uppercase tracking-widest font-bold text-gray-500">Description of Work</th>
                                            <th className="p-2.5 text-[9px] uppercase tracking-widest font-bold text-gray-500 text-center w-14">Qty</th>
                                            <th className="p-2.5 text-[9px] uppercase tracking-widest font-bold text-gray-500 text-right w-24">Unit Price</th>
                                            <th className="p-2.5 text-[9px] uppercase tracking-widest font-bold text-gray-500 text-right w-24">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedEssential.packages.length > 0 && (
                                            <>
                                                {renderSectionHeader("Service Packages")}
                                                {groupedEssential.packages.map(pkg => (
                                                    <React.Fragment key={pkg.header.id}>
                                                        {renderLine(pkg.header)}
                                                        {pkg.children.map(child => renderLine(child, true))}
                                                    </React.Fragment>
                                                ))}
                                            </>
                                        )}
                                        
                                        {groupedEssential.labor.length > 0 && (
                                            <>
                                                {renderSectionHeader("Labour")}
                                                {groupedEssential.labor.map(item => renderLine(item))}
                                            </>
                                        )}

                                        {groupedEssential.parts.length > 0 && (
                                            <>
                                                {renderSectionHeader("Parts & Materials")}
                                                {groupedEssential.parts.map(item => renderLine(item))}
                                            </>
                                        )}

                                        {essentialItems.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-400 italic text-xs">No essential items listed</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {optionalItems.length > 0 && (
                                    <div className="mt-8 page-break-inside-avoid">
                                        <div className="bg-indigo-50 p-2 px-4 rounded-t-lg border-t border-x border-indigo-100">
                                            <h3 className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Recommended Additional Work</h3>
                                        </div>
                                        <table className="w-full text-left bg-indigo-50/20 border-x border-b border-indigo-100 rounded-b-lg">
                                            <tbody>
                                                {groupedOptional.packages.length > 0 && (
                                                    <>
                                                        {renderSectionHeader("Service Packages")}
                                                        {groupedOptional.packages.map(pkg => (
                                                            <React.Fragment key={pkg.header.id}>
                                                                {renderLine(pkg.header)}
                                                                {pkg.children.map(child => renderLine(child, true))}
                                                            </React.Fragment>
                                                        ))}
                                                    </>
                                                )}
                                                
                                                {groupedOptional.labor.length > 0 && (
                                                    <>
                                                        {renderSectionHeader("Labour")}
                                                        {groupedOptional.labor.map(item => renderLine(item))}
                                                    </>
                                                )}

                                                {groupedOptional.parts.length > 0 && (
                                                    <>
                                                        {renderSectionHeader("Parts & Materials")}
                                                        {groupedOptional.parts.map(item => renderLine(item))}
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="mt-8 flex justify-end page-break-inside-avoid">
                                    <div className="w-72 space-y-2.5 bg-gray-50 p-5 rounded-xl border border-gray-100">
                                        {canViewPricing ? (
                                            <>
                                                <div className="flex justify-between text-gray-400 font-bold uppercase text-[9px]">
                                                    <span>Subtotal Net</span>
                                                    <span className="text-gray-900">{formatCurrency(totals.totalNet)}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {totals.vatBreakdown.map((b: any) => (
                                                        <div key={b.name} className="flex justify-between text-[10px] text-gray-400">
                                                            <span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span>
                                                            <span>{formatCurrency(b.vat)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-1">
                                                    <span className="text-gray-900 font-black uppercase text-xs">Total Estimated</span>
                                                    <span className="text-xl font-black text-black">{formatCurrency(totals.grandTotal)}</span>
                                                </div>
                                                {typeof depositAmount === 'number' && depositAmount > 0 && (
                                                    <div className="space-y-2 mt-4 pt-4 border-t-2 border-indigo-600">
                                                        <div className="flex justify-between text-indigo-600 font-bold uppercase text-[10px] bg-indigo-50 p-2 rounded -mx-2">
                                                            <span>Deposit Received</span>
                                                            <span>{formatCurrency(depositAmount)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-gray-900 font-black uppercase text-xs">Total Balance Due</span>
                                                            <span className="text-xl font-black text-indigo-700">{formatCurrency(totals.grandTotal - depositAmount)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-center italic text-gray-400 text-xs">Pricing Hidden</p>
                                        )}
                                    </div>
                                </div>
                            </main>
                        </td>
                    </tr>
                </tbody>

                <tfoot className="print-footer-group">
                    <tr>
                        <td>
                            <div className="footer-spacing" style={{ height: '10mm' }}></div>
                             <footer style={{ margin: '0 15mm 10mm 15mm', paddingBottom: '10mm' }}>
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#94a3b8' }}>
                                    <div style={{ fontStyle: 'italic' }}>
                                        <p>This estimate is valid for 30 days. Final costs subject to actual parts and labor.</p>
                                    </div>
                                    <div className="footer-page-number" style={{ fontStyle: 'normal', fontWeight: 'bold' }}></div>
                                </div>
                                <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '8px', color: '#cbd5e1', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                                    BROOKSPEED PRODUCTION SYSTEM v8.02
                                </div>
                            </footer>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

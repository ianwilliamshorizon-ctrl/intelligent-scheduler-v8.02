
import React, { useMemo } from 'react';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, Part, EstimateLineItem } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';
import { EstimateTable, getDisplayDate } from './EstimateShared';

interface PrintableEstimateProps {
    estimate: Estimate;
    customer?: Customer;
    vehicle?: Vehicle;
    entityDetails?: BusinessEntity;
    taxRates: TaxRate[];
    parts: Part[];
    isInternal: boolean;
    canViewPricing: boolean;
    totals: { totalNet: number; grandTotal: number; vatBreakdown: any[] };
}

export const PrintableEstimate: React.FC<PrintableEstimateProps> = ({ estimate, customer, vehicle, entityDetails, parts, isInternal, canViewPricing, totals }) => {
    const partsMap = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);
    
    // Group Items into Essentials and Optionals
    const { essentialRows, optionalRows } = useMemo(() => {
        const essentials: any[] = [];
        const optionals: any[] = [];
        const allItems = estimate.lineItems || [];
        
        // Helper to structure rows
        const processItems = (items: EstimateLineItem[], targetArray: any[]) => {
            const packageHeaders = items.filter(item => item.servicePackageId && !item.isPackageComponent);
            const processedPackageIds = new Set();

            packageHeaders.forEach(header => {
                const children = allItems.filter(item => item.isPackageComponent && item.servicePackageId === header.servicePackageId);
                targetArray.push({ header, children });
                processedPackageIds.add(header.servicePackageId);
            });

            items.forEach(item => {
                if (!item.servicePackageId && !item.isPackageComponent) {
                    targetArray.push({ standalone: item });
                }
            });
        };

        const essentialItems = allItems.filter(i => !i.isOptional);
        const optionalItemsList = allItems.filter(i => i.isOptional);

        processItems(essentialItems, essentials);
        processItems(optionalItemsList, optionals);

        return { essentialRows: essentials, optionalRows: optionals };
    }, [estimate.lineItems]);

    return (
        <div className="bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', padding: '15mm', boxSizing: 'border-box' }}>
             <header className="pb-6 border-b mb-6">
                <div style={{ marginBottom: '5mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{entityDetails?.name}</h1>
                        <p>{entityDetails?.addressLine1}</p>
                        <p>{entityDetails?.city}, {entityDetails?.postcode}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-gray-800">ESTIMATE</h2>
                        <p className="text-lg">#{estimate?.estimateNumber}</p>
                        <p className="mt-1">Date: {getDisplayDate(estimate.issueDate)}</p>
                    </div>
                </div>
            </header>
            
            <main>
                <section style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Customer</h3>
                        <p className="font-bold text-gray-900 text-base">{customer?.forename} {customer?.surname}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Vehicle</h3>
                        <p className="font-bold text-gray-900 text-base">{vehicle?.registration}</p>
                        <p>{vehicle?.make} {vehicle?.model}</p>
                    </div>
                </section>

                <section>
                    <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">Proposed Work</h3>
                    <EstimateTable items={essentialRows} isInternal={isInternal} canViewPricing={canViewPricing} partsMap={partsMap} />
                </section>

                {optionalRows.length > 0 && (
                    <section className="mt-8 page-break-inside-avoid">
                        <div className="flex items-center gap-2 mb-2 border-b pb-1">
                            <h3 className="font-bold text-indigo-800">Optional Extras & Recommendations</h3>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Optional</span>
                        </div>
                        <EstimateTable items={optionalRows} isInternal={isInternal} canViewPricing={canViewPricing} partsMap={partsMap} />
                    </section>
                )}
            </main>

            {canViewPricing && (
                <footer style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '250px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Net Total</span><span style={{ fontWeight: '600' }}>{formatCurrency(totals.totalNet)}</span></div>
                            {totals.vatBreakdown.map((b: any) => (<div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#6b7280' }}><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #d1d5db', marginTop: '8px', fontWeight: 'bold', fontSize: '16px' }}><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};

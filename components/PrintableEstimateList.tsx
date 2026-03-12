import React from 'react';
import { Estimate, Customer, Vehicle, EstimateLineItem, TaxRate } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface PrintableEstimateListProps {
    estimates: Estimate[];
    customers: Map<string, Customer>;
    vehicles: Map<string, Vehicle>;
    taxRates: TaxRate[];
    title: string;
}

const PrintableEstimateList: React.FC<PrintableEstimateListProps> = ({ 
    estimates, 
    customers, 
    vehicles, 
    taxRates, 
    title 
}) => {
    // 1. Logic Helpers
    const taxRatesMap = new Map<string, number>(taxRates.map(t => [t.id, t.rate]));
    const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;

    const calculateTotal = (lineItems: EstimateLineItem[]) => {
        let totalNet = 0;
        let totalVat = 0;

        (lineItems || []).forEach(item => {
            if (item.isOptional) return;

            const itemNet = (item.quantity || 0) * (item.unitPrice || 0);

            if (!item.isPackageComponent) {
                totalNet += itemNet;
            }

            const effectiveTaxCodeId = (item.taxCodeId === 'Taxstd' || !item.taxCodeId) 
                ? standardTaxRateId 
                : item.taxCodeId;

            const rate = effectiveTaxCodeId ? (taxRatesMap.get(effectiveTaxCodeId) || 0) / 100 : 0;
            totalVat += itemNet * rate;
        });

        return totalNet + totalVat;
    };

    return (
        <div style={{ 
            backgroundColor: '#ffffff', 
            color: '#000000', 
            fontFamily: 'Arial, sans-serif', 
            width: '210mm', 
            padding: '15mm', 
            margin: '0 auto',
            boxSizing: 'border-box',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
        }}>
            {/* THE SAFETY NET:
                This style block is injected directly into the document. 
                It forces the browser to show this specific component and hide the 
                background UI, which solves the "Blank Page" issue.
            */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: A4 vertical; 
                        margin: 10mm; 
                    }
                    /* Hide everything else on the screen */
                    body * { 
                        visibility: hidden; 
                    }
                    /* Specifically show ONLY the printable content and its children */
                    .rebuild-print-container, .rebuild-print-container * { 
                        visibility: visible !important; 
                    }
                    .rebuild-print-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                    }
                    /* Force table borders to render */
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        margin-top: 20px !important;
                    }
                    th { 
                        background-color: #f2f2f2 !important; 
                        -webkit-print-color-adjust: exact; 
                    }
                    td, th { 
                        border: 1px solid #333333 !important; 
                        padding: 10px !important; 
                        color: #000 !important; 
                    }
                }
            `}} />

            <div className="rebuild-print-container">
                <header style={{ 
                    borderBottom: '3px solid #000000', 
                    paddingBottom: '15px', 
                    marginBottom: '25px' 
                }}>
                    <h1 style={{ fontSize: '26px', margin: '0 0 5px 0', fontWeight: 'bold', color: '#000' }}>
                        Estimates Report
                    </h1>
                    <h2 style={{ fontSize: '18px', margin: '0', color: '#333' }}>
                        {title}
                    </h2>
                    <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', textTransform: 'uppercase' }}>
                        Generated: {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString('en-GB')}
                    </p>
                </header>

                <main>
                    <table style={{ width: '100%', border: '1px solid #333', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f2f2f2' }}>
                                <th style={{ textAlign: 'left' }}>Estimate #</th>
                                <th style={{ textAlign: 'left' }}>Issue Date</th>
                                <th style={{ textAlign: 'left' }}>Customer</th>
                                <th style={{ textAlign: 'left' }}>Vehicle</th>
                                <th style={{ textAlign: 'left' }}>Status</th>
                                <th style={{ textAlign: 'right' }}>Total (Inc. VAT)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estimates.length > 0 ? (
                                estimates.map(est => {
                                    const customer = customers.get(est.customerId);
                                    const vehicle = est.vehicleId ? vehicles.get(est.vehicleId) : null;
                                    const total = calculateTotal(est.lineItems);
                                    
                                    return (
                                        <tr key={est.id}>
                                            <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                                                {est.estimateNumber}
                                            </td>
                                            <td>{est.issueDate}</td>
                                            <td>{getCustomerDisplayName(customer)}</td>
                                            <td>{vehicle?.registration || 'N/A'}</td>
                                            <td style={{ fontSize: '10px' }}>
                                                {est.status.toUpperCase()}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                {formatCurrency(total)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                        No estimates found for the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </main>

                <footer style={{ 
                    marginTop: '40px', 
                    paddingTop: '10px', 
                    borderTop: '1px solid #eee', 
                    fontSize: '9px', 
                    color: '#999', 
                    textAlign: 'center' 
                }}>
                    Workshop Management System - Confidential Report
                </footer>
            </div>
        </div>
    );
};

export default PrintableEstimateList;
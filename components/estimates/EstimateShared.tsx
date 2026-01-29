
import React from 'react';
import { EstimateLineItem, Part } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';
import { formatReadableDate, formatDate } from '../../core/utils/dateUtils';

// Helper to safely format date or return today's date if invalid
export const getDisplayDate = (dateStr?: string) => {
    try {
        if (!dateStr || dateStr === 'Nan-Nan-Nan' || dateStr.includes('NaN')) {
            return formatReadableDate(formatDate(new Date()));
        }
        return formatReadableDate(dateStr);
    } catch (e) {
        return formatReadableDate(formatDate(new Date()));
    }
};

interface EstimateTableProps {
    items: { header?: EstimateLineItem, children?: EstimateLineItem[], standalone?: EstimateLineItem }[];
    isInternal: boolean;
    canViewPricing: boolean;
    partsMap: Map<string, Part>;
}

export const EstimateTable: React.FC<EstimateTableProps> = ({ items, isInternal, canViewPricing, partsMap }) => {
    
    const formatDescription = (description: string) => {
        // Remove internal codes like [PN:...] if they exist in description text
        if (!description) return '';
        return description.replace(/\[PN:.*?\]\s*/g, '');
    };

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
            <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#4b5563', width: isInternal ? '40%' : '55%' }}>Description</th>
                    {isInternal && <th style={{ textAlign: 'left', padding: '8px', color: '#4b5563', width: '15%' }}>Part No.</th>}
                    <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563', width: '10%' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563', width: '15%' }}>Unit Price</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563', width: '15%' }}>Total</th>
                </tr>
            </thead>
            <tbody>
                {items.map((row, index) => {
                    if (row.standalone) {
                        const item = row.standalone;
                        const part = item.partId ? partsMap.get(item.partId) : null;
                        return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px', verticalAlign: 'middle' }}>{formatDescription(item.description)}</td>
                                {isInternal && <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', verticalAlign: 'middle' }}>{item.partNumber || part?.partNumber || '-'}</td>}
                                <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'middle' }}>{item.quantity}</td>
                                <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'middle' }}>{canViewPricing ? formatCurrency(item.unitPrice) : '----'}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '500', verticalAlign: 'middle' }}>{canViewPricing ? formatCurrency(item.quantity * item.unitPrice) : '----'}</td>
                            </tr>
                        );
                    } else if (row.header && row.children) {
                        return (
                            <React.Fragment key={row.header.id}>
                                {/* Spacer row for PDF rendering */}
                                <tr style={{ height: '8px' }}><td colSpan={isInternal ? 5 : 4}></td></tr>
                                {/* Package Header */}
                                <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#eef2ff' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#3730a3', fontSize: '13px', verticalAlign: 'middle' }} colSpan={isInternal ? 2 : 1}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>📦</span>
                                            {formatDescription(row.header.description)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'middle' }}>{row.header.quantity}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'middle' }}>{canViewPricing ? formatCurrency(row.header.unitPrice) : '----'}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>{canViewPricing ? formatCurrency(row.header.quantity * row.header.unitPrice) : '----'}</td>
                                </tr>
                                {/* Package Children */}
                                {row.children.map(child => {
                                    const part = child.partId ? partsMap.get(child.partId) : null;
                                    return (
                                        <tr key={child.id} style={{ borderBottom: '1px solid #f9fafb', color: '#6b7280', fontSize: '11px' }}>
                                            <td style={{ padding: '4px 8px 4px 32px', verticalAlign: 'middle' }}>- {formatDescription(child.description)}</td>
                                            {isInternal && <td style={{ padding: '4px 8px', fontFamily: 'monospace', verticalAlign: 'middle' }}>{child.partNumber || part?.partNumber || '-'}</td>}
                                            <td style={{ padding: '4px 8px', textAlign: 'right', verticalAlign: 'middle' }}>{child.quantity}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', verticalAlign: 'middle' }}>{isInternal && canViewPricing ? formatCurrency(child.unitCost || 0) : 'Included'}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', verticalAlign: 'middle' }}></td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    }
                    return null;
                })}
            </tbody>
        </table>
    );
};

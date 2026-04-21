import React from 'react';
import { BusinessEntity } from '../../types';

interface PrintableDocumentLayoutProps {
    entity?: BusinessEntity;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

export const PrintableDocumentLayout: React.FC<PrintableDocumentLayoutProps> = ({ entity, title, subtitle, children }) => {
    return (
        <div 
            className="print-container font-sans text-sm text-gray-800 bg-white"
            style={{ padding: '20mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
            <table className="w-full">
                <thead>
                    <tr>
                        <td>
                            <div className="print-header-space" />
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div className="print-content">
                                {children}
                            </div>
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td>
                            <div className="print-footer-space" />
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Header fixed to top of every page */}
            <div className="print-header print-border flex justify-between items-start border-b-2 border-black print-border-b pb-4 px-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{entity?.name || 'BROOKSPEED'}</h1>
                    <p className="text-[10px] text-gray-600 leading-tight">
                        {entity?.addressLine1}{entity?.city ? `, ${entity.city}` : ''}{entity?.postcode ? `, ${entity.postcode}` : ''}
                        {entity?.vatNumber && <span className="ml-2">• VAT: {entity.vatNumber}</span>}
                    </p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-indigo-700 uppercase">{title}</h2>
                    {subtitle && <p className="text-xs font-semibold text-gray-500">{subtitle}</p>}
                </div>
            </div>

            {/* Footer fixed to bottom of every page */}
            <div className="print-footer px-2 py-4 flex justify-between items-end text-[9px] text-gray-500 italic">
                <div>
                    {entity?.invoiceFooterText && <p className="max-w-md">{entity.invoiceFooterText}</p>}
                    <p className="mt-1 font-bold">Registered in England & Wales • {entity?.companyNumber || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p>Printed on {new Date().toLocaleString('en-GB')}</p>
                    <p className="font-bold">Page 1 of 1</p>
                </div>
            </div>
        </div>
    );
};

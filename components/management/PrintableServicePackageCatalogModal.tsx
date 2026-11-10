import React, { useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, CheckCircle2, Building2, Wrench, Package as PackageIcon, ShieldCheck } from 'lucide-react';
import { ServicePackage, BusinessEntity } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';

interface PrintableServicePackageCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    packages: ServicePackage[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
}

export const PrintableServicePackageCatalogModal: React.FC<PrintableServicePackageCatalogModalProps> = ({
    isOpen,
    onClose,
    packages,
    businessEntities,
    selectedEntityId
}) => {
    const printComponentRef = useRef<HTMLDivElement>(null);

    const activeEntityName = useMemo(() => {
        if (selectedEntityId === 'all') return 'All Entities (Brookspeed Group)';
        const entity = businessEntities.find(e => e.id === selectedEntityId);
        return entity?.name || 'Selected Entity';
    }, [selectedEntityId, businessEntities]);

    // Group packages by business entity
    const groupedPackages = useMemo(() => {
        const groups: { [entityKey: string]: { entity: BusinessEntity | undefined; packages: ServicePackage[] } } = {};

        packages.forEach(pkg => {
            const entId = pkg.entityId || 'ent_unassigned';
            if (!groups[entId]) {
                const entObj = businessEntities.find(e => e.id === entId);
                groups[entId] = {
                    entity: entObj,
                    packages: []
                };
            }
            groups[entId].packages.push(pkg);
        });

        return groups;
    }, [packages, businessEntities]);

    const totalLineItems = useMemo(() => {
        return packages.reduce((sum, p) => sum + (p.costItems?.length || 0), 0);
    }, [packages]);

    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `Brookspeed_Service_Packages_Catalogue_${selectedEntityId}_${new Date().toISOString().split('T')[0]}`
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[96vh] overflow-hidden border border-gray-200">
                
                {/* Modal Header Toolbar (Non-printable) */}
                <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
                            <FileText size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                                Service Packages Publication
                                <span className="bg-rose-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                    {packages.length} {packages.length === 1 ? 'Package' : 'Packages'}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                                <Building2 size={13} className="text-rose-400" />
                                <span>Filter Scope: <strong className="text-white">{activeEntityName}</strong></span>
                                <span className="text-slate-500">•</span>
                                <span>{totalLineItems} Operations & Parts</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            title="Print or Save as PDF"
                        >
                            <Printer size={16} />
                            <span>Print / Save PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                            title="Close preview"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Printable Document Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100 flex justify-center">
                    
                    <div 
                        ref={printComponentRef}
                        className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 md:p-12 shadow-md rounded-xl text-slate-900 printable-catalog"
                        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    >
                        {/* Print Stylesheet */}
                        <style>{`
                            @media print {
                                @page {
                                    size: A4 portrait;
                                    margin: 10mm 12mm 12mm 12mm;
                                }
                                body {
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    background: white !important;
                                }
                                .printable-catalog {
                                    box-shadow: none !important;
                                    padding: 0 !important;
                                    max-width: 100% !important;
                                    border-radius: 0 !important;
                                }
                                .avoid-page-break {
                                    page-break-inside: avoid !important;
                                    break-inside: avoid !important;
                                }
                                .page-break-before {
                                    page-break-before: always !important;
                                    break-before: page !important;
                                }
                            }
                        `}</style>

                        {/* Executive Cover Header */}
                        <div className="border-b-2 border-slate-900 pb-6 mb-8">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs tracking-widest uppercase mb-1">
                                        <ShieldCheck size={16} />
                                        <span>Official Master Service Schedule</span>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                        BROOKSPEED WORKSHOP CATALOGUE
                                    </h1>
                                    <p className="text-sm font-medium text-slate-600 mt-1">
                                        Itemized Technical Operations, Labour Allocations & Parts Schedule
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <img 
                                        src="/logo.png" 
                                        alt="Brookspeed Logo" 
                                        className="h-12 w-auto object-contain mb-1"
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                    />
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Dispatch & Technical Systems
                                    </span>
                                </div>
                            </div>

                            {/* Metadata Pill Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-200">
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Scope / Entity</span>
                                    <strong className="text-xs text-slate-800 font-bold block truncate">{activeEntityName}</strong>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Packages</span>
                                    <strong className="text-xs text-slate-800 font-bold block">{packages.length} Active Packages</strong>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Itemized Operations</span>
                                    <strong className="text-xs text-slate-800 font-bold block">{totalLineItems} Lines</strong>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Date Generated</span>
                                    <strong className="text-xs text-slate-800 font-bold block">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Empty state */}
                        {packages.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <FileText size={40} className="mx-auto text-slate-400 mb-3" />
                                <h3 className="text-base font-bold text-slate-700">No service packages found</h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    No service packages match the selected entity filter ({activeEntityName}). Select another entity or choose "All Entities".
                                </p>
                            </div>
                        ) : (
                            /* Packages Grouped by Entity */
                            <div className="space-y-10">
                                {Object.entries(groupedPackages).map(([entKey, group]) => {
                                    const entName = group.entity?.name || (entKey === 'ent_unassigned' ? 'Universal / Unassigned' : entKey);
                                    
                                    return (
                                        <div key={entKey} className="space-y-6">
                                            {/* Entity Section Header Banner */}
                                            <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between border-l-4 border-rose-600 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <Building2 size={16} className="text-rose-400" />
                                                    <h2 className="text-sm md:text-base font-bold tracking-wide uppercase">
                                                        {entName}
                                                    </h2>
                                                </div>
                                                <span className="text-xs font-semibold bg-slate-800 text-rose-200 px-2.5 py-0.5 rounded-full border border-slate-700">
                                                    {group.packages.length} {group.packages.length === 1 ? 'Package' : 'Packages'}
                                                </span>
                                            </div>

                                            {/* Packages List in this Entity */}
                                            <div className="space-y-6">
                                                {group.packages.map((pkg, idx) => {
                                                    const lines = pkg.costItems || [];
                                                    const gross = pkg.totalPrice ?? (pkg.totalPriceNet ? pkg.totalPriceNet * 1.2 : 0);
                                                    const net = pkg.totalPriceNet ?? (pkg.totalPrice ? pkg.totalPrice / 1.2 : 0);
                                                    const vat = pkg.totalPriceVat ?? (gross - net);

                                                    const labourLines = lines.filter(l => l.isLabor);
                                                    const partLines = lines.filter(l => !l.isLabor);

                                                    return (
                                                        <div 
                                                            key={pkg.id || idx}
                                                            className="avoid-page-break border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                                                        >
                                                            {/* Package Card Top Bar */}
                                                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                                                                <div className="space-y-1 max-w-2xl">
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                                                            {pkg.name}
                                                                        </h3>
                                                                        {pkg.applicableMake && (
                                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                                                {pkg.applicableMake}
                                                                            </span>
                                                                        )}
                                                                        {pkg.applicableModel && (
                                                                            <span className="text-[10px] font-semibold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                                                                                {pkg.applicableModel}
                                                                            </span>
                                                                        )}
                                                                        {pkg.applicableVariant && (
                                                                            <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                                                                {pkg.applicableVariant}
                                                                            </span>
                                                                        )}
                                                                        {pkg.applicableEngineSize ? (
                                                                            <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                                                                {pkg.applicableEngineSize}L
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    {pkg.description && (
                                                                        <p className="text-xs text-slate-600 italic leading-relaxed pt-0.5">
                                                                            {pkg.description}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Price Box */}
                                                                <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                                                                    <div className="text-base font-black text-rose-700 leading-tight">
                                                                        {formatCurrency(gross)}
                                                                        <span className="text-[10px] font-normal text-slate-500 ml-1">inc VAT</span>
                                                                    </div>
                                                                    <div className="text-[11px] font-semibold text-slate-600">
                                                                        Net: {formatCurrency(net)}
                                                                        <span className="text-[10px] text-slate-400 ml-1">(VAT: {formatCurrency(vat)})</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Itemized Line Items Table */}
                                                            {lines.length > 0 ? (
                                                                <table className="w-full text-left text-xs border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                                            <th className="py-2 px-3 w-16">Type</th>
                                                                            <th className="py-2 px-3">Operation / Part Description</th>
                                                                            <th className="py-2 px-3 w-28">Part / Code</th>
                                                                            <th className="py-2 px-3 w-16 text-right">Qty/Hrs</th>
                                                                            <th className="py-2 px-3 w-24 text-right">Unit Price</th>
                                                                            <th className="py-2 px-3 w-24 text-right">Line Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {lines.map((item, lIdx) => {
                                                                            const unitP = item.unitPrice || 0;
                                                                            const qty = item.quantity || 1;
                                                                            const lineTotal = item.totalPrice ?? (unitP * qty);

                                                                            return (
                                                                                <tr key={item.id || lIdx} className="hover:bg-slate-50/60 transition-colors">
                                                                                    <td className="py-2 px-3">
                                                                                        {item.isLabor ? (
                                                                                            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                                                <Wrench size={10} /> Labour
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                                                <PackageIcon size={10} /> Part
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 font-medium text-slate-800">
                                                                                        {item.description}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 truncate">
                                                                                        {item.partNumber || '—'}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-medium text-slate-700">
                                                                                        {qty}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-medium text-slate-700">
                                                                                        {formatCurrency(unitP)}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                                                                        {formatCurrency(lineTotal)}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="bg-slate-50/80 border-t border-slate-200 text-[11px] font-semibold text-slate-600">
                                                                            <td colSpan={3} className="py-2 px-3">
                                                                                <span>Labour Operations: <strong>{labourLines.length}</strong></span>
                                                                                <span className="mx-2">•</span>
                                                                                <span>Parts / Materials: <strong>{partLines.length}</strong></span>
                                                                            </td>
                                                                            <td colSpan={2} className="py-2 px-3 text-right text-slate-500 font-normal">
                                                                                Package Fixed Total:
                                                                            </td>
                                                                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                                                {formatCurrency(gross)}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            ) : (
                                                                <div className="p-3 text-xs text-slate-400 italic text-center">
                                                                    No individual line item breakdown configured for this package.
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Publication Footer */}
                        <div className="mt-12 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                            <div>
                                <span>BROOKSPEED AUTOMOTIVE ENGINEERING</span>
                                <span className="mx-2">•</span>
                                <span>Confidential Technical Specification</span>
                            </div>
                            <div>
                                <span>Generated for: {activeEntityName}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="p-3 bg-white border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Ready to print or save as PDF via your browser's print dialog (A4 Portrait recommended).
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                            <Printer size={16} /> Print / Save PDF
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

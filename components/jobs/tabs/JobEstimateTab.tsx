import React from 'react';
import { EstimateLineItem, TaxRate, Part, PurchaseOrder, ServicePackage, Estimate } from '../../../types';
import { Trash2, PlusCircle, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../core/utils/formatUtils';
import SearchableSelect from '../../SearchableSelect';

// Reusable Row Component within the tab
interface EditableLineItemRowProps {
    item: EstimateLineItem;
    taxRates: TaxRate[];
    filteredParts: Part[];
    activePartSearch: string | null;
    onLineItemChange: (id: string, field: keyof EstimateLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    onPartSearchChange: (value: string) => void;
    onSetActivePartSearch: (id: string | null) => void;
    onSelectPart: (lineItemId: string, part: Part) => void;
    isReadOnly: boolean;
    canViewPricing: boolean;
}

const MemoizedEditableLineItemRow = React.memo(({ 
    item, 
    taxRates, 
    onLineItemChange, 
    onRemoveLineItem, 
    filteredParts, 
    activePartSearch, 
    onPartSearchChange, 
    onSetActivePartSearch, 
    onSelectPart, 
    isReadOnly, 
    canViewPricing 
}: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onLineItemChange(item.id, 'description', value);
        if (!item.isLabor && !isPackageHeader && !isPackageComponent) {
            onPartSearchChange(value);
        }
    };

    return (
         <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border transition-colors ${
            isPackageHeader ? 'bg-indigo-50/30 border-indigo-100 shadow-sm' : 
            isPackageComponent ? 'bg-gray-50 border-gray-100 ml-2' : 
            'bg-white shadow-sm border-gray-200'
         }`}>
            <input 
                type="text" 
                placeholder="Part No." 
                value={item.partNumber || ''} 
                onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} 
                className="col-span-2 p-1 border rounded text-xs disabled:bg-gray-100 disabled:text-gray-400" 
                disabled={isReadOnly || isPackageHeader || isPackageComponent || item.isLabor} 
            />
            <div className="col-span-5 relative">
                 <input
                    type="text"
                    placeholder="Description"
                    value={item.description || ''}
                    onChange={handleDescriptionChange}
                    onFocus={() => !item.isLabor && !isPackageHeader && !isPackageComponent && onSetActivePartSearch(item.id)}
                    onBlur={() => setTimeout(() => onSetActivePartSearch(null), 200)}
                    className={`w-full p-1 border rounded text-xs disabled:bg-gray-100 disabled:text-gray-500 ${isPackageHeader ? 'font-bold' : ''}`}
                    disabled={isReadOnly || isPackageHeader || isPackageComponent}
                />
                 {activePartSearch === item.id && (filteredParts || []).length > 0 && (
                    <div className="absolute z-50 top-full left-0 w-full bg-white border rounded shadow-xl max-h-60 overflow-y-auto mt-1 border-indigo-100">
                        {filteredParts.map(part => (
                            <div 
                                key={part.id} 
                                onMouseDown={() => onSelectPart(item.id, part)} 
                                className="p-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0 border-gray-50"
                            >
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-gray-800 text-xs">{part.partNumber}</p>
                                    <p className={`text-[10px] font-bold px-1 rounded ${part.stockQuantity > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        Stock: {part.stockQuantity}
                                    </p>
                                </div>
                                <p className="text-gray-600 text-[10px] truncate">{part.description}</p>
                                <p className="text-indigo-600 font-mono text-[10px]">{formatCurrency(part.salePrice)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <input 
                type="number" 
                step="0.1" 
                value={item.quantity || 0} 
                onChange={e => onLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} 
                className="col-span-1 p-1 border rounded text-right text-xs disabled:bg-gray-100 disabled:text-gray-400" 
                disabled={isReadOnly || isPackageHeader} 
            />
            {canViewPricing ? (
                <input 
                    type="number" 
                    step="0.01" 
                    value={item.unitPrice || 0} 
                    onChange={e => onLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} 
                    className="col-span-2 p-1 border rounded text-right text-xs disabled:bg-gray-100 disabled:text-gray-400" 
                    placeholder="Sale (Net)" 
                    disabled={isReadOnly || isPackageHeader || isPackageComponent}
                />
            ) : (
                <div className="col-span-2 p-1 text-right font-semibold text-gray-400 text-xs italic">Hidden</div>
            )}
            <select 
                value={item.taxCodeId || ''} 
                onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} 
                className="col-span-1 p-1 border rounded text-[10px] disabled:bg-gray-100" 
                disabled={isReadOnly || isPackageHeader}
            >
                <option value="">--</option>
                {(taxRates || []).map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </select>
            <button 
                onClick={() => onRemoveLineItem(item.id)} 
                className="col-span-1 text-red-400 hover:text-red-600 justify-self-center disabled:opacity-30 transition-colors" 
                disabled={isReadOnly || isPackageComponent}
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
});

interface JobEstimateTabProps {
    partsStatus: string;
    purchaseOrderIds: string[];
    purchaseOrders: PurchaseOrder[];
    supplierMap: Map<string, string>;
    editableEstimate: any; 
    supplementaryEstimates: Estimate[];
    estimateBreakdown: { packages: any[], standaloneLabor: any[], standaloneParts: any[] };
    isReadOnly: boolean;
    canViewPricing: boolean;
    taxRates: TaxRate[];
    filteredParts: Part[];
    activePartSearch: string | null;
    servicePackages: ServicePackage[];
    totalNet: number;
    vatBreakdown: any[];
    grandTotal: number;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onCreateEstimate: () => void;
    onRaiseSupplementaryEstimate: () => void;
    onViewEstimate: (estimate: Estimate) => void;
    onAddLineItem: (isLabor: boolean) => void;
    onAddPackage: (packageId: string) => void;
    onLineItemChange: (id: string, field: keyof EstimateLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    onPartSearchChange: (value: string) => void;
    onSetActivePartSearch: (id: string | null) => void;
    onSelectPart: (lineItemId: string, part: Part) => void;
}

export const JobEstimateTab: React.FC<JobEstimateTabProps> = ({
    partsStatus, purchaseOrderIds, purchaseOrders, supplierMap, editableEstimate, supplementaryEstimates = [],
    estimateBreakdown, isReadOnly, canViewPricing, taxRates, filteredParts, activePartSearch, servicePackages,
    totalNet, vatBreakdown, grandTotal, onChange, onOpenPurchaseOrder, onCreateEstimate, onRaiseSupplementaryEstimate, onViewEstimate,
    onAddLineItem, onAddPackage, onLineItemChange, onRemoveLineItem, onPartSearchChange, onSetActivePartSearch, onSelectPart
}) => {
    return (
        <div className="space-y-6 text-sm">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <label className="font-bold text-gray-700 text-xs uppercase tracking-wider">Parts Logistics Status</label>
                <select 
                    name="partsStatus" 
                    value={partsStatus || 'Not Required'} 
                    onChange={onChange} 
                    className="w-full p-2.5 border rounded-lg bg-gray-50 mt-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    disabled={isReadOnly}
                >
                    <option>Not Required</option>
                    <option>Awaiting Order</option>
                    <option>Ordered</option>
                    <option>Partially Received</option>
                    <option>Fully Received</option>
                </select>
            </div>
            
            {supplementaryEstimates.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                        <FileText size={18}/> Supplementary Estimates
                    </h4>
                    <div className="space-y-2">
                        {supplementaryEstimates.map(est => {
                            const total = (est?.lineItems || []).reduce((sum, item) => {
                                const qty = item?.quantity || 0;
                                const price = item?.unitPrice || 0;
                                return sum + (qty * price);
                            }, 0);

                            return (
                                <div key={est.id || Math.random()} className="flex justify-between items-center bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-amber-700">
                                            #{est?.estimateNumber || 'N/A'}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                            est?.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {est?.status || 'Draft'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {canViewPricing && (
                                            <span className="font-bold text-gray-900">
                                                {formatCurrency(total)}
                                            </span>
                                        )}
                                        <button 
                                            onClick={() => onViewEstimate && onViewEstimate(est)} 
                                            className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 font-bold transition-colors shadow-sm"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h4 className="font-bold text-gray-800">Estimate & Costing</h4>
                    <button onClick={onRaiseSupplementaryEstimate} className="text-xs flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 border border-indigo-200 transition-all">
                         <PlusCircle size={14}/> Raise Supplementary
                    </button>
                </div>

                <div className="p-4">
                    {!editableEstimate && !isReadOnly && (
                        <div className="text-center py-8">
                            <AlertTriangle className="mx-auto text-amber-400 mb-2" size={32} />
                            <p className="text-gray-500 mb-4">This job currently has no cost estimate linked.</p>
                            <button onClick={onCreateEstimate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all">Create Primary Estimate</button>
                        </div>
                    )}
                    
                    {editableEstimate && (
                        <div className="space-y-4">
                            {!isReadOnly && (
                                <div className="flex flex-wrap justify-between items-center gap-4 pb-2">
                                    <div className="flex gap-2">
                                        <button onClick={() => onAddLineItem(true)} className="flex items-center text-xs font-bold py-2 px-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-100 transition-all"><PlusCircle size={14} className="mr-1.5" /> Add Labor</button>
                                        <button onClick={() => onAddLineItem(false)} className="flex items-center text-xs font-bold py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-all"><PlusCircle size={14} className="mr-1.5" /> Add Part</button>
                                    </div>
                                    <div className="w-64">
                                        <SearchableSelect
                                            options={(servicePackages || []).map(p => ({ id: p.id, label: p.name }))}
                                            value={null} 
                                            onChange={(packageId) => { if (packageId) onAddPackage(packageId); }}
                                            placeholder="Quick Add Package..."
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="hidden lg:grid grid-cols-12 gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest px-2 mb-1">
                                <div className="col-span-2">Part No.</div>
                                <div className="col-span-5">Description</div>
                                <div className="col-span-1 text-right">Qty/Hrs</div>
                                <div className="col-span-2 text-right">{canViewPricing ? 'Sell (Net)' : ''}</div>
                                <div className="col-span-1 text-center">Tax</div>
                                <div className="col-span-1"></div>
                            </div>
                            
                            <div className="space-y-1">
                                {(estimateBreakdown?.packages || []).length > 0 && <h5 className="font-bold text-indigo-900 text-[10px] uppercase pt-4 pb-2 flex items-center gap-2"><div className="h-px bg-indigo-100 flex-grow"/> Service Packages <div className="h-px bg-indigo-100 flex-grow"/></h5>}
                                {(estimateBreakdown?.packages || []).map(({ header, children }: any) => (
                                    <div key={header.id} className="mb-4 space-y-1">
                                        <MemoizedEditableLineItemRow canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={header} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} />
                                        <div className="pl-4 border-l-2 border-indigo-100/50 space-y-1">
                                            {(children || []).map((child: any) => (
                                                <MemoizedEditableLineItemRow key={child.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={child} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                
                                {(estimateBreakdown?.standaloneLabor || []).length > 0 && <h5 className="font-bold text-blue-900 text-[10px] uppercase pt-4 pb-2 flex items-center gap-2"><div className="h-px bg-blue-100 flex-grow"/> Labor <div className="h-px bg-blue-100 flex-grow"/></h5>}
                                {(estimateBreakdown?.standaloneLabor || []).map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} />)}
                                
                                {(estimateBreakdown?.standaloneParts || []).length > 0 && <h5 className="font-bold text-emerald-900 text-[10px] uppercase pt-4 pb-2 flex items-center gap-2"><div className="h-px bg-emerald-100 flex-grow"/> Parts <div className="h-px bg-emerald-100 flex-grow"/></h5>}
                                {(estimateBreakdown?.standaloneParts || []).map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} />)}
                            </div>
                            
                            {canViewPricing && (
                                <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                                    <div className="w-72 bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                                        <div className="flex justify-between text-gray-600"><span>Net Total</span><span className="font-bold">{formatCurrency(totalNet || 0)}</span></div>
                                        {(vatBreakdown || []).map(b => (
                                            <div key={b.name} className="flex justify-between text-gray-500 text-xs italic">
                                                <span>VAT @ {b.rate}%</span>
                                                <span>{formatCurrency(b.vat || 0)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between font-black text-xl mt-2 pt-2 border-t border-gray-200 text-indigo-900">
                                            <span>Total</span>
                                            <span>{formatCurrency(grandTotal || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                    <h4 className="font-bold text-gray-800">Linked Purchase Orders</h4>
                </div>
                <div className="p-4 space-y-2">
                    {(purchaseOrderIds || []).length > 0 ? (purchaseOrderIds || []).map(poId => {
                        const po = (purchaseOrders || []).find(p => p.id === poId);
                        if (!po) return <div key={poId} className="p-3 border rounded-lg bg-red-50 text-xs text-red-700 font-medium">Error: PO {poId} not found in local state.</div>;
                        const poTotal = (po.lineItems || []).reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
                        return (
                            <button key={poId} type="button" onClick={() => onOpenPurchaseOrder(po)} className="w-full text-left border rounded-xl bg-white p-3 hover:border-indigo-300 hover:shadow-sm transition-all group">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{poId}</p>
                                        <p className="text-xs text-gray-500">{po?.supplierId ? (supplierMap.get(po.supplierId) || 'Unknown Supplier') : 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${po.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>{po.status || 'Draft'}</span>
                                        {canViewPricing && <p className="font-bold mt-1 text-gray-700">{formatCurrency(poTotal)}</p>}
                                    </div>
                                </div>
                            </button>
                        );
                    }) : (
                        <div className="text-center py-4 text-gray-400 italic text-xs">No purchase orders linked to this job yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
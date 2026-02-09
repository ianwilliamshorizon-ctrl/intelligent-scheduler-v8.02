
import React, { useMemo, useState } from 'react';
import { EstimateLineItem, TaxRate, Part, PurchaseOrder, ServicePackage, Estimate, Vehicle } from '../../../types';
import { Trash2, PlusCircle, FileText, CheckCircle, AlertTriangle, Image as ImageIcon, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
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
    onManageMedia: (itemId: string) => void; 
    onAddNewPart: (lineItemId: string, searchTerm: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart, isReadOnly, canViewPricing, onManageMedia, onAddNewPart }: EditableLineItemRowProps) => {
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
         <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
            <div className="col-span-2 flex items-center gap-1">
                <input type="text" placeholder="Part Number" value={item.partNumber || ''} onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} className="w-full p-1 border rounded disabled:bg-gray-200 text-xs" disabled={isReadOnly || isPackageHeader || isPackageComponent || item.isLabor} />
            </div>
            
            <div className="col-span-5 relative">
                 <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={handleDescriptionChange}
                    onFocus={() => !item.isLabor && !isPackageHeader && !isPackageComponent && onSetActivePartSearch(item.id)}
                    onBlur={() => setTimeout(() => onSetActivePartSearch(null), 150)}
                    className="w-full p-1 border rounded disabled:bg-gray-200"
                    disabled={isReadOnly || isPackageHeader || isPackageComponent}
                />
                 {activePartSearch === item.id && (
                    <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-50 overflow-y-auto mt-1">
                        {filteredParts.map(part => (
                            <div key={part.id} onMouseDown={() => onSelectPart(item.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm border-b last:border-0">
                                <p className="font-semibold">{part.partNumber} - {part.description}</p>
                            </div>
                        ))}
                        <div 
                            onMouseDown={() => onAddNewPart(item.id, item.description)} 
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 cursor-pointer text-sm text-indigo-700 font-semibold border-t flex items-center gap-1"
                        >
                            <Plus size={14}/> Create New Part
                        </div>
                    </div>
                )}
            </div>
            
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader} />
            
            {canViewPricing ? (
                <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right disabled:bg-gray-200" placeholder="Sale (Net)" disabled={isReadOnly || isPackageHeader || isPackageComponent}/>
            ) : (
                <div className="col-span-2 p-1 text-right font-semibold text-gray-500">Hidden</div>
            )}
            
            <div className="col-span-1">
                <select value={item.taxCodeId || ''} onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} className="w-full p-1 border rounded text-xs disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader}>
                    <option value="">-- Tax --</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
            </div>
            
            <div className="col-span-1 flex justify-end gap-1">
                {!isPackageComponent && !isPackageHeader && (
                    <button 
                        onClick={() => onManageMedia(item.id)} 
                        className={`p-1 rounded hover:bg-gray-200 ${item.media && item.media.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`} 
                        title="Attach Photo/Video"
                    >
                        <ImageIcon size={14}/>
                    </button>
                )}
                <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={isReadOnly || isPackageComponent}><Trash2 size={14} /></button>
            </div>
        </div>
    );
});

// Component to render a read-only list of items for supplementary estimates
const ReadOnlyEstimateList: React.FC<{ items: EstimateLineItem[] }> = ({ items }) => (
    <div className="mt-2 text-xs bg-gray-50 rounded border p-2 space-y-1">
        <div className="grid grid-cols-12 font-bold text-gray-500 pb-1 border-b mb-1">
            <div className="col-span-2">Part No.</div>
            <div className="col-span-8">Description</div>
            <div className="col-span-2 text-right">Qty</div>
        </div>
        {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12">
                <div className="col-span-2 font-mono">{item.partNumber || '-'}</div>
                <div className="col-span-8">{item.description}</div>
                <div className="col-span-2 text-right">{item.quantity}</div>
            </div>
        ))}
    </div>
);


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
    currentJobHours: number;
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
    onManageMedia: (itemId: string) => void;
    vehicle?: Vehicle;
    onAddNewPart: (lineItemId: string, searchTerm: string) => void;
}

export const JobEstimateTab: React.FC<JobEstimateTabProps> = ({
    partsStatus, purchaseOrderIds, purchaseOrders, supplierMap, editableEstimate, supplementaryEstimates,
    estimateBreakdown, isReadOnly, canViewPricing, taxRates, filteredParts, activePartSearch, servicePackages,
    totalNet, vatBreakdown, grandTotal, currentJobHours, onChange, onOpenPurchaseOrder, onCreateEstimate, onRaiseSupplementaryEstimate, onViewEstimate,
    onAddLineItem, onAddPackage, onLineItemChange, onRemoveLineItem, onPartSearchChange, onSetActivePartSearch, onSelectPart, onManageMedia,
    vehicle, onAddNewPart
}) => {
    // State to track expanded supplementary estimates
    const [expandedSuppEstIds, setExpandedSuppEstIds] = useState<Set<string>>(new Set());

    const toggleExpandSuppEst = (id: string) => {
        setExpandedSuppEstIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    // Sort and Filter Packages based on Vehicle Hierarchy
    const sortedPackages = useMemo(() => {
        if (!vehicle) {
            return servicePackages
                .filter(p => !p.applicableMake)
                .map(p => ({ id: p.id, label: p.name }));
        }

        const vMake = (vehicle.make || '').toLowerCase().trim();
        const vModel = (vehicle.model || '').toLowerCase().trim();

        const scored = servicePackages.map(pkg => {
            const pMake = (pkg.applicableMake || '').toLowerCase().trim();
            const pModel = (pkg.applicableModel || '').toLowerCase().trim();
            const pVariant = (pkg.applicableVariant || '').toLowerCase().trim();
            
            let score = -1;

            if (!pMake) {
                score = 0; 
            } else if (vMake === pMake || vMake.includes(pMake) || pMake.includes(vMake)) {
                if (!pModel) {
                    score = 1; 
                } else if (vModel.includes(pModel)) {
                    if (!pVariant) {
                        score = 2; 
                    } else if (vModel.includes(pVariant)) {
                        score = 3; 
                    } else {
                        score = -1; 
                    }
                } else {
                    score = -1; 
                }
            }
            return { pkg, score };
        });

        return scored
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score || a.pkg.name.localeCompare(b.pkg.name))
            .map(item => {
                let label = item.pkg.name;
                if (item.score === 3) label = `★ ${label} (Exact Match)`;
                else if (item.score === 2) label = `★ ${label} (Model Match)`;
                else if (item.score === 1) label = `${label} (Make Match)`;
                
                return { id: item.pkg.id, label };
            });

    }, [servicePackages, vehicle]);

    return (
        <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                    <Clock size={18} className="text-indigo-600"/>
                    <span className="font-semibold text-gray-700">Total Job Hours:</span>
                </div>
                <span className="font-bold text-lg text-indigo-700">{currentJobHours.toFixed(1)} hrs</span>
            </div>

            <div>
                <label className="font-semibold">Parts Status</label>
                <select name="partsStatus" value={partsStatus || 'Not Required'} onChange={onChange} className="w-full p-2 border rounded bg-white mt-1" disabled={isReadOnly}>
                    <option>Not Required</option>
                    <option>Awaiting Order</option>
                    <option>Ordered</option>
                    <option>Partially Received</option>
                    <option>Fully Received</option>
                </select>
            </div>
            
            {supplementaryEstimates.length > 0 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><FileText size={16}/> Supplementary Work</h4>
                    <div className="space-y-2">
                        {supplementaryEstimates.map(est => {
                             const total = (est.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                             const isExpanded = expandedSuppEstIds.has(est.id);
                             return (
                                <div key={est.id} className="bg-white p-2 rounded border border-indigo-100 shadow-sm">
                                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpandSuppEst(est.id)}>
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                                            <span className="font-mono font-semibold">#{est.estimateNumber}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${est.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{est.status}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {canViewPricing && <span className="font-bold text-sm">{formatCurrency(total)}</span>}
                                            <button onClick={(e) => { e.stopPropagation(); onViewEstimate(est); }} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 font-semibold">Full View</button>
                                        </div>
                                    </div>
                                    {isExpanded && est.lineItems && (
                                        <ReadOnlyEstimateList items={est.lineItems} />
                                    )}
                                </div>
                             );
                        })}
                    </div>
                </div>
            )}
            
            <div>
                <div className="flex justify-between items-end mb-2">
                    <h4 className="font-semibold">Main Job Package & Items</h4>
                    <button onClick={onRaiseSupplementaryEstimate} className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold hover:bg-amber-200 border border-amber-300">
                         <PlusCircle size={12}/> Raise Supplementary Estimate
                    </button>
                </div>

                {!editableEstimate && !isReadOnly && <button onClick={onCreateEstimate} className="text-indigo-600 hover:underline">This job has no estimate. Click here to add items.</button>}
                
                {editableEstimate && (
                    <div className="space-y-4">
                        {!isReadOnly && (
                            <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-2">
                                    <button onClick={() => onAddLineItem(true)} className="flex items-center text-xs py-1 px-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"><PlusCircle size={14} className="mr-1" /> Add Labor</button>
                                    <button onClick={() => onAddLineItem(false)} className="flex items-center text-xs py-1 px-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><PlusCircle size={14} className="mr-1" /> Add Part</button>
                                </div>
                                <div className="flex items-center gap-2 w-64">
                                    <SearchableSelect
                                        options={sortedPackages}
                                        value={null} onChange={(packageId) => { if (packageId) onAddPackage(packageId); }}
                                        placeholder="Add Package..."
                                    />
                                </div>
                            </div>
                        )}
                        <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                            <div className="col-span-2">Part No.</div><div className="col-span-5">Description</div>
                            <div className="col-span-1 text-right">Qty/Hrs</div>
                            {canViewPricing ? (
                                <div className="col-span-2 text-right">Sell Price (Net)</div>
                            ) : (
                                <div className="col-span-2"></div>
                            )}
                            <div className="col-span-1">Tax</div><div className="col-span-1"></div>
                        </div>
                        
                        {estimateBreakdown.packages.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Service Packages</h5>}
                        {estimateBreakdown.packages.map(({ header, children }: any) => (<div key={header.id}><MemoizedEditableLineItemRow canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={header} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onManageMedia={onManageMedia} onAddNewPart={()=>{}} /><div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">{children.map((child: any) => (<MemoizedEditableLineItemRow key={child.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={child} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onManageMedia={onManageMedia} onAddNewPart={()=>{}} />))}</div></div>))}
                        
                        {estimateBreakdown.standaloneLabor.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Labor</h5>}
                        {estimateBreakdown.standaloneLabor.map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} onManageMedia={onManageMedia} onAddNewPart={onAddNewPart} />)}
                        
                        {estimateBreakdown.standaloneParts.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Parts</h5>}
                        {estimateBreakdown.standaloneParts.map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} onManageMedia={onManageMedia} onAddNewPart={onAddNewPart} />)}
                        
                        {canViewPricing && (
                            <div className="mt-4 pt-4 border-t flex justify-end">
                                <div className="w-64 text-sm">
                                    <div className="flex justify-between"><span>Net Total</span><span className="font-semibold">{formatCurrency(totalNet)}</span></div>
                                    {vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                                    <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div>
                <h4 className="font-semibold">Linked Purchase Orders</h4>
                <div className="space-y-2 mt-1">
                    {(purchaseOrderIds || []).length > 0 ? (purchaseOrderIds || []).map(poId => {
                        const po = purchaseOrders.find(p => p.id === poId);
                        if (!po) return <div key={poId} className="p-2 border rounded-md bg-red-50 text-xs text-red-700">Error: Purchase Order {poId} not found.</div>;
                        const poTotal = (po.lineItems || []).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                        return (
                            <button key={poId} type="button" onClick={() => onOpenPurchaseOrder(po)} className="w-full text-left border rounded-md bg-gray-50 text-xs hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <div className="p-2 flex justify-between items-center">
                                    <div><p><strong>{poId}</strong> - {po?.supplierId ? (supplierMap.get(po.supplierId) || 'Unknown Supplier') : 'N/A'}</p><p>Status: <span className="font-semibold">{po.status}</span>{canViewPricing && <> - Total: <span className="font-semibold">{formatCurrency(poTotal)}</span></>} </p></div>
                                </div>
                            </button>
                        );
                    }) : <p className="text-xs text-gray-500">No purchase orders linked.</p>}
                </div>
            </div>
        </div>
    );
};

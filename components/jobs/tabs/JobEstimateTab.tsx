import React, { useMemo, useState } from 'react';
import { EstimateLineItem, TaxRate, Part, PurchaseOrder, ServicePackage, Estimate, Vehicle, Supplier } from '../../../types';
import { Trash2, PlusCircle, FileText, Clock, ChevronDown, ChevronUp, Plus, Image as ImageIcon, Search, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import SearchableSelect from '../../SearchableSelect';
import { getScoredServicePackages } from '../../../utils/servicePackageScoring';
import SupplierSelectionModal from '../../SupplierSelectionModal';


const PartsStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusStyles: { [key: string]: string } = {
        'Not Required': 'bg-gray-100 text-gray-800',
        'Awaiting Parts': 'bg-yellow-100 text-yellow-800',
        'Awaiting Order': 'bg-orange-100 text-orange-800',
        'Ordered': 'bg-blue-100 text-blue-800',
        'Partially Received': 'bg-indigo-100 text-indigo-800',
        'Fully Received': 'bg-green-100 text-green-800',
    };

    return (
        <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusStyles[status] || 'bg-gray-200'}`}>
            {status}
        </span>
    );
};

const LineItemPOStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusStyles: { [key: string]: string } = {
        'From Stock': 'bg-green-100 text-green-800',
        'To Order': 'bg-red-100 text-red-800',
        'Awaiting Order': 'bg-orange-100 text-orange-800',
        'Ordered': 'bg-blue-100 text-blue-800',
        'Partially Received': 'bg-indigo-100 text-indigo-800',
        'Received': 'bg-teal-100 text-teal-800',
        'PO Linked': 'bg-gray-100 text-gray-800',
    };

    return (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyles[status] || 'bg-gray-200'}`}>
            {status}
        </span>
    );
};

interface EditableLineItemRowProps {
    item: EstimateLineItem;
    taxRates: TaxRate[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
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
    onOpenSupplierSelection: (lineItemId: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ 
    item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart, 
    isReadOnly, canViewPricing, onManageMedia, onAddNewPart, suppliers, onOpenSupplierSelection, purchaseOrders 
}: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

    const lineItemStatus = useMemo(() => {
        if (item.isLabor || isPackageHeader) return null;
        if (item.fromStock) return 'From Stock';

        if (item.purchaseOrderLineItemId) {
            for (const po of purchaseOrders) {
                if (po.lineItems.some(li => li.id === item.purchaseOrderLineItemId)) {
                    switch (po.status) {
                        case 'Draft': return 'Awaiting Order';
                        case 'Ordered': return 'Ordered';
                        case 'Partially Received': return 'Partially Received';
                        case 'Received':
                        case 'Finalized': return 'Received';
                        default: return 'PO Linked';
                    }
                }
            }
        }
        
        if (item.partId) return 'To Order';

        return null;

    }, [item, purchaseOrders, isPackageHeader]);

    const supplierShortCode = useMemo(() => {
        if (item.isLabor) return 'N/A';
        if (!item.supplierId) return <span className="text-gray-400">-</span>;
        const supplier = suppliers.find(s => s.id === item.supplierId);
        return <span className="font-mono bg-gray-200 px-1 rounded">{supplier?.shortCode || '???'}</span>;
    }, [item.supplierId, suppliers, item.isLabor]);

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onLineItemChange(item.id, 'description', value);
        if (!item.isLabor && !isPackageHeader && !isPackageComponent) {
            onPartSearchChange(value);
        }
    };

    return (
         <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
            <div className="col-span-6 space-y-1">
                 <input 
                    type="text" 
                    placeholder="Part No." 
                    value={item.partNumber || ''} 
                    onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} 
                    className="w-full p-1 border rounded disabled:bg-gray-200 text-sm" 
                    disabled={isReadOnly || isPackageComponent || item.isLabor} 
                />
                <div className="relative w-full">
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
            </div>
             <div className="col-span-1 text-xs text-center">
                {lineItemStatus && <LineItemPOStatusBadge status={lineItemStatus} />}
            </div>
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader} />
            
            {canViewPricing ? (
                <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-1 p-1 border rounded text-right disabled:bg-gray-200" placeholder="Sale" disabled={isReadOnly || isPackageHeader || isPackageComponent}/>
            ) : (
                <div className="col-span-1 p-1 text-right font-semibold text-gray-500">Hidden</div>
            )}
            <div className="col-span-1">
                <button 
                    type="button" 
                    onClick={() => onOpenSupplierSelection(item.id)} 
                    className="w-full p-1 border rounded text-sm text-center hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed h-full" 
                    disabled={item.isLabor || isPackageComponent || isPackageHeader}
                >
                    {supplierShortCode}
                </button>
            </div>
           
            <div className="col-span-1 flex justify-end items-center gap-1">
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
    suppliers: Supplier[];
    filteredParts: Part[];
    activePartSearch: string | null;
    servicePackages: ServicePackage[];
    totalNet: number;
    vatBreakdown: any[];
    grandTotal: number;
    currentJobHours: number;
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
    onRaisePurchaseOrders: () => void;
}

export const JobEstimateTab: React.FC<JobEstimateTabProps> = ({
    partsStatus, purchaseOrderIds, purchaseOrders, supplierMap, editableEstimate, supplementaryEstimates,
    estimateBreakdown, isReadOnly, canViewPricing, taxRates, filteredParts, activePartSearch, servicePackages,
    totalNet, vatBreakdown, grandTotal, currentJobHours, onOpenPurchaseOrder, onCreateEstimate, onRaiseSupplementaryEstimate, onViewEstimate,
    onAddLineItem, onAddPackage, onLineItemChange, onRemoveLineItem, onPartSearchChange, onSetActivePartSearch, onSelectPart, onManageMedia,
    vehicle, onAddNewPart, suppliers, onRaisePurchaseOrders
}) => {
    const [expandedSuppEstIds, setExpandedSuppEstIds] = useState<Set<string>>(new Set());
    const [isSupplierSelectionOpen, setIsSupplierSelectionOpen] = useState(false);
    const [lineItemForSupplier, setLineItemForSupplier] = useState<string | null>(null);

    const partsToOrderCount = useMemo(() => {
        if (!editableEstimate) return 0;
        return editableEstimate.lineItems.filter((li: EstimateLineItem) => {
            const isPackageHeader = !!li.servicePackageId && !li.isPackageComponent;
            return !li.isLabor && !isPackageHeader && li.partId && !li.fromStock && !li.purchaseOrderLineItemId;
        }).length;
    }, [editableEstimate]);

    const toggleExpandSuppEst = (id: string) => {
        setExpandedSuppEstIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const openSupplierSelection = (lineItemId: string) => {
        setLineItemForSupplier(lineItemId);
        setIsSupplierSelectionOpen(true);
    };

    const handleSelectSupplier = (supplierId: string) => {
        if (lineItemForSupplier) {
            onLineItemChange(lineItemForSupplier, 'supplierId', supplierId);
        }
        setIsSupplierSelectionOpen(false);
        setLineItemForSupplier(null);
    };
    
    const sortedPackages = useMemo(() => {
        const results = getScoredServicePackages(servicePackages, vehicle);
        
        return results.map(({ pkg, matchType, color }) => ({
            id: pkg.id,
            value: pkg.id,
            label: pkg.name || 'Unnamed Package',
            description: pkg.description || 'Service Package',
            badge: { text: matchType, className: color }
        }));
    }, [servicePackages, vehicle]);

    return (
        <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-indigo-600"/>
                        <span className="font-semibold text-gray-700">Total Job Hours:</span>
                        <span className="font-bold text-lg text-indigo-700">{currentJobHours.toFixed(1)} hrs</span>
                    </div>
                    <div className="border-l-2 border-gray-300 h-8"></div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">Parts Status:</span>
                        <PartsStatusBadge status={partsStatus} />
                    </div>
                </div>
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
                    <h4 className="font-semibold">Main Job Estimate & Items</h4>
                    <div className="flex items-center gap-2">
                         <button onClick={onRaiseSupplementaryEstimate} className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold hover:bg-amber-200 border border-amber-300">
                            <PlusCircle size={12}/> Raise Supplementary Estimate
                        </button>
                        {partsToOrderCount > 0 && (
                            <button onClick={onRaisePurchaseOrders} className="text-xs flex items-center gap-1 bg-teal-100 text-teal-800 px-2 py-1 rounded font-semibold hover:bg-teal-200 border border-teal-300 relative">
                                <ShoppingCart size={12}/> Create Purchase Order(s)
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{partsToOrderCount}</span>
                            </button>
                        )}
                    </div>
                </div>

                {!editableEstimate && !isReadOnly && <button onClick={onCreateEstimate} className="text-indigo-600 hover:underline">This job has no estimate. Click here to add items.</button>}
                
                {editableEstimate && (
                    <div className="space-y-2">
                        <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                            <div className="col-span-6">Part / Description</div>
                            <div className="col-span-1 text-center">Line Status</div>
                            <div className="col-span-1 text-right">Qty/Hrs</div>
                            {canViewPricing ? (
                                <div className="col-span-1 text-right">Sell</div>
                            ) : (
                                <div className="col-span-1"></div>
                            )}
                            <div className="col-span-1 text-center">Supplier</div>
                            <div className="col-span-2"></div>
                        </div>
                        
                        {estimateBreakdown.packages.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Service Packages</h5>}
                        {estimateBreakdown.packages.map(({ header, children }: any) => (
                            <div key={header.id}>
                                <MemoizedEditableLineItemRow 
                                    canViewPricing={canViewPricing} 
                                    isReadOnly={isReadOnly} 
                                    item={header} 
                                    taxRates={taxRates} 
                                    suppliers={suppliers}
                                    purchaseOrders={purchaseOrders}
                                    onLineItemChange={onLineItemChange} 
                                    onRemoveLineItem={onRemoveLineItem} 
                                    filteredParts={filteredParts} 
                                    activePartSearch={activePartSearch} 
                                    onPartSearchChange={onPartSearchChange} 
                                    onSetActivePartSearch={onSetActivePartSearch} 
                                    onSelectPart={onSelectPart} 
                                    onManageMedia={onManageMedia} 
                                    onAddNewPart={onAddNewPart} 
                                    onOpenSupplierSelection={openSupplierSelection}
                                />
                                <div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">
                                    {children.map((child: any) => (
                                        <MemoizedEditableLineItemRow 
                                            key={child.id} 
                                            canViewPricing={canViewPricing} 
                                            isReadOnly={isReadOnly} 
                                            item={child} 
                                            taxRates={taxRates} 
                                            suppliers={suppliers}
                                            purchaseOrders={purchaseOrders}
                                            onLineItemChange={onLineItemChange} 
                                            onRemoveLineItem={onRemoveLineItem} 
                                            filteredParts={filteredParts} 
                                            activePartSearch={activePartSearch} 
                                            onPartSearchChange={onPartSearchChange} 
                                            onSetActivePartSearch={onSetActivePartSearch} 
                                            onSelectPart={onSelectPart} 
                                            onManageMedia={onManageMedia} 
                                            onAddNewPart={onAddNewPart} 
                                            onOpenSupplierSelection={openSupplierSelection}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        
                        {estimateBreakdown.standaloneLabor.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Labor</h5>}
                        {estimateBreakdown.standaloneLabor.map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} suppliers={suppliers} purchaseOrders={purchaseOrders} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} onManageMedia={onManageMedia} onAddNewPart={onAddNewPart} onOpenSupplierSelection={openSupplierSelection}/>)}
                        
                        {estimateBreakdown.standaloneParts.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Parts</h5>}
                        {estimateBreakdown.standaloneParts.map((item: any) => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} suppliers={suppliers} purchaseOrders={purchaseOrders} onLineItemChange={onLineItemChange} onRemoveLineItem={onRemoveLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={onPartSearchChange} onSetActivePartSearch={onSetActivePartSearch} onSelectPart={onSelectPart} onManageMedia={onManageMedia} onAddNewPart={onAddNewPart} onOpenSupplierSelection={openSupplierSelection}/>)}
                        
                         {!isReadOnly && (
                            <div className="flex justify-between items-center pt-4 mt-4 border-t">
                                <div className="flex gap-2">
                                    <button onClick={() => onAddLineItem(true)} className="flex items-center text-xs py-1 px-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"><PlusCircle size={14} className="mr-1" /> Add Labor</button>
                                    <button onClick={() => onAddLineItem(false)} className="flex items-center text-xs py-1 px-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><PlusCircle size={14} className="mr-1" /> Add Part</button>
                                </div>
                                <div className="flex items-center gap-2 w-64">
                                    <SearchableSelect
                                        options={sortedPackages}
                                        onSelect={(packageId) => { if (packageId) onAddPackage(packageId); }}
                                        placeholder="Add Package..."
                                        dropdownClassName="min-w-[450px] right-0"
                                    />
                                </div>
                            </div>
                        )}

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
            {isSupplierSelectionOpen && (
                <SupplierSelectionModal 
                    isOpen={isSupplierSelectionOpen}
                    onClose={() => setIsSupplierSelectionOpen(false)}
                    onSelect={handleSelectSupplier}
                    suppliers={suppliers}
                />
            )}
        </div>
    );
};
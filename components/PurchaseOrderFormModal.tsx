
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PurchaseOrder, PurchaseOrderLineItem, Supplier, BusinessEntity, TaxRate, Part } from '../types';
import { Save, PlusCircle, Trash2, X, CheckSquare, Eye, ArrowDownCircle } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { generatePurchaseOrderId } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import SearchableSelect from './SearchableSelect';

interface EditableLineItemRowProps {
    item: PurchaseOrderLineItem;
    taxRates: TaxRate[];
    onLineItemChange: (id: string, field: keyof PurchaseOrderLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    isReceivingDisabled: boolean;
    isOrderedOrLater: boolean;
    isCostPriceChanged: boolean;
    newSalePrice: string;
    onNewSalePriceChange: (value: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ item, taxRates, onLineItemChange, onRemoveLineItem, isReceivingDisabled, isOrderedOrLater, isCostPriceChanged, newSalePrice, onNewSalePriceChange }: EditableLineItemRowProps) => {
    
    // Calculate remaining
    const ordered = item.quantity || 0;
    const received = item.receivedQuantity || 0;
    const remaining = Math.max(0, ordered - received);
    const isFullyReceived = received >= ordered && ordered > 0;

    return (
        <>
            <div className={`grid grid-cols-12 gap-2 items-center p-2 border bg-white ${isCostPriceChanged ? 'rounded-t-lg border-b-0' : 'rounded-lg'} ${isFullyReceived && isOrderedOrLater ? 'bg-green-50/50' : ''}`}>
                <input type="text" placeholder="Part Number" value={item.partNumber || ''} onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} className="col-span-2 p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isOrderedOrLater} />
                <input type="text" placeholder="Description" value={item.description} onChange={e => onLineItemChange(item.id, 'description', e.target.value)} className="col-span-3 p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isOrderedOrLater} />
                <input type="number" step="1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isOrderedOrLater} />
                
                <div className="col-span-1 relative">
                    <input 
                        type="number" 
                        step="1" 
                        value={item.receivedQuantity ?? ''} 
                        onChange={e => onLineItemChange(item.id, 'receivedQuantity', e.target.value)} 
                        placeholder="0" 
                        className={`w-full p-1 border rounded text-right disabled:bg-gray-100 ${!isReceivingDisabled && remaining > 0 ? 'border-blue-400 ring-1 ring-blue-100 font-bold' : ''}`} 
                        disabled={isReceivingDisabled} 
                        title={`Ordered: ${ordered}, Remaining: ${remaining}`}
                    />
                    {!isReceivingDisabled && remaining > 0 && (
                         <div className="absolute -top-2 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                </div>

                <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Unit Cost"/>
                <select value={item.taxCodeId || ''} onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} className="col-span-2 p-1 border rounded text-xs disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isOrderedOrLater}>
                    <option value="">-- Tax --</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
                <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={isOrderedOrLater}><Trash2 size={14} /></button>
            </div>
            {isCostPriceChanged && (
                <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-b-lg border-x border-b bg-amber-50 border-amber-200">
                    <div className="col-start-6 col-span-3 text-right text-sm font-semibold text-amber-800">
                        Cost price changed. Update sale price:
                    </div>
                    <div className="col-span-2">
                        <input
                            type="number"
                            step="0.01"
                            value={newSalePrice}
                            onChange={(e) => onNewSalePriceChange(e.target.value)}
                            className="w-full p-1 border rounded text-right border-amber-300 focus:ring-amber-500"
                            placeholder="New Sale Price"
                        />
                    </div>
                </div>
            )}
        </>
    );
});

interface PurchaseOrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (po: PurchaseOrder) => void;
    purchaseOrder: PurchaseOrder | null;
    suppliers: Supplier[];
    taxRates: TaxRate[];
    businessEntities: BusinessEntity[];
    allPurchaseOrders: PurchaseOrder[];
    selectedEntityId: string;
    parts: Part[];
    setParts: React.Dispatch<React.SetStateAction<Part[]>>;
    onViewPurchaseOrder?: (po: PurchaseOrder) => void;
}

const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({ isOpen, onClose, onSave, purchaseOrder, suppliers, taxRates, businessEntities, allPurchaseOrders, selectedEntityId, parts, setParts, onViewPurchaseOrder }) => {
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({ lineItems: [] });
    const [newSalePrices, setNewSalePrices] = useState<Record<string, string>>({});
    
    const partsMap = useMemo(() => new Map(parts.map(p => [p.partNumber, p])), [parts]);
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    const title = useMemo(() => {
        if (!formData?.id) return 'Create New Purchase Order';
        if (formData.status === 'Ordered' || formData.status === 'Partially Received') {
            return `Receive Goods for PO #${formData.id}`;
        }
        return `Edit Purchase Order #${formData.id}`;
    }, [formData.id, formData.status]);

    useEffect(() => {
        if (!isOpen) return;
        
        setNewSalePrices({});
        
        if (purchaseOrder) {
             // Deep copy to avoid direct mutation
             setFormData(JSON.parse(JSON.stringify(purchaseOrder)));
        } else {
             setFormData({
                entityId: selectedEntityId,
                orderDate: formatDate(new Date()),
                status: 'Draft',
                lineItems: [],
                notes: '',
                vehicleRegistrationRef: '',
                supplierReference: '',
                secondarySupplierReference: ''
            });
        }
    }, [purchaseOrder, isOpen, selectedEntityId]);
    
    const isReceivingDisabled = useMemo(() => {
        return formData.status === 'Draft';
    }, [formData.status]);

    const isOrderedOrLater = useMemo(() => {
        if (!formData.status) return false;
        return ['Ordered', 'Partially Received', 'Received'].includes(formData.status);
    }, [formData.status]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLineItemChange = useCallback((id: string, field: keyof PurchaseOrderLineItem, value: any) => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).map(item => {
                if (item.id === id) {
                    const numericFields = ['quantity', 'unitPrice', 'receivedQuantity'];
                    let processedValue = value;
                    if (numericFields.includes(field as string)) {
                        const num = parseFloat(value);
                        processedValue = isNaN(num) ? undefined : num;
                    }
                    return { ...item, [field]: processedValue };
                }
                return item;
            })
        }));
    }, []);
    
    const addLineItem = () => {
        const newItem: PurchaseOrderLineItem = { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, taxCodeId: standardTaxRateId };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const removeLineItem = useCallback((id: string) => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).filter(item => item.id !== id)
        }));
    }, []);
    
    const handleFillBalance = () => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).map(item => ({
                ...item,
                receivedQuantity: item.quantity // Auto-fill received to match ordered
            }))
        }));
    };

    const getPartUpdates = useCallback((): Part[] => {
        const updatedParts: Part[] = [];
        (formData.lineItems || []).forEach(item => {
            // FIX: Safely access purchaseOrder.lineItems to prevent crash when saving a new PO (where purchaseOrder is null)
            const originalItem = (purchaseOrder?.lineItems || []).find(li => li.id === item.id);
            const isCostPriceChanged = originalItem !== undefined && item.unitPrice !== originalItem.unitPrice;
            
            if (isCostPriceChanged && item.partNumber) {
                const partToUpdate = parts.find(p => p.partNumber === item.partNumber);
                if (partToUpdate) {
                    const newCostPrice = item.unitPrice;
                    let newSalePrice = partToUpdate.salePrice; // Default to old sale price
                    
                    if (newSalePrices[item.id] !== undefined) {
                        const parsedSalePrice = parseFloat(newSalePrices[item.id]);
                        if (!isNaN(parsedSalePrice)) {
                            newSalePrice = parsedSalePrice;
                        }
                    }
                    
                    updatedParts.push({ ...partToUpdate, costPrice: newCostPrice, salePrice: newSalePrice });
                }
            }
        });
        return updatedParts;
    }, [formData.lineItems, purchaseOrder, parts, newSalePrices]);
    
    const handleSave = () => {
        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            alert('Supplier and Internal Reference are required.');
            return;
        }

        let newStatus = formData.status;
        const lineItems = formData.lineItems || [];

        if (lineItems.length > 0 && formData.status !== 'Draft' && formData.status !== 'Cancelled') {
            const allReceived = lineItems.every(item => (item.receivedQuantity || 0) >= item.quantity);
            const anyReceived = lineItems.some(item => (item.receivedQuantity || 0) > 0);

            if (allReceived) {
                newStatus = 'Received';
            } else if (anyReceived) {
                newStatus = 'Partially Received';
            }
        }
        
        // Validation: Mandatory Supplier Reference when Receiving
        if ((newStatus === 'Received' || newStatus === 'Partially Received') && !formData.supplierReference) {
            alert('Supplier Reference / Invoice No. is mandatory when marking goods as Received or Partially Received.');
            return;
        }
        
        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';

        // If we are editing, ensure we use the existing ID. If new, generate one.
        const finalId = purchaseOrder?.id || formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode);

        const payload: any = {
            ...formData,
            id: finalId,
            status: newStatus,
            partUpdates: getPartUpdates(),
        };
        
        onSave(payload as PurchaseOrder);
        onClose();
    };

    const handleMarkAndSaveAsReceived = () => {
        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            alert('Supplier and Internal Reference are required.');
            return;
        }
        
        // Validation: Mandatory Supplier Reference
        if (!formData.supplierReference) {
             alert('Supplier Reference / Invoice No. is mandatory when marking goods as Received.');
             return;
        }

        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        const finalId = purchaseOrder?.id || formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode);
    
        const updatedPO: any = {
            ...formData,
            id: finalId,
            lineItems: (formData.lineItems || []).map(item => ({
                ...item,
                receivedQuantity: Number(item.quantity)
            })),
            status: 'Received',
            partUpdates: getPartUpdates(),
        };
        
        onSave(updatedPO as PurchaseOrder);
        onClose();
    };
    

    const { totalNet, grandTotal, vatBreakdown } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        if (!formData || !formData.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [] };

        let currentTotalNet = 0;

        formData.lineItems.forEach(item => {
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId);
            if (!taxRate) return;

            if (!breakdown[taxCodeId]) {
                breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            }
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            breakdown[taxCodeId].net += itemTotal;
            currentTotalNet += itemTotal;
        });

        Object.values(breakdown).forEach(summary => {
            summary.vat = summary.net * (summary.rate / 100);
        });
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0 && b.rate > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        
        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown };
    }, [formData.lineItems, taxRatesMap, standardTaxRateId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] animate-fade-in-up">
                <div className="flex justify-between items-center border-b p-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="font-semibold text-sm">Supplier*</label>
                            <SearchableSelect
                                options={suppliers.map(s => ({ id: s.id, label: s.name }))}
                                value={formData.supplierId || null}
                                onChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
                                placeholder="Search suppliers..."
                                disabled={isOrderedOrLater}
                            />
                        </div>
                        <div>
                            <label className="font-semibold text-sm">Internal Reference*</label>
                            <input name="vehicleRegistrationRef" value={formData.vehicleRegistrationRef || ''} onChange={handleChange} placeholder="e.g., Vehicle Reg, Stock, Workshop Supplies" className="w-full p-2 border rounded mt-1 disabled:bg-gray-100 disabled:cursor-not-allowed" required disabled={isOrderedOrLater} />
                        </div>
                         <div>
                            <label className="font-semibold text-sm">Supplier Reference / Invoice No.</label>
                            <input name="supplierReference" value={formData.supplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1 border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Required when receiving" />
                        </div>
                        <div>
                             <label className="font-semibold text-sm">Secondary Ref (Balance)</label>
                             <input name="secondarySupplierReference" value={formData.secondarySupplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" placeholder="e.g. Invoice # for remaining items" />
                        </div>
                        <div>
                            <label className="font-semibold text-sm">Order Date</label>
                            <input name="orderDate" type="date" value={formData.orderDate} onChange={handleChange} className="w-full p-2 border rounded mt-1 disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isOrderedOrLater} />
                        </div>
                        <div>
                            <label className="font-semibold text-sm">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                <option>Draft</option>
                                <option>Ordered</option>
                                <option>Partially Received</option>
                                <option>Received</option>
                                <option>Cancelled</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="font-semibold text-sm">Notes</label>
                            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold">Line Items</h3>
                            {(formData.status === 'Ordered' || formData.status === 'Partially Received') && (
                                <button 
                                    onClick={handleFillBalance} 
                                    className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold"
                                >
                                    <ArrowDownCircle size={14} /> Receive Balance
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                <div className="col-span-2">Part Number</div>
                                <div className="col-span-3">Description</div>
                                <div className="col-span-1 text-right">Qty</div>
                                <div className="col-span-1 text-right">Total Rcvd</div>
                                <div className="col-span-2 text-right">Unit Cost (Net)</div>
                                <div className="col-span-2 text-center">Tax</div>
                                <div className="col-span-1"></div>
                            </div>
                            {(formData.lineItems || []).map(item => {
                                // Safely access original items, handling null purchaseOrder
                                const originalItem = (purchaseOrder?.lineItems || []).find(li => li.id === item.id);
                                const isCostPriceChanged = originalItem !== undefined && item.unitPrice !== originalItem.unitPrice;
                                const part = item.partNumber ? partsMap.get(item.partNumber) : undefined;

                                return (
                                    <MemoizedEditableLineItemRow 
                                        key={item.id} 
                                        item={item} 
                                        taxRates={taxRates} 
                                        onLineItemChange={handleLineItemChange} 
                                        onRemoveLineItem={removeLineItem} 
                                        isReceivingDisabled={isReceivingDisabled}
                                        isOrderedOrLater={isOrderedOrLater}
                                        isCostPriceChanged={isCostPriceChanged && !!part}
                                        newSalePrice={newSalePrices[item.id] !== undefined ? newSalePrices[item.id] : (part?.salePrice?.toString() ?? '')}
                                        onNewSalePriceChange={(value) => setNewSalePrices(prev => ({...prev, [item.id]: value}))}
                                    />
                                );
                            })}
                        </div>
                        {!isOrderedOrLater && (
                            <button onClick={addLineItem} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <PlusCircle size={16} className="mr-1" /> Add Item
                            </button>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t flex justify-end">
                        <div className="w-64 text-sm">
                            <div className="flex justify-between"><span>Net Total</span><span className="font-semibold">{formatCurrency(totalNet)}</span></div>
                            {vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                        </div>
                    </div>
                </div>
                <footer className="flex justify-between items-center p-4 border-t bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {formData.id && onViewPurchaseOrder && (
                             <button
                                type="button"
                                onClick={() => onViewPurchaseOrder(formData as PurchaseOrder)}
                                className="flex items-center gap-2 text-sm py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
                            >
                                <Eye size={16}/> View &amp; Send
                            </button>
                        )}
                        {!isReceivingDisabled && (
                             <button type="button" onClick={handleMarkAndSaveAsReceived} className="flex items-center gap-2 text-sm py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                <CheckSquare size={16}/> Mark All Received & Save
                            </button>
                         )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">Cancel</button>
                        <button onClick={handleSave} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                            <Save size={16} className="mr-2"/> Save Changes
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PurchaseOrderFormModal;

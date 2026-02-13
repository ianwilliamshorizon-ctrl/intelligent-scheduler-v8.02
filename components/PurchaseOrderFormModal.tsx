import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PurchaseOrder, PurchaseOrderLineItem, Supplier, BusinessEntity, TaxRate, Part } from '../types';
import { Save, PlusCircle, Trash2, X, CheckSquare, Eye, ArrowDownCircle, AlertTriangle, CornerDownRight, RotateCcw } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { generatePurchaseOrderId } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';

interface EditableLineItemRowProps {
    item: PurchaseOrderLineItem;
    parts: Part[];
    onLineItemChange: (id: string, field: keyof PurchaseOrderLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    isReceivingDisabled: boolean;
    isOrderedOrLater: boolean;
    isCostPriceChanged: boolean;
    newSalePrice: string;
    onNewSalePriceChange: (value: string) => void;
    isCredit: boolean;
}

const MemoizedEditableLineItemRow = React.memo(({ 
    item, 
    parts,
    onLineItemChange, 
    onRemoveLineItem, 
    isReceivingDisabled, 
    isOrderedOrLater, 
    isCostPriceChanged, 
    newSalePrice, 
    onNewSalePriceChange, 
    isCredit 
}: EditableLineItemRowProps) => {
    
    const ordered = item.quantity || 0;
    const received = item.receivedQuantity || 0;
    const remaining = isCredit ? 0 : Math.max(0, ordered - received);
    const isFullyReceived = isCredit ? (Math.abs(received) >= Math.abs(ordered)) : (received >= ordered && ordered > 0);
    const isPendingReturn = item.returnStatus === 'Pending';

    const handlePartNumberChange = (val: string) => {
        onLineItemChange(item.id, 'partNumber', val);
        const foundPart = parts.find(p => p.partNumber.toLowerCase() === val.toLowerCase());
        if (foundPart) {
            onLineItemChange(item.id, 'description', foundPart.description || '');
            onLineItemChange(item.id, 'unitPrice', foundPart.costPrice || 0);
        }
    };
    
    return (
        <>
            <div className={`grid grid-cols-12 gap-2 items-center p-2 border bg-white ${isCostPriceChanged ? 'rounded-t-lg border-b-0' : 'rounded-lg'} ${isFullyReceived && isOrderedOrLater ? 'bg-green-50/50' : ''} ${isPendingReturn ? 'bg-amber-50 border-amber-200' : ''} ${isCredit ? 'bg-red-50/30' : ''}`}>
                <div className="col-span-2">
                    <input 
                        type="text" 
                        placeholder="Part Number" 
                        value={item.partNumber || ''} 
                        onChange={e => handlePartNumberChange(e.target.value)} 
                        className="w-full p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium" 
                        disabled={isOrderedOrLater} 
                    />
                </div>
                <input type="text" placeholder="Description" value={item.description || ''} onChange={e => onLineItemChange(item.id, 'description', e.target.value)} className="col-span-4 p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed text-sm" disabled={isOrderedOrLater} />
                <input type="number" step="1" value={item.quantity ?? 0} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className={`col-span-1 p-1 border rounded text-right disabled:bg-gray-100 disabled:cursor-not-allowed text-sm ${isCredit ? 'text-red-600 font-bold' : ''}`} disabled={isOrderedOrLater} />
                
                <div className="col-span-2 relative">
                    <input 
                        type="number" 
                        step="1" 
                        value={item.receivedQuantity ?? ''} 
                        onChange={e => onLineItemChange(item.id, 'receivedQuantity', e.target.value)} 
                        placeholder="0" 
                        className={`w-full p-1 border rounded text-right disabled:bg-gray-100 text-sm ${!isReceivingDisabled && remaining > 0 ? 'border-blue-400 ring-1 ring-blue-100 font-bold' : ''}`} 
                        disabled={isReceivingDisabled} 
                        title={`Ordered: ${ordered}`}
                    />
                </div>

                <input type="number" step="0.01" value={item.unitPrice ?? 0} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Unit Cost"/>
                
                <div className="col-span-1 flex justify-center">
                    {!isReceivingDisabled && !isCredit ? (
                         <button 
                            type="button"
                            onClick={() => onLineItemChange(item.id, 'returnStatus', isPendingReturn ? 'None' : 'Pending')}
                            className={`p-1 rounded ${isPendingReturn ? 'bg-amber-100 text-amber-600' : 'text-gray-300 hover:text-amber-500'}`}
                        >
                            <AlertTriangle size={16} fill={isPendingReturn ? "currentColor" : "none"}/>
                        </button>
                    ) : (
                         <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isOrderedOrLater}><Trash2 size={14} /></button>
                    )}
                </div>
            </div>
            {isCostPriceChanged && (
                <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-b-lg border-x border-b bg-blue-50 border-blue-200">
                    <div className="col-start-6 col-span-3 text-right text-sm font-semibold text-blue-800">
                        Cost price changed. Update sale price:
                    </div>
                    <div className="col-span-2">
                        <input
                            type="number"
                            step="0.01"
                            value={newSalePrice || ''}
                            onChange={(e) => onNewSalePriceChange(e.target.value)}
                            className="w-full p-1 border rounded text-right border-blue-300 focus:ring-blue-500"
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
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({ 
        lineItems: [],
        supplierId: '',
        vehicleRegistrationRef: '',
        supplierReference: '',
        secondarySupplierReference: '',
        notes: '',
        status: 'Draft',
        type: 'Standard',
        orderDate: formatDate(new Date())
    });
    const [newSalePrices, setNewSalePrices] = useState<Record<string, string>>({});
    
    const partsMap = useMemo(() => new Map(parts.map(p => [p.partNumber, p])), [parts]);
    const standardTaxRate = useMemo(() => taxRates.find(t => t.code === 'T1') || taxRates[0], [taxRates]);

    const title = useMemo(() => {
        if (!formData?.id) return 'Create New Purchase Order';
        if (formData.type === 'Credit') return `Credit Note Request #${formData.id}`;
        return `Edit Purchase Order #${formData.id}`;
    }, [formData.id, formData.type]);

    useEffect(() => {
        if (!isOpen) return;
        setNewSalePrices({});

        if (purchaseOrder) {
            const data = JSON.parse(JSON.stringify(purchaseOrder));
            const rawId = data.supplierId || data.supplier?.id || data.SupplierId || "";
            
            setFormData({
                ...data,
                supplierId: String(rawId), 
                vehicleRegistrationRef: data.vehicleRegistrationRef || '',
                supplierReference: data.supplierReference || '',
                secondarySupplierReference: data.secondarySupplierReference || '',
                notes: data.notes || '',
                status: data.status || 'Draft',
                type: data.type || 'Standard',
                lineItems: data.lineItems || []
            });
        } else {
            setFormData({
                entityId: selectedEntityId,
                supplierId: '',
                orderDate: formatDate(new Date()),
                status: 'Draft',
                lineItems: [],
                notes: '',
                vehicleRegistrationRef: '',
                supplierReference: '',
                secondarySupplierReference: '',
                type: 'Standard'
            });
        }
    }, [purchaseOrder, isOpen, selectedEntityId]);
    
    const isReceivingDisabled = useMemo(() => formData.status === 'Draft', [formData.status]);
    const isOrderedOrLater = useMemo(() => ['Ordered', 'Partially Received', 'Received'].includes(formData.status || ''), [formData.status]);
    
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
                        processedValue = isNaN(num) ? 0 : num;
                    }
                    return { ...item, [field]: processedValue };
                }
                return item;
            })
        }));
    }, []);
    
    const addLineItem = () => {
        const newItem: PurchaseOrderLineItem = { 
            id: crypto.randomUUID(), 
            description: '', 
            quantity: 1, 
            unitPrice: 0, 
            taxCodeId: standardTaxRate?.id 
        };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const removeLineItem = useCallback((id: string) => {
        setFormData(prev => ({ ...prev, lineItems: (prev.lineItems || []).filter(item => item.id !== id) }));
    }, []);
    
    const handleFillBalance = () => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).map(item => ({ ...item, receivedQuantity: item.quantity }))
        }));
    };

    const handleCreateCreditNote = () => {
        if (!purchaseOrder) return;
        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        const creditNote: Partial<PurchaseOrder> = {
            ...formData,
            id: generatePurchaseOrderId(allPurchaseOrders, entityShortCode) + "-CR",
            type: 'Credit',
            status: 'Draft',
            orderDate: formatDate(new Date()),
            supplierReference: `CR to ${formData.id}`,
            lineItems: (formData.lineItems || []).map(item => ({
                ...item,
                id: crypto.randomUUID(),
                quantity: -Math.abs(item.quantity),
                receivedQuantity: 0,
                returnStatus: undefined
            })),
            notes: `Credit Note for PO #${formData.id}. ${formData.notes || ''}`
        };
        setFormData(creditNote);
    };

    const getPartUpdates = useCallback((): Part[] => {
        const updatedParts: Part[] = [];
        (formData.lineItems || []).forEach(item => {
            const originalItem = (purchaseOrder?.lineItems || []).find(li => li.id === item.id);
            if (originalItem && item.unitPrice !== originalItem.unitPrice && item.partNumber) {
                const partToUpdate = parts.find(p => p.partNumber === item.partNumber);
                if (partToUpdate) {
                    let newSalePrice = partToUpdate.salePrice;
                    if (newSalePrices[item.id]) {
                        const parsed = parseFloat(newSalePrices[item.id]);
                        if (!isNaN(parsed)) newSalePrice = parsed;
                    }
                    updatedParts.push({ ...partToUpdate, costPrice: item.unitPrice, salePrice: newSalePrice });
                }
            }
        });
        return updatedParts;
    }, [formData.lineItems, purchaseOrder, parts, newSalePrices]);

    const calculateFinalStatus = (lineItems: PurchaseOrderLineItem[]): string => {
        if (lineItems.length === 0) return formData.status || 'Draft';
        
        const allReceived = lineItems.every(item => 
            Math.abs(Number(item.receivedQuantity || 0)) >= Math.abs(Number(item.quantity || 0))
        );
        const anyReceived = lineItems.some(item => 
            Math.abs(Number(item.receivedQuantity || 0)) > 0
        );

        if (allReceived) return 'Received';
        if (anyReceived) return 'Partially Received';
        return 'Ordered';
    };

    const handleSave = () => {
        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            alert('Supplier and Internal Reference are required.');
            return;
        }

        const lineItems = formData.lineItems || [];
        let newStatus = formData.status || 'Draft';

        if (newStatus !== 'Draft' && newStatus !== 'Cancelled') {
            newStatus = calculateFinalStatus(lineItems);
        }

        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        const payload = {
            ...formData,
            id: formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode),
            status: newStatus,
            partUpdates: getPartUpdates(),
        };
        
        onSave(payload as PurchaseOrder);
        onClose();
    };

    const handleFinalizeReceipt = () => {
        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            alert('Supplier and Internal Reference are required.');
            return;
        }
        
        // Ensure we have a reference number if we are receiving anything
        if (!formData.supplierReference) {
             alert('Please enter a Supplier Reference / Invoice No. to finalize this receipt.');
             return;
        }

        const lineItems = formData.lineItems || [];
        const newStatus = calculateFinalStatus(lineItems);

        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
    
        const updatedPO = {
            ...formData,
            id: formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode),
            status: newStatus,
            partUpdates: getPartUpdates(),
        };
        
        onSave(updatedPO as PurchaseOrder);
        onClose();
    };

    const { totalNet, totalTax, grandTotal } = useMemo(() => {
        let net = 0;
        (formData.lineItems || []).forEach(item => {
            net += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        });
        
        const taxRatePercent = standardTaxRate?.rate || 20;
        const tax = net * (taxRatePercent / 100);
        
        return { totalNet: net, totalTax: tax, grandTotal: net + tax };
    }, [formData.lineItems, standardTaxRate]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center border-b p-4">
                    <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <label className="font-semibold text-sm block text-gray-700">Supplier*</label>
                            <select 
                                name="supplierId"
                                value={formData.supplierId || ''} 
                                onChange={handleChange}
                                className="w-full p-2 border rounded mt-1 bg-white disabled:bg-gray-100"
                                disabled={isOrderedOrLater}
                            >
                                <option value="">-- Select Supplier --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Internal Ref (Reg/Job)*</label>
                            <input name="vehicleRegistrationRef" value={formData.vehicleRegistrationRef || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={isOrderedOrLater} />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Status</label>
                            <select name="status" value={formData.status || 'Draft'} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                <option>Draft</option>
                                <option>Ordered</option>
                                <option>Partially Received</option>
                                <option>Received</option>
                                <option>Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Supplier Ref (Invoice #)</label>
                            <input name="supplierReference" value={formData.supplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Secondary Ref (Delivery Note)</label>
                            <input name="secondarySupplierReference" value={formData.secondarySupplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Order Date</label>
                            <input type="date" name="orderDate" value={formData.orderDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 space-y-2">
                        <div className="flex justify-between items-end">
                            <h3 className="font-bold text-gray-800">Line Items</h3>
                            {isOrderedOrLater && !isReceivingDisabled && (
                                <button onClick={handleFillBalance} className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800 font-bold mb-1">
                                    <ArrowDownCircle size={14}/> Auto-fill "Rec'd" for all items
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-2">Part Number</div>
                            <div className="col-span-4">Description</div>
                            <div className="col-span-1 text-right">Qty</div>
                            <div className="col-span-2 text-right">Rec'd</div>
                            <div className="col-span-2 text-right">Unit Cost</div>
                            <div className="col-span-1"></div>
                        </div>

                        {(formData.lineItems || []).map(item => (
                            <MemoizedEditableLineItemRow 
                                key={item.id} 
                                item={item} 
                                parts={parts}
                                onLineItemChange={handleLineItemChange} 
                                onRemoveLineItem={removeLineItem} 
                                isReceivingDisabled={isReceivingDisabled}
                                isOrderedOrLater={isOrderedOrLater}
                                isCostPriceChanged={!!(item.partNumber && partsMap.get(item.partNumber) && item.unitPrice !== (purchaseOrder?.lineItems?.find(li => li.id === item.id)?.unitPrice))}
                                newSalePrice={newSalePrices[item.id] || ''}
                                onNewSalePriceChange={(v) => setNewSalePrices(p => ({...p, [item.id]: v}))}
                                isCredit={formData.type === 'Credit'}
                            />
                        ))}
                        {!isOrderedOrLater && (
                            <button onClick={addLineItem} className="text-indigo-600 font-semibold flex items-center gap-1 mt-2 hover:text-indigo-800">
                                <PlusCircle size={16}/> Add New Line
                            </button>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t flex justify-between items-start">
                        <div className="w-1/2">
                            <label className="font-semibold text-sm text-gray-700 block mb-1">Internal Notes</label>
                            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded text-sm bg-white" placeholder="Add any internal notes here..." />
                        </div>
                        <div className="w-64 space-y-1">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Net Total</span>
                                <span>{formatCurrency(totalNet)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 italic">
                                <span>VAT ({standardTaxRate?.rate || 20}%)</span>
                                <span>{formatCurrency(totalTax)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t text-indigo-900">
                                <span>Grand Total</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="p-4 border-t flex justify-between bg-gray-50">
                    <div className="flex gap-2">
                        {!isReceivingDisabled && formData.type !== 'Credit' && (
                            <button onClick={handleFinalizeReceipt} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold shadow-sm">
                                <CheckSquare size={16}/> Save & Finalize Receipt
                            </button>
                        )}
                        {purchaseOrder && formData.type !== 'Credit' && (
                            <button onClick={handleCreateCreditNote} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg flex items-center gap-2 hover:bg-amber-200 font-bold">
                                <RotateCcw size={16}/> Create Credit Note
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold shadow-sm">
                            <Save size={16}/> Save Changes
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PurchaseOrderFormModal;
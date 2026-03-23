import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as T from '../types';
import { X, Save, Plus, Trash2, Edit, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';

interface PurchaseOrderEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: T.PurchaseOrder;
    onUpdate: (updatedPO: T.PurchaseOrder, source?: string) => Promise<void>;
    handleSaveItem: (setter: React.Dispatch<React.SetStateAction<any[]>>, item: any, collectionOverride?: string) => Promise<any>;
    onEditPart: (part: T.Part) => void;
}

const PurchaseOrderEditModal: React.FC<PurchaseOrderEditModalProps> = ({ isOpen, onClose, purchaseOrder, onUpdate, handleSaveItem, onEditPart }) => {
    const { setConfirmation } = useApp();
    const { parts, setParts, taxRates } = useData();
    const [editablePo, setEditablePo] = useState<T.PurchaseOrder>(purchaseOrder);
    const [showPartSearch, setShowPartSearch] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const taxRatesMap = useMemo(() => new Map(taxRates.map(tr => [tr.id, tr.rate])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    useEffect(() => {
        setEditablePo(purchaseOrder);
    }, [purchaseOrder, isOpen]);

    const filteredParts = useMemo(() => {
        if (!searchTerm) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return parts.filter(p => 
            p.partNumber.toLowerCase().includes(lowerSearch) || 
            p.description.toLowerCase().includes(lowerSearch)
        ).slice(0, 10);
    }, [searchTerm, parts]);

    const handleLineItemChange = (id: string, field: keyof T.PurchaseOrderLineItem, value: any) => {
        setEditablePo(prev => {
            if (!prev) return prev;
            const updatedItems = (prev.lineItems || []).map(item => 
                item.id === id ? { ...item, [field]: value } : item
            );
            return { ...prev, lineItems: updatedItems };
        });
    };

    const handlePartNumberChange = async (id: string, newPartNumber: string) => {
        handleLineItemChange(id, 'partNumber', newPartNumber);
        const existingPart = parts.find(p => p.partNumber === newPartNumber);
        if (existingPart) {
            handleLineItemChange(id, 'partId', existingPart.id);
            handleLineItemChange(id, 'description', existingPart.description);
            handleLineItemChange(id, 'unitPrice', existingPart.costPrice);
        } else {
            handleLineItemChange(id, 'partId', undefined);
        }
    };

    const selectPart = (lineItemId: string, part: T.Part) => {
        handleLineItemChange(lineItemId, 'partId', part.id);
        handleLineItemChange(lineItemId, 'partNumber', part.partNumber);
        handleLineItemChange(lineItemId, 'description', part.description);
        handleLineItemChange(lineItemId, 'unitPrice', part.costPrice);
        setShowPartSearch(null);
        setSearchTerm('');
    };

    const addNewLineItem = () => {
        const newLineItem: T.PurchaseOrderLineItem = {
            id: crypto.randomUUID(),
            partNumber: '',
            description: '',
            quantity: 1,
            receivedQuantity: 0,
            unitPrice: 0,
            taxCodeId: standardTaxRateId || '',
        };
        setEditablePo(prev => prev ? { ...prev, lineItems: [...(prev.lineItems || []), newLineItem] } : prev);
    };

    const removeLineItem = (id: string) => {
        setEditablePo(prev => prev ? { ...prev, lineItems: (prev.lineItems || []).filter(item => item.id !== id) } : prev);
    };

    const handleSaveEdits = async () => {
        await onUpdate(editablePo);
        onClose();
    };

    const handleReceiveAndFinalize = async () => {
        let poToUpdate = { ...editablePo, status: 'Received' as const };
        
        for (const item of poToUpdate.lineItems) {
            let part = parts.find(p => p.id === item.partId);
            if (!part && item.partNumber) {
                part = parts.find(p => p.partNumber === item.partNumber);
            }
            
            if (part) {
                const updatedPart = { ...part, stockQuantity: (part.stockQuantity || 0) + (item.quantity - (item.receivedQuantity || 0)) };
                await handleSaveItem(setParts, updatedPart, 'brooks_parts');
                item.partId = part.id;
            } else {
                const newPart: T.Part = {
                    id: `new_${Date.now()}`,
                    partNumber: item.partNumber,
                    description: item.description,
                    stockQuantity: item.quantity - (item.receivedQuantity || 0),
                    costPrice: item.unitPrice,
                    salePrice: item.unitPrice * 1.2, 
                    isStockItem: true,
                    taxCodeId: item.taxCodeId,
                    defaultSupplierId: poToUpdate.supplierId,
                };
                const savedPart = await handleSaveItem(setParts, newPart, 'brooks_parts');
                item.partId = savedPart.id;
            }
            item.receivedQuantity = item.quantity;
        }

        await onUpdate(poToUpdate, 'receive');
        onClose();
    };

    const poTotal = useMemo(() => 
        (editablePo.lineItems || []).reduce((acc, item) => {
            const taxRate = taxRatesMap.get(item.taxCodeId) || 0;
            const itemTotal = (item.unitPrice || 0) * (item.quantity || 0);
            const itemVat = itemTotal * (taxRate / 100);
            return acc + itemTotal + itemVat;
        }, 0),
    [editablePo.lineItems, taxRatesMap]);

    const hasMissingPartIds = useMemo(() => 
        (editablePo.lineItems || []).some(item => !item.partId && item.partNumber)
    , [editablePo.lineItems]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h2 className="text-xl font-bold flex items-center gap-2">Edit Purchase Order: {purchaseOrder.id}</h2>
                    <button type="button" onClick={onClose}><X size={28} /></button>
                </header>

                <main className="flex-grow overflow-y-auto p-6">
                    {hasMissingPartIds && (
                        <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-sm text-yellow-800">
                            <AlertTriangle size={16}/>
                            <span>Some parts are not linked to inventory items. This may affect stock levels.</span>
                        </div>
                    )}

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-2 w-1/4">Part No.</th>
                                <th className="text-left p-2 w-2/5">Description</th>
                                <th className="text-right p-2">Qty</th>
                                <th className="text-right p-2">Unit Price</th>
                                <th className="text-right p-2">Total</th>
                                <th className="p-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(editablePo.lineItems || []).map(item => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 align-top">
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={item.partNumber}
                                                onChange={e => handlePartNumberChange(item.id, e.target.value)}
                                                onFocus={() => { setShowPartSearch(item.id); setSearchTerm(item.partNumber); }}
                                                onBlur={() => setTimeout(() => setShowPartSearch(null), 200)}
                                                className={`w-full p-1 border rounded bg-white ${!item.partId && item.partNumber ? 'border-red-500' : ''}`}
                                            />
                                            {showPartSearch === item.id && (
                                                <div className="absolute z-10 top-full left-0 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                                    {filteredParts.map(part => (
                                                        <div key={part.id} onMouseDown={() => selectPart(item.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer">
                                                            {part.partNumber} - {part.description}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <input type="text" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} className="w-full p-1 border rounded bg-white" />
                                    </td>
                                    <td className="p-2 text-right align-top">
                                        <input type="number" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)} className="w-20 p-1 border rounded text-right bg-white" />
                                    </td>
                                    <td className="p-2 text-right align-top">
                                         <input type="number" step="0.01" value={item.unitPrice} onChange={e => handleLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24 p-1 border rounded text-right bg-white" />
                                    </td>
                                    <td className="p-2 text-right font-semibold align-top">{formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}</td>
                                    <td className="p-2 text-center align-top flex items-center gap-2">
                                        {item.partId && (
                                            <button onClick={() => onEditPart({id: item.partId} as T.Part)} className="text-gray-500 hover:text-indigo-600">
                                                <Edit size={16}/>
                                            </button>
                                        )}
                                        <button onClick={() => removeLineItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addNewLineItem} className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold"><Plus size={16}/> Add New Item</button>
                </main>

                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="font-bold text-lg">Total: {formatCurrency(poTotal)}</div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400">Cancel</button>
                        <button type="button" onClick={handleSaveEdits} className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"><Save size={16}/> Save Changes</button>
                        <button type="button" onClick={handleReceiveAndFinalize} disabled={hasMissingPartIds} className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"><CheckCircle size={16}/> Receive & Finalize</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PurchaseOrderEditModal;

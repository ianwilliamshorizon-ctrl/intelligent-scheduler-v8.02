import React, { useState, useMemo, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import * as T from '../types';
import { X, Printer, Package, Send, Phone, Plus, Save } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PurchaseOrderPrint } from './PurchaseOrderPrint';
import { formatCurrency } from '../core/utils/formatUtils';
import { useData } from '../core/state/DataContext';
import EditableLineItemRow from './EditableLineItemRow';
import { v4 as uuidv4 } from 'uuid';

interface PurchaseOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: T.PurchaseOrder;
    // Updated signature to accept the optional source string from PurchaseOrdersTab
    onUpdate: (updatedPO: T.PurchaseOrder, source?: string) => Promise<void>;
    onSend: (poId: string) => void;
    
    // Made these optional (?) to fix the TS2739 error in PurchaseOrdersTab.tsx
    onEditPart?: (part: any) => void; 
    handleSaveItem?: (
        setter: Dispatch<SetStateAction<any[]>>, 
        item: any, 
        collectionOverride?: string
    ) => Promise<void>;
}

const PurchaseOrderViewModal: React.FC<PurchaseOrderViewModalProps> = ({ 
    isOpen, 
    onClose, 
    purchaseOrder, 
    onUpdate, 
    onSend,
    onEditPart,
    handleSaveItem
}) => {
    const { taxRates, suppliers, businessEntities } = useData();
    const componentToPrintRef = useRef<HTMLDivElement>(null);
    const [lineItems, setLineItems] = useState<T.PurchaseOrderLineItem[]>([]);

    useEffect(() => {
        if (purchaseOrder.lineItems) {
            setLineItems(purchaseOrder.lineItems);
        }
    }, [purchaseOrder.lineItems]);

    const taxRatesMap = useMemo(() => new Map(taxRates.map(tr => tr.id && tr.rate ? [tr.id, tr.rate] : [null, 0])), [taxRates]);

    const handlePrint = useReactToPrint({
        documentTitle: `Purchase_Order_${purchaseOrder.id}`,
    });

    const triggerPrint = () => {
        // Correct 2026 syntax: single functional argument
        handlePrint(() => componentToPrintRef.current);
    };

    const handleOrderByPhone = async () => {
        const confirmedPO = { ...purchaseOrder, status: 'Ordered' as const, lineItems };
        await onUpdate(confirmedPO);
        onClose();
    };

    const handleSave = async () => {
        const updatedPO = { ...purchaseOrder, lineItems };
        await onUpdate(updatedPO);
        onClose();
    };

    const handleLineItemChange = (updatedItem: T.PurchaseOrderLineItem) => {
        const updatedLineItems = lineItems.map(item => item.id === updatedItem.id ? updatedItem : item);
        setLineItems(updatedLineItems);
    };

    const handleAddLineItem = () => {
        const newItem: T.PurchaseOrderLineItem = {
            id: uuidv4(),
            partNumber: '',
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxCodeId: undefined, 
        };
        setLineItems([...lineItems, newItem]);
    };

    const handleDeleteLineItem = (itemId: string) => {
        const updatedLineItems = lineItems.filter(item => item.id !== itemId);
        setLineItems(updatedLineItems);
    };
    
    const printData = useMemo(() => {
        const supplier = suppliers.find(s => s.id === purchaseOrder.supplierId);
        const entityDetails = businessEntities.find(e => e.id === purchaseOrder.entityId);
        const totals = (lineItems || []).reduce((acc, item) => {
            const taxRate = taxRatesMap.get(item.taxCodeId || null) || 0;
            const itemTotal = (item.unitPrice || 0) * (item.quantity || 0);
            const itemVat = itemTotal * (taxRate / 100);
            acc.net += itemTotal;
            acc.vat += itemVat;
            return acc;
        }, { net: 0, vat: 0 });
        const grandTotal = totals.net + totals.vat;

        return {
            supplier,
            entityDetails,
            totals: { ...totals, grandTotal }
        };
    }, [lineItems, purchaseOrder, suppliers, businessEntities, taxRatesMap]);

    const poTotal = useMemo(() => 
        (lineItems || []).reduce((acc, item) => {
            const taxRate = taxRatesMap.get(item.taxCodeId || null) || 0;
            const itemTotal = (item.unitPrice || 0) * (item.quantity || 0);
            const itemVat = itemTotal * (taxRate / 100);
            return acc + itemTotal + itemVat;
        }, 0),
    [lineItems, taxRatesMap]);

    if (!isOpen) return null;

    const isDraft = purchaseOrder.status === 'Draft';

    const deliveryAddress = printData.entityDetails ? `${printData.entityDetails.addressLine1}, ${printData.entityDetails.city}, ${printData.entityDetails.postcode}` : 'N/A';

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Package size={24}/>Purchase Order: {purchaseOrder.id}</h2>
                    <button type="button" onClick={onClose}><X size={28} /></button>
                </header>

                <main className="flex-grow overflow-y-auto p-6">
                     <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6 text-sm">
                        <div>
                            <label className="font-bold text-gray-600 block">Supplier</label>
                            <p>{printData.supplier?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="font-bold text-gray-600 block">Delivery Address</label>
                            <p>{deliveryAddress}</p>
                        </div>
                        <div>
                            <label className="font-bold text-gray-600 block">Order Date</label>
                            <p>{purchaseOrder.orderDate}</p>
                        </div>
                        <div>
                            <label className="font-bold text-gray-600 block">Supplier Reference</label>
                            <p>{purchaseOrder.supplierReference || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="font-bold text-gray-600 block">Secondary Reference</label>
                             <p>{purchaseOrder.secondarySupplierReference || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="font-bold text-gray-600 block">Vehicle Reg</label>
                            <p className="font-mono">{purchaseOrder.vehicleRegistrationRef || 'N/A'}</p>
                        </div>
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-2 w-1/4">Part No.</th>
                                <th className="text-left p-2 w-2/5">Description</th>
                                <th className="text-right p-2">Qty</th>
                                <th className="text-right p-2">Unit Price</th>
                                <th className="text-right p-2">Total</th>
                                {isDraft && <th className="p-2"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map(item => (
                                isDraft ? (
                                    <EditableLineItemRow
                                        key={item.id}
                                        item={item}
                                        onItemChange={handleLineItemChange}
                                        onDeleteItem={handleDeleteLineItem}
                                    />
                                ) : (
                                    <tr key={item.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 align-top">{item.partNumber}</td>
                                        <td className="p-2 align-top">{item.description}</td>
                                        <td className="p-2 text-right align-top">{item.quantity}</td>
                                        <td className="p-2 text-right align-top">{formatCurrency(item.unitPrice)}</td>
                                        <td className="p-2 text-right font-semibold align-top">{formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}</td>
                                    </tr>
                                )
                            ))}
                        </tbody>
                    </table>
                    {isDraft && (
                        <div className="mt-4">
                            <button onClick={handleAddLineItem} className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                                <Plus size={16}/> Add Line Item
                            </button>
                        </div>
                    )}
                </main>

                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="font-bold text-lg">Total: {formatCurrency(poTotal)}</div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400">Close</button>
                        
                        {isDraft ? (
                            <>
                                <button type="button" onClick={handleSave} className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                                    <Save size={16}/> Save Changes
                                </button>
                                <button type="button" onClick={handleOrderByPhone} className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                                    <Phone size={16}/> Order by Phone
                                </button>
                                <button onClick={() => onSend(purchaseOrder.id)} className="flex items-center gap-2 py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700">
                                    <Send size={16}/> Send via Email
                                </button>
                            </>
                        ) : (
                            <button type="button" onClick={triggerPrint} className="flex items-center gap-2 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold">
                                <Printer size={14}/> Print
                            </button>
                        )}
                    </div>
                </footer>

                <div className="hidden">
                    <div ref={componentToPrintRef}>
                        {printData.supplier && printData.entityDetails && (
                            <PurchaseOrderPrint 
                                purchaseOrder={purchaseOrder} 
                                supplier={printData.supplier} 
                                entityDetails={printData.entityDetails} 
                                totals={printData.totals}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrderViewModal;
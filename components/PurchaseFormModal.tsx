import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Save, Plus, Trash2, Loader2, Package, AlertCircle
} from 'lucide-react';
import { useData } from '../core/state/DataContext';
import { PurchaseOrder, PurchaseOrderLineItem, Supplier, Part } from '../types';

// Local helper for currency formatting
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
    }).format(amount);
};

// Local helper for ID generation
const generatePOId = (existing: PurchaseOrder[]) => {
    const nextNum = existing.length + 1001;
    return `PO-${nextNum}`;
};

interface PurchaseOrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPO: PurchaseOrder | null;
}

const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({
    isOpen,
    onClose,
    selectedPO
}) => {
    const { 
        purchaseOrders, setPurchaseOrders, 
        suppliers, jobs 
    } = useData();

    const [isProcessing, setIsProcessing] = useState(false);
    
    // Create a memoized lookup map for suppliers to ensure quick name resolution
    const supplierMap = useMemo(() => {
        const map: Record<string, Supplier> = {};
        suppliers.forEach(s => {
            map[s.id] = s;
        });
        return map;
    }, [suppliers]);

    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
        id: '',
        supplierId: '', 
        status: 'Draft',
        lineItems: [],
        totalAmount: 0,
        taxAmount: 0,
        jobId: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (selectedPO) {
                // Check if the current supplierId actually exists in our loaded suppliers
                const validSupplierId = supplierMap[selectedPO.supplierId] ? selectedPO.supplierId : '';
                
                setFormData({
                    ...selectedPO,
                    supplierId: validSupplierId,
                    lineItems: selectedPO.lineItems || []
                });
            } else {
                setFormData({
                    id: generatePOId(purchaseOrders),
                    supplierId: '', // Start empty for new POs
                    status: 'Draft',
                    lineItems: [],
                    totalAmount: 0,
                    taxAmount: 0,
                    jobId: ''
                });
            }
        }
    }, [isOpen, selectedPO, purchaseOrders, supplierMap]);

    const handleLineItemChange = (id: string, field: keyof PurchaseOrderLineItem, value: any) => {
        const newItems = (formData.lineItems || []).map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        });

        const newTotal = newItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        setFormData(prev => ({ ...prev, lineItems: newItems, totalAmount: newTotal }));
    };

    const addLineItem = (part?: Part) => {
        const newItem: PurchaseOrderLineItem = {
            id: `poi_${Date.now()}`,
            partNumber: part?.partNumber || '', 
            description: part?.description || '',
            quantity: 1,
            unitPrice: part?.costPrice || 0,
            receivedQuantity: 0,
            taxCodeId: 'VAT_20' 
        };
        
        setFormData(prev => {
            const items = [...(prev.lineItems || []), newItem];
            const total = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
            return {
                ...prev,
                lineItems: items,
                totalAmount: total
            };
        });
    };

    const removeLineItem = (id: string) => {
        const newItems = (formData.lineItems || []).filter(item => item.id !== id);
        const newTotal = newItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        setFormData(prev => ({ ...prev, lineItems: newItems, totalAmount: newTotal }));
    };

    const handleSave = async () => {
        if (!formData.supplierId) {
            alert("Please select a supplier before saving.");
            return;
        }

        setIsProcessing(true);
        try {
            const finalPO = {
                ...formData,
                updatedAt: new Date().toISOString()
            } as PurchaseOrder;

            if (purchaseOrders.find(po => po.id === finalPO.id)) {
                setPurchaseOrders(purchaseOrders.map(po => po.id === finalPO.id ? finalPO : po));
            } else {
                setPurchaseOrders([...purchaseOrders, finalPO]);
            }
            onClose();
        } catch (err) {
            console.error("Failed to save PO:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
                
                {/* Header */}
                <header className="px-6 py-4 border-b flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                            <Package size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900">
                                {selectedPO ? `Edit Purchase Order #${formData.id}` : 'New Purchase Order'}
                            </h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                                {formData.status}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </header>

                <main className="flex-grow overflow-y-auto p-6 space-y-6">
                    {/* Supplier Info Alert if missing */}
                    {!formData.supplierId && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800">
                            <AlertCircle size={18} />
                            <p className="text-sm font-bold">This Purchase Order is not linked to a supplier. Please select one below.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        {/* Supplier Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Supplier</label>
                            <select 
                                value={formData.supplierId} 
                                onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                                className={`w-full p-3 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                                    !formData.supplierId ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-gray-50'
                                }`}
                            >
                                <option value="">-- Select Supplier ({suppliers.length} available) --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Job Link */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Linked Job</label>
                            <select 
                                value={formData.jobId || ''} 
                                onChange={(e) => setFormData(prev => ({ ...prev, jobId: e.target.value }))}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Stock Order (No Job)</option>
                                {jobs.filter(j => j.status !== 'Invoiced').map(j => (
                                    <option key={j.id} value={j.id}>Job #{j.id} - {j.description?.substring(0, 20)}...</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border border-gray-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Description</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 w-24 text-center">Qty</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 w-32">Unit Price</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 w-32">Total</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.lineItems?.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <input 
                                                className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                                value={item.description}
                                                onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-center"
                                                value={item.quantity}
                                                onChange={(e) => handleLineItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1.5 text-gray-400 text-xs">£</span>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-white border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-sm font-bold"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black text-gray-900">
                                            {formatCurrency(item.unitPrice * item.quantity)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => removeLineItem(item.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 bg-gray-50/50 border-t">
                            <button 
                                onClick={() => addLineItem()}
                                className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                            >
                                <Plus size={14} /> Add Manual Item
                            </button>
                        </div>
                    </div>
                </main>

                <footer className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cost (Ex. Tax)</p>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(formData.totalAmount || 0)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-black text-gray-500 hover:text-gray-700 transition-all"
                        >
                            CANCEL
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            SAVE PURCHASE ORDER
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PurchaseOrderFormModal;
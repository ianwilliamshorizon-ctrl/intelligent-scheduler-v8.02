import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    X, Save, Plus, Trash2, Loader2, Package, AlertCircle, Search
} from 'lucide-react';
import { useData } from '../core/state/DataContext';
import { PurchaseOrder, PurchaseOrderLineItem, Supplier, Part } from '../types';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
    }).format(amount);
};

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
        suppliers, jobs, parts 
    } = useData();

    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
        id: '',
        supplierId: '', 
        status: 'Draft',
        lineItems: [],
        totalAmount: 0,
        taxAmount: 0,
        jobId: '',
        notes: ''
    });

    const poId = selectedPO?.id;

    useEffect(() => {
        if (!isOpen) return;

        if (selectedPO) {
            setFormData({
                ...selectedPO,
                lineItems: selectedPO.lineItems || [],
                jobId: selectedPO.jobId || '',
                notes: selectedPO.notes || '',
                taxAmount: selectedPO.taxAmount || 0
            });
        } else {
            setFormData({
                id: generatePOId(purchaseOrders),
                supplierId: '',
                status: 'Draft',
                lineItems: [],
                totalAmount: 0,
                taxAmount: 0,
                jobId: '',
                notes: ''
            });
        }
    }, [isOpen, poId]);

    // Calculate totals whenever line items change
    const calculateTotals = (items: PurchaseOrderLineItem[]) => {
        const subtotal = items.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
        const tax = subtotal * 0.20; // Assuming flat 20% VAT for now
        return { total: subtotal, tax: tax };
    };

    const handleLineItemChange = (id: string, field: keyof PurchaseOrderLineItem, value: any) => {
        const newItems = (formData.lineItems || []).map(item => {
            if (item.id === id) return { ...item, [field]: value };
            return item;
        });
        const { total, tax } = calculateTotals(newItems);
        setFormData(prev => ({ ...prev, lineItems: newItems, totalAmount: total, taxAmount: tax }));
    };

    const addLineItem = (part?: Part) => {
        const newItem: PurchaseOrderLineItem = {
            id: `poi_${Date.now()}`,
            partNumber: part?.partNumber || '', 
            description: part?.description || 'Manual Item',
            quantity: 1,
            unitPrice: part?.costPrice || 0,
            receivedQuantity: 0,
            taxCodeId: 'VAT_20' 
        };
        
        setFormData(prev => {
            const items = [...(prev.lineItems || []), newItem];
            const { total, tax } = calculateTotals(items);
            return { ...prev, lineItems: items, totalAmount: total, taxAmount: tax };
        });
        setSearchTerm(''); // Reset search after adding
    };

    const removeLineItem = (id: string) => {
        const newItems = (formData.lineItems || []).filter(item => item.id !== id);
        const { total, tax } = calculateTotals(newItems);
        setFormData(prev => ({ ...prev, lineItems: newItems, totalAmount: total, taxAmount: tax }));
    };

    const filteredParts = useMemo(() => {
        if (!searchTerm) return [];
        return parts.filter(p => 
            p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5); // Limit to top 5 results for speed
    }, [searchTerm, parts]);

    const handleSave = async () => {
        if (!formData.supplierId) return alert("Please select a supplier.");
        setIsProcessing(true);
        try {
            const finalPO = { ...formData, updatedAt: new Date().toISOString() } as PurchaseOrder;
            if (purchaseOrders.find(po => po.id === finalPO.id)) {
                setPurchaseOrders(purchaseOrders.map(po => po.id === finalPO.id ? finalPO : po));
            } else {
                setPurchaseOrders([...purchaseOrders, finalPO]);
            }
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200">
                
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
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{formData.status}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </header>

                <main className="flex-grow overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Supplier</label>
                            <select 
                                value={formData.supplierId || ''} 
                                onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">-- Select Supplier --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Linked Job</label>
                            <select 
                                value={formData.jobId || ''} 
                                onChange={(e) => setFormData(prev => ({ ...prev, jobId: e.target.value }))}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Stock Order (No Job)</option>
                                {jobs.map(j => <option key={j.id} value={j.id}>Job #{j.id} - {j.description?.substring(0, 30)}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Part Search / Add */}
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                             <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Add Parts from Catalog</label>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Search by Part Number or Description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        
                        {filteredParts.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                                {filteredParts.map(part => (
                                    <button
                                        key={part.id}
                                        onClick={() => addLineItem(part)}
                                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex justify-between items-center border-b last:border-0"
                                    >
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{part.partNumber}</p>
                                            <p className="text-xs text-gray-500">{part.description}</p>
                                        </div>
                                        <p className="text-sm font-bold text-indigo-600">{formatCurrency(part.costPrice)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Line Items */}
                    <div className="border border-gray-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Part / Description</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase w-24 text-center">Qty</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase w-32">Unit Price</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase w-32">Subtotal</th>
                                    <th className="px-4 py-3 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(formData.lineItems || []).map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <p className="text-[10px] font-black text-indigo-600 mb-1">{item.partNumber || 'MANUAL'}</p>
                                            <input 
                                                className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                                value={item.description || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-center"
                                                value={item.quantity ?? ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1.5 text-gray-400 text-xs">£</span>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-white border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-sm font-bold"
                                                    value={item.unitPrice ?? ''}
                                                    onChange={(e) => handleLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black text-gray-900">
                                            {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => removeLineItem(item.id)} className="text-gray-300 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {formData.lineItems?.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm italic">
                                            No items added yet. Search above or add a manual item.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="p-4 bg-gray-50/50 border-t flex gap-4">
                            <button onClick={() => addLineItem()} className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest">
                                <Plus size={14} /> Add Manual Item
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Internal Notes</label>
                        <textarea 
                            value={formData.notes || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Add any specific instructions for the supplier..."
                        />
                    </div>
                </main>

                <footer className="px-6 py-6 border-t bg-white flex justify-between items-end">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</p>
                            <p className="text-lg font-bold text-gray-700">{formatCurrency(formData.totalAmount || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">VAT (20%)</p>
                            <p className="text-lg font-bold text-gray-700">{formatCurrency(formData.taxAmount || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Order Value</p>
                            <p className="text-2xl font-black text-gray-900">{formatCurrency((formData.totalAmount || 0) + (formData.taxAmount || 0))}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-black text-gray-500 hover:text-gray-700">CANCEL</button>
                        <button 
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50"
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
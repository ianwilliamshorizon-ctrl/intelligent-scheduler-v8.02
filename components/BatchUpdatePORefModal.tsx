import React, { useState, useMemo } from 'react';
import { PurchaseOrder, Supplier } from '../types';
import FormModal from './FormModal';
import { Search, Loader2, CheckSquare, Square, RefreshCcw } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import SearchableSelect from './SearchableSelect';

interface BatchUpdatePORefModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedPos: PurchaseOrder[]) => void;
    purchaseOrders: PurchaseOrder[];
    suppliers: Supplier[];
}

const BatchUpdatePORefModal: React.FC<BatchUpdatePORefModalProps> = ({ 
    isOpen, onClose, onSave, purchaseOrders, suppliers 
}) => {
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [masterReference, setMasterReference] = useState('');
    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const supplierOptions = useMemo(() => 
        suppliers.map(s => ({ value: s.id, label: s.name || 'Unknown' })), 
    [suppliers]);

    const filteredPos = useMemo(() => {
        if (!selectedSupplierId) return [];
        return purchaseOrders
            .filter(po => po.supplierId === selectedSupplierId)
            .sort((a,b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
    }, [purchaseOrders, selectedSupplierId]);

    const togglePoSelection = (id: string) => {
        const next = new Set(selectedPoIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPoIds(next);
    };

    const toggleAll = () => {
        if (selectedPoIds.size === filteredPos.length) setSelectedPoIds(new Set());
        else setSelectedPoIds(new Set(filteredPos.map(po => po.id)));
    };

    const handleSave = async () => {
        if (!masterReference || selectedPoIds.size === 0) return;
        setIsSaving(true);
        
        const updatedPos: PurchaseOrder[] = [];
        const sortedSelectedIds = Array.from(selectedPoIds).sort((a, b) => {
            const poA = filteredPos.find(p => p.id === a);
            const poB = filteredPos.find(p => p.id === b);
            return (poA?.orderDate || '').localeCompare(poB?.orderDate || '');
        });

        sortedSelectedIds.forEach((id, index) => {
            const po = purchaseOrders.find(p => p.id === id);
            if (po) {
                const suffix = (index + 1).toString().padStart(3, '0');
                updatedPos.push({
                    ...po,
                    supplierReference: `${masterReference} - ${suffix}`
                });
            }
        });

        onSave(updatedPos);
        setIsSaving(false);
    };

    const calculateTotal = (po: PurchaseOrder) => 
        (po.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title="Batch Update Supplier References" maxWidth="max-w-4xl">
            <div className="space-y-6">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-extrabold text-indigo-700 uppercase mb-1">Step 1: Select Supplier</label>
                        <SearchableSelect 
                            options={supplierOptions} 
                            onSelect={(val) => { setSelectedSupplierId(val || ''); setSelectedPoIds(new Set()); }}
                            defaultValue={selectedSupplierId}
                            placeholder="Find supplier (e.g. Porsche)..."
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-extrabold text-indigo-700 uppercase mb-1">Step 2: Master Invoice #</label>
                        <input 
                            value={masterReference} 
                            onChange={(e) => setMasterReference(e.target.value)}
                            className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                            placeholder="e.g. PORS-INV-99"
                        />
                    </div>
                </div>

                <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                        <h4 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
                            <RefreshCcw size={16} className="text-indigo-600"/> 
                            Available Purchase Orders ({filteredPos.length})
                        </h4>
                        <button type="button" onClick={toggleAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            {selectedPoIds.size === filteredPos.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 sticky top-0 text-[10px] uppercase font-bold text-gray-500">
                                <tr>
                                    <th className="p-3 w-10"></th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">System Ref</th>
                                    <th className="p-3">Current Supp. Ref</th>
                                    <th className="p-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPos.length === 0 ? (
                                    <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">Select a supplier to see POs</td></tr>
                                ) : (
                                    filteredPos.map(po => {
                                        const isSelected = selectedPoIds.has(po.id);
                                        return (
                                            <tr key={po.id} onClick={() => togglePoSelection(po.id)} className={`border-b cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                                                <td className="p-3">
                                                    {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-gray-300" />}
                                                </td>
                                                <td className="p-3 font-mono text-xs">{po.orderDate}</td>
                                                <td className="p-3 font-bold">#{po.id.slice(-6).toUpperCase()}</td>
                                                <td className="p-3 text-gray-500">{po.supplierReference || '-'}</td>
                                                <td className="p-3 text-right font-bold text-indigo-700">{formatCurrency(calculateTotal(po))}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedPoIds.size > 0 && masterReference && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl animate-in slide-in-from-bottom-2">
                        <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                            <CheckSquare size={16} /> 
                            Summary: {selectedPoIds.size} POs will be updated to:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono font-bold shadow-sm">{masterReference} - 001</span>
                            <span className="px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono font-bold shadow-sm">{masterReference} - 002</span>
                            {selectedPoIds.size > 2 && <span className="px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono font-bold shadow-sm">... through {(selectedPoIds.size).toString().padStart(3, '0')}</span>}
                        </div>
                    </div>
                )}
            </div>
            {isSaving && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                        <span className="font-bold text-indigo-700">Updating References...</span>
                    </div>
                </div>
            )}
        </FormModal>
    );
};

export default BatchUpdatePORefModal;

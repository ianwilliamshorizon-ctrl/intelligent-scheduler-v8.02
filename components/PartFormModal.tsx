import React, { useState, useEffect } from 'react';
import { Part, TaxRate, Supplier } from '../types';
import FormModal from './FormModal';

interface PartFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (part: Part) => void;
    part: Part | null;
    suppliers: Supplier[];
    taxRates: TaxRate[];
}

const PartFormModal: React.FC<PartFormModalProps> = ({ isOpen, onClose, onSave, part, suppliers, taxRates }) => {
    const [formData, setFormData] = useState<Partial<Part>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(part || {
                partNumber: '',
                description: '',
                salePrice: 0,
                costPrice: 0,
                stockQuantity: 0,
                isStockItem: true,
                defaultSupplierId: '',
                taxCodeId: taxRates.find(t => t.code === 'T1')?.id
            });
        }
    }, [isOpen, part, taxRates]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = () => {
        if (!formData.partNumber || !formData.description) return;
        onSave({
            id: formData.id || `part_${Date.now()}`,
            partNumber: formData.partNumber!,
            description: formData.description!,
            salePrice: formData.salePrice || 0,
            costPrice: formData.costPrice || 0,
            stockQuantity: formData.stockQuantity || 0,
            isStockItem: formData.isStockItem ?? true,
            defaultSupplierId: formData.defaultSupplierId,
            taxCodeId: formData.taxCodeId,
            alternateSupplierIds: formData.alternateSupplierIds || []
        } as Part);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={part ? "Edit Part" : "Add Part"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Part Number</label>
                    <input name="partNumber" value={formData.partNumber || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <input name="description" value={formData.description || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Price (Net)</label>
                    <input name="costPrice" type="number" step="0.01" value={formData.costPrice || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Sale Price (Net)</label>
                    <input name="salePrice" type="number" step="0.01" value={formData.salePrice || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Stock Quantity</label>
                    <input name="stockQuantity" type="number" value={formData.stockQuantity || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div className="flex items-end pb-3">
                    <label className="flex items-center space-x-2">
                        <input name="isStockItem" type="checkbox" checked={formData.isStockItem} onChange={handleChange} className="rounded text-indigo-600" />
                        <span className="text-sm font-medium text-gray-700">Track Stock Level</span>
                    </label>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Default Supplier</label>
                    <select name="defaultSupplierId" value={formData.defaultSupplierId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="">-- Select --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tax Rate</label>
                    <select name="taxCodeId" value={formData.taxCodeId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="">-- Select --</option>
                        {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} ({t.rate}%)</option>)}
                    </select>
                </div>
            </div>
        </FormModal>
    );
};
export default PartFormModal;
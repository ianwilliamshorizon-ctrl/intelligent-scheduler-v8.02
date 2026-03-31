import React, { useState, useEffect, useMemo } from 'react';
import { Part, Supplier, TaxRate } from '../types';
import { Save, X } from 'lucide-react';

interface PartFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (part: Part) => void;
    part: Partial<Part> | null;
    suppliers: Supplier[];
    taxRates: TaxRate[];
}

const PartFormModal: React.FC<PartFormModalProps> = ({ isOpen, onClose, onSave, part, suppliers, taxRates }) => {
    const [formData, setFormData] = useState<Partial<Part>>({});
    const defaultSupplierId = useMemo(() => (suppliers && suppliers.length > 0) ? suppliers[0].id : undefined, [suppliers]);

    useEffect(() => {
        if (part) {
            setFormData(part);
        } else {
            setFormData({ defaultSupplierId });
        }
    }, [part, defaultSupplierId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isNumeric = ['salePrice', 'costPrice', 'stockQuantity'].includes(name);
        
        let processedValue: string | number | boolean = value;
        if (isCheckbox) {
            processedValue = (e.target as HTMLInputElement).checked;
        } else if (isNumeric) {
            // Allow empty string for clearing the input
            processedValue = value === '' ? '' : parseFloat(value);
            if (processedValue !== '' && isNaN(processedValue as number)) {
                processedValue = 0;
            }
        }

        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };
    
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Part);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[90] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center border-b p-4">
                    <h2 className="text-xl font-bold text-indigo-700">{formData.id ? 'Edit Part' : 'Create New Part'}</h2>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700">Part Number</label>
                            <input id="partNumber" name="partNumber" value={formData.partNumber || ''} onChange={handleChange} placeholder="Part Number" className="mt-1 p-2 w-full border rounded" />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <input id="description" name="description" value={formData.description || ''} onChange={handleChange} placeholder="Description" className="mt-1 p-2 w-full border rounded" />
                        </div>
                        <div>
                            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">Sale Price</label>
                            <input type="number" id="salePrice" name="salePrice" value={formData.salePrice ?? ''} onChange={handleChange} placeholder="Sale Price" className="mt-1 p-2 w-full border rounded" />
                        </div>
                        <div>
                            <label htmlFor="costPrice" className="block text-sm font-medium text-gray-700">Cost Price</label>
                            <input type="number" id="costPrice" name="costPrice" value={formData.costPrice ?? ''} onChange={handleChange} placeholder="Cost Price" className="mt-1 p-2 w-full border rounded" />
                        </div>
                        <div>
                            <label htmlFor="stockQuantity" className="block text-sm font-medium text-gray-700">Stock Quantity</label>
                            <input type="number" id="stockQuantity" name="stockQuantity" value={formData.stockQuantity ?? ''} onChange={handleChange} placeholder="Stock Quantity" className="mt-1 p-2 w-full border rounded" />
                        </div>
                         <div>
                            <label htmlFor="defaultSupplierId" className="block text-sm font-medium text-gray-700">Default Supplier</label>
                            <select id="defaultSupplierId" name="defaultSupplierId" value={formData.defaultSupplierId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded bg-white">
                                <option value="">-- Select Supplier --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                             <label htmlFor="taxCodeId" className="block text-sm font-medium text-gray-700">Tax Rate</label>
                            <select id="taxCodeId" name="taxCodeId" value={formData.taxCodeId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded bg-white">
                                <option value="">-- Select Tax Rate --</option>
                                {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <input type="checkbox" id="isStockItem" name="isStockItem" checked={formData.isStockItem || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                            <label htmlFor="isStockItem" className="text-sm text-gray-700">Is a stock item?</label>
                        </div>
                    </div>

                    <footer className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold"><Save size={16}/> Save Part</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default PartFormModal;

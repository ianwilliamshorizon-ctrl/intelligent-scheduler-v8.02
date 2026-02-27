import React, { useState, useEffect } from 'react';
import * as T from '../types';

interface PartFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (part: T.Part) => void;
    part: T.Part | null;
    suppliers: T.Supplier[];
    taxRates: T.TaxRate[];
}

const PartFormModal: React.FC<PartFormModalProps> = ({ isOpen, onClose, onSave, part, suppliers, taxRates }) => {
    const [formData, setFormData] = useState<Partial<T.Part>>({});

    useEffect(() => {
        if (isOpen) {
            if (part) {
                // Deep copy to prevent state mutation issues
                const sanitizedPart = JSON.parse(JSON.stringify(part));
                // Set isStockItem to false if it's null or undefined
                if (sanitizedPart.isStockItem == null) {
                    sanitizedPart.isStockItem = false;
                }
                setFormData(sanitizedPart);
            } else {
                // Default for NEW parts
                setFormData({
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
        }
    }, [isOpen, part, taxRates]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
             console.log(formData);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Type assertion to satisfy onSave prop
        onSave(formData as T.Part);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-bold">{part ? 'Edit Part' : 'Create Part'}</h3>
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="partNumber" value={formData.partNumber || ''} onChange={handleChange} placeholder="Part Number" className="p-2 border rounded" />
                        <input type="text" name="description" value={formData.description || ''} onChange={handleChange} placeholder="Description" className="p-2 border rounded" required />
                        <input type="number" name="salePrice" value={formData.salePrice || ''} onChange={handleChange} placeholder="Sale Price" className="p-2 border rounded" />
                        <input type="number" name="costPrice" value={formData.costPrice || ''} onChange={handleChange} placeholder="Cost Price" className="p-2 border rounded" />
                        <input type="number" name="stockQuantity" value={formData.stockQuantity || ''} onChange={handleChange} placeholder="Stock Quantity" className="p-2 border rounded" />
                        <select name="defaultSupplierId" value={formData.defaultSupplierId || ''} onChange={handleChange} className="p-2 border rounded">
                            <option value="">No Default Supplier</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select name="taxCodeId" value={formData.taxCodeId || ''} onChange={handleChange} className="p-2 border rounded">
                           {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} - {t.rate}%</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isStockItem" name="isStockItem" checked={formData.isStockItem || false} onChange={handleChange} className="h-4 w-4 rounded" />
                            <label htmlFor="isStockItem">Is Stock Item?</label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PartFormModal;
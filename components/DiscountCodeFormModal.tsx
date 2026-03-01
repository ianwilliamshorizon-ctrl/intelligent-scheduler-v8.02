import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { DiscountCode, DiscountType, DiscountApplicability } from '../types';

interface DiscountCodeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (code: DiscountCode) => void;
    initialData?: DiscountCode | null;
}

const DiscountCodeFormModal: React.FC<DiscountCodeFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<DiscountCode>({
        id: '',
        code: '',
        description: '',
        type: 'Percentage',
        value: 0,
        applicability: 'All',
        isActive: true,
        entityId: 'ent_porsche' // Default, should probably be selectable or current context
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                id: crypto.randomUUID(),
                code: '',
                description: '',
                type: 'Percentage',
                value: 0,
                applicability: 'All',
                isActive: true,
                entityId: 'ent_porsche'
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[70]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">{initialData ? 'Edit Discount Code' : 'New Discount Code'}</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-500 hover:text-gray-700" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Code</label>
                        <input 
                            type="text" 
                            required 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" 
                            value={formData.code} 
                            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                            placeholder="e.g. SUMMER2024"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input 
                            type="text" 
                            required 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Summer Sale Discount"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <select 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value as DiscountType})}
                            >
                                <option value="Percentage">Percentage (%)</option>
                                <option value="Fixed">Fixed Amount (£)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Value</label>
                            <input 
                                type="number" 
                                required 
                                min="0"
                                step="0.01"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" 
                                value={formData.value} 
                                onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Applicability</label>
                        <select 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            value={formData.applicability}
                            onChange={e => setFormData({...formData, applicability: e.target.value as DiscountApplicability})}
                        >
                            <option value="All">All Items</option>
                            <option value="Labor">Labor Only</option>
                            <option value="Parts">Parts Only</option>
                            <option value="Packages">Service Packages Only</option>
                        </select>
                    </div>

                    <div className="flex items-center">
                        <input 
                            id="isActive" 
                            type="checkbox" 
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            checked={formData.isActive}
                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                        />
                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                            Active
                        </label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={onClose} className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 flex items-center gap-2">
                            <Save size={16} /> Save Code
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DiscountCodeFormModal;

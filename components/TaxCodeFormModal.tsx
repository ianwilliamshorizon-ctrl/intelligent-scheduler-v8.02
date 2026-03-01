
import React, { useState, useEffect } from 'react';
import { TaxRate } from '../types';
import FormModal from './FormModal';

interface TaxCodeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (taxRate: TaxRate) => void;
    taxRate: TaxRate | null;
}

const TaxCodeFormModal: React.FC<TaxCodeFormModalProps> = ({ isOpen, onClose, onSave, taxRate }) => {
    const [formData, setFormData] = useState<Partial<TaxRate>>({});

    useEffect(() => {
        if (taxRate) {
            setFormData(taxRate);
        } else {
            setFormData({ code: '', name: '', rate: 0 });
        }
    }, [taxRate, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleSave = () => {
        if (!formData.code || !formData.name) {
            alert('Code and Name are required.');
            return;
        }
        onSave({ id: formData.id || `tax_${formData.code.replace(/\s/g, '')}_${Date.now()}`, ...formData } as TaxRate);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={taxRate ? 'Edit Tax Code' : 'Add Tax Code'}>
            <div className="space-y-4 p-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <input name="code" value={formData.code || ''} onChange={handleChange} placeholder="e.g. T1" className="w-full p-2 border rounded-lg bg-gray-50" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g. Standard VAT" className="w-full p-2 border rounded-lg bg-gray-50" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (%)</label>
                    <input name="rate" type="number" step="0.01" value={formData.rate || 0} onChange={handleChange} className="w-full p-2 border rounded-lg bg-gray-50" />
                </div>
            </div>
        </FormModal>
    );
};

export default TaxCodeFormModal;

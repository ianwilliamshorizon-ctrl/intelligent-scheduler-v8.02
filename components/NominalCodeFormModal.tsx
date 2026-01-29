
import React, { useState, useEffect } from 'react';
import { NominalCode } from '../types';
import FormModal from './FormModal';

interface NominalCodeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (code: NominalCode) => void;
    nominalCode: NominalCode | null;
}

const NominalCodeFormModal: React.FC<NominalCodeFormModalProps> = ({ isOpen, onClose, onSave, nominalCode }) => {
    const [formData, setFormData] = useState<Partial<NominalCode>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(nominalCode || {
                code: '',
                name: '',
                secondaryCode: ''
            });
        }
    }, [isOpen, nominalCode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = () => {
        if (!formData.code || !formData.name) return;
        onSave({
            id: formData.id || `nc_${Date.now()}`,
            code: formData.code,
            name: formData.name,
            secondaryCode: formData.secondaryCode
        } as NominalCode);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={nominalCode ? "Edit Nominal Code" : "Add Nominal Code"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Code</label>
                    <input name="code" value={formData.code || ''} onChange={handleChange} className="w-full p-2 border rounded" required placeholder="e.g. 4000"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required placeholder="e.g. Sales - Labor"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Secondary Code (Optional)</label>
                    <input name="secondaryCode" value={formData.secondaryCode || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="e.g. For Sage/Xero mapping"/>
                </div>
            </div>
        </FormModal>
    );
};
export default NominalCodeFormModal;

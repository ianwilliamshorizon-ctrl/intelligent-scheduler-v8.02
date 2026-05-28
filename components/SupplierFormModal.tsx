import React, { useState, useEffect, useMemo } from 'react';
import { Supplier } from '../types';
import FormModal from './FormModal';

interface SupplierFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier) => void;
    supplier: Supplier | null;
    suppliers: Supplier[];
}

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ isOpen, onClose, onSave, supplier, suppliers }) => {
    const [formData, setFormData] = useState<Partial<Supplier>>({});
    const [isShortCodeManuallyEdited, setIsShortCodeManuallyEdited] = useState(false);

    // Dynamic unique short code generator
    const generateUniqueShortCode = (name: string, existingSuppliers: Supplier[], currentSupplierId?: string): string => {
        // Clean name: keep alphanumeric and spaces, make uppercase
        const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase();
        if (!cleanName) return '';

        const words = cleanName.split(/\s+/).filter(Boolean);
        let base = '';
        
        if (words.length >= 3) {
            base = words.slice(0, 3).map(w => w[0]).join('');
        } else if (words.length === 2) {
            const w1 = words[0];
            const w2 = words[1];
            base = (w1.slice(0, 2) + w2.slice(0, 1)).padEnd(3, 'X');
        } else {
            base = words[0].slice(0, 3).padEnd(3, 'X');
        }

        base = base.slice(0, 3).toUpperCase();
        
        // Find other suppliers (ignore self)
        const otherSuppliers = existingSuppliers.filter(s => s.id !== currentSupplierId);
        const otherCodes = otherSuppliers.map(s => (s.shortCode || '').toUpperCase().trim());

        if (!otherCodes.includes(base)) {
            return base;
        }

        // Try prefix + number to resolve conflicts (e.g. EC1, EC2, ...)
        const prefix = base.slice(0, 2);
        for (let i = 1; i <= 9; i++) {
            const candidate = `${prefix}${i}`;
            if (!otherCodes.includes(candidate)) {
                return candidate;
            }
        }

        // Try first letter + two-digit number (e.g. E10, E11, ...)
        const prefixShort = base.slice(0, 1);
        for (let i = 10; i <= 99; i++) {
            const candidate = `${prefixShort}${i}`;
            if (!otherCodes.includes(candidate)) {
                return candidate;
            }
        }

        return 'SUP';
    };

    useEffect(() => {
        if (isOpen) {
            setFormData(supplier || {
                name: '',
                shortCode: '',
                contactName: '',
                phone: '',
                email: '',
                addressLine1: '',
                city: '',
                postcode: ''
            });
            setIsShortCodeManuallyEdited(!!supplier && !!supplier.shortCode);
        }
    }, [isOpen, supplier]);

    // Validation checks
    const shortCodeError = useMemo(() => {
        const code = (formData.shortCode || '').trim();
        if (!code) return null;
        if (code.length !== 3) return 'Short Code must be exactly 3 characters.';
        
        const isDuplicate = suppliers.some(s => 
            s.id !== supplier?.id && 
            s.shortCode?.toUpperCase().trim() === code.toUpperCase()
        );
        if (isDuplicate) return 'Short Code is already in use by another supplier.';
        
        return null;
    }, [formData.shortCode, suppliers, supplier]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'shortCode') {
            const val = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
            setIsShortCodeManuallyEdited(val.length > 0);
            setFormData(prev => ({ ...prev, [name]: val }));
        } else if (name === 'name') {
            const newName = value;
            setFormData(prev => {
                const updated = { ...prev, name: newName };
                if (!isShortCodeManuallyEdited) {
                    updated.shortCode = generateUniqueShortCode(newName, suppliers, supplier?.id);
                }
                return updated;
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = () => {
        if (!formData.name || !formData.shortCode || !!shortCodeError) return;
        onSave({
            id: formData.id || `sup_${Date.now()}`,
            name: formData.name.trim(),
            shortCode: formData.shortCode.trim().toUpperCase(),
            contactName: formData.contactName || '',
            phone: formData.phone || '',
            email: formData.email || '',
            addressLine1: formData.addressLine1 || '',
            city: formData.city || '',
            postcode: formData.postcode || ''
        } as Supplier);
    };

    const isSaveDisabled = !formData.name || !formData.shortCode || formData.shortCode.length !== 3 || !!shortCodeError;

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            onSave={handleSave} 
            title={supplier ? "Edit Supplier" : "Add Supplier"}
            saveDisabled={isSaveDisabled}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Company Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Short Code (3-digit)</label>
                    <input 
                        name="shortCode" 
                        value={formData.shortCode || ''} 
                        onChange={handleChange} 
                        className={`w-full p-2 border rounded ${shortCodeError ? 'border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500' : ''}`}
                        required
                    />
                    {shortCodeError && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">{shortCodeError}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                    <input name="contactName" value={formData.contactName || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded mb-2" placeholder="Address Line 1" />
                    <input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="City" />
                    <input name="postcode" value={formData.postcode || ''} onChange={handleChange} className="w-full p-2 border rounded mt-2" placeholder="Postcode" />
                </div>
            </div>
        </FormModal>
    );
};

export default SupplierFormModal;

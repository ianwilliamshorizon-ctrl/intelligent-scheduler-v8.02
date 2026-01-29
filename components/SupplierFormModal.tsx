import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import FormModal from './FormModal';

interface SupplierFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier) => void;
    supplier: Supplier | null;
}

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ isOpen, onClose, onSave, supplier }) => {
    const [formData, setFormData] = useState<Partial<Supplier>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(supplier || {
                name: '',
                contactName: '',
                phone: '',
                email: '',
                addressLine1: '',
                city: '',
                postcode: ''
            });
        }
    }, [isOpen, supplier]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.name) return;
        onSave({
            id: formData.id || `sup_${Date.now()}`,
            name: formData.name!,
            contactName: formData.contactName || '',
            phone: formData.phone || '',
            email: formData.email || '',
            addressLine1: formData.addressLine1 || '',
            city: formData.city || '',
            postcode: formData.postcode || ''
        } as Supplier);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={supplier ? "Edit Supplier" : "Add Supplier"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Company Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
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
                <div>
                    <label className="block text-sm font-medium text-gray-700">Postcode</label>
                    <input name="postcode" value={formData.postcode || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded mb-2" placeholder="Address Line 1" />
                    <input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="City" />
                </div>
            </div>
        </FormModal>
    );
};
export default SupplierFormModal;

import React, { useState, useEffect } from 'react';
import { StorageLocation, BusinessEntity } from '../types';
import FormModal from './FormModal';

interface StorageLocationFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (location: StorageLocation) => void;
    location: StorageLocation | null;
    businessEntities: BusinessEntity[];
}

const StorageLocationFormModal: React.FC<StorageLocationFormModalProps> = ({ isOpen, onClose, onSave, location, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<StorageLocation>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(location || {
                name: '',
                entityId: businessEntities.filter(e => e.type === 'Storage')[0]?.id || '',
                capacity: 10
            });
        }
    }, [isOpen, location, businessEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? parseInt(value, 10) || 0 : value 
        }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.entityId || formData.capacity === undefined) return;
        onSave({
            id: formData.id || `sl_${Date.now()}`,
            name: formData.name,
            entityId: formData.entityId,
            capacity: formData.capacity
        } as StorageLocation);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={location ? "Edit Storage Location" : "Add Storage Location"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Location Name</label>
                    <input 
                        name="name" 
                        value={formData.name || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                        placeholder="e.g. Unit 1"
                        required 
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Business Entity (Storage)</label>
                    <select 
                        name="entityId" 
                        value={formData.entityId || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded bg-white"
                        required
                    >
                        <option value="" disabled>Select Storage Entity...</option>
                        {businessEntities.filter(e => e.type === 'Storage').map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Storage Capacity (Slots)</label>
                    <input 
                        type="number"
                        name="capacity" 
                        value={formData.capacity || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                        min="1"
                        required 
                    />
                    <p className="text-xs text-gray-500 mt-1">Numerical identifier for slots will be generated based on this (e.g. 1-20).</p>
                </div>
            </div>
        </FormModal>
    );
};

export default StorageLocationFormModal;

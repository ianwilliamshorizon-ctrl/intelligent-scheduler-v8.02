
import React, { useState, useEffect } from 'react';
import { BatteryCharger, BusinessEntity } from '../types';
import FormModal from './FormModal';

interface BatteryChargerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (charger: BatteryCharger) => void;
    charger: BatteryCharger | null;
    businessEntities: BusinessEntity[];
}

const BatteryChargerFormModal: React.FC<BatteryChargerFormModalProps> = ({ isOpen, onClose, onSave, charger, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<BatteryCharger>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(charger || {
                name: '',
                entityId: businessEntities[0]?.id || '',
                locationDescription: ''
            });
        }
    }, [isOpen, charger, businessEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.entityId) return;
        onSave({
            id: formData.id || `bc_${Date.now()}`,
            name: formData.name,
            entityId: formData.entityId,
            locationDescription: formData.locationDescription
        } as BatteryCharger);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={charger ? "Edit Battery Charger" : "Add Battery Charger"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Charger Name/ID</label>
                    <input 
                        name="name" 
                        value={formData.name || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                        placeholder="e.g. CTEK-01"
                        required 
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Business Entity</label>
                    <select 
                        name="entityId" 
                        value={formData.entityId || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded bg-white"
                    >
                        {businessEntities.map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Location Description</label>
                    <input 
                        name="locationDescription" 
                        value={formData.locationDescription || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                        placeholder="e.g. Storage Bay 1"
                    />
                </div>
            </div>
        </FormModal>
    );
};

export default BatteryChargerFormModal;

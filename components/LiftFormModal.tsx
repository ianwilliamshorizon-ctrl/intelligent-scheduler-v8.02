
import React, { useState, useEffect } from 'react';
import { Lift, BusinessEntity } from '../types';
import FormModal from './FormModal';

interface LiftFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (lift: Lift) => void;
    lift: Lift | null;
    businessEntities: BusinessEntity[];
}

const LiftFormModal: React.FC<LiftFormModalProps> = ({ isOpen, onClose, onSave, lift, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<Lift>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(lift || {
                name: '',
                entityId: businessEntities.filter(e => e.type === 'Workshop')[0]?.id || '',
                type: 'General',
                color: 'blue'
            });
        }
    }, [isOpen, lift, businessEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.entityId) return;
        onSave({
            id: formData.id || `lift_${Date.now()}`,
            name: formData.name,
            entityId: formData.entityId,
            type: formData.type || 'General',
            color: formData.color || 'blue'
        } as Lift);
    };

    const colors = ['blue', 'green', 'gray', 'orange', 'red', 'yellow', 'purple', 'pink', 'cyan'];

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={lift ? "Edit Lift / Bay" : "Add Lift / Bay"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Lift Name</label>
                    <input 
                        name="name" 
                        value={formData.name || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                        placeholder="e.g. Lift 1"
                        required 
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Business Entity (Workshop)</label>
                    <select 
                        name="entityId" 
                        value={formData.entityId || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded bg-white"
                        required
                    >
                        <option value="" disabled>Select Workshop...</option>
                        {businessEntities.filter(e => e.type === 'Workshop').map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">This lift will only appear on the timeline for this specific business entity.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Type</label>
                        <select 
                            name="type" 
                            value={formData.type || 'General'} 
                            onChange={handleChange} 
                            className="w-full p-2 border rounded bg-white"
                        >
                            <option value="General">General Repair</option>
                            <option value="MOT">MOT Bay</option>
                            <option value="Trimming">Trimming Bay</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Color Tag</label>
                        <div className="flex items-center gap-2">
                             <select 
                                name="color" 
                                value={formData.color || 'blue'} 
                                onChange={handleChange} 
                                className="w-full p-2 border rounded bg-white"
                            >
                                {colors.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                            </select>
                            <div className={`w-8 h-8 rounded border bg-${formData.color}-500 flex-shrink-0`}></div>
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default LiftFormModal;

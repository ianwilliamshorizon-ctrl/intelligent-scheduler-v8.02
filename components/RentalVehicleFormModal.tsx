import React, { useState, useEffect, useMemo } from 'react';
import { RentalVehicle, Vehicle, BusinessEntity } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { X } from 'lucide-react';
import { saveImage, getImage } from '../utils/imageStore';

const Input = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input className="w-full p-2 border border-gray-300 rounded-lg" {...props} />
    </div>
);

const Select = ({ label, children, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" {...props}>{children}</select>
    </div>
);

interface RentalVehicleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rentalVehicle: RentalVehicle) => void;
    rentalVehicle: Partial<RentalVehicle> | null;
    allVehicles: Vehicle[];
    existingRentalVehicles: RentalVehicle[];
    businessEntities: BusinessEntity[];
}

const RentalVehicleFormModal: React.FC<RentalVehicleFormModalProps> = ({ isOpen, onClose, onSave, rentalVehicle, allVehicles, existingRentalVehicles, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<RentalVehicle> & { tempImageUrl?: string }>({});

    const rentalEntities = useMemo(() => businessEntities.filter(e => e.type === 'Rentals'), [businessEntities]);

    useEffect(() => {
        if (isOpen) {
            const isEditing = rentalVehicle && rentalVehicle.id;
            // FIX: Add explicit type to prevent type widening on 'status' and 'type' properties.
            const initialData: Partial<RentalVehicle> = isEditing ? { ...rentalVehicle } : {
                entityId: rentalEntities.length > 0 ? rentalEntities[0].id : undefined,
                status: 'Available',
                type: 'Courtesy Car',
                damageMarkerColors: { checkOut: '#3b82f6', checkIn: '#ef4444' }
            };

            setFormData({ ...initialData, tempImageUrl: undefined });

            if (isEditing && rentalVehicle.damageCheckImageId) {
                getImage(rentalVehicle.damageCheckImageId).then(url => {
                    if (url) {
                        setFormData(prev => ({ ...prev, tempImageUrl: url }));
                    }
                }).catch(err => console.error("Failed to load rental vehicle image for preview", err));
            }
        }
    }, [rentalVehicle, isOpen, rentalEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleColorChange = (type: 'checkOut' | 'checkIn', value: string) => {
        setFormData(prev => ({
            ...prev,
            damageMarkerColors: {
                ...(prev.damageMarkerColors || { checkOut: '#3b82f6', checkIn: '#ef4444' }),
                [type]: value
            }
        }));
    };
    
    const availableVehicles = useMemo(() => {
        const existingIds = new Set(existingRentalVehicles.map(rv => rv.id));
        return allVehicles.filter(v => !existingIds.has(v.id));
    }, [allVehicles, existingRentalVehicles]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if(file.type !== 'image/jpeg' && file.type !== 'image/png') {
                alert('Please upload a JPG or PNG file.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const imageId = `rental_diag_${formData.id || crypto.randomUUID()}`;
                try {
                    await saveImage(imageId, dataUrl);
                    setFormData(prev => ({ ...prev, damageCheckImageId: imageId, tempImageUrl: dataUrl }));
                } catch (err) {
                    console.error("Failed to save rental diagram image.", err);
                    alert("Could not save diagram image.");
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = () => {
        const { tempImageUrl, ...dataToSave } = formData;
        dataToSave.type = 'Courtesy Car';
        onSave(dataToSave as RentalVehicle);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={rentalVehicle?.id ? 'Edit Rental Vehicle' : 'Add Rental Vehicle'}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle*</label>
                        <SearchableSelect
                            options={availableVehicles.map(v => ({ id: v.id, label: `${v.registration} - ${v.make} ${v.model}` }))}
                            value={formData.id || null}
                            onChange={(value) => setFormData(prev => ({...prev, id: value || ''}))}
                            placeholder="Select a vehicle..."
                            disabled={!!rentalVehicle?.id}
                        />
                    </div>
                    
                    <Select label="Entity" name="entityId" value={formData.entityId || ''} onChange={handleChange}>
                        {rentalEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </Select>
                     
                    <Select label="Status" name="status" value={formData.status || ''} onChange={handleChange}>
                        <option value="Available">Available</option>
                        <option value="Booked">Booked</option>
                        <option value="Rented">Rented</option>
                        <option value="Maintenance">Maintenance</option>
                    </Select>
                    <Input label="Daily Rate (£)" name="dailyRate" type="number" step="0.01" value={formData.dailyRate || ''} onChange={handleChange} />
                    <Input label="Weekly Rate (£)" name="weeklyRate" type="number" step="0.01" value={formData.weeklyRate || ''} onChange={handleChange} />

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Damage Diagram Image</label>
                        <div className="flex items-center gap-4">
                            {formData.tempImageUrl && (
                                <div className="relative">
                                    <img src={formData.tempImageUrl} alt="Diagram preview" className="h-20 w-32 object-contain border p-1 rounded-lg bg-gray-100" />
                                    <button onClick={() => setFormData(p => ({...p, damageCheckImageId: undefined, tempImageUrl: undefined}))} className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full"><X size={12}/></button>
                                </div>
                            )}
                            <input type="file" accept="image/jpeg, image/png" onChange={handleImageChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 pt-2 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Damage Marker Colors</label>
                        <div className="flex items-center gap-4">
                             <label className="flex items-center gap-2">Check-Out: <input type="color" value={formData.damageMarkerColors?.checkOut || '#3b82f6'} onChange={(e) => handleColorChange('checkOut', e.target.value)} /></label>
                             <label className="flex items-center gap-2">Check-In: <input type="color" value={formData.damageMarkerColors?.checkIn || '#ef4444'} onChange={(e) => handleColorChange('checkIn', e.target.value)} /></label>
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default RentalVehicleFormModal;
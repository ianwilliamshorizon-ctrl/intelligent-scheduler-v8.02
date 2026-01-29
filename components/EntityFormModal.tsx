import React, { useState, useEffect } from 'react';
import { BusinessEntity } from '../types';
import FormModal from './FormModal';
import { saveImage, getImage } from '../utils/imageStore';

const EntityFormInput = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input className="w-full p-2 border border-gray-300 rounded-lg" {...props} />
    </div>
);

const EntityFormTextarea = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea className="w-full p-2 border border-gray-300 rounded-lg" {...props} />
    </div>
);

const EntityFormSelect = ({ label, children, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" {...props}>{children}</select>
    </div>
);

const ColorPicker = ({ label, value, onChange, name }: { label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, name: string }) => {
    const colors = ['blue', 'green', 'purple', 'gray', 'yellow', 'pink', 'orange', 'red'];
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <EntityFormSelect name={name} value={value} onChange={onChange}>
                    {colors.map(color => <option key={color} value={color}>{color}</option>)}
                </EntityFormSelect>
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-${value}-500`}></div>
            </div>
        </div>
    )
};

interface EntityFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entity: BusinessEntity) => void;
    entity: BusinessEntity | null;
    isDebugMode: boolean;
}

const EntityFormModal: React.FC<EntityFormModalProps> = ({ isOpen, onClose, onSave, entity, isDebugMode }) => {
    const [formData, setFormData] = useState<Partial<BusinessEntity> & { tempLogoUrl?: string }>({});

    useEffect(() => {
        if (isDebugMode && entity) {
            console.log("DEBUG: EntityFormModal received entity data:", JSON.stringify(entity, null, 2));
        }
        const initialData = entity || {};
        setFormData({ ...initialData, tempLogoUrl: undefined });
        if (entity?.logoImageId) {
            getImage(entity.logoImageId).then(url => {
                if(url) setFormData(p => ({ ...p, tempLogoUrl: url }));
            });
        }
    }, [entity, isOpen, isDebugMode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const inputType = e.target.getAttribute('type');
        const numValue = (inputType === 'number') ? parseFloat(value) || undefined : value;
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const imageId = `logo_${formData.id || crypto.randomUUID()}`;
                try {
                    await saveImage(imageId, dataUrl);
                    setFormData(prev => ({ ...prev, logoImageId: imageId, tempLogoUrl: dataUrl }));
                } catch (err) {
                    console.error("Failed to save entity logo", err);
                    alert("Could not save logo image.");
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = () => {
        const { tempLogoUrl, ...dataToSave } = formData;
        onSave(dataToSave as BusinessEntity);
        onClose();
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title="Edit Business Entity" maxWidth="max-w-4xl">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Core Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <EntityFormInput label="Entity Name" name="name" value={formData.name || ''} onChange={handleChange} />
                    <EntityFormSelect label="Type" name="type" value={formData.type || ''} onChange={handleChange} disabled>
                        <option>Workshop</option>
                        <option>Sales</option>
                        <option>Storage</option>
                        <option>Rentals</option>
                    </EntityFormSelect>
                    <EntityFormInput label="Short Code" name="shortCode" value={formData.shortCode || ''} onChange={handleChange} maxLength={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ColorPicker label="UI Color" name="color" value={formData.color || 'gray'} onChange={handleChange}/>
                    <div className="md:col-span-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                            <div className="flex items-center gap-4">
                                {formData.tempLogoUrl && <img src={formData.tempLogoUrl} alt="logo preview" className="h-16 w-16 object-contain border p-1 rounded-lg" />}
                                <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                            </div>
                        </div>
                    </div>
                </div>

                {formData.type === 'Workshop' && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 my-4">Workshop Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <EntityFormInput label="Labor Rate (£)" name="laborRate" type="number" step="0.01" value={formData.laborRate || ''} onChange={handleChange} />
                            <EntityFormInput label="Labor Cost Rate (£)" name="laborCostRate" type="number" step="0.01" value={formData.laborCostRate || ''} onChange={handleChange} />
                            <EntityFormInput label="Daily Capacity (hours)" name="dailyCapacityHours" type="number" step="0.5" value={formData.dailyCapacityHours || ''} onChange={handleChange} />
                        </div>

                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 my-4">Reminder Templates</h3>
                        <p className="text-xs text-gray-500 -mt-2 mb-4">
                            Available placeholders: [CustomerName], [VehicleDescription], [DueDate], [Registration], [Make], [Model]
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EntityFormTextarea label="MOT Reminder (Email)" name="motReminderEmailTemplate" value={formData.motReminderEmailTemplate || ''} onChange={handleChange} rows={4} />
                            <EntityFormTextarea label="MOT Reminder (SMS)" name="motReminderSmsTemplate" value={formData.motReminderSmsTemplate || ''} onChange={handleChange} rows={2} />
                            <EntityFormTextarea label="Service Reminder (Email)" name="serviceReminderEmailTemplate" value={formData.serviceReminderEmailTemplate || ''} onChange={handleChange} rows={4} />
                            <EntityFormTextarea label="Service Reminder (SMS)" name="serviceReminderSmsTemplate" value={formData.serviceReminderSmsTemplate || ''} onChange={handleChange} rows={2} />
                            <EntityFormTextarea label="Winter Check Reminder (Email)" name="winterCheckReminderEmailTemplate" value={formData.winterCheckReminderEmailTemplate || ''} onChange={handleChange} rows={4} />
                            <EntityFormTextarea label="Winter Check Reminder (SMS)" name="winterCheckReminderSmsTemplate" value={formData.winterCheckReminderSmsTemplate || ''} onChange={handleChange} rows={2} />
                        </div>
                    </>
                )}

                {formData.type === 'Storage' && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 my-4">Storage Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EntityFormInput label="Storage Capacity (slots)" name="storageCapacity" type="number" value={formData.storageCapacity || ''} onChange={handleChange} />
                            <EntityFormInput label="Default Weekly Rate (£)" name="defaultWeeklyStorageRate" type="number" step="0.01" value={formData.defaultWeeklyStorageRate || ''} onChange={handleChange} />
                        </div>
                    </>
                )}

                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 my-4">Company & Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EntityFormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} />
                    <EntityFormInput label="Address Line 2" name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} />
                    <EntityFormInput label="City" name="city" value={formData.city || ''} onChange={handleChange} />
                    <EntityFormInput label="Postcode" name="postcode" value={formData.postcode || ''} onChange={handleChange} />
                    <EntityFormInput label="Company Number" name="companyNumber" value={formData.companyNumber || ''} onChange={handleChange} />
                    <EntityFormInput label="VAT Number" name="vatNumber" value={formData.vatNumber || ''} onChange={handleChange} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <EntityFormInput label="Bank Account Name" name="bankAccountName" value={formData.bankAccountName || ''} onChange={handleChange} />
                     <EntityFormInput label="Bank Sort Code" name="bankSortCode" value={formData.bankSortCode || ''} onChange={handleChange} />
                     <EntityFormInput label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber || ''} onChange={handleChange} />
                </div>
                <EntityFormTextarea label="Invoice Footer Text" name="invoiceFooterText" value={formData.invoiceFooterText || ''} onChange={handleChange} rows={2} />

                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 my-4">Terms & Conditions</h3>
                <div className="space-y-4">
                    <EntityFormTextarea label="Courtesy Car T&Cs" name="courtesyCarTermsAndConditions" value={formData.courtesyCarTermsAndConditions || ''} onChange={handleChange} rows={4} />
                    <EntityFormTextarea label="Rental T&Cs" name="rentalTermsAndConditions" value={formData.rentalTermsAndConditions || ''} onChange={handleChange} rows={4} />
                    <EntityFormTextarea label="Sale or Return (SOR) T&Cs" name="sorTermsAndConditions" value={formData.sorTermsAndConditions || ''} onChange={handleChange} rows={4} />
                    <EntityFormTextarea label="Storage T&Cs" name="storageTermsAndConditions" value={formData.storageTermsAndConditions || ''} onChange={handleChange} rows={4} />
                </div>
            </div>
        </FormModal>
    );
};

export default EntityFormModal;
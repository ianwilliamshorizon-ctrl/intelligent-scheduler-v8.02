import React, { useState, useEffect } from 'react';
import { Prospect, SaleVehicle, Vehicle, Customer } from '../types';
import { X, Save, User, Link as LinkIcon, UserPlus, UserCheck } from 'lucide-react';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import CustomerFormModal from './CustomerFormModal';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface ProspectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (prospect: Prospect) => void;
    prospect: Prospect | null;
    entityId: string;
    saleVehicles: SaleVehicle[];
    vehicles: Vehicle[];
    customers: Customer[];
    onSaveCustomer: (customer: Customer) => void;
}

const ProspectFormModal: React.FC<ProspectFormModalProps> = ({ isOpen, onClose, onSave, prospect, entityId, saleVehicles, vehicles, customers, onSaveCustomer }) => {
    const [formData, setFormData] = useState<Partial<Prospect>>({});
    const [showCustomerLinker, setShowCustomerLinker] = useState(false);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(prospect ? { ...prospect } : {
                entityId,
                name: '',
                phone: '',
                email: '',
                status: 'Active',
                desiredVehicle: '',
                notes: '',
                linkedSaleVehicleId: null,
                customerId: null,
            });
            setShowCustomerLinker(false);
            setIsCreatingCustomer(false);
        }
    }, [isOpen, prospect, entityId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handleLinkCustomer = (customerId: string) => {
        setFormData(p => ({ ...p, customerId, status: 'Converted' }));
        setShowCustomerLinker(false);
    };

    const handleUnlinkCustomer = () => {
        setFormData(p => ({ ...p, customerId: null, status: 'Active' }));
    };

    const handleSaveNewCustomer = (newCustomer: Customer) => {
        onSaveCustomer(newCustomer);
        handleLinkCustomer(newCustomer.id);
        setIsCreatingCustomer(false);
    };

    const handleSave = () => {
        if (!formData.name || !formData.phone) {
            alert('Prospect name and phone number are required.');
            return;
        }

        const prospectToSave: Prospect = {
            id: formData.id || crypto.randomUUID(),
            createdAt: formData.createdAt || new Date().toISOString(),
            ...formData
        } as Prospect;
        
        onSave(prospectToSave);
    };

    const availableSaleVehicles = saleVehicles
        .filter(sv => sv.status === 'For Sale')
        .map(sv => {
            const vehicle = vehicles.find(v => v.id === sv.vehicleId);
            return {
                id: sv.id,
                label: `${vehicle?.registration} - ${vehicle?.make} ${vehicle?.model}`
            };
        });
    
    const linkedCustomer = customers.find(c => c.id === formData.customerId);

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title={prospect ? 'Edit Prospect' : 'Add New Prospect'}
            maxWidth="max-w-2xl"
        >
            {isCreatingCustomer ? (
                <CustomerFormModal 
                    isOpen={true}
                    onClose={() => setIsCreatingCustomer(false)}
                    onSave={handleSaveNewCustomer}
                    customer={null}
                    existingCustomers={customers}
                />
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name*</label>
                            <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="status" value={formData.status || 'Active'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                <option>Active</option>
                                <option>Contacted</option>
                                <option>Converted</option>
                                <option>Archived</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone*</label>
                            <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Desired Vehicle</label>
                        <input name="desiredVehicle" value={formData.desiredVehicle || ''} onChange={handleChange} placeholder="e.g., Porsche 911 GT3 in silver" className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Link to Vehicle in Stock</label>
                        <SearchableSelect
                            options={availableSaleVehicles}
                            value={formData.linkedSaleVehicleId || null}
                            onChange={(value) => setFormData(p => ({ ...p, linkedSaleVehicleId: value }))}
                            placeholder="Link to a vehicle for sale..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded" />
                    </div>
                    
                    <div className="pt-4 border-t">
                         <label className="block text-sm font-medium text-gray-700 mb-2">Customer Link</label>
                         {linkedCustomer ? (
                            <div className="p-3 bg-green-100 border border-green-200 rounded-lg flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <UserCheck size={20} className="text-green-700"/>
                                    <div>
                                        <p className="font-bold text-green-800">Converted & Linked</p>
                                        <p className="text-sm">{getCustomerDisplayName(linkedCustomer)}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={handleUnlinkCustomer} className="text-sm text-red-600 hover:underline">Unlink</button>
                            </div>
                         ) : showCustomerLinker ? (
                            <div className="p-3 bg-gray-100 border rounded-lg space-y-3 animate-fade-in">
                                <SearchableSelect
                                    options={customers.map(c => ({id: c.id, label: getCustomerDisplayName(c)}))}
                                    value={null}
                                    onChange={(val) => { if(val) handleLinkCustomer(val) }}
                                    placeholder="Search existing customers..."
                                />
                                 <div className="flex items-center gap-2">
                                    <div className="flex-grow border-t"></div>
                                    <span className="text-xs text-gray-500">OR</span>
                                    <div className="flex-grow border-t"></div>
                                </div>
                                <button type="button" onClick={() => setIsCreatingCustomer(true)} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border rounded-lg text-sm font-semibold hover:bg-gray-50">
                                    <UserPlus size={16}/> Create New Customer
                                </button>
                            </div>
                         ) : (
                            <button type="button" onClick={() => setShowCustomerLinker(true)} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition">
                                <LinkIcon size={16}/> Link to Customer & Mark as Converted
                            </button>
                         )}
                    </div>
                </div>
            )}
        </FormModal>
    );
};

export default ProspectFormModal;

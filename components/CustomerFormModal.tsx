import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Job, Vehicle, Estimate, Invoice } from '../types';
import FormModal from './FormModal';
import { generateCustomerId } from '../core/utils/customerUtils';
import { formatDate } from '../core/utils/dateUtils';
import { lookupAddressByPostcode } from '../services/postcodeLookupService';
import { Loader2, Search, Briefcase, Car, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuditLogger } from '../core/hooks/useAuditLogger';

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm mb-4">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                {isOpen ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
        </div>
    );
};

interface CustomerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Customer) => void;
    customer: Partial<Customer> | null;
    existingCustomers: Customer[];
    jobs: Job[];
    vehicles: Vehicle[];
    estimates: Estimate[];
    invoices: Invoice[];
    onViewVehicle?: (vehicleId: string) => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ 
    isOpen, onClose, onSave, customer, existingCustomers = [], vehicles = [], onViewVehicle 
}) => {
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const { logEvent } = useAuditLogger();
    const lastProcessedId = useRef<string | null | 'NEW'>(null);

    useEffect(() => {
        if (!isOpen) {
            lastProcessedId.current = null;
            return;
        }

        if (customer) {
            if (lastProcessedId.current !== customer.id) {
                setFormData({ ...customer });
                lastProcessedId.current = customer.id;
            }
        } else {
            if (lastProcessedId.current !== 'NEW') {
                setFormData({
                    title: '', forename: '', surname: '', phone: '', mobile: '', email: '',
                    addressLine1: '', addressLine2: '', city: '', county: '', postcode: '',
                    category: 'Retail', isCashCustomer: false, marketingConsent: false,
                    serviceReminderConsent: false, communicationPreference: 'None',
                    isBusinessCustomer: false, companyName: ''
                });
                lastProcessedId.current = 'NEW';
            }
        }
    }, [isOpen, customer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleAddressLookup = async () => {
        if (!formData.postcode) return;
        setIsLookingUpAddress(true);
        try {
            const details: any = await lookupAddressByPostcode(formData.postcode);
            setFormData(prev => ({
                ...prev,
                addressLine1: details.addressLine1 || '',
                addressLine2: details.addressLine2 || '',
                city: details.city || '',
                county: details.county || prev.county || ''
            }));
        } catch (error) { console.error(error); } finally { setIsLookingUpAddress(false); }
    };

    const handleSave = () => {
        if (!formData.forename || !formData.surname) { alert("Name required"); return; }
        const finalCustomer: Customer = {
            ...formData,
            id: formData.id || generateCustomerId(formData.surname!, existingCustomers),
            createdDate: formData.createdDate || formatDate(new Date()),
        } as Customer;
        onSave(finalCustomer);
    };

    const customerVehicles = useMemo(() => 
        (vehicles || []).filter(v => v.customerId === customer?.id), 
    [vehicles, customer]);

    if (!isOpen) return null;

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={customer ? 'Customer 360° Profile' : 'Add New Customer'} maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Customer Account Reference</label>
                            <input value={formData.id || customer?.id || ''} readOnly className="w-full p-2 border rounded bg-gray-50 font-mono text-gray-500 text-sm" />
                        </div>
                        
                        <div className="md:col-span-3 flex items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <input type="checkbox" id="isBusinessCustomer" name="isBusinessCustomer" checked={formData.isBusinessCustomer || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded" />
                            <label htmlFor="isBusinessCustomer" className="ml-2 text-sm font-bold text-indigo-900">Business / Fleet Account</label>
                        </div>

                        {formData.isBusinessCustomer && (
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name*</label>
                                <input name="companyName" value={formData.companyName || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                            </div>
                        )}
                        
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input name="title" value={formData.title || ''} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Forename*</label><input name="forename" value={formData.forename || ''} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Surname*</label><input name="surname" value={formData.surname || ''} onChange={handleChange} className="w-full p-2 border rounded" /></div>

                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label><input name="mobile" value={formData.mobile || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input name="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        
                        <div className="md:col-span-3 border-t pt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label><input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div className="md:col-span-3"><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label><input name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">County</label><input name="county" value={formData.county || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                            <input name="postcode" value={formData.postcode || ''} onChange={handleChange} className="w-full p-2 border rounded uppercase"/>
                            <button type="button" onClick={handleAddressLookup} className="absolute right-2 top-8 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200">
                                {isLookingUpAddress ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Search size={14} className="text-gray-500" />}
                            </button>
                        </div>

                        <div className="md:col-span-3 border-t pt-4 grid grid-cols-2 gap-.4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select name="category" value={formData.category || 'Retail'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                    <option value="Retail">Retail</option><option value="Trade">Trade</option><option value="Fleet">Fleet</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Comm. Preference</label>
                                <select name="communicationPreference" value={formData.communicationPreference || 'None'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                    <option value="None">None</option><option value="Email">Email</option><option value="SMS">SMS</option><option value="Phone">Phone</option>
                                </select>
                            </div>
                        </div>

                        <div className="md:col-span-3 bg-gray-50 p-4 rounded-lg space-y-3">
                             <div className="flex items-center gap-3">
                                <input type="checkbox" id="marketingConsent" name="marketingConsent" checked={formData.marketingConsent || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded" />
                                <label htmlFor="marketingConsent" className="text-sm font-medium text-gray-700">Marketing Consent (GDPR)</label>
                             </div>
                             <div className="flex items-center gap-3">
                                <input type="checkbox" id="serviceReminderConsent" name="serviceReminderConsent" checked={formData.serviceReminderConsent || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded" />
                                <label htmlFor="serviceReminderConsent" className="text-sm font-medium text-gray-700">Service/MOT Reminders</label>
                             </div>
                        </div>

                    </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    <Section title={`Vehicles (${customerVehicles.length})`} icon={Car}>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                            {customerVehicles.map(v => (
                                <div key={v.id} className="p-3 bg-white border rounded shadow-sm">
                                    <p className="font-bold font-mono text-indigo-600">{v.registration}</p>
                                    <p className="text-xs text-gray-500">{v.make} {v.model}</p>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
        </FormModal>
    );
};

export default CustomerFormModal;

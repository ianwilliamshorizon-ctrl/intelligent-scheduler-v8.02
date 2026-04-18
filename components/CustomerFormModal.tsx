import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Job, Vehicle, Estimate, Invoice } from '../types';
import FormModal from './FormModal';
import { generateCustomerId } from '../core/utils/customerUtils';
import { formatDate } from '../core/utils/dateUtils';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';
import { Loader2, Search, Briefcase, Car, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuditLogger } from '../core/hooks/useAuditLogger';
import { useData } from '../core/state/DataContext';

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
    jobs?: Job[];
    vehicles?: Vehicle[];
    estimates?: Estimate[];
    invoices?: Invoice[];
    onViewVehicle?: (vehicleId: string) => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ 
    isOpen, onClose, onSave, customer, existingCustomers = [], 
    jobs: propsJobs, vehicles: propsVehicles, estimates: propsEstimates, invoices: propsInvoices, 
    onViewVehicle 
}) => {
    const globalData = useData();
    const jobs = (propsJobs && propsJobs.length > 0) ? propsJobs : (globalData.jobs || []);
    const vehicles = (propsVehicles && propsVehicles.length > 0) ? propsVehicles : (globalData.vehicles || []);
    const estimates = (propsEstimates && propsEstimates.length > 0) ? propsEstimates : (globalData.estimates || []);
    const invoices = (propsInvoices && propsInvoices.length > 0) ? propsInvoices : (globalData.invoices || []);

    // Using 'any' here temporarily to resolve the missing properties in your Customer type definition
    const [formData, setFormData] = useState<any>({});
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const [addressList, setAddressList] = useState<AddressDetails[]>([]);
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
        setFormData((prev: any) => ({ ...prev, [name]: val }));
    };

    const handleAddressLookup = async () => {
        if (!formData.postcode) return;
        setIsLookingUpAddress(true);
        setAddressList([]);
        try {
            const addresses = await lookupAddressByPostcode(formData.postcode);
            setAddressList(addresses);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setIsLookingUpAddress(false); 
        }
    };

    const handleAddressSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedAddress = addressList[parseInt(e.target.value, 10)];
        if (selectedAddress) {
            setFormData((prev: any) => ({
                ...prev,
                addressLine1: selectedAddress.street || '',
                addressLine2: selectedAddress.locality || '',
                city: selectedAddress.postTown || '',
                county: selectedAddress.county || '',
                postcode: selectedAddress.postcode || prev.postcode
            }));
            setAddressList([]);
        }
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
        (vehicles || []).filter(v => v.customerId === (customer?.id || formData.id)), 
    [vehicles, customer, formData.id]);

    if (!isOpen) return null;

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={customer ? 'Customer 360° Profile' : 'Add New Customer'} maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Customer Account Reference</label>
                            <input value={formData.id || ''} readOnly className="w-full p-2 border rounded bg-gray-50 font-mono text-gray-500 text-sm" />
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
                        
                        <div className="md:col-span-3 border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                            <div className="relative">
                                <input 
                                    name="postcode" 
                                    value={formData.postcode || ''} 
                                    onChange={(e) => setFormData({...formData, postcode: e.target.value.toUpperCase()})} 
                                    className="w-full p-2 border rounded uppercase font-mono pr-10"
                                    placeholder="E.G. GU24 9NY"
                                />
                                <button 
                                    type="button" 
                                    onClick={handleAddressLookup} 
                                    disabled={isLookingUpAddress}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-gray-100 rounded hover:bg-indigo-600 hover:text-white transition-colors text-gray-500 disabled:opacity-50"
                                >
                                    {isLookingUpAddress ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                                </button>
                            </div>
                        </div>

                        {addressList.length > 0 && (
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-indigo-700 mb-1">Select Address</label>
                                <select onChange={handleAddressSelect} className="w-full p-2 border-2 border-indigo-200 rounded bg-indigo-50">
                                    <option value="">Select an address...</option>
                                    {addressList.map((addr, index) => (
                                        <option key={index} value={index}>{addr.summaryAddress}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="md:col-span-3"><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label><input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div className="md:col-span-3"><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label><input name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">County</label><input name="county" value={formData.county || ''} onChange={handleChange} className="w-full p-2 border rounded"/></div>

                        <div className="md:col-span-3 border-t pt-4 grid grid-cols-2 gap-4">
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
                            {customerVehicles.length === 0 ? (
                                <p className="text-center py-8 text-gray-400 text-sm">No vehicles linked to this customer.</p>
                            ) : (
                                customerVehicles.map(v => (
                                    <div key={v.id} className="p-3 bg-white border rounded shadow-sm hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => onViewVehicle?.(v.id)}>
                                        <p className="font-bold font-mono text-indigo-600">{v.registration}</p>
                                        <p className="text-xs text-gray-500 uppercase">{v.make} {v.model}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </Section>
                </div>
            </div>
        </FormModal>
    );
};

export default CustomerFormModal;
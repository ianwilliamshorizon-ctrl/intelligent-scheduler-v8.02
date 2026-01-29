
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Job, Vehicle, Estimate, Invoice } from '../types';
import FormModal from './FormModal';
import { generateCustomerId, getCustomerDisplayName } from '../core/utils/customerUtils';
import { formatDate } from '../core/utils/dateUtils';
import { lookupAddressByPostcode } from '../services/postcodeLookupService';
import { Loader2, Search, Briefcase, Car, ChevronDown, ChevronUp, FileText, Receipt } from 'lucide-react';
import { useAuditLogger } from '../core/hooks/useAuditLogger';
import { formatCurrency } from '../utils/formatUtils';

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
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

const VehicleHistoryItem: React.FC<{ vehicle: Vehicle, jobs: Job[], estimates: Estimate[], invoices: Invoice[], onViewVehicle?: (vehicleId: string) => void }> = ({ vehicle, jobs, estimates, invoices, onViewVehicle }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Helper to sum invoice totals
    const getInvoiceTotal = (inv: Invoice) => {
        return (inv.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };

    const getEstimateTotal = (est: Estimate) => {
        return (est.lineItems || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };

    const statusStyles: { [key in Invoice['status']]: string } = {
        Draft: 'bg-gray-200 text-gray-800',
        Sent: 'bg-blue-200 text-blue-800',
        'Part Paid': 'bg-amber-200 text-amber-800',
        Paid: 'bg-green-200 text-green-800',
        Overdue: 'bg-red-200 text-red-800',
    };

    return (
        <div className="border rounded-lg bg-white overflow-hidden">
            <div 
                className="p-3 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        {onViewVehicle && (
                            <button onClick={(e) => { e.stopPropagation(); onViewVehicle(vehicle.id); }} className="p-1 text-indigo-600 hover:bg-gray-200 rounded-full" title={`View vehicle ${vehicle.registration}`}>
                                <Car size={16} />
                            </button>
                        )}
                        <p className="font-bold font-mono text-sm">{vehicle.registration}</p>
                        <span className="text-xs text-gray-600">{vehicle.make} {vehicle.model}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Briefcase size={12}/> {jobs.length} Jobs</span>
                        <span className="flex items-center gap-1"><FileText size={12}/> {estimates.length} Est.</span>
                        <span className="flex items-center gap-1"><Receipt size={12}/> {invoices.length} Inv.</span>
                    </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </div>
            
            {isExpanded && (
                <div className="p-3 bg-white border-t space-y-4">
                    {jobs.length > 0 && (
                        <div>
                            <h5 className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><Briefcase size={12}/> Jobs</h5>
                            <div className="space-y-1 pl-1">
                                {jobs.map(job => (
                                    <div key={job.id} className="text-xs grid grid-cols-[80px_1fr_auto] gap-2 p-1 bg-gray-50 rounded hover:bg-gray-100">
                                        <span className="text-gray-500">{job.createdAt}</span>
                                        <span className="truncate font-medium">{job.description}</span>
                                        <span className={`px-1.5 rounded-full ${job.status === 'Complete' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{job.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {estimates.length > 0 && (
                        <div>
                            <h5 className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><FileText size={12}/> Estimates</h5>
                            <div className="space-y-1 pl-1">
                                {estimates.map(est => (
                                    <div key={est.id} className="text-xs grid grid-cols-[80px_1fr_auto] gap-2 p-1 bg-gray-50 rounded hover:bg-gray-100">
                                        <span className="text-gray-500">{est.issueDate}</span>
                                        <span className="truncate font-medium">#{est.estimateNumber}</span>
                                        <div className="text-right">
                                            <span className="font-mono mr-2">{formatCurrency(getEstimateTotal(est))}</span>
                                            <span className={`px-1.5 rounded-full ${est.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{est.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {invoices.length > 0 && (
                        <div>
                            <h5 className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><Receipt size={12}/> Invoices</h5>
                            <div className="space-y-1 pl-1">
                                {invoices.map(inv => (
                                    <div key={inv.id} className="text-xs grid grid-cols-[80px_1fr_auto] gap-2 p-1 bg-gray-50 rounded hover:bg-gray-100">
                                        <span className="text-gray-500">{inv.issueDate}</span>
                                        <span className="truncate font-medium">#{inv.id}</span>
                                        <div className="text-right">
                                            <span className="font-mono mr-2">{formatCurrency(getInvoiceTotal(inv))}</span>
                                            <span className={`px-1.5 rounded-full ${statusStyles[inv.status]}`}>{inv.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {jobs.length === 0 && estimates.length === 0 && invoices.length === 0 && (
                        <p className="text-xs text-gray-400 italic text-center">No history records found.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ isOpen, onClose, onSave, customer, existingCustomers, jobs, vehicles, estimates, invoices, onViewVehicle }) => {
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const [addressLookupError, setAddressLookupError] = useState('');
    const { logEvent } = useAuditLogger();

    useEffect(() => {
        setFormData(customer || {
            title: '',
            forename: '',
            surname: '',
            phone: '',
            mobile: '',
            email: '',
            addressLine1: '',
            addressLine2: '',
            city: '',
            county: '',
            postcode: '',
            category: 'Retail',
            isCashCustomer: false,
            marketingConsent: false,
            serviceReminderConsent: false,
            communicationPreference: 'None',
            isBusinessCustomer: false,
            companyName: ''
        });
    }, [customer, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddressLookup = async () => {
        if (!formData.postcode) {
            setAddressLookupError('Please enter a postcode to look up.');
            return;
        }
        setIsLookingUpAddress(true);
        setAddressLookupError('');
        try {
            const details = await lookupAddressByPostcode(formData.postcode);
            setFormData(prev => ({
                ...prev,
                addressLine1: details.addressLine1,
                addressLine2: details.addressLine2,
                city: details.city,
            }));
        } catch (error: any) {
            setAddressLookupError(error.message);
        } finally {
            setIsLookingUpAddress(false);
        }
    };

    const handleSave = () => {
        if (formData.isBusinessCustomer && !formData.companyName) {
            alert("Company Name is required for business customers.");
            return;
        }
        if (!formData.forename || !formData.surname || (!formData.phone && !formData.mobile && !formData.email)) {
            alert("Please enter the customer's forename, surname, and at least one contact method (Telephone, Mobile, or Email).");
            return;
        }

        const isNew = !formData.id;
        const newCustomer: Customer = {
            id: formData.id || generateCustomerId(formData.surname!, existingCustomers),
            createdDate: formData.createdDate || formatDate(new Date()),
            ...formData,
        } as Customer;

        onSave(newCustomer);
        logEvent(isNew ? 'CREATE' : 'UPDATE', 'Customer', newCustomer.id, `${isNew ? 'Created' : 'Updated'} customer: ${getCustomerDisplayName(newCustomer)}.`);
    };
    
    const customerVehicles = useMemo(() => {
        if (!customer || !customer.id || !vehicles) return [];
        return vehicles.filter(v => v.customerId === customer.id);
    }, [customer, vehicles]);

    const vehicleHistoryMap = useMemo(() => {
        const map = new Map<string, { jobs: Job[], estimates: Estimate[], invoices: Invoice[] }>();
        if (!customer || !customer.id) return map;

        customerVehicles.forEach(v => {
            map.set(v.id, {
                jobs: (jobs || []).filter(j => j.vehicleId === v.id).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
                estimates: (estimates || []).filter(e => e.vehicleId === v.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '')),
                invoices: (invoices || []).filter(i => i.vehicleId === v.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
            });
        });
        return map;
    }, [customer, customerVehicles, jobs, estimates, invoices]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={customer?.id ? 'Edit Customer' : 'Add Customer'} maxWidth="max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {formData.id && (
                             <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Code / Account No.</label>
                                <input name="id" value={formData.id} readOnly className="w-full p-2 border rounded bg-gray-100 font-mono text-gray-600" />
                            </div>
                        )}
                        
                         <div className="md:col-span-3 flex items-center">
                            <input type="checkbox" id="isBusinessCustomer" name="isBusinessCustomer" checked={formData.isBusinessCustomer || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor="isBusinessCustomer" className="ml-2 block text-sm font-medium text-gray-700">This is a business customer</label>
                        </div>

                        {formData.isBusinessCustomer && (
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name*</label>
                                <input name="companyName" value={formData.companyName || ''} onChange={handleChange} className="w-full p-2 border rounded" required/>
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input name="title" value={formData.title || ''} onChange={handleChange} placeholder="e.g. Mr" className="w-full p-2 border rounded"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{formData.isBusinessCustomer ? 'Contact Forename*' : 'Forename*'}</label>
                            <input name="forename" value={formData.forename || ''} onChange={handleChange} className="w-full p-2 border rounded" required/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{formData.isBusinessCustomer ? 'Contact Surname*' : 'Surname*'}</label>
                            <input name="surname" value={formData.surname || ''} onChange={handleChange} className="w-full p-2 border rounded" required/>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                            <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                            <input name="mobile" value={formData.mobile || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                        
                         <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                            <input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                         <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                            <input name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                            <input name="county" value={formData.county || ''} onChange={handleChange} className="w-full p-2 border rounded"/>
                        </div>
                        
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                            <input name="postcode" value={formData.postcode || ''} onChange={handleChange} className="w-full p-2 border rounded pr-10"/>
                            <button
                                type="button"
                                onClick={handleAddressLookup}
                                className="absolute right-2 top-8 p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors disabled:opacity-50"
                                disabled={isLookingUpAddress || !formData.postcode}
                                title="Look up address by Postcode"
                            >
                                {isLookingUpAddress ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                        </div>
                        {addressLookupError && <p className="text-sm text-red-600 md:col-span-3 -mt-2">{addressLookupError}</p>}
                        
                        <div className="md:col-span-3 flex justify-between items-center pt-2">
                             <div className="flex items-center">
                                <label className="block text-sm font-medium text-gray-700 mr-2">Category</label>
                                <select name="category" value={formData.category || 'Retail'} onChange={handleChange} className="p-2 border rounded bg-white">
                                    <option>Retail</option>
                                    <option>Trade</option>
                                </select>
                            </div>
                        </div>

                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800 border-t pt-4 mt-4">Communication Preferences</h4>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Method</label>
                                <select name="communicationPreference" value={formData.communicationPreference || 'None'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                    <option value="None">None</option>
                                    <option value="Email">Email</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="SMS">SMS</option>
                                </select>
                            </div>
                            <div className="flex items-center pt-2">
                                <input type="checkbox" id="serviceReminderConsent" name="serviceReminderConsent" checked={formData.serviceReminderConsent || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="serviceReminderConsent" className="ml-2 block text-sm font-medium text-gray-700">Service/MOT reminders OK</label>
                            </div>
                            <div className="flex items-center pt-2">
                                <input type="checkbox" id="marketingConsent" name="marketingConsent" checked={formData.marketingConsent || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="marketingConsent" className="ml-2 block text-sm font-medium text-gray-700">General marketing OK</label>
                            </div>
                        </div>
                    </div>
                </div>
                 <div className="md:col-span-2 space-y-4">
                    {customer?.id && vehicles && (
                        <Section title={`Vehicles (${customerVehicles.length})`} icon={Car}>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                {customerVehicles.length === 0 && <p className="text-sm text-gray-500">No vehicles linked to this customer.</p>}
                                {customerVehicles.map(v => {
                                    const history = vehicleHistoryMap.get(v.id) || { jobs: [], estimates: [], invoices: [] };
                                    return (
                                        <VehicleHistoryItem 
                                            key={v.id} 
                                            vehicle={v} 
                                            jobs={history.jobs} 
                                            estimates={history.estimates} 
                                            invoices={history.invoices} 
                                            onViewVehicle={onViewVehicle}
                                        />
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export default CustomerFormModal;

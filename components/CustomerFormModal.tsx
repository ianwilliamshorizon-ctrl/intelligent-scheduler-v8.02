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

const VehicleHistoryItem: React.FC<{ vehicle: Vehicle, jobs: Job[], estimates: Estimate[], invoices: Invoice[], onViewVehicle?: (vehicleId: string) => void }> = ({ vehicle, jobs, estimates, invoices, onViewVehicle }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getInvoiceTotal = (inv: Invoice) => {
        return (inv.lineItems || []).reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);
    };

    const getEstimateTotal = (est: Estimate) => {
        return (est.lineItems || []).reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);
    };

    const statusStyles: { [key: string]: string } = {
        Draft: 'bg-gray-200 text-gray-800',
        Sent: 'bg-blue-200 text-blue-800',
        'Part Paid': 'bg-amber-200 text-amber-800',
        Paid: 'bg-green-200 text-green-800',
        Overdue: 'bg-red-200 text-red-800',
    };

    return (
        <div className="border rounded-lg bg-white overflow-hidden mb-3">
            <div 
                className="p-3 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        {onViewVehicle && (
                            <button onClick={(e) => { e.stopPropagation(); onViewVehicle(vehicle.id); }} className="p-1 text-indigo-600 hover:bg-gray-200 rounded-full">
                                <Car size={16} />
                            </button>
                        )}
                        <p className="font-bold font-mono text-sm">{vehicle.registration}</p>
                        <span className="text-xs text-gray-600">{vehicle.make} {vehicle.model}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Briefcase size={12}/> {jobs.length}</span>
                        <span className="flex items-center gap-1"><FileText size={12}/> {estimates.length}</span>
                        <span className="flex items-center gap-1"><Receipt size={12}/> {invoices.length}</span>
                    </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </div>
            
            {isExpanded && (
                <div className="p-3 bg-white border-t space-y-4">
                    {jobs.length > 0 && (
                        <div>
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Job History</h5>
                            <div className="space-y-1">
                                {jobs.map(job => (
                                    <div key={job.id} className="text-xs grid grid-cols-[80px_1fr_auto] gap-2 p-1.5 bg-gray-50 rounded">
                                        <span className="text-gray-500">{job.createdAt}</span>
                                        <span className="truncate">{job.description}</span>
                                        <span className="font-bold text-indigo-600">{job.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {invoices.length > 0 && (
                        <div>
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Invoices</h5>
                            <div className="space-y-1">
                                {invoices.map(inv => (
                                    <div key={inv.id} className="text-xs grid grid-cols-[80px_1fr_auto] gap-2 p-1.5 bg-gray-50 rounded">
                                        <span className="text-gray-500">{inv.issueDate}</span>
                                        <span className="truncate">#{inv.id}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[inv.status] || ''}`}>
                                            {formatCurrency(getInvoiceTotal(inv))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface CustomerFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Customer) => void;
    customerId: string | null;
    customers: Customer[];
    jobs: Job[];
    vehicles: Vehicle[];
    estimates: Estimate[];
    invoices: Invoice[];
    onViewVehicle?: (vehicleId: string) => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ 
    isOpen, onClose, onSave, customerId, customers, jobs, vehicles, estimates, invoices, onViewVehicle 
}) => {
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const [addressLookupError, setAddressLookupError] = useState('');
    const { logEvent } = useAuditLogger();

    // 1. Find the customer in the data set
    const activeCustomer = useMemo(() => 
        customers.find(c => c.id === customerId), 
    [customers, customerId]);

    // 2. Sync form data - This ensures the fields populate whenever activeCustomer changes
    useEffect(() => {
        if (isOpen) {
            if (activeCustomer) {
                console.log('CustomerFormModal: Loading data for', activeCustomer.id);
                setFormData({ ...activeCustomer });
            } else {
                console.log('CustomerFormModal: Initializing blank form');
                setFormData({
                    title: '', forename: '', surname: '', phone: '', mobile: '', email: '',
                    addressLine1: '', addressLine2: '', city: '', county: '', postcode: '',
                    category: 'Retail', isCashCustomer: false, marketingConsent: false,
                    serviceReminderConsent: false, communicationPreference: 'None',
                    isBusinessCustomer: false, companyName: ''
                });
            }
        }
    }, [activeCustomer, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddressLookup = async () => {
        if (!formData.postcode) return;
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
        if (!formData.forename || !formData.surname) {
            alert("Forename and Surname are required.");
            return;
        }

        const isNew = !formData.id;
        const finalCustomer: Customer = {
            ...formData,
            id: formData.id || generateCustomerId(formData.surname!, customers),
            createdDate: formData.createdDate || formatDate(new Date()),
        } as Customer;

        onSave(finalCustomer);
        logEvent(isNew ? 'CREATE' : 'UPDATE', 'Customer', finalCustomer.id, `Saved customer: ${finalCustomer.forename} ${finalCustomer.surname}`);
    };
    
    // 3. 360 View Data Processing
    const customerVehicles = useMemo(() => 
        vehicles.filter(v => v.customerId === customerId), 
    [vehicles, customerId]);

    const vehicleHistoryMap = useMemo(() => {
        const map = new Map<string, { jobs: Job[], estimates: Estimate[], invoices: Invoice[] }>();
        customerVehicles.forEach(v => {
            map.set(v.id, {
                jobs: jobs.filter(j => j.vehicleId === v.id),
                estimates: estimates.filter(e => e.vehicleId === v.id),
                invoices: invoices.filter(i => i.vehicleId === v.id)
            });
        });
        return map;
    }, [customerVehicles, jobs, estimates, invoices]);

    if (!isOpen) return null;

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={activeCustomer ? 'Customer 360° Profile' : 'Add New Customer'} maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Left Side: Form Details */}
                <div className="md:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {formData.id && (
                             <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Customer Account Reference</label>
                                <input name="id" value={formData.id} readOnly className="w-full p-2 border rounded bg-gray-50 font-mono text-gray-500 text-sm shadow-inner" />
                            </div>
                        )}
                        
                        <div className="md:col-span-3 flex items-center bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                            <input type="checkbox" id="isBusinessCustomer" name="isBusinessCustomer" checked={formData.isBusinessCustomer || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500" />
                            <label htmlFor="isBusinessCustomer" className="ml-2 text-sm font-bold text-indigo-900">Business / Fleet Account</label>
                        </div>

                        {formData.isBusinessCustomer && (
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name*</label>
                                <input name="companyName" value={formData.companyName || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input name="title" value={formData.title || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Forename*</label>
                            <input name="forename" value={formData.forename || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Surname*</label>
                            <input name="surname" value={formData.surname || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                            <input name="mobile" value={formData.mobile || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input name="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"/>
                        </div>
                        
                        <div className="md:col-span-3 border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                            <input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"/>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                            <input name="postcode" value={formData.postcode || ''} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"/>
                            <button type="button" onClick={handleAddressLookup} className="absolute right-2 top-8 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                                {isLookingUpAddress ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Search size={14} className="text-gray-500" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: 360 Activity */}
                <div className="md:col-span-2 space-y-4">
                    {customerId ? (
                        <Section title={`Vehicle History (${customerVehicles.length})`} icon={Car}>
                            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                                {customerVehicles.length === 0 && (
                                    <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed">
                                        <p className="text-sm text-gray-400">No vehicles registered.</p>
                                    </div>
                                )}
                                {customerVehicles.map(v => (
                                    <VehicleHistoryItem 
                                        key={v.id} 
                                        vehicle={v} 
                                        jobs={vehicleHistoryMap.get(v.id)?.jobs || []} 
                                        estimates={vehicleHistoryMap.get(v.id)?.estimates || []} 
                                        invoices={vehicleHistoryMap.get(v.id)?.invoices || []} 
                                        onViewVehicle={onViewVehicle}
                                    />
                                ))}
                            </div>
                        </Section>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-dashed rounded-xl text-gray-400">
                             <Briefcase size={48} className="mb-2 opacity-20"/>
                             <p className="text-center text-sm">Customer activity will appear here once the profile is created.</p>
                        </div>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export default CustomerFormModal;
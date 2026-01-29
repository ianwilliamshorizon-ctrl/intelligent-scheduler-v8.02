

import React, { useState } from 'react';
import { Customer, Vehicle } from '../types';
import { User, Car, Save, Search, Loader2 } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { generateCustomerId } from '../core/utils/customerUtils';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode } from '../services/postcodeLookupService';

interface AddNewVehicleFormProps {
    initialRegistration: string;
    onSave: (customer: Customer, vehicle: Vehicle) => void;
    onCancel: () => void;
    customers: Customer[];
    saveButtonText?: string;
}

const FormInput = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:cursor-not-allowed disabled:bg-gray-200" {...props} />
    </div>
);

const FormSelect = ({ label, children, ...props }: any) => (
     <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select className="w-full p-2 border border-gray-300 rounded-lg" {...props}>{children}</select>
    </div>
);

const AddNewVehicleForm: React.FC<AddNewVehicleFormProps> = ({ initialRegistration, onSave, onCancel, customers, saveButtonText = "Save & Continue" }) => {
    const [customerData, setCustomerData] = useState({
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
        isBusinessCustomer: false,
        companyName: '',
        serviceReminderConsent: true,
        communicationPreference: 'Email',
    });
    const [vehicleData, setVehicleData] = useState({
        registration: initialRegistration,
        make: '',
        model: '',
        vin: '',
        nextServiceDate: '',
        nextMotDate: '',
        winterCheckDate: '',
        fleetNumber: '',
        manufactureDate: '',
        transmissionType: 'Manual',
        engineCapacity: '',
        fuelType: '',
        colour: '',
    });
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
    const [addressLookupError, setAddressLookupError] = useState('');

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setCustomerData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setCustomerData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleVehicleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setVehicleData(prev => ({ ...prev, [name]: value }));
    };

    const handleLookup = async (lookupValue: string) => {
        if (!lookupValue) {
            setLookupError('Please enter a registration or VIN to look up.');
            return;
        }
        setIsLookingUp(true);
        setLookupError('');
        try {
            const details = await lookupVehicleByVRM(lookupValue);
            setVehicleData(prev => ({
                ...prev,
                make: details.make || prev.make,
                model: details.model || prev.model, // Keep existing or empty if DVLA doesn't provide
                colour: details.colour || prev.colour,
                fuelType: details.fuelType || prev.fuelType,
                engineCapacity: details.engineCapacity ? details.engineCapacity.toString() : prev.engineCapacity,
                nextMotDate: details.motExpiryDate || prev.nextMotDate,
                manufactureDate: details.monthOfFirstRegistration ? `${details.monthOfFirstRegistration}-01` : prev.manufactureDate
            }));
        } catch (error: any) {
            setLookupError(error.message);
        } finally {
            setIsLookingUp(false);
        }
    };
    
    const handleAddressLookup = async () => {
        if (!customerData.postcode) {
            setAddressLookupError('Please enter a postcode to look up.');
            return;
        }
        setIsLookingUpAddress(true);
        setAddressLookupError('');
        try {
            const details = await lookupAddressByPostcode(customerData.postcode);
            setCustomerData(prev => ({
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


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customerData.isBusinessCustomer && !customerData.companyName) {
            alert("Company Name is required for business customers.");
            return;
        }
        if (!vehicleData.registration || !vehicleData.make || !vehicleData.model) {
            alert("Please fill in all vehicle details (Registration, Make, Model).");
            return;
        }
        if (!customerData.forename || !customerData.surname || (!customerData.phone && !customerData.mobile && !customerData.email)) {
             alert("Please enter the customer's forename, surname, and at least one contact method (Telephone, Mobile, or Email).");
            return;
        }

        const newId = generateCustomerId(customerData.surname, customers);
        const newCustomer: Customer = { 
            id: newId, 
            isBusinessCustomer: customerData.isBusinessCustomer,
            companyName: customerData.companyName || undefined,
            title: customerData.title || undefined,
            forename: customerData.forename,
            surname: customerData.surname,
            phone: customerData.phone,
            mobile: customerData.mobile || undefined,
            email: customerData.email || undefined,
            addressLine1: customerData.addressLine1 || undefined,
            addressLine2: customerData.addressLine2 || undefined,
            city: customerData.city || undefined,
            county: customerData.county || undefined,
            postcode: customerData.postcode || undefined,
            category: customerData.category as 'Retail' | 'Trade',
            isCashCustomer: customerData.isCashCustomer,
            marketingConsent: customerData.marketingConsent,
            serviceReminderConsent: customerData.serviceReminderConsent,
            communicationPreference: customerData.communicationPreference as 'Email' | 'SMS' | 'WhatsApp' | 'None' | undefined,
            createdDate: formatDate(new Date()),
        };
        const newVehicle: Vehicle = { 
            id: crypto.randomUUID(), 
            customerId: newCustomer.id, 
            registration: vehicleData.registration.toUpperCase().replace(/\s/g, ''), 
            make: vehicleData.make, 
            model: vehicleData.model,
            vin: vehicleData.vin || undefined,
            nextServiceDate: vehicleData.nextServiceDate || undefined,
            nextMotDate: vehicleData.nextMotDate || undefined,
            winterCheckDate: vehicleData.winterCheckDate || undefined,
            fleetNumber: vehicleData.fleetNumber || undefined,
            manufactureDate: vehicleData.manufactureDate || undefined,
            transmissionType: vehicleData.transmissionType as 'Automatic' | 'Manual' | 'Other',
            cc: vehicleData.engineCapacity ? parseInt(vehicleData.engineCapacity) : undefined,
            fuelType: vehicleData.fuelType || undefined,
            colour: vehicleData.colour || undefined,
        };

        onSave(newCustomer, newVehicle);
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center mb-4"><Car size={20} className="mr-2 text-indigo-600"/> Vehicle Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration (VRM Lookup)*</label>
                        <div className="relative">
                            <input 
                                name="registration" 
                                value={vehicleData.registration} 
                                onChange={handleVehicleChange} 
                                className="w-full p-2 border border-gray-300 rounded-lg bg-white pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => handleLookup(vehicleData.registration)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors disabled:opacity-50"
                                disabled={isLookingUp || !vehicleData.registration}
                                title="VRM Lookup"
                            >
                                {isLookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                        </div>
                        {lookupError && <p className="text-sm text-red-600 mt-1">{lookupError}</p>}
                    </div>
                    <FormInput label="Make*" name="make" value={vehicleData.make} onChange={handleVehicleChange} required />
                    <FormInput label="Model*" name="model" value={vehicleData.model} onChange={handleVehicleChange} required />
                    <FormInput label="Colour" name="colour" value={vehicleData.colour} onChange={handleVehicleChange} />
                    <FormInput label="Engine CC" name="engineCapacity" value={vehicleData.engineCapacity} onChange={handleVehicleChange} type="number"/>
                    <FormInput label="Fuel Type" name="fuelType" value={vehicleData.fuelType} onChange={handleVehicleChange} />
                    
                    <FormInput label="VIN" name="vin" value={vehicleData.vin} onChange={handleVehicleChange} />
                    <FormSelect label="Transmission" name="transmissionType" value={vehicleData.transmissionType} onChange={handleVehicleChange}>
                        <option>Manual</option>
                        <option>Automatic</option>
                        <option>Other</option>
                    </FormSelect>
                    
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Next Service Due</label>
                        <input type="date" name="nextServiceDate" value={vehicleData.nextServiceDate} onChange={handleVehicleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Next MOT Due</label>
                        <input type="date" name="nextMotDate" value={vehicleData.nextMotDate} onChange={handleVehicleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Winter Check Due</label>
                        <input type="date" name="winterCheckDate" value={vehicleData.winterCheckDate} onChange={handleVehicleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                     <FormInput label="Fleet Number" name="fleetNumber" value={vehicleData.fleetNumber} onChange={handleVehicleChange} />
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date</label>
                        <input type="date" name="manufactureDate" value={vehicleData.manufactureDate} onChange={handleVehicleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                </div>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center mb-4"><User size={20} className="mr-2 text-indigo-600"/> Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                         <input type="checkbox" id="isBusinessCustomer" name="isBusinessCustomer" checked={customerData.isBusinessCustomer} onChange={handleCustomerChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                         <label htmlFor="isBusinessCustomer" className="ml-2 text-sm font-medium text-gray-700">This is a business customer</label>
                    </div>
                    {customerData.isBusinessCustomer && (
                        <div className="md:col-span-3">
                            <FormInput label="Company Name*" name="companyName" value={customerData.companyName} onChange={handleCustomerChange} required/>
                        </div>
                    )}
                    <FormInput label="Title" name="title" value={customerData.title} onChange={handleCustomerChange} />
                    <FormInput label={customerData.isBusinessCustomer ? 'Contact Forename*' : 'Forename*'} name="forename" value={customerData.forename} onChange={handleCustomerChange} required/>
                    <FormInput label={customerData.isBusinessCustomer ? 'Contact Surname*' : 'Surname*'} name="surname" value={customerData.surname} onChange={handleCustomerChange} required/>

                    <FormInput label="Telephone" name="phone" value={customerData.phone} onChange={handleCustomerChange} />
                    <FormInput label="Mobile" name="mobile" value={customerData.mobile} onChange={handleCustomerChange} />
                    <FormInput label="Email" name="email" value={customerData.email} onChange={handleCustomerChange} type="email"/>

                     <div className="md:col-span-3">
                        <FormInput label="Address Line 1" name="addressLine1" value={customerData.addressLine1} onChange={handleCustomerChange} />
                    </div>
                     <div className="md:col-span-3">
                        <FormInput label="Address Line 2" name="addressLine2" value={customerData.addressLine2} onChange={handleCustomerChange} />
                    </div>
                     <FormInput label="City" name="city" value={customerData.city} onChange={handleCustomerChange} />
                    <FormInput label="County" name="county" value={customerData.county} onChange={handleCustomerChange} />

                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                        <div className="relative">
                            <input name="postcode" value={customerData.postcode} onChange={handleCustomerChange} className="w-full p-2 border border-gray-300 rounded-lg pr-10"/>
                            <button
                                type="button"
                                onClick={handleAddressLookup}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors disabled:opacity-50"
                                disabled={isLookingUpAddress || !customerData.postcode}
                                title="Look up address by Postcode"
                            >
                                {isLookingUpAddress ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                        </div>
                        {addressLookupError && <p className="text-sm text-red-600 mt-1">{addressLookupError}</p>}
                    </div>
                </div>
                
                 <div className="mt-4 pt-4 border-t flex items-start justify-between">
                    <FormSelect label="Category" name="category" value={customerData.category} onChange={handleCustomerChange}>
                        <option>Retail</option>
                        <option>Trade</option>
                    </FormSelect>
                     <div className="md:col-span-3 mt-4 pt-4 border-t">
                        <h4 className="font-semibold text-gray-800 mb-2">Communication Preferences</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Method</label>
                                <select name="communicationPreference" value={customerData.communicationPreference || 'None'} onChange={handleCustomerChange} className="w-full p-2 border rounded bg-white">
                                    <option value="None">None</option>
                                    <option value="Email">Email</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="SMS">SMS</option>
                                </select>
                            </div>
                            <div className="flex items-center pt-6">
                                <input type="checkbox" id="serviceReminderConsent" name="serviceReminderConsent" checked={customerData.serviceReminderConsent} onChange={handleCustomerChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="serviceReminderConsent" className="ml-2 text-sm text-gray-600">Agrees to service reminders.</label>
                            </div>
                            <div className="flex items-center pt-6">
                                <input type="checkbox" id="marketingConsent" name="marketingConsent" checked={customerData.marketingConsent} onChange={handleCustomerChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="marketingConsent" className="ml-2 text-sm text-gray-600">Agrees to marketing.</label>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

             <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={onCancel} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">Cancel</button>
                <button type="button" onClick={handleSubmit} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                    <Save size={16} className="mr-2"/> {saveButtonText}
                </button>
            </div>
        </div>
    );
};

export default AddNewVehicleForm;
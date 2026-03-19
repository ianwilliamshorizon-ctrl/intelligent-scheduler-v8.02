
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Vehicle, Customer, Job, Estimate, MotTest } from '../types';
import FormModal from './FormModal';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { 
    Loader2, Search, Briefcase, History, 
    Eye, ArrowRightLeft, ShieldCheck, AlertCircle, 
    Printer, Car, Shield, XCircle, AlertTriangle,
    Database, User, ExternalLink
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuditLogger } from '../core/hooks/useAuditLogger';
import VehicleImageManager from './VehicleImageManager';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, dateStringToDate } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';

/**
 * Type overrides for missing exports in ../types
 */
type LocalInvoice = any;
type LocalPrevReg = { registration: string; changedAt: string; changedByUserId: string };

const TabButton = ({ isActive, onClick, children }: { isActive: boolean, onClick: () => void, children: React.ReactNode }) => (
    <button 
        type="button" 
        onClick={onClick} 
        className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
            isActive 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
    >
        {children}
    </button>
);

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
        </div>
    );
};

interface VehicleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vehicle: Vehicle) => void;
    onSaveWithCustomer?: (customer: Customer, vehicle: Vehicle) => void;
    vehicle: Partial<Vehicle> | null;
    customers: Customer[];
    jobs?: Job[];
    estimates?: Estimate[];
    invoices?: LocalInvoice[];
    onViewJob?: (jobId: string) => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onViewInvoice?: (invoice: LocalInvoice) => void;
    onViewCustomer?: (customerId: string) => void;
    initialCustomerId?: string;
    initialRegistration?: string;
}

const VehicleFormModal: React.FC<VehicleFormModalProps> = ({ 
    isOpen, onClose, onSave, vehicle, customers, jobs, estimates, invoices, 
    onViewJob, onViewEstimate, onViewInvoice, onViewCustomer, initialCustomerId, onSaveWithCustomer, initialRegistration
}) => {
    // Using any for formData to bypass strict property checks on the Partial<Vehicle> type
    const [formData, setFormData] = useState<any>({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'mot'>('details');
    const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
    const { logEvent } = useAuditLogger();
    const { currentUser } = useApp();
    const [isTransferMode, setIsTransferMode] = useState(false);
    
    // Safety ref to prevent 429 Resource Exhausted loops
    const hasAutoLookedUp = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            hasAutoLookedUp.current = false;
            return;
        }

        const initialData = vehicle || {
            customerId: initialCustomerId || '',
            registration: initialRegistration || '',
            make: '',
            model: '',
            transmissionType: 'Manual',
        };
        
        setFormData(initialData);
        setIsTransferMode(!vehicle?.id);
        setActiveTab('details');

        // Fire auto-lookup once per modal open
        if (initialRegistration && !vehicle?.make && !hasAutoLookedUp.current) {
            hasAutoLookedUp.current = true;
            handleLookup(initialRegistration);
        }
    }, [isOpen, vehicle, initialRegistration, initialCustomerId]);
    
    if (!vehicle && !initialRegistration && !initialCustomerId) {
        return (
             <FormModal isOpen={isOpen} onClose={onClose} onSave={() => {}} title="Add New Vehicle & Customer" maxWidth="max-w-4xl">
                <AddNewVehicleForm
                    initialRegistration={initialRegistration || ''}
                    onSave={(customer, v) => {
                        if (onSaveWithCustomer) onSaveWithCustomer(customer, v);
                        onClose();
                    }}
                    onCancel={onClose}
                    customers={customers}
                />
            </FormModal>
        );
    }

    const getInvoiceTotal = (inv: any) => inv.lineItems?.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const getEstimateTotal = (est: Estimate) => est.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const vehicleJobs = useMemo(() => (jobs || []).filter(j => j.vehicleId === vehicle?.id).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [jobs, vehicle]);
    const vehicleEstimates = useMemo(() => (estimates || []).filter(e => e.vehicleId === vehicle?.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '')), [estimates, vehicle]);
    const vehicleInvoices = useMemo(() => (invoices || []).filter(i => i.vehicleId === vehicle?.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '')), [invoices, vehicle]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData((prev: any) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: name === 'registration' ? value.toUpperCase() : value }));
        }
    };

    const handleLookup = async (lookupValue: string) => {
        if (!lookupValue || lookupValue.trim().length < 2 || isLookingUp) return;
        
        setIsLookingUp(true);
        setLookupError('');
        
        try {
            const details = await lookupVehicleByVRM(lookupValue) as any;

            // Sync API Quota
            if (details.AccountBalance !== undefined) setRemainingQuota(details.AccountBalance);
            else if (details.CreditsRemaining !== undefined) setRemainingQuota(details.CreditsRemaining);

            setFormData((prev: any) => ({
                ...prev,
                make: details.make || prev.make,
                model: details.model || prev.model,
                colour: details.colour || prev.colour,
                fuelType: details.fuelType || prev.fuelType,
                engineCapacityCc: details.engineCapacity || prev.engineCapacityCc,
                engineNumber: details.engineNumber || prev.engineNumber,
                vin: details.vin || prev.vin,
                nextMotDate: details.nextMotDate || prev.nextMotDate,
                manufactureDate: details.monthOfFirstRegistration ? `${details.monthOfFirstRegistration}-01` : prev.manufactureDate,
                motHistory: details.motHistory?.motTestDetailsList || []
            }));
        } catch (error: any) {
            setLookupError(error.message || 'Lookup failed.');
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleMotIncrement = () => {
        const currentMot = formData.nextMotDate ? dateStringToDate(formData.nextMotDate) : new global.Date();
        const nextYear = new global.Date(currentMot.setFullYear(currentMot.getFullYear() + 1));
        setFormData((prev: any) => ({ ...prev, nextMotDate: formatDate(nextYear) }));
    };

    const handleSave = () => {
        if (!formData.customerId || !formData.registration || !formData.make || !formData.model) {
            alert('Required fields: Customer, Registration, Make, and Model.');
            return;
        }
        const isNew = !formData.id;
        let vehicleToSave = { ...formData };

        if (!isNew && vehicle?.registration && vehicle.registration !== vehicleToSave.registration) {
            const historyEntry: LocalPrevReg = {
                registration: vehicle.registration,
                changedAt: new global.Date().toISOString(),
                changedByUserId: currentUser.id,
            };
            vehicleToSave.previousRegistrations = [...(vehicleToSave.previousRegistrations || []), historyEntry];
        }

        const finalVehicle = {
            id: vehicleToSave.id || crypto.randomUUID(),
            ...vehicleToSave,
        } as Vehicle;
        
        onSave(finalVehicle);
        logEvent(isNew ? 'CREATE' : 'UPDATE', 'Vehicle', finalVehicle.id, `${isNew ? 'Created' : 'Updated'} vehicle ${finalVehicle.registration}.`);
    };

    const handleCustomerClick = () => {
        if (onViewCustomer && formData.customerId) {
            onViewCustomer(formData.customerId);
        } else {
            console.warn("VehicleFormModal: onViewCustomer prop is missing or customerId is null.");
        }
    };
    
    const customerOptions = customers.map(c => ({
        value: c.id,
        label: `${c.forename} ${c.surname} ${c.companyName ? `(${c.companyName})` : ''} - ${c.postcode}`
    }));

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={vehicle?.id ? 'Edit Vehicle' : 'Add Vehicle'} maxWidth="max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-4">
                    <div className="flex border-b border-gray-200 justify-between items-center pr-2">
                        <div className="flex">
                            <TabButton isActive={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                                <Car size={16}/> Vehicle Specifications
                            </TabButton>
                            <TabButton isActive={activeTab === 'mot'} onClick={() => setActiveTab('mot')}>
                                <Shield size={16}/> Official MOT Records
                            </TabButton>
                        </div>
                        {remainingQuota !== null && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100 text-[10px] font-extrabold text-indigo-700">
                                <Database size={12} />
                                <span>API CREDITS: {remainingQuota}</span>
                            </div>
                        )}
                    </div>

                    {activeTab === 'details' ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner*</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                options={customerOptions}
                                                onSelect={(value) => setFormData((prev: any) => ({...prev, customerId: value || ''}))}
                                                defaultValue={formData.customerId}
                                                placeholder="Search customers..."
                                            />
                                        </div>
                                        {formData.customerId && (
                                            <button
                                                type="button"
                                                onClick={handleCustomerClick}
                                                className="px-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-2 text-sm font-bold shadow-sm whitespace-nowrap"
                                            >
                                                <User size={16} />
                                                View Profile
                                                <ExternalLink size={14} className="opacity-50" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration*</label>
                                     <div className="relative">
                                        <input 
                                            name="registration" 
                                            value={formData.registration || ''} 
                                            onChange={handleChange} 
                                            className={`w-full p-2 border rounded font-bold uppercase tracking-widest ${isTransferMode ? 'bg-white border-indigo-500 ring-1 ring-indigo-500' : 'bg-gray-100'}`}
                                            disabled={!isTransferMode}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleLookup(formData.registration!)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                                            disabled={isLookingUp || !formData.registration}
                                        >
                                            {isLookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                        </button>
                                    </div>
                                    {!isTransferMode && vehicle?.id && (
                                        <button type="button" onClick={() => setIsTransferMode(true)} className="text-[10px] text-indigo-600 font-bold mt-1 flex items-center gap-1 uppercase">
                                            <ArrowRightLeft size={10}/> Plate Transfer
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Make*</label>
                                    <input name="make" value={formData.make || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model*</label>
                                    <input name="model" value={formData.model || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                                </div>

                                {lookupError && <p className="text-sm text-red-600 md:col-span-3 -mt-2 flex items-center gap-1 font-medium bg-red-50 p-2 rounded border border-red-100"><AlertCircle size={14}/> {lookupError}</p>}
                                
                                <div className="md:col-span-3">
                                     <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">VIN / Chassis <ShieldCheck size={14} className="text-green-600"/></label>
                                    <input name="vin" value={formData.vin || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-mono text-sm" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
                                    <input name="colour" value={formData.colour || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Engine Number</label>
                                    <input name="engineNumber" value={formData.engineNumber || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Engine Size (CC)</label>
                                    <input name="engineCapacityCc" type="number" value={formData.engineCapacityCc || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                                    <input name="fuelType" value={formData.fuelType || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                                    <select name="transmissionType" value={formData.transmissionType || 'Manual'} onChange={handleChange} className="w-full p-2 border rounded bg-white font-medium">
                                        <option>Manual</option>
                                        <option>Automatic</option>
                                        <option>Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Next MOT Due</label>
                                    <div className="flex gap-1">
                                        <input name="nextMotDate" type="date" value={formData.nextMotDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                        <button type="button" onClick={handleMotIncrement} className="p-2 bg-green-100 text-green-700 rounded-lg text-xs font-bold border border-green-200">+1 Yr</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Service</label>
                                    <input name="nextServiceDate" type="date" value={formData.nextServiceDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date</label>
                                    <input name="manufactureDate" type="date" value={formData.manufactureDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fleet Number</label>
                                    <input name="fleetNumber" value={formData.fleetNumber || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                </div>
                                <div className="flex items-center pt-6">
                                    <input type="checkbox" id="covidEx" name="covid19MotExemption" checked={formData.covid19MotExemption || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
                                    <label htmlFor="covidEx" className="ml-2 text-sm text-gray-700 font-medium">COVID Exemption</label>
                                </div>
                            </div>
                            {formData.id && <VehicleImageManager vehicle={formData as Vehicle} onUpdateVehicle={(v) => setFormData(v)} />}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {(!formData.motHistory || formData.motHistory.length === 0) ? (
                                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed">
                                    <Shield className="mx-auto text-gray-300 mb-2" size={48} />
                                    <p className="text-gray-500 font-medium">No official DVLA records found.</p>
                                </div>
                            ) : (
                                (formData.motHistory as MotTest[]).map((test, idx) => (
                                    <div key={idx} className={`p-4 rounded-lg border-l-4 ${test.testPassed ? 'border-green-500' : 'border-red-500'} bg-white shadow-sm border`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${test.testPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {test.testPassed ? 'PASS' : 'FAIL'}
                                            </span>
                                            <span className="text-sm text-gray-500 font-mono font-bold">{test.testDate ? formatDate(new Date(test.testDate)) : ''}</span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-700">Odometer: {test.odometerReading} {test.odometerUnit}</p>
                                        {test.annotationList?.map((note, nIdx) => (
                                            <div key={nIdx} className="mt-2 text-xs flex gap-2 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                                {note.type === 'FAIL' ? <XCircle size={14} className="text-red-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                                                <span>{note.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                 <div className="md:col-span-2 space-y-4">
                    {vehicle?.id && (
                        <Section title="Internal Garage History" icon={Briefcase}>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                <div className="p-2 bg-gray-100 rounded text-[10px] flex justify-between border border-gray-200">
                                    <span className="font-mono font-bold text-gray-600 uppercase">VIN: {formData.vin || 'N/A'}</span>
                                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-vehicle-history-report', { detail: { vehicleId: vehicle.id } }))} className="text-indigo-600 hover:text-indigo-800"><Printer size={14}/></button>
                                </div>

                                {vehicleJobs.length > 0 && (
                                    <div className="space-y-1">
                                        <h5 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Recent Jobs</h5>
                                        {vehicleJobs.map(job => (
                                            <div key={job.id} className="text-xs flex justify-between p-2 border rounded bg-blue-50/30 hover:bg-blue-100 cursor-pointer transition-colors" onClick={() => onViewJob?.(job.id)}>
                                                <span className="text-gray-500 font-mono">{job.createdAt}</span>
                                                <span className="truncate font-bold flex-1 px-2">{job.description}</span>
                                                <Eye size={14} className="text-gray-400" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {vehicleEstimates.length > 0 && (
                                    <div className="space-y-1 mt-4">
                                        <h5 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Estimates</h5>
                                        {vehicleEstimates.map(est => (
                                            <div key={est.id} className="text-xs flex justify-between p-2 border rounded bg-amber-50/30 hover:bg-amber-100 cursor-pointer transition-colors" onClick={() => onViewEstimate?.(est)}>
                                                <span className="text-gray-500 font-mono">{est.issueDate}</span>
                                                <span className="flex-1 px-2 font-bold text-amber-900">#{est.id.slice(-6)}</span>
                                                <span className="font-extrabold">{formatCurrency(getEstimateTotal(est))}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {vehicleInvoices.length > 0 && (
                                    <div className="space-y-1 mt-4">
                                        <h5 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Billing</h5>
                                        {vehicleInvoices.map(inv => (
                                            <div key={inv.id} className="text-xs flex justify-between p-2 border rounded bg-green-50/30 hover:bg-green-100 cursor-pointer transition-colors" onClick={() => onViewInvoice?.(inv)}>
                                                <span className="text-gray-500 font-mono">{inv.issueDate}</span>
                                                <span className="flex-1 px-2 font-bold text-green-900">#{inv.id.slice(-6)}</span>
                                                <span className="font-extrabold">{formatCurrency(getInvoiceTotal(inv))}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}
                    
                    {(formData.previousRegistrations || []).length > 0 && (
                        <Section title="Plate History" icon={History}>
                            <div className="space-y-2">
                                {[...formData.previousRegistrations].reverse().map((reg: any, index: number) => (
                                    <div key={index} className="p-2 border rounded-lg bg-gray-50 text-xs flex justify-between border-gray-200">
                                        <span className="font-mono font-bold text-gray-700 tracking-tight">{reg.registration}</span>
                                        <span className="text-gray-500 italic">Ended {new Date(reg.changedAt).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export default VehicleFormModal;

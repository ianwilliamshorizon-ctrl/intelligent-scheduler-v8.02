
import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, Customer, Job, Estimate, Invoice } from '../types';
import FormModal from './FormModal';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { Loader2, Search, Briefcase, FileText, Edit2, History, Receipt, CalendarPlus, Eye } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuditLogger } from '../core/hooks/useAuditLogger';
import VehicleImageManager from './VehicleImageManager';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, addDays, dateStringToDate } from '../core/utils/dateUtils';

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
    vehicle: Partial<Vehicle> | null;
    customers: Customer[];
    jobs?: Job[];
    estimates?: Estimate[];
    invoices?: Invoice[];
    onViewJob?: (jobId: string) => void;
    onViewEstimate?: (estimate: Estimate) => void;
    onViewInvoice?: (invoice: Invoice) => void;
}

const VehicleFormModal: React.FC<VehicleFormModalProps> = ({ isOpen, onClose, onSave, vehicle, customers, jobs, estimates, invoices, onViewJob, onViewEstimate, onViewInvoice }) => {
    const [formData, setFormData] = useState<Partial<Vehicle>>({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const { logEvent } = useAuditLogger();
    const { currentUser } = useApp();
    const [isEditingReg, setIsEditingReg] = useState(false);

    useEffect(() => {
        const initialData = vehicle || {
            customerId: '',
            registration: '',
            make: '',
            model: '',
            transmissionType: 'Manual',
        };
        setFormData(initialData);
        setIsEditingReg(!vehicle?.id);
    }, [vehicle, isOpen]);

    // Calculate totals helpers
    const getInvoiceTotal = (inv: Invoice) => inv.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const getEstimateTotal = (est: Estimate) => est.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const vehicleJobs = useMemo(() => (jobs || []).filter(j => j.vehicleId === vehicle?.id).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [jobs, vehicle]);
    const vehicleEstimates = useMemo(() => (estimates || []).filter(e => e.vehicleId === vehicle?.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '')), [estimates, vehicle]);
    const vehicleInvoices = useMemo(() => (invoices || []).filter(i => i.vehicleId === vehicle?.id).sort((a,b) => (b.issueDate || '').localeCompare(a.issueDate || '')), [invoices, vehicle]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
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
            setFormData(prev => ({
                ...prev,
                make: details.make || prev.make,
                model: details.model || prev.model, // Keep current model if DVLA API returns empty
                colour: details.colour || prev.colour,
                fuelType: details.fuelType || prev.fuelType,
                cc: details.engineCapacity || prev.cc,
                nextMotDate: details.motExpiryDate || prev.nextMotDate,
                manufactureDate: details.monthOfFirstRegistration ? `${details.monthOfFirstRegistration}-01` : prev.manufactureDate
            }));
        } catch (error: any) {
            setLookupError(error.message);
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleMotIncrement = () => {
        if (formData.nextMotDate) {
            const currentMot = dateStringToDate(formData.nextMotDate);
            const nextYear = new Date(currentMot.setFullYear(currentMot.getFullYear() + 1));
            setFormData(prev => ({ ...prev, nextMotDate: formatDate(nextYear) }));
        } else {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            setFormData(prev => ({ ...prev, nextMotDate: formatDate(nextYear) }));
        }
    };

    const handleSave = () => {
        if (!formData.customerId || !formData.registration || !formData.make || !formData.model) {
            alert('Customer, Registration, Make, and Model are required.');
            return;
        }
        const isNew = !formData.id;
        let vehicleToSave = { ...formData };

        if (!isNew && vehicle?.registration && vehicle.registration !== vehicleToSave.registration) {
            const historyEntry: T.PreviousRegistration = {
                registration: vehicle.registration,
                changedAt: new Date().toISOString(),
                changedByUserId: currentUser.id,
            };

            vehicleToSave = {
                ...vehicleToSave,
                previousRegistrations: [...(vehicleToSave.previousRegistrations || []), historyEntry],
            };
        }

        const finalVehicle: Vehicle = {
            id: vehicleToSave.id || crypto.randomUUID(),
            ...vehicleToSave,
        } as Vehicle;
        
        onSave(finalVehicle);
        logEvent(isNew ? 'CREATE' : 'UPDATE', 'Vehicle', finalVehicle.id, `${isNew ? 'Created' : 'Updated'} vehicle: ${finalVehicle.registration}.`);
    };

    const handleImageUpdate = (updatedVehicle: Vehicle) => {
        setFormData(updatedVehicle);
    };

    const statusStyles: { [key in T.Invoice['status']]: string } = {
        Draft: 'bg-gray-200 text-gray-800',
        Sent: 'bg-blue-200 text-blue-800',
        'Part Paid': 'bg-amber-200 text-amber-800',
        Paid: 'bg-green-200 text-green-800',
        Overdue: 'bg-red-200 text-red-800',
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={vehicle?.id ? 'Edit Vehicle' : 'Add Vehicle'} maxWidth="max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-4">
                    {/* Added items-start to align top when one column is taller */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Owner*</label>
                            <SearchableSelect
                                options={customers.map(c => ({ id: c.id, label: `${c.forename} ${c.surname} (${c.postcode || 'No postcode'})` }))}
                                value={formData.customerId || null}
                                onChange={(value) => setFormData(prev => ({...prev, customerId: value || ''}))}
                                placeholder="Search customers..."
                            />
                        </div>
                        
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Registration (VRM Lookup)*</label>
                             <div className="relative">
                                <input 
                                    name="registration" 
                                    value={formData.registration || ''} 
                                    onChange={handleChange} 
                                    className="w-full p-2 border rounded disabled:bg-gray-200 pr-10" 
                                    required 
                                    disabled={!isEditingReg}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleLookup(formData.registration!)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors disabled:opacity-50"
                                    disabled={isLookingUp || !formData.registration}
                                    title="Refresh / Lookup VRM"
                                >
                                    {isLookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                </button>
                            </div>
                            {!isEditingReg && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditingReg(true)}
                                    className="text-xs text-yellow-700 underline mt-1"
                                >
                                    Manually Edit Reg
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

                        {lookupError && <p className="text-sm text-red-600 md:col-span-3 -mt-2">{lookupError}</p>}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
                            <input name="colour" value={formData.colour || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Engine CC</label>
                            <input name="cc" type="number" value={formData.cc || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                            <input name="fuelType" value={formData.fuelType || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                            <input name="vin" value={formData.vin || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Engine No.</label>
                            <input name="engineNumber" value={formData.engineNumber || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                            <select name="transmissionType" value={formData.transmissionType || 'Manual'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                                <option>Manual</option>
                                <option>Automatic</option>
                                <option>Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Next Service Due</label>
                            <input name="nextServiceDate" type="date" value={formData.nextServiceDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Next MOT Due</label>
                            <div className="flex gap-1">
                                <input name="nextMotDate" type="date" value={formData.nextMotDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                <button
                                    type="button"
                                    onClick={handleMotIncrement}
                                    className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs font-semibold whitespace-nowrap flex items-center gap-1"
                                    title="Update MOT date by 1 year"
                                >
                                    <CalendarPlus size={14} /> +1 Yr
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Winter Check</label>
                            <input name="winterCheckDate" type="date" value={formData.winterCheckDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fleet Number</label>
                            <input name="fleetNumber" value={formData.fleetNumber || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date</label>
                            <input name="manufactureDate" type="date" value={formData.manufactureDate || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div className="flex items-center pt-6">
                            <input type="checkbox" id="covid19MotExemption" name="covid19MotExemption" checked={formData.covid19MotExemption || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor="covid19MotExemption" className="ml-2 block text-sm font-medium text-gray-700">COVID-19 MOT Exemption</label>
                        </div>
                    </div>
                     {formData.id && <VehicleImageManager vehicle={formData as Vehicle} onUpdateVehicle={handleImageUpdate} />}
                </div>

                 <div className="md:col-span-2 space-y-4">
                    {vehicle?.id && jobs && estimates && invoices && (
                        <Section title="Vehicle History" icon={Briefcase}>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {vehicleJobs.length === 0 && vehicleEstimates.length === 0 && vehicleInvoices.length === 0 && (
                                    <p className="text-sm text-gray-500">No history found for this vehicle.</p>
                                )}

                                {vehicleJobs.length > 0 && (
                                    <div>
                                        <h5 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1 sticky top-0 bg-white py-1 border-b">
                                            <Briefcase size={12}/> Jobs ({vehicleJobs.length})
                                        </h5>
                                        <div className="space-y-1">
                                            {vehicleJobs.map(job => (
                                                <div 
                                                    key={`job-${job.id}`} 
                                                    className="text-xs grid grid-cols-[80px_1fr_auto_auto] items-center gap-2 p-2 border rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition"
                                                    onClick={() => onViewJob && onViewJob(job.id)}
                                                >
                                                    <span className="text-gray-500">{job.createdAt}</span>
                                                    <span className="truncate font-medium">{job.description}</span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] self-start ${
                                                        job.status === 'Complete' || job.status === 'Invoiced' ? 'bg-green-200 text-green-800' : 
                                                        job.status === 'Closed' ? 'bg-gray-300 text-gray-800' :
                                                        'bg-blue-200 text-blue-800'}`}>{job.status}</span>
                                                    <Eye size={16} className="text-gray-400 justify-self-end" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {vehicleEstimates.length > 0 && (
                                    <div>
                                        <h5 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1 sticky top-0 bg-white py-1 border-b mt-2">
                                            <FileText size={12}/> Estimates ({vehicleEstimates.length})
                                        </h5>
                                        <div className="space-y-1">
                                            {vehicleEstimates.map(est => (
                                                <div 
                                                    key={`est-${est.id}`} 
                                                    className="text-xs grid grid-cols-[80px_1fr_auto_auto] items-center gap-2 p-2 border rounded-lg bg-yellow-50 hover:bg-yellow-100 cursor-pointer transition"
                                                    onClick={() => onViewEstimate && onViewEstimate(est)}
                                                >
                                                    <span className="text-gray-500">{est.issueDate}</span>
                                                    <span className="truncate font-medium">#{est.estimateNumber}</span>
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className="font-mono font-semibold">{formatCurrency(getEstimateTotal(est))}</span>
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] mt-0.5 ${est.status === 'Approved' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{est.status}</span>
                                                    </div>
                                                    <Eye size={16} className="text-gray-400 justify-self-end" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {vehicleInvoices.length > 0 && (
                                    <div>
                                        <h5 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1 sticky top-0 bg-white py-1 border-b mt-2">
                                            <Receipt size={12}/> Invoices ({vehicleInvoices.length})
                                        </h5>
                                        <div className="space-y-1">
                                            {vehicleInvoices.map(inv => (
                                                <div 
                                                    key={`inv-${inv.id}`} 
                                                    className="text-xs grid grid-cols-[80px_1fr_auto_auto] items-center gap-2 p-2 border rounded-lg bg-green-50 hover:bg-green-100 cursor-pointer transition"
                                                    onClick={() => onViewInvoice && onViewInvoice(inv)}
                                                >
                                                    <span className="text-gray-500">{inv.issueDate}</span>
                                                    <span className="truncate font-medium">#{inv.id}</span>
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className="font-mono font-semibold">{formatCurrency(getInvoiceTotal(inv))}</span>
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] mt-0.5 ${statusStyles[inv.status]}`}>{inv.status}</span>
                                                    </div>
                                                    <Eye size={16} className="text-gray-400 justify-self-end" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}
                    {vehicle?.previousRegistrations && vehicle.previousRegistrations.length > 0 && (
                        <Section title="Registration History" icon={History}>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                <div className="p-2 border-2 border-indigo-200 rounded-lg bg-indigo-50/70 text-xs">
                                    <div className="flex justify-between items-center">
                                        <p className="font-mono font-bold text-indigo-800">{vehicle.registration}</p>
                                        <p className="font-semibold text-indigo-700">Current</p>
                                    </div>
                                </div>
                                {[...vehicle.previousRegistrations].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()).map((reg, index) => (
                                    <div key={index} className="p-2 border rounded-lg bg-gray-50/70 text-xs">
                                        <div className="flex justify-between items-center">
                                            <p className="font-mono font-semibold">{reg.registration}</p>
                                            <p className="text-gray-500">{new Date(reg.changedAt).toLocaleDateString()}</p>
                                        </div>
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

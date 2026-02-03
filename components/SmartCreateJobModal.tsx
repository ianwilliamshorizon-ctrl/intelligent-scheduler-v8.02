import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Wand2, Check, Car, Plus, Trash2 } from 'lucide-react';
import { parseJobRequest, generateEstimateFromDescription } from '../core/services/geminiService';
import { Vehicle, ServicePackage, Customer, EstimateLineItem, Part } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
import { searchDocuments } from '../core/db/index'; 
import SearchableSelect from './SearchableSelect';

interface SmartCreateJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    creationMode: 'job' | 'estimate';
    onJobCreate: (jobData: any) => void;
    onVehicleAndJobCreate: (customer: Customer, vehicle: Vehicle, jobData: any) => void;
    onEstimateCreate: (estimateData: any) => void;
    onVehicleAndEstimateCreate: (customer: Customer, vehicle: Vehicle, estimateData: any) => void;
    vehicles: Vehicle[];
    customers: Customer[];
    servicePackages: ServicePackage[];
    defaultDate?: string | null;
    initialPrompt?: string | null;
}

const SmartCreateJobModal: React.FC<SmartCreateJobModalProps> = ({ 
    isOpen, 
    onClose, 
    creationMode,
    onJobCreate, 
    onVehicleAndJobCreate, 
    onEstimateCreate,
    onVehicleAndEstimateCreate,
    vehicles, 
    customers, 
    servicePackages, 
    defaultDate,
    initialPrompt,
}) => {
    // ⚡ Performance: Removed 'parts' from useData to avoid loading 21k array
    const { taxRates } = useData();
    const { filteredBusinessEntities: businessEntities, selectedEntityId } = useApp();

    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [parsedJob, setParsedJob] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    
    const [isGeneratingAiEstimate, setIsGeneratingAiEstimate] = useState(false);
    const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
    const [optionalItems, setOptionalItems] = useState<EstimateLineItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showAddNewVehicle, setShowAddNewVehicle] = useState(false);

    const isEstimateMode = creationMode === 'estimate';
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    useEffect(() => {
        if (isOpen) {
            setPrompt(initialPrompt || '');
            setParsedJob(null);
            setIsLoading(false);
            setError('');
            setVehicleExists(null);
            setFoundVehicle(null);
            setIsGeneratingAiEstimate(false);
            setLineItems([]);
            setOptionalItems([]);
            setNotes('');
            setShowAddNewVehicle(false);

            if (initialPrompt) {
               setTimeout(() => handleParseRequest(initialPrompt), 100);
           }
        }
    }, [isOpen, initialPrompt]);

    // ⚡ HOT PATH: Denormalize details so the dashboard/list doesn't lag
    const attachDisplayDetails = (data: any, customer: Customer, vehicle: Vehicle) => {
        return {
            ...data,
            displayDetails: {
                customerName: `${customer.forename} ${customer.surname}`,
                vehicleReg: vehicle.registration,
                vehicleModel: `${vehicle.make} ${vehicle.model}`
            }
        };
    };

    const handleParseRequest = async (promptOverride?: string) => {
        const currentPrompt = promptOverride || prompt;
        if (!currentPrompt.trim()) {
            setError('Please enter a description.');
            return;
        }
        setIsLoading(true);
        setError('');
        
        try {
            const contextDate = defaultDate || formatDate(new Date());
            let finalResult = await parseJobRequest(currentPrompt, servicePackages, contextDate);

            const registration = finalResult.vehicleRegistration?.toUpperCase().replace(/\s/g, '');
            if (!registration) throw new Error("Could not identify a vehicle registration.");

            const found = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === registration);
            
            if (found && (!finalResult.servicePackageNames || finalResult.servicePackageNames.length === 0)) {
                finalResult = await parseJobRequest(currentPrompt, servicePackages, contextDate, { make: found.make, model: found.model });
            }

            if (!finalResult.scheduledDate && defaultDate && !isEstimateMode) {
                finalResult.scheduledDate = defaultDate;
            }
            
            setParsedJob(finalResult);
            setNotes(finalResult.notes || '');
            
            if (found) {
                setVehicleExists(true);
                setFoundVehicle(found);
            } else {
                setVehicleExists(false);
                if (!isEstimateMode) setShowAddNewVehicle(true);
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalCreate = () => {
        if (!foundVehicle) {
            setShowAddNewVehicle(true);
            return;
        }

        const customer = customers.find(c => c.id === foundVehicle.customerId);
        if (!customer) return setError("Associated customer not found.");

        if (isEstimateMode) {
            const estimateData = attachDisplayDetails({
                ...parsedJob,
                customerId: customer.id,
                vehicleId: foundVehicle.id,
                vehicleRegistration: foundVehicle.registration,
                lineItems,
                notes,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: 'Draft'
            }, customer, foundVehicle);
            onEstimateCreate(estimateData);
        } else {
            const jobData = attachDisplayDetails({
                ...parsedJob,
                customerId: customer.id,
                vehicleId: foundVehicle.id,
            }, customer, foundVehicle);
            onJobCreate(jobData);
        }
        onClose();
    };

    const handleSaveNewVehicleAndCreate = (newCustomer: Customer, newVehicle: Vehicle) => {
        const baseData = isEstimateMode ? { 
            ...parsedJob, 
            lineItems, 
            notes,
            issueDate: getTodayISOString(),
            expiryDate: getFutureDateISOString(30),
            status: 'Draft' 
        } : parsedJob;

        const dataWithDisplay = attachDisplayDetails(baseData, newCustomer, newVehicle);

        if (isEstimateMode) {
            onVehicleAndEstimateCreate(newCustomer, newVehicle, dataWithDisplay);
        } else {
            onVehicleAndJobCreate(newCustomer, newVehicle, dataWithDisplay);
        }
        onClose();
    };

    const availablePackages = useMemo(() => {
        if (!foundVehicle) return servicePackages.filter(p => !p.applicableMake);
        return servicePackages.filter(p => {
            if (!p.applicableMake) return true;
            return p.applicableMake.toLowerCase() === foundVehicle.make.toLowerCase();
        });
    }, [servicePackages, foundVehicle]);

    const handleSelectPackage = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const headerItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: totalCost,
            isLabor: false, 
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
        };
        const childItems: EstimateLineItem[] = (pkg.costItems || []).map(ci => ({
            ...ci, id: crypto.randomUUID(), unitPrice: 0, servicePackageId: pkg.id, servicePackageName: pkg.name, isPackageComponent: true
        }));
        setLineItems(prev => [...prev, headerItem, ...childItems]);
    };

    const handleAiGenerate = async () => {
        setIsGeneratingAiEstimate(true);
        setError('');
        try {
            const entity = businessEntities.find(e => e.id === selectedEntityId);
            if (!entity) throw new Error("Could not find selected business entity.");

            // Pass empty parts array - we will fetch specifically what we need after the AI suggests them
            const { mainItems, optionalExtras, suggestedNotes } = await generateEstimateFromDescription(
                prompt,
                foundVehicle ? { make: foundVehicle.make, model: foundVehicle.model } : { make: 'Unknown', model: 'Unknown' },
                [], 
                availablePackages,
                entity.laborRate || 100
            );

            const processAiItems = async (items: any[], isOptional = false): Promise<EstimateLineItem[]> => {
                const newItems: EstimateLineItem[] = [];
                for (const item of items) {
                    if (item.servicePackageName) {
                        const pkg = servicePackages.find(p => p.name === item.servicePackageName);
                        if (pkg) handleSelectPackage(pkg.id);
                        continue;
                    }

                    const newItem: EstimateLineItem = {
                        id: crypto.randomUUID(),
                        description: item.description || '', 
                        quantity: item.quantity || 1,
                        isLabor: item.isLabor || false, 
                        taxCodeId: standardTaxRateId,
                        partNumber: item.partNumber, 
                        unitPrice: 0, 
                        unitCost: 0, 
                        isOptional,
                    };

                    if (item.isLabor) {
                        newItem.unitPrice = entity.laborRate || 0;
                        newItem.unitCost = entity.laborCostRate || 0;
                    } else if (item.partNumber) {
                        // ⚡ Performance: Fetch specifically by part number from the index
                        const searchResults = await searchDocuments('brooks_parts', 'partNumber', item.partNumber.toUpperCase());
                        if (searchResults && searchResults.length > 0) {
                            const partData = searchResults[0] as Part;
                            newItem.description = partData.description;
                            newItem.partId = partData.id;
                            newItem.unitPrice = partData.salePrice;
                            newItem.unitCost = partData.costPrice;
                            newItem.taxCodeId = partData.taxCodeId || standardTaxRateId;
                        }
                    }
                    newItems.push(newItem);
                }
                return newItems;
            };

            const processedMain = await processAiItems(mainItems);
            setLineItems(prev => [...prev, ...processedMain]);

            const processedOpt = await processAiItems(optionalExtras, true);
            setOptionalItems(prev => [...prev, ...processedOpt]);

            if (suggestedNotes) {
                setNotes(prev => prev ? `${prev}\n\n[AI Suggestions]\n${suggestedNotes}` : `[AI Suggestions]\n${suggestedNotes}`);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGeneratingAiEstimate(false);
        }
    };
    
    const handleRemoveLineItem = (id: string) => {
        const itemToRemove = lineItems.find(i => i.id === id);
        if (itemToRemove?.servicePackageId && !itemToRemove.isPackageComponent) {
            setLineItems(prev => prev.filter(li => li.servicePackageId !== itemToRemove.servicePackageId));
        } else {
            setLineItems(prev => prev.filter(li => li.id !== id));
        }
    };

    const handleAddOptionalItem = (itemToAdd: EstimateLineItem) => {
        setLineItems(prev => [...prev, { ...itemToAdd, isOptional: false }]);
        setOptionalItems(prev => prev.filter(item => item.id !== itemToAdd.id));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex-shrink-0 flex justify-between items-center border-b p-6">
                    <h2 className="text-2xl font-bold text-indigo-700 flex items-center"><Wand2 className="mr-2"/> {isEstimateMode ? 'Smart Estimate Builder' : 'Smart Job Creator'}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6">
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4 border border-red-100">{error}</div>}
                    
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={40} className="animate-spin text-indigo-600 mb-4"/>
                            <p className="font-semibold text-gray-700 text-lg">Analyzing your request...</p>
                        </div>
                    ) : !parsedJob ? (
                        <div className="animate-fade-in">
                            <p className="text-sm text-gray-600 mb-4 font-medium uppercase tracking-wider">Describe the {isEstimateMode ? 'work required' : 'job'} in plain English</p>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., Book an MOT and a Minor Service for the Ford Transit REG123 for tomorrow."
                                rows={4}
                                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            />
                            <button
                                onClick={() => handleParseRequest()}
                                className="mt-6 w-full flex justify-center items-center py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition"
                                disabled={isLoading}
                            >
                                <Wand2 size={20} className="mr-2" /> Parse {isEstimateMode ? 'Estimate' : 'Job'} Request
                            </button>
                        </div>
                    ) : isEstimateMode ? (
                        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {foundVehicle ? (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                        <p className="font-bold text-green-800 flex items-center gap-2"><Car size={18}/> Vehicle Identified</p>
                                        <p className="text-green-700">{foundVehicle.make} {foundVehicle.model} ({foundVehicle.registration})</p>
                                    </div>
                                ) : (
                                     <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="font-bold text-amber-800">Vehicle Not Found</p>
                                        <p className="text-sm text-amber-700">Reg: <span className="font-mono bg-amber-100 px-1 rounded">{parsedJob.vehicleRegistration}</span>. You can add the details at the end.</p>
                                    </div>
                                )}
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-white border rounded-xl shadow-sm">
                                        <h4 className="font-bold text-gray-700 mb-3 text-sm">Standard Service Packages</h4>
                                        <SearchableSelect
                                            options={availablePackages.map(p => ({ id: p.id, label: p.name }))}
                                            value={null}
                                            onChange={(id) => id && handleSelectPackage(id)}
                                            placeholder="Search & Add Package..."
                                        />
                                    </div>

                                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                        <h4 className="font-bold text-indigo-900 mb-1 text-sm">AI Detailed Generator</h4>
                                        <p className="text-xs text-indigo-700 mb-3 italic">Generates specific parts & labor from your prompt.</p>
                                        <button onClick={handleAiGenerate} disabled={isGeneratingAiEstimate} className="w-full flex justify-center items-center py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50">
                                            {isGeneratingAiEstimate ? <Loader2 size={18} className="animate-spin mr-2"/> : <Wand2 size={18} className="mr-2"/>}
                                            {isGeneratingAiEstimate ? 'Building...' : 'Generate with AI ✨'}
                                        </button>
                                    </div>

                                    {optionalItems.length > 0 && (
                                        <div className="p-4 bg-white border border-indigo-200 rounded-xl animate-fade-in">
                                            <h4 className="font-bold text-indigo-800 mb-3 text-sm italic">Suggested Extras</h4>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {optionalItems.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                                        <span className="text-xs font-medium text-indigo-900">{item.description}</span>
                                                        <button onClick={() => handleAddOptionalItem(item)} className="p-1 bg-white text-indigo-600 rounded-md shadow-sm border border-indigo-200"><Plus size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {showAddNewVehicle ? (
                                     <AddNewVehicleForm initialRegistration={parsedJob.vehicleRegistration} onSave={handleSaveNewVehicleAndCreate} onCancel={() => setShowAddNewVehicle(false)} customers={customers} saveButtonText="Save & Create Estimate" />
                                ) : (
                                    <div className="p-5 bg-white border rounded-xl shadow-md flex flex-col h-full">
                                        <h4 className="font-bold text-gray-800 mb-4 flex justify-between items-center uppercase text-xs tracking-widest">
                                            Estimate Review
                                            <span className="text-indigo-600">{lineItems.length} items</span>
                                        </h4>
                                        <div className="flex-grow space-y-2 overflow-y-auto pr-1 max-h-80 min-h-48 mb-4">
                                            {lineItems.length === 0 && <p className="text-sm text-gray-400 text-center py-10">Use AI or Packages to add items.</p>}
                                            {lineItems.map(item => (
                                                <div key={item.id} className={`p-3 rounded-lg border text-sm flex justify-between items-center ${item.isPackageComponent ? 'bg-gray-50 border-gray-100' : 'bg-white shadow-sm'}`}>
                                                    <div className="truncate">
                                                        <p className="font-bold text-gray-800">{item.quantity}x {item.description}</p>
                                                        {!item.isPackageComponent && <p className="text-[10px] text-gray-500 font-mono uppercase">{item.partNumber || 'Labour'}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-indigo-900">{item.isPackageComponent ? 'INC' : formatCurrency(item.unitPrice * item.quantity)}</span>
                                                        {!item.isPackageComponent && <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="border-t pt-4 mt-auto">
                                            <label className="font-bold text-gray-600 text-xs uppercase mb-1 block">Internal Notes</label>
                                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full p-2 border rounded-lg text-sm bg-gray-50" />
                                            <button onClick={handleFinalCreate} disabled={lineItems.length === 0} className="mt-4 w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50">
                                                <Check size={20} className="inline mr-2" /> Confirm & Create Estimate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in max-w-2xl mx-auto">
                            {showAddNewVehicle ? (
                                <AddNewVehicleForm initialRegistration={parsedJob.vehicleRegistration} onSave={handleSaveNewVehicleAndCreate} onCancel={() => setShowAddNewVehicle(false)} customers={customers} saveButtonText="Save & Book Job" />
                            ) : (
                                <div className="p-6 bg-gray-50 border rounded-2xl space-y-6">
                                    <h3 className="font-bold text-xl text-gray-800">Confirm Booking:</h3>
                                    {foundVehicle && (
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-green-200">
                                            <div className="p-3 bg-green-100 text-green-700 rounded-full"><Car size={24}/></div>
                                            <div>
                                                <p className="font-bold text-lg">{foundVehicle.registration}</p>
                                                <p className="text-gray-600">{foundVehicle.make} {foundVehicle.model}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="p-3 bg-white rounded-lg border">
                                            <p className="text-gray-500 font-bold uppercase text-[10px]">Date</p>
                                            <p className="font-semibold">{parsedJob.scheduledDate}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border">
                                            <p className="text-gray-500 font-bold uppercase text-[10px]">Work</p>
                                            <p className="font-semibold truncate">{parsedJob.description}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleFinalCreate} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">
                                        <Check size={20} className="inline mr-2" /> Confirm and Create Job
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartCreateJobModal;

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Wand2, Check, Car, Plus, Trash2 } from 'lucide-react';
import { parseJobRequest, generateEstimateFromDescription } from '../core/services/geminiService';
import { Vehicle, ServicePackage, Customer, EstimateLineItem, Part } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
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
    const { parts, taxRates } = useData();
    const { filteredBusinessEntities: businessEntities, selectedEntityId } = useApp();

    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [parsedJob, setParsedJob] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    
    // States for estimate builder
    const [isGeneratingAiEstimate, setIsGeneratingAiEstimate] = useState(false);
    const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
    const [optionalItems, setOptionalItems] = useState<EstimateLineItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showAddNewVehicle, setShowAddNewVehicle] = useState(false);

    const isEstimateMode = creationMode === 'estimate';
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    useEffect(() => {
        if (isOpen) {
            const promptToUse = initialPrompt || '';
            setPrompt(promptToUse);
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

            if (promptToUse) {
               // Use a timeout to allow the modal to render before starting the async operation
               setTimeout(() => handleParseRequest(promptToUse), 100);
           }
        }
    }, [isOpen, initialPrompt]);

    const handleParseRequest = async (promptOverride?: string) => {
        const currentPrompt = promptOverride || prompt;
        if (!currentPrompt.trim()) {
            setError('Please enter a description.');
            return;
        }
        setIsLoading(true);
        setError('');
        setParsedJob(null);
        setVehicleExists(null);
        setFoundVehicle(null);
        setNotes('');

        try {
            const contextDate = defaultDate || formatDate(new Date());
            let finalResult = await parseJobRequest(currentPrompt, servicePackages, contextDate);

            const registration = finalResult.vehicleRegistration?.toUpperCase().replace(/\s/g, '');
            if (!registration) {
                throw new Error("Could not identify a vehicle registration in your request.");
            }

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
                if (!isEstimateMode) {
                    setShowAddNewVehicle(true);
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalCreate = () => {
        if (!vehicleExists && isEstimateMode) {
            setShowAddNewVehicle(true);
            return;
        }

        if (isEstimateMode) {
            onEstimateCreate({
                ...parsedJob,
                vehicleRegistration: foundVehicle!.registration,
                lineItems,
                notes,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: 'Draft'
            });
        } else {
             onJobCreate(parsedJob);
        }
        handleClose();
    };

    const handleSaveNewVehicleAndCreate = (newCustomer: Customer, newVehicle: Vehicle) => {
        if (isEstimateMode) {
            onVehicleAndEstimateCreate(newCustomer, newVehicle, { 
                ...parsedJob, 
                lineItems, 
                notes,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: 'Draft'
            });
        } else {
            onVehicleAndJobCreate(newCustomer, newVehicle, parsedJob);
        }
        handleClose();
    };

    const handleClose = () => {
        onClose();
    };
    
    const availablePackages = useMemo(() => {
        if (!foundVehicle) return servicePackages.filter(p => !p.applicableMake);
        return servicePackages.filter(p => {
            if (!p.applicableMake) return true;
            if (p.applicableMake.toLowerCase() === foundVehicle.make.toLowerCase()) {
                return !p.applicableModel || p.applicableModel.toLowerCase() === foundVehicle.model.toLowerCase();
            }
            return false;
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
            isLabor: false, taxCodeId: standardTaxRateId,
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

            const { mainItems, optionalExtras, suggestedNotes } = await generateEstimateFromDescription(
                prompt,
                foundVehicle ? { make: foundVehicle.make, model: foundVehicle.model } : { make: 'Unknown', model: 'Unknown' },
                parts,
                availablePackages,
                entity.laborRate || 100
            );

            const processAiItems = (items: Partial<EstimateLineItem>[], isOptional = false): EstimateLineItem[] => {
                const newItems: EstimateLineItem[] = [];
                for (const item of items) {
                    if (item.servicePackageName) {
                        const pkg = servicePackages.find(p => p.name === item.servicePackageName);
                        if (pkg) handleSelectPackage(pkg.id);
                        continue;
                    }
                    const newItem: EstimateLineItem = {
                        id: crypto.randomUUID(),
                        description: item.description || '', quantity: item.quantity || 1,
                        isLabor: item.isLabor || false, taxCodeId: standardTaxRateId,
                        partNumber: item.partNumber, unitPrice: 0, unitCost: 0, isOptional,
                    };
                    if (item.isLabor) {
                        newItem.unitPrice = entity.laborRate || 0;
                        newItem.unitCost = entity.laborCostRate || 0;
                    } else if (item.partNumber) {
                        const part = parts.find(p => p.partNumber === item.partNumber);
                        if (part) {
                            newItem.description = part.description; newItem.partId = part.id;
                            newItem.unitPrice = part.salePrice; newItem.unitCost = part.costPrice;
                            newItem.taxCodeId = part.taxCodeId || standardTaxRateId;
                        }
                    }
                    newItems.push(newItem);
                }
                return newItems;
            };

            const processedMainItems = processAiItems(mainItems);
            setLineItems(prev => [...prev, ...processedMainItems]);

            const processedOptionalItems = processAiItems(optionalExtras, true);
            setOptionalItems(prev => [...prev, ...processedOptionalItems]);

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
        if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
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

    const renderInitialPrompt = () => (
        <div>
            <p className="text-sm text-gray-600 mb-4">Describe the {isEstimateMode ? 'work required' : 'job'} in plain English. {defaultDate ? `Date is pre-selected as ${defaultDate}.` : `Try: "Book an MOT and a Minor Service for the Ford Transit REG123 for tomorrow."`}</p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Minor service for Porsche 911 (REG456), should take about 6 hours..."
                rows={3}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <button
                onClick={() => handleParseRequest()}
                className="mt-4 w-full flex justify-center items-center py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-200"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Wand2 size={20} className="mr-2" />}
                {isLoading ? 'Analyzing...' : `Parse ${isEstimateMode ? 'Estimate' : 'Job'} Request`}
            </button>
        </div>
    );
    
    const renderJobConfirm = () => (
        <div className="animate-fade-in">
            {showAddNewVehicle ? (
                <div>
                    <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg text-amber-800 mb-4">
                        <p className="font-bold">Vehicle Not Found</p>
                        <p className="text-sm">Registration <span className="font-mono bg-amber-200 px-1 rounded">{parsedJob.vehicleRegistration}</span> is not in the system. Please add vehicle and customer details to proceed.</p>
                    </div>
                    <AddNewVehicleForm
                        initialRegistration={parsedJob.vehicleRegistration}
                        onSave={handleSaveNewVehicleAndCreate}
                        onCancel={handleClose}
                        customers={customers}
                        saveButtonText="Save & Create Job"
                    />
                </div>
            ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <h3 className="font-semibold text-lg text-gray-800">Please Confirm Job Details:</h3>
                    {foundVehicle && <div className="p-3 bg-green-100 border border-green-200 rounded-lg text-green-800">
                        <p className="font-bold flex items-center gap-2"><Car size={16}/> Vehicle Found</p>
                        <p><strong>Registration:</strong> {foundVehicle?.registration}</p>
                        <p><strong>Vehicle:</strong> {foundVehicle?.make} {foundVehicle?.model}</p>
                    </div>}
                    <div><strong>Description:</strong> {parsedJob.description}</div>
                    <div><strong>Date:</strong> {parsedJob.scheduledDate}</div>
                    <button onClick={handleFinalCreate} className="w-full flex justify-center items-center py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-200">
                        <Check size={20} className="mr-2" /> Confirm and Create Job
                    </button>
                </div>
            )}
        </div>
    );

    const renderEstimateBuilder = () => (
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                {foundVehicle ? (
                    <div className="p-3 bg-green-100 border border-green-200 rounded-lg text-sm">
                        <p className="font-bold flex items-center gap-2"><Car size={16}/> Vehicle Identified</p>
                        <p><strong>{foundVehicle.make} {foundVehicle.model}</strong> ({foundVehicle.registration})</p>
                    </div>
                ) : (
                     <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg text-sm">
                        <p className="font-bold">Vehicle Not Found</p>
                        <p>Registration <span className="font-mono bg-amber-200 px-1 rounded">{parsedJob.vehicleRegistration}</span> is not in the system. You can still build the estimate and add the vehicle at the end.</p>
                    </div>
                )}
                
                <div className="p-3 bg-gray-100 border rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">1. Add Standard Service Packages</h4>
                    <SearchableSelect
                        options={availablePackages.map(p => ({ id: p.id, label: p.name }))}
                        value={null}
                        onChange={(packageId) => { if (packageId) handleSelectPackage(packageId); }}
                        placeholder="Search & Add Package..."
                    />
                </div>

                <div className="p-3 bg-gray-100 border rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">2. Generate Detailed Items with AI</h4>
                    <p className="text-xs text-gray-600 mb-2">Based on your initial request: "{prompt}"</p>
                    <button onClick={handleAiGenerate} disabled={isGeneratingAiEstimate} className="w-full flex justify-center items-center py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-200 disabled:opacity-50">
                        {isGeneratingAiEstimate ? <Loader2 size={16} className="animate-spin mr-2"/> : <Wand2 size={16} className="mr-2"/>}
                        {isGeneratingAiEstimate ? 'Generating...' : 'Generate with AI ✨'}
                    </button>
                </div>
                {optionalItems.length > 0 && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-fade-in">
                        <h4 className="font-semibold text-indigo-800 mb-2">Suggested Optional Extras</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                            {optionalItems.map(item => (
                                <div key={item.id} className="w-full text-left flex justify-between items-center p-2 bg-white rounded-md border">
                                    <span className="text-sm">{item.description} (Qty: {item.quantity})</span>
                                    <button onClick={() => handleAddOptionalItem(item)} className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200" title="Add to estimate"><Plus size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {showAddNewVehicle ? (
                     <AddNewVehicleForm initialRegistration={parsedJob.vehicleRegistration} onSave={handleSaveNewVehicleAndCreate} onCancel={handleClose} customers={customers} saveButtonText={"Save & Create Estimate"} />
                ) : (
                    <div className="p-3 bg-white border rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">3. Review & Create Estimate</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {lineItems.length === 0 && <p className="text-sm text-gray-500 text-center p-4">No items added yet.</p>}
                            {lineItems.map(item => (
                                <div key={item.id} className={`p-2 rounded border text-sm flex justify-between items-center ${item.isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
                                    <div className="truncate pr-2">
                                        <p className="font-semibold">{item.quantity} x {item.description}</p>
                                        {!item.isPackageComponent && <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} each</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{item.isPackageComponent ? 'Included' : formatCurrency(item.unitPrice * item.quantity)}</span>
                                        {!item.isPackageComponent && <button onClick={() => handleRemoveLineItem(item.id)}><Trash2 size={14} className="text-red-500"/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                         <div className="mt-4">
                            <label className="font-semibold text-gray-800 text-sm">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                                className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Add any notes for the customer or technician..."
                            />
                        </div>
                        <button onClick={handleFinalCreate} disabled={lineItems.length === 0} className="mt-4 w-full flex justify-center items-center py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Check size={20} className="mr-2" /> Create Estimate
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="flex flex-col items-center justify-center p-8"><Loader2 size={32} className="animate-spin text-indigo-600"/><p className="mt-4 font-semibold text-gray-700">Analyzing your request...</p></div>;
        }

        if (!parsedJob) {
            return renderInitialPrompt();
        }

        if (isEstimateMode) {
            return renderEstimateBuilder();
        } else {
            return renderJobConfirm();
        }
    }

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] transform transition-all">
                <div className="flex-shrink-0 flex justify-between items-center border-b p-6">
                    <h2 className="text-2xl font-bold text-indigo-700 flex items-center"><Wand2 className="mr-2"/> {isEstimateMode ? 'Smart Estimate Builder' : 'Smart Job Creator'}</h2>
                    <button onClick={handleClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6">
                    {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm mb-4">{error}</div>}
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default SmartCreateJobModal;

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Wand2, Check, Car, Plus, Trash2, Calendar, AlertTriangle, Calculator, FileText, User, Phone, Mail, Edit, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import { parseJobRequest } from '../core/services/geminiService';
import { Vehicle, ServicePackage, Customer, EstimateLineItem, Job, Estimate } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString, splitJobIntoSegments } from '../core/utils/dateUtils';
import AddNewVehicleForm from './AddNewVehicleForm';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatCurrency } from '../utils/formatUtils';
import SearchableSelect from './SearchableSelect';
import { generateEstimateNumber, generateJobId } from '../core/utils/numberGenerators';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';

interface SmartCreateJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    creationMode: 'job' | 'estimate';
    onJobCreate: (jobData: Job) => void;
    onVehicleAndJobCreate: (customer: Customer, vehicle: Vehicle, jobData: Job) => void;
    onEstimateCreate: (estimateData: Estimate) => void;
    onVehicleAndEstimateCreate: (customer: Customer, vehicle: Vehicle, estimateData: Estimate) => void;
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
    const { taxRates, jobs, businessEntities, estimates, parts } = useData();
    const { selectedEntityId, currentUser } = useApp();

    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [parsedData, setParsedData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Core Entity States
    const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(defaultDate || getTodayISOString());
    
    // Builder States
    const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
    const [notes, setNotes] = useState('');
    const [showAddNewVehicle, setShowAddNewVehicle] = useState(false);

    const isEstimateMode = creationMode === 'estimate';
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    
    const selectedEntity = useMemo(() => businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0], [businessEntities, selectedEntityId]);

    useEffect(() => {
        if (isOpen) {
            const promptToUse = initialPrompt || '';
            setPrompt(promptToUse);
            setParsedData(null);
            setIsLoading(false);
            setError('');
            setVehicleExists(null);
            setFoundVehicle(null);
            setFoundCustomer(null);
            setLineItems([]);
            setNotes('');
            setShowAddNewVehicle(false);
            setSelectedDate(defaultDate || getTodayISOString());

            if (promptToUse) {
               setTimeout(() => handleParseRequest(promptToUse), 100);
           }
        }
    }, [isOpen, initialPrompt]);

    // Capacity Calculation
    const capacityStats = useMemo(() => {
        if (!selectedDate || !selectedEntity) return { allocated: 0, max: 0, available: 0, isOver: false, currentJobHours: 0 };
        
        // 1. Calculate existing load for this entity on this date
        const entityJobs = jobs.filter(j => j.entityId === selectedEntity.id);
        const allocatedHours = entityJobs
            .flatMap(j => j.segments || [])
            .filter(s => s.date === selectedDate && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + s.duration, 0);

        // 2. Calculate labor hours for the NEW job being built
        const currentJobHours = lineItems
            .filter(item => item.isLabor && !item.isOptional)
            .reduce((sum, item) => sum + item.quantity, 0);

        const max = selectedEntity.dailyCapacityHours || 40;
        const totalProjected = allocatedHours + currentJobHours;
        
        return {
            allocated: allocatedHours,
            max,
            available: Math.max(0, max - allocatedHours),
            currentJobHours,
            totalProjected,
            isOver: totalProjected > max
        };
    }, [jobs, selectedEntity, selectedDate, lineItems]);

    // Financial Totals
    const totals = useMemo(() => {
        const net = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const cost = lineItems.reduce((sum, item) => sum + (item.quantity * (item.unitCost || 0)), 0);
        // Approximation of VAT
        const vat = net * 0.2;
        const gross = net + vat; 
        const profit = net - cost;
        const margin = net > 0 ? (profit / net) * 100 : 0;
        
        return { net, vat, gross, cost, profit, margin };
    }, [lineItems]);
    
    // Sort and Filter Packages based on Vehicle Hierarchy
    const sortedPackages = useMemo(() => {
        if (!foundVehicle) {
            return servicePackages
                .filter(p => p.entityId === selectedEntity.id)
                .map(p => ({ 
                    id: p.id, 
                    label: p.name,
                    value: p.id,
                    badge: { text: 'Generic', className: 'bg-gray-100 text-gray-600' }
                }));
        }

        const vMake = (foundVehicle.make || '').toLowerCase().trim();
        const vModel = (foundVehicle.model || '').toLowerCase().trim();

        const scored = servicePackages
            .filter(p => p.entityId === selectedEntity.id)
            .map(pkg => {
                const pMake = (pkg.applicableMake || '').toLowerCase().trim();
                const pModel = (pkg.applicableModel || '').toLowerCase().trim();
                const pVariant = (pkg.applicableVariant || '').toLowerCase().trim();
                
                let score = -1;
                let matchType = 'Mismatch';
                let color = 'bg-gray-100 text-gray-400';

                if (!pMake) {
                    score = 0;
                    matchType = 'Generic';
                    color = 'bg-gray-100 text-gray-600';
                } else if (vMake === pMake || vMake.includes(pMake) || pMake.includes(vMake)) {
                    if (!pModel) {
                        score = 1;
                        matchType = 'Make Match';
                        color = 'bg-amber-100 text-amber-800';
                    } else if (vModel.includes(pModel)) {
                        if (!pVariant) {
                            score = 2;
                            matchType = 'Model Match';
                            color = 'bg-amber-100 text-amber-800';
                        } else if (vModel.includes(pVariant)) {
                            score = 3;
                            matchType = 'Exact Match';
                            color = 'bg-green-100 text-green-800';
                        } else {
                            score = 1.5;
                            matchType = 'Model Match';
                            color = 'bg-amber-100 text-amber-800';
                        }
                    } else {
                        score = 0.5;
                        matchType = 'Make Only';
                        color = 'bg-gray-100 text-gray-600';
                    }
                }
                return { pkg, score, matchType, color };
            });

        return scored
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score || a.pkg.name.localeCompare(b.pkg.name))
            .map(item => ({
                id: item.pkg.id,
                label: item.pkg.name,
                value: item.pkg.id,
                badge: { text: item.matchType, className: item.color }
            }));

    }, [servicePackages, foundVehicle, selectedEntity]);

    const handleParseRequest = async (promptOverride?: string) => {
        const currentPrompt = promptOverride || prompt;
        if (!currentPrompt.trim()) {
            setError('Please enter a description.');
            return;
        }
        setIsLoading(true);
        setError('');
        setParsedData(null);
        setLineItems([]);

        try {
            const contextDate = defaultDate || formatDate(new Date());
            let finalResult = await parseJobRequest(currentPrompt);

            // 1. Match Vehicle
            const registration = finalResult.vehicleRegistration?.toUpperCase().replace(/\s/g, '');
            let found = vehicles.find(v => v.registration.toUpperCase().replace(/\s/g, '') === registration);
            
            // If found, fetch latest technical data (VIN, MOT) to satisfy "front sheet" update requirement
            if (found) {
                try {
                    const latestDetails = await lookupVehicleByVRM(found.registration);
                    found = {
                        ...found,
                        vin: latestDetails.vin || found.vin,
                        nextMotDate: latestDetails.nextMotDate || found.nextMotDate,
                    };
                } catch (apiErr) {
                    console.warn('Vehicle technical data lookup failed during smart create:', apiErr);
                }
            }
            
            // Re-parse with vehicle context if needed - reducing arguments to match current API signature
            if (found && (!finalResult.servicePackageNames || finalResult.servicePackageNames.length === 0)) {
                // We simplify the call to match the single-argument signature in geminiService.ts
                const secondaryPrompt = `${currentPrompt} (Context: Vehicle is a ${found.make} ${found.model})`;
                finalResult = await parseJobRequest(secondaryPrompt);
            }

            if (finalResult.scheduledDate) setSelectedDate(finalResult.scheduledDate);
            
            setParsedData(finalResult);
            setNotes(finalResult.notes || '');
            
            if (found) {
                setVehicleExists(true);
                setFoundVehicle(found);
                const cust = customers.find(c => c.id === found.customerId);
                setFoundCustomer(cust || null);
            } else {
                setVehicleExists(false);
                setFoundVehicle(null);
                
                // 2. Match Customer if Vehicle not found
                if (finalResult.customerName) {
                    const lowerName = finalResult.customerName.toLowerCase();
                    const matchedCust = customers.find(c => getCustomerDisplayName(c).toLowerCase().includes(lowerName));
                    setFoundCustomer(matchedCust || null);
                } else {
                    setFoundCustomer(null);
                }
            }

            // Auto-populate line items if packages detected
            if (finalResult.servicePackageNames && finalResult.servicePackageNames.length > 0) {
                finalResult.servicePackageNames.forEach((pkgName: string) => {
                    const pkg = servicePackages.find(p => p.name === pkgName);
                    if (pkg) handleSelectPackage(pkg.id);
                });
            } else if (finalResult.estimatedHours) {
                // Add generic labor if no package but hours found
                setLineItems(prev => [...prev, {
                    id: crypto.randomUUID(),
                    description: finalResult.description || 'Labor',
                    quantity: finalResult.estimatedHours,
                    unitPrice: selectedEntity.laborRate || 0,
                    unitCost: selectedEntity.laborCostRate || 0,
                    isLabor: true,
                    taxCodeId: standardTaxRateId
                }]);
            } else {
                // Default if nothing specific found
                setLineItems(prev => [...prev, {
                    id: crypto.randomUUID(),
                    description: finalResult.description || 'Diagnosis / Inspection',
                    quantity: 1,
                    unitPrice: selectedEntity.laborRate || 0,
                    unitCost: selectedEntity.laborCostRate || 0,
                    isLabor: true,
                    taxCodeId: standardTaxRateId
                }]);
            }

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalCreate = () => {
        try {
            if (!vehicleExists && !foundVehicle) {
                setShowAddNewVehicle(true);
                return;
            }
            if (!selectedEntity) {
                setError("Business entity configuration missing. Please contact admin.");
                return;
            }

            const entityShortCode = selectedEntity.shortCode || 'UNK';
            const newEstimateId = `est_${Date.now()}`;
            
            // Check for standalone MOT
            const isStandaloneMOT = lineItems.length > 0 && 
                                  lineItems.every(li => li.servicePackageName?.toUpperCase().includes('MOT'));

            const newEstimate: Estimate = {
                id: newEstimateId,
                estimateNumber: generateEstimateNumber(estimates, entityShortCode),
                entityId: selectedEntity.id,
                customerId: foundVehicle!.customerId,
                vehicleId: foundVehicle!.id,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: isEstimateMode ? 'Draft' : 'Converted to Job',
                lineItems: lineItems.map(li => ({ ...li, isCourtesyCar: isStandaloneMOT })),
                notes: notes,
                createdByUserId: currentUser.id,
                jobId: isEstimateMode ? undefined : 'pending_creation' // Will be updated below
            };

            if (isEstimateMode) {
                onEstimateCreate(newEstimate);
                handleClose();
                return;
            }

            // 2. Create Job (If Job Mode)
            const totalHours = lineItems.filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
            // Ensure at least 0.5 hours for any job so it gets a segment
            const validEstimatedHours = Math.max(0.5, totalHours);
            
            const newJobId = generateJobId(jobs, entityShortCode);
            
            const newJob: Job = {
                id: newJobId,
                entityId: selectedEntity.id,
                vehicleId: foundVehicle!.id,
                customerId: foundVehicle!.customerId,
                description: parsedData?.description || 'New Job',
                estimatedHours: validEstimatedHours,
                scheduledDate: selectedDate,
                status: 'Unallocated', // Initial status
                createdAt: getTodayISOString(),
                createdByUserId: currentUser.id,
                segments: [], // Generated below
                estimateId: newEstimate.id,
                notes: notes,
                vehicleStatus: 'Awaiting Arrival',
                partsStatus: lineItems.some(li => 
                    !li.fromStock &&
                    (!li.servicePackageId || li.isPackageComponent === true) &&
                    (li.unitCost || 0) > 0
                ) ? 'Awaiting Order' : 'Not Required',
                purchaseOrderIds: undefined,
                isStandalone: isStandaloneMOT
            };

            // CRITICAL: Generate segments based on the new job data so it appears on the timeline/unallocated list
            const segments = splitJobIntoSegments(newJob);
            newJob.segments = segments;
            
            // Link estimate to job
            newEstimate.jobId = newJobId;

            // Save both
            onEstimateCreate(newEstimate);
            onJobCreate(newJob);
            
            handleClose();
        } catch (e: any) {
            console.error("Failed to create job:", e);
            setError(`Failed to create: ${e.message}`);
        }
    };

    const handleSaveNewVehicleAndCreate = (newCustomer: Customer, newVehicle: Vehicle) => {
        try {
            setFoundVehicle(newVehicle);
            setFoundCustomer(newCustomer);
            setVehicleExists(true);
            
            const entityShortCode = selectedEntity?.shortCode || 'UNK';
            const newEstimateId = `est_${Date.now()}`;
            
            const isStandaloneMOT = lineItems.length > 0 && 
                                  lineItems.every(li => li.servicePackageName?.toUpperCase().includes('MOT'));

            const newEstimate: Estimate = {
                id: newEstimateId,
                estimateNumber: generateEstimateNumber(estimates, entityShortCode),
                entityId: selectedEntity.id,
                customerId: newCustomer.id,
                vehicleId: newVehicle.id,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: isEstimateMode ? 'Draft' : 'Converted to Job',
                lineItems: lineItems.map(li => ({ ...li, isCourtesyCar: isStandaloneMOT })),
                notes: notes,
                createdByUserId: currentUser.id
            };

            if (isEstimateMode) {
                 onVehicleAndEstimateCreate(newCustomer, newVehicle, newEstimate);
            } else {
                 const totalHours = lineItems.filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
                 const validEstimatedHours = Math.max(0.5, totalHours);
                 
                 const newJobId = generateJobId(jobs, entityShortCode);
                 const newJob: Job = {
                    id: newJobId,
                    entityId: selectedEntity.id,
                    vehicleId: newVehicle.id,
                    customerId: newCustomer.id,
                    description: parsedData?.description || 'New Job',
                    estimatedHours: validEstimatedHours,
                    scheduledDate: selectedDate,
                    status: 'Unallocated',
                    createdAt: getTodayISOString(),
                    createdByUserId: currentUser.id,
                    segments: [],
                    estimateId: newEstimate.id,
                    notes: notes,
                    vehicleStatus: 'Awaiting Arrival',
                    partsStatus: lineItems.some(li => 
                    !li.fromStock &&
                    (!li.servicePackageId || li.isPackageComponent === true) &&
                    (li.unitCost || 0) > 0
                ) ? 'Awaiting Order' : 'Not Required',
                    isStandalone: isStandaloneMOT
                };
                
                newJob.segments = splitJobIntoSegments(newJob);
                
                newEstimate.jobId = newJobId;
                onVehicleAndJobCreate(newCustomer, newVehicle, newJob);
                onEstimateCreate(newEstimate); 
            }
            handleClose();
        } catch (e: any) {
            console.error("Failed to create new vehicle and job:", e);
            setError(`Failed to save: ${e.message}`);
        }
    };

    const handleClose = () => {
        onClose();
    };

    // --- Builder Actions ---
    
    const handleSelectPackage = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        
        // FIX: Header cost set to 0. Children items will carry the cost.
        const headerItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: 0, // Cost is distributed among children to avoid double counting
            isLabor: false, taxCodeId: standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
        };
        const childItems: EstimateLineItem[] = (pkg.costItems || []).map(ci => {
            const part = ci.partId ? (parts || []).find(p => p.id === ci.partId) : null;
            return {
                ...ci, 
                id: crypto.randomUUID(), 
                unitPrice: 0, 
                servicePackageId: pkg.id, 
                servicePackageName: pkg.name, 
                isPackageComponent: true,
                fromStock: ci.fromStock ?? (ci.isLabor ? true : (part?.isStockItem && part.stockQuantity > 0))
            };
        });
        setLineItems(prev => [...prev, headerItem, ...childItems]);
    };

    const handleAddLabor = () => {
        setLineItems(prev => [...prev, {
            id: crypto.randomUUID(),
            description: 'Labor',
            quantity: 1,
            unitPrice: selectedEntity.laborRate || 0,
            unitCost: selectedEntity.laborCostRate || 0,
            isLabor: true,
            fromStock: true,
            taxCodeId: standardTaxRateId
        }]);
    };

    const handleAddPart = () => {
        setLineItems(prev => [...prev, {
            id: crypto.randomUUID(),
            description: 'Part',
            quantity: 1,
            unitPrice: 0,
            unitCost: 0,
            isLabor: false,
            fromStock: false,
            taxCodeId: standardTaxRateId
        }]);
    };

    const handleRemoveLineItem = (id: string) => {
        const itemToRemove = lineItems.find(i => i.id === id);
        if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
            setLineItems(prev => prev.filter(li => li.servicePackageId !== itemToRemove.servicePackageId));
        } else {
            setLineItems(prev => prev.filter(li => li.id !== id));
        }
    };
    
    const handleLineItemChange = (id: string, field: keyof EstimateLineItem, value: any) => {
        setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleCustomerSelect = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        setFoundCustomer(customer || null);
    };

    // --- Renderers ---

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
    
    const renderBuilder = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
            {/* Left Column: Context Blocks */}
            <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2">
                 
                 {/* Customer Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
                     <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><User size={16}/> Customer</h3>
                     {foundCustomer ? (
                         <div className="text-sm space-y-1">
                             <div className="flex justify-between items-start">
                                 <p className="font-semibold text-indigo-700">{getCustomerDisplayName(foundCustomer)}</p>
                                 <button onClick={() => setFoundCustomer(null)} className="text-xs text-gray-400 hover:text-gray-600"><Edit size={12}/></button>
                             </div>
                             <p className="flex items-center gap-2 text-gray-600"><Phone size={12}/> {foundCustomer.mobile || foundCustomer.phone || 'N/A'}</p>
                             <p className="flex items-center gap-2 text-gray-600"><Mail size={12}/> {foundCustomer.email || 'N/A'}</p>
                         </div>
                     ) : (
                         <div className="space-y-2">
                             <div className="p-2 bg-amber-50 text-amber-800 rounded text-sm mb-2">
                                 {parsedData?.customerName ? `AI Suggested: "${parsedData.customerName}"` : 'Customer not identified.'}
                             </div>
                             <SearchableSelect 
                                options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c), value: c.id }))}
                                initialValue={null}
                                onSelect={(val) => val && handleCustomerSelect(val)}
                                placeholder="Search existing customer..."
                             />
                             <div className="text-center text-xs text-gray-500">- OR -</div>
                             <button onClick={() => setShowAddNewVehicle(true)} className="w-full py-1.5 text-xs bg-indigo-50 text-indigo-700 font-semibold rounded hover:bg-indigo-100">Create New Customer</button>
                         </div>
                     )}
                 </div>

                 {/* Vehicle Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><Car size={16}/> Vehicle</h3>
                    {foundVehicle ? (
                        <div className="text-sm space-y-1">
                            <div className="p-2 bg-green-50 text-green-800 rounded text-sm mb-2 flex items-center gap-2">
                                <Check size={14}/> <strong>{foundVehicle.registration}</strong>
                            </div>
                             <p className="text-gray-600 font-medium">{foundVehicle.make} {foundVehicle.model}</p>
                             <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
                                 <div>
                                     <label className="text-[10px] uppercase font-bold text-gray-400">VIN Number</label>
                                     <p className="text-xs font-mono bg-gray-50 p-1 rounded border overflow-hidden truncate" title={foundVehicle.vin}>{foundVehicle.vin || 'Not Set'}</p>
                                 </div>
                                 <div>
                                     <label className="text-[10px] uppercase font-bold text-gray-400">Next MOT Date</label>
                                     <p className={`text-xs p-1 rounded border ${foundVehicle.nextMotDate ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'}`}>
                                         {foundVehicle.nextMotDate || 'Missing'}
                                     </p>
                                 </div>
                             </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="p-2 bg-red-50 text-red-800 rounded text-sm mb-2">
                                 Registration <strong>{parsedData?.vehicleRegistration || 'UNKNOWN'}</strong> not found.
                            </div>
                            {!showAddNewVehicle && (
                                <button onClick={() => setShowAddNewVehicle(true)} className="w-full py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 text-xs shadow-sm">
                                    Add New Vehicle
                                </button>
                            )}
                        </div>
                    )}
                 </div>

                 {/* Financial Summary Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 space-y-2">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><Wallet size={16}/> Financial Summary</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Total Cost Price:</span>
                            <span>{formatCurrency(totals.cost)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Total Sale Price (Net):</span>
                            <span>{formatCurrency(totals.net)}</span>
                        </div>
                         <div className="flex justify-between text-green-700 font-bold pt-1 border-t border-dashed">
                            <span>Total Profit:</span>
                            <span>{formatCurrency(totals.profit)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Profit Margin:</span>
                            <span>{totals.margin.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-indigo-700 pt-1 border-t mt-1">
                            <span>Total Gross:</span>
                            <span>{formatCurrency(totals.gross)}</span>
                        </div>
                    </div>
                </div>

                 {/* Notes Block */}
                 <div className="bg-white rounded-lg border shadow-sm p-4 flex-grow flex flex-col min-h-[150px]">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2 mb-2"><FileText size={16}/> Notes</h3>
                    <textarea 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)} 
                        className="w-full flex-grow p-2 border rounded resize-none text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Job instructions..."
                    />
                 </div>

                 {/* Date & Capacity (Only in Job Mode) */}
                 {!isEstimateMode && (
                     <div className={`p-4 rounded-lg border bg-white shadow-sm ${capacityStats.isOver ? 'border-red-300' : ''}`}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                            <Calendar size={16}/> Scheduled Date
                        </label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-2 border rounded mb-3 bg-gray-50"/>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                                <span>Workshop Capacity</span>
                                <span className={capacityStats.isOver ? 'text-red-600' : 'text-gray-600'}>
                                    {capacityStats.totalProjected.toFixed(1)} / {capacityStats.max} hrs
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden flex">
                                <div className="bg-gray-500 h-2.5" style={{ width: `${Math.min(100, (capacityStats.allocated / capacityStats.max) * 100)}%` }} title="Existing Jobs"></div>
                                <div className={`h-2.5 ${capacityStats.isOver ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (capacityStats.currentJobHours / capacityStats.max) * 100)}%` }} title="This Job"></div>
                            </div>
                            {capacityStats.isOver && <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={12}/> Over Capacity!</p>}
                        </div>
                     </div>
                 )}
            </div>

            {/* Right Column: Line Items */}
            <div className="lg:col-span-2 flex flex-col h-full overflow-hidden border rounded-lg bg-gray-50">
                 {showAddNewVehicle ? (
                    <div className="p-4 overflow-y-auto">
                        <AddNewVehicleForm
                            initialRegistration={parsedData.vehicleRegistration}
                            onSave={handleSaveNewVehicleAndCreate}
                            onCancel={() => setShowAddNewVehicle(false)}
                            customers={customers}
                            vehicles={vehicles}
                            saveButtonText={`Save & Create ${isEstimateMode ? 'Estimate' : 'Job'}`}
                        />
                    </div>
                 ) : (
                    <>
                        <div className="p-4 bg-white border-b flex-shrink-0">
                             <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><DollarSign size={18}/> Work Items & Costs</h3>
                             <div className="flex gap-2 mb-2">
                                <div className="flex-grow">
                                <SearchableSelect 
                                    options={sortedPackages}
                                    initialValue={null}
                                    onSelect={(val) => val && handleSelectPackage(val)}
                                    placeholder="+ Add Service Package..."
                                />
                                </div>
                             </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 space-y-2">
                            {lineItems.length === 0 && <p className="text-center text-gray-400 italic py-10">No items added. Add packages or items to build the job.</p>}
                            {lineItems.map(item => (
                                <div key={item.id} className={`flex items-center gap-2 p-2 rounded border text-sm ${item.isPackageComponent ? 'bg-gray-100 ml-4' : 'bg-white shadow-sm'}`}>
                                    <input 
                                        value={item.description} 
                                        onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                                        className="flex-grow p-1 border rounded bg-transparent"
                                        placeholder="Description"
                                        disabled={!!item.isPackageComponent}
                                    />
                                    <div className="flex items-center gap-1 w-24">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value))}
                                            className="w-12 p-1 border rounded text-right"
                                            disabled={!!item.servicePackageId && !item.isPackageComponent} // Package header qty locked usually
                                        />
                                        <span className="text-xs text-gray-500">{item.isLabor ? 'hrs' : 'qty'}</span>
                                    </div>
                                    <div className="w-24 text-right font-mono">
                                        {formatCurrency(item.unitPrice * item.quantity)}
                                    </div>
                                    {!item.isPackageComponent && (
                                        <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Financial Summary Footer */}
                        <div className="p-4 bg-white border-t flex-shrink-0 space-y-3">
                             <div className="flex gap-2">
                                <button onClick={handleAddLabor} className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-semibold flex items-center gap-1"><Plus size={14}/> Labor</button>
                                <button onClick={handleAddPart} className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-semibold flex items-center gap-1"><Plus size={14}/> Part</button>
                            </div>
                            <div className="flex justify-between items-center font-bold text-lg text-gray-800">
                                <span>Total Estimated Cost:</span>
                                <span className="text-indigo-700">{formatCurrency(totals.gross)}</span>
                            </div>
                            
                            <button 
                                onClick={handleFinalCreate} 
                                disabled={lineItems.length === 0 || (capacityStats.isOver && !isEstimateMode)}
                                className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all
                                    ${lineItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' : capacityStats.isOver && !isEstimateMode ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}
                                `}
                            >
                                {capacityStats.isOver && !isEstimateMode ? <AlertTriangle size={20}/> : <Check size={20}/>}
                                {capacityStats.isOver && !isEstimateMode ? 'Over Capacity - Select different date' : `Confirm & Create ${isEstimateMode ? 'Estimate' : 'Job'}`}
                            </button>
                        </div>
                    </>
                 )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isEstimateMode ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            <Wand2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Smart {isEstimateMode ? 'Estimate' : 'Job'} Creator</h2>
                            <p className="text-sm text-gray-500">Describe the work, and AI will build it for you.</p>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-hidden p-6">
                    {!parsedData ? (
                         <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto">
                            {renderInitialPrompt()}
                        </div>
                    ) : (
                        renderBuilder()
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartCreateJobModal;

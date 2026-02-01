
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Job, Vehicle, Customer, Estimate, TaxRate, EstimateLineItem, Part, ServicePackage, RentalBooking, PurchaseOrder, ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../types';
import { X, Save, Car, CarFront, Wrench, DollarSign, Loader2, CheckCircle, Trash2, Plus } from 'lucide-react';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateEstimateNumber, generatePurchaseOrderId } from '../core/utils/numberGenerators';
import { JobDetailsTab } from './jobs/tabs/JobDetailsTab';
import { JobEstimateTab } from './jobs/tabs/JobEstimateTab';
import { JobInspectionTab } from './jobs/tabs/JobInspectionTab';
import { useDebouncedSave } from '../core/hooks/useDebouncedSave';
import { initialChecklistData, initialTyreCheckData } from '../core/data/initialChecklistData';

const EditJobModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedJobId: string;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    rentalBookings: RentalBooking[];
    onOpenRentalBooking: (booking: Partial<RentalBooking> | null) => void;
    onOpenConditionReport: (booking: RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onRaiseSupplementaryEstimate: (job: Job) => void;
    onViewEstimate: (estimate: Estimate) => void;
}> = ({ isOpen, onClose, selectedJobId, onOpenPurchaseOrder, rentalBookings, onOpenRentalBooking, onOpenConditionReport, onRaiseSupplementaryEstimate, onViewEstimate }) => {
    const {
        jobs, setJobs, vehicles, customers, engineers, estimates, setEstimates, purchaseOrders, setPurchaseOrders, suppliers, parts, servicePackages, taxRates, businessEntities
    } = useData();
    const { currentUser } = useApp();

    const job = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    
    const [editableJob, setEditableJob] = useState<Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<Estimate | null>(null);
    const [newObservation, setNewObservation] = useState('');
    const [activeTab, setActiveTab] = useState<'estimate' | 'inspection' | 'notes' | 'segments'>('estimate');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);

    // Auto-Sync Hook
    const { isSaving, lastSaved } = useDebouncedSave('brooks_jobs', editableJob, 1000);

    const canViewPricing = useMemo(() => {
        if (!currentUser) return false;
        return ['Admin', 'Dispatcher', 'Sales', 'Garage Concierge'].includes(currentUser.role);
    }, [currentUser]);

    const vehicle = useMemo(() => job ? vehicles.find(v => v.id === job.vehicleId) : undefined, [job, vehicles]);
    const customer = useMemo(() => job ? customers.find(c => c.id === job.customerId) : undefined, [job, customers]);

    const diagramImageId = useMemo(() => {
        return vehicle?.images?.find(img => img.isPrimaryDiagram)?.id ?? null;
    }, [vehicle]);

    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    // Calculate Supplementary Estimates (Linked to Job but NOT the main estimate)
    const supplementaryEstimates = useMemo(() => {
        if (!job) return [];
        return estimates.filter(e => e.jobId === job.id && e.id !== job.estimateId);
    }, [estimates, job]);

    useEffect(() => {
        if (job) {
            const jobCopy = JSON.parse(JSON.stringify(job));
            if (!jobCopy.inspectionChecklist || jobCopy.inspectionChecklist.length === 0) {
                jobCopy.inspectionChecklist = JSON.parse(JSON.stringify(initialChecklistData));
            }
            if (!jobCopy.tyreCheck) {
                jobCopy.tyreCheck = JSON.parse(JSON.stringify(initialTyreCheckData));
            }
            if (!jobCopy.damagePoints) {
                jobCopy.damagePoints = [];
            }
            setEditableJob(jobCopy);
            if (job.estimateId) {
                const linkedEstimate = estimates.find(e => e.id === job.estimateId);
                if (linkedEstimate) setEditableEstimate(JSON.parse(JSON.stringify(linkedEstimate)));
                else setEditableEstimate(null); 
            } else {
                setEditableEstimate(null);
            }
            setActiveTab('estimate');
        } else {
            setEditableJob(null);
            setEditableEstimate(null);
        }
    }, [job, isOpen, estimates]);

    const isReadOnly = !!editableJob?.invoiceId;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableJob(prev => prev ? { ...prev, [name]: value } : null);
    };
    
    const handleAddObservation = () => {
        if (!newObservation.trim()) return;
        setEditableJob(prev => prev ? { ...prev, technicianObservations: [...(prev.technicianObservations || []), newObservation] } : null);
        setNewObservation('');
    };

    const handleRemoveObservation = (index: number) => {
         setEditableJob(prev => prev ? { ...prev, technicianObservations: (prev.technicianObservations || []).filter((_, i) => i !== index) } : null);
    };

    const handleCreateEstimateIfNeeded = useCallback(() => {
        if (!editableEstimate && editableJob) {
            const entity = businessEntities.find(e => e.id === editableJob.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            const newEstimate: Estimate = {
                id: `est_${Date.now()}_temp`, // temp id
                estimateNumber: generateEstimateNumber(estimates, entityShortCode),
                entityId: editableJob.entityId,
                customerId: editableJob.customerId,
                vehicleId: editableJob.vehicleId,
                issueDate: formatDate(new Date()),
                expiryDate: formatDate(addDays(new Date(), 30)),
                status: 'Draft',
                lineItems: [],
                notes: `Auto-generated from Job #${editableJob.id}`,
                createdByUserId: currentUser.id,
                jobId: editableJob.id,
            };
            setEditableEstimate(newEstimate);
            return newEstimate;
        }
        return editableEstimate;
    }, [editableEstimate, editableJob, businessEntities, estimates, currentUser.id]);

    const handleLineItemChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => { setEditableEstimate(prev => prev ? ({ ...prev, lineItems: (prev.lineItems || []).map(item => item.id === id ? { ...item, [field]: ['quantity', 'unitPrice', 'unitCost'].includes(field as string) ? parseFloat(value) || 0 : value } : item) }) : null); }, []);

    const entityLaborRate = useMemo(() => businessEntities.find(e => e.id === editableJob?.entityId)?.laborRate, [businessEntities, editableJob?.entityId]);
    const entityLaborCostRate = useMemo(() => businessEntities.find(e => e.id === editableJob?.entityId)?.laborCostRate, [businessEntities, editableJob?.entityId]);

    const addLineItem = (isLabor: boolean) => {
        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;
        const newItem: EstimateLineItem = { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: isLabor ? (entityLaborRate || 0) : 0, unitCost: isLabor ? (entityLaborCostRate || 0) : 0, isLabor, taxCodeId: standardTaxRateId };
        setEditableEstimate(prev => prev ? ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }) : null);
    };

    const addPackage = (packageId: string) => {
        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
    
        const newItems: EstimateLineItem[] = [];
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(), description: pkg.name, quantity: 1, unitPrice: pkg.totalPrice, unitCost: totalCost, isLabor: false, 
            taxCodeId: standardTaxRateId, servicePackageId: pkg.id, servicePackageName: pkg.name, isPackageComponent: false,
        };
        newItems.push(mainPackageItem);
    
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => newItems.push({ ...costItem, id: crypto.randomUUID(), unitPrice: 0, servicePackageId: pkg.id, servicePackageName: pkg.name, isPackageComponent: true }));
        }
        setEditableEstimate(prev => prev ? ({ ...prev, lineItems: [...(prev.lineItems || []), ...newItems] }) : null);
    };

    const removeLineItem = useCallback((id: string) => {
        setEditableEstimate(prev => {
            if (!prev) return null;
            const itemToRemove = (prev.lineItems || []).find(i => i.id === id);
            if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
                return { ...prev, lineItems: (prev.lineItems || []).filter(item => item.servicePackageId !== itemToRemove.servicePackageId) };
            }
            return { ...prev, lineItems: (prev.lineItems || []).filter(item => item.id !== id) };
        });
    }, []);

    const filteredParts = useMemo(() => {
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return parts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    }, [partSearchTerm, parts]);

    const handleSelectPart = (lineItemId: string, part: Part) => {
        setEditableEstimate(prev => prev ? ({ ...prev, lineItems: (prev.lineItems || []).map(item => item.id === lineItemId ? { ...item, partNumber: part.partNumber, description: part.description, unitPrice: part.salePrice, unitCost: part.costPrice, partId: part.id, taxCodeId: part.taxCodeId || item.taxCodeId, fromStock: part.stockQuantity > 0 } : item) }) : null);
        setActivePartSearch(null);
        setPartSearchTerm('');
    };
    
    const handleSave = () => {
        if (!editableJob) { onClose(); return; }
    
        let jobToSave = { ...editableJob };
        const newPOs: PurchaseOrder[] = [];
        let updatedPOs: PurchaseOrder[] = [];
        const newPurchaseOrderIds: string[] = [];
    
        if (editableEstimate) {
            const originalEstimate = estimates.find(e => e.id === editableEstimate.id);
            const originalLineItemIds = new Set((originalEstimate?.lineItems || []).map(item => item.id));
            const newPartItems = (editableEstimate.lineItems || []).filter(item => !item.isLabor && item.partId && !originalLineItemIds.has(item.id));
    
            if (newPartItems.length > 0) {
                const currentJobPOs = purchaseOrders.filter(po => (jobToSave.purchaseOrderIds || []).includes(po.id));
                const partsBySupplier = newPartItems.reduce((acc, item) => {
                    const part = parts.find(p => p.id === item.partId);
                    const supplierId = part?.defaultSupplierId || 'no_supplier';
                    if (!acc[supplierId]) acc[supplierId] = [];
                    acc[supplierId].push(item);
                    return acc;
                }, {} as Record<string, EstimateLineItem[]>);
    
                for (const supplierId in partsBySupplier) {
                    const itemsForSupplier = partsBySupplier[supplierId];
                    const draftPO = currentJobPOs.find(po => po.supplierId === (supplierId === 'no_supplier' ? null : supplierId) && po.status === 'Draft');
    
                    if (draftPO) {
                        const newPoLineItems: any[] = itemsForSupplier.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId, }));
                        const poToUpdate = updatedPOs.find(p => p.id === draftPO.id) || draftPO;
                        const updatedPO = { ...poToUpdate, lineItems: [...poToUpdate.lineItems, ...newPoLineItems] };
                        const otherUpdatedPOs = updatedPOs.filter(p => p.id !== draftPO.id);
                        updatedPOs = [...otherUpdatedPOs, updatedPO];
                    } else {
                        const entity = businessEntities.find(e => e.id === jobToSave.entityId);
                        const vehicle = vehicles.find(v => v.id === jobToSave.vehicleId);
                        const newPOId = generatePurchaseOrderId([...purchaseOrders, ...newPOs], entity?.shortCode || 'UNK');
                        newPurchaseOrderIds.push(newPOId);
                        
                        const newPO: PurchaseOrder = { id: newPOId, entityId: jobToSave.entityId, supplierId: supplierId === 'no_supplier' ? null : supplierId, vehicleRegistrationRef: vehicle?.registration || 'N/A', orderDate: formatDate(new Date()), status: 'Draft', jobId: jobToSave.id, lineItems: itemsForSupplier.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId, })) };
                        newPOs.push(newPO);
                    }
                }
            }
    
            if (editableEstimate.id.endsWith('_temp')) {
                 const realEstimate = { ...editableEstimate, id: `est_${Date.now()}` };
                 setEstimates(prev => [...prev, realEstimate]);
                 jobToSave.estimateId = realEstimate.id;
            } else {
                setEstimates(prev => prev.map(e => e.id === editableEstimate.id ? editableEstimate : e));
            }
            const totalLaborHours = (editableEstimate.lineItems || []).filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
            jobToSave.estimatedHours = totalLaborHours;
        }
    
        if (newPurchaseOrderIds.length > 0) jobToSave.purchaseOrderIds = [...(jobToSave.purchaseOrderIds || []), ...newPurchaseOrderIds];
        
        if (newPOs.length > 0 || updatedPOs.length > 0) {
            const allPOsForJobNow = [...purchaseOrders.filter(po => (jobToSave.purchaseOrderIds || []).includes(po.id) && !updatedPOs.some(upo => upo.id === po.id)), ...updatedPOs, ...newPOs];
            if (allPOsForJobNow.length > 0) {
                if (allPOsForJobNow.every(p => p.status === 'Received')) jobToSave.partsStatus = 'Fully Received';
                else if (allPOsForJobNow.some(p => p.status === 'Partially Received' || p.status === 'Received')) jobToSave.partsStatus = 'Partially Received';
                else if (allPOsForJobNow.some(p => p.status === 'Ordered')) jobToSave.partsStatus = 'Ordered';
                else if (allPOsForJobNow.some(p => p.status === 'Draft')) jobToSave.partsStatus = 'Awaiting Order';
            }
        }
    
        if (newPOs.length > 0 || updatedPOs.length > 0) {
            setPurchaseOrders(prevPOs => {
                let newPOList = prevPOs.map(po => {
                    const updated = updatedPOs.find(upo => upo.id === po.id);
                    return updated || po;
                });
                return [...newPOList, ...newPOs];
            });
        }
    
        setJobs(prevJobs => prevJobs.map(j => (j.id === jobToSave.id ? jobToSave : j)));
        onClose();
    };

    const estimateBreakdown = useMemo(() => {
        if (!editableEstimate) return { packages: [], standaloneLabor: [], standaloneParts: [] };
        const packagesMap = new Map<string, { header: EstimateLineItem, children: EstimateLineItem[] }>();
        const standaloneLabor: EstimateLineItem[] = [];
        const standaloneParts: EstimateLineItem[] = [];
        (editableEstimate.lineItems || []).forEach(item => {
            if (item.servicePackageId && !item.isPackageComponent) {
                packagesMap.set(item.servicePackageId, { header: item, children: [] });
            } else if (!item.servicePackageId) {
                if (item.isLabor) standaloneLabor.push(item);
                else standaloneParts.push(item);
            }
        });
        (editableEstimate.lineItems || []).forEach(item => {
            if (item.servicePackageId && item.isPackageComponent) {
                const pkg = packagesMap.get(item.servicePackageId);
                if (pkg) pkg.children.push(item);
            }
        });
        return { packages: Array.from(packagesMap.values()), standaloneLabor, standaloneParts };
    }, [editableEstimate]);
    
     const { totalNet, grandTotal, vatBreakdown } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        if (!editableEstimate || !editableEstimate.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [] };
        let currentTotalNet = 0;
        const billableItems = (editableEstimate.lineItems || []).filter(item => !item.isPackageComponent);
        billableItems.forEach(item => {
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            currentTotalNet += itemTotal;
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId);
            if (!taxRate || taxRate.rate === 0) return;
            if (!breakdown[taxCodeId]) breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            breakdown[taxCodeId].net += itemTotal;
        });
        Object.values(breakdown).forEach(summary => { summary.vat = summary.net * (summary.rate / 100); });
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0 && b.rate > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown };
    }, [editableEstimate, taxRatesMap, standardTaxRateId]);

    const linkedBooking = useMemo(() => rentalBookings.find(b => b.jobId === job?.id), [rentalBookings, job]);
    const handleBookCourtesyCar = () => { if (!editableJob) return; const booking: Partial<RentalBooking> = { jobId: editableJob.id, customerId: editableJob.customerId, bookingType: 'Courtesy Car', startDate: `${editableJob.scheduledDate || formatDate(new Date())}T09:00`, endDate: `${editableJob.scheduledDate || formatDate(new Date())}T17:00` }; onOpenRentalBooking(booking); };

    if (!isOpen || !editableJob) return null;

    const engineerMap = new Map(engineers.map(e => [e.id, e.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const renderTabs = () => {
        switch (activeTab) {
            case 'estimate':
                return (
                    <JobEstimateTab
                        partsStatus={editableJob.partsStatus || 'Not Required'}
                        purchaseOrderIds={editableJob.purchaseOrderIds || []}
                        purchaseOrders={purchaseOrders}
                        supplierMap={supplierMap}
                        editableEstimate={editableEstimate}
                        supplementaryEstimates={supplementaryEstimates}
                        estimateBreakdown={estimateBreakdown}
                        isReadOnly={isReadOnly}
                        canViewPricing={canViewPricing}
                        taxRates={taxRates}
                        filteredParts={filteredParts}
                        activePartSearch={activePartSearch}
                        servicePackages={servicePackages.filter(p => p.entityId === editableJob.entityId)}
                        totalNet={totalNet}
                        vatBreakdown={vatBreakdown}
                        grandTotal={grandTotal}
                        onChange={handleChange}
                        onOpenPurchaseOrder={onOpenPurchaseOrder}
                        onCreateEstimate={handleCreateEstimateIfNeeded}
                        onRaiseSupplementaryEstimate={() => onRaiseSupplementaryEstimate(editableJob)}
                        onViewEstimate={onViewEstimate}
                        onAddLineItem={addLineItem}
                        onAddPackage={addPackage}
                        onLineItemChange={handleLineItemChange}
                        onRemoveLineItem={removeLineItem}
                        onPartSearchChange={setPartSearchTerm}
                        onSetActivePartSearch={setActivePartSearch}
                        onSelectPart={handleSelectPart}
                    />
                );
            case 'inspection':
                return (
                    <JobInspectionTab 
                        checklistData={editableJob.inspectionChecklist || []}
                        tyreData={editableJob.tyreCheck || initialTyreCheckData}
                        damagePoints={editableJob.damagePoints || []}
                        onChecklistUpdate={(d) => setEditableJob(prev => prev ? {...prev, inspectionChecklist: d} : null)}
                        onTyreUpdate={(d) => setEditableJob(prev => prev ? {...prev, tyreCheck: d} : null)}
                        onDamageReportUpdate={(d) => setEditableJob(prev => prev ? {...prev, damagePoints: d} : null)}
                        isReadOnly={isReadOnly}
                        vehicleModel={vehicle?.model}
                        diagramImageId={diagramImageId}
                    />
                );
            case 'notes':
                 return (
                    <div className="space-y-3">
                        {(editableJob.technicianObservations || []).map((obs, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-md">
                                <span>{obs}</span>
                                <button onClick={() => handleRemoveObservation(index)} disabled={isReadOnly}><Trash2 size={14} className="text-red-500"/></button>
                            </div>
                        ))}
                         <div className="flex items-center gap-2 pt-2 border-t">
                            <input value={newObservation} onChange={e => setNewObservation(e.target.value)} placeholder="Add new observation..." className="w-full p-2 border rounded-md" disabled={isReadOnly}/>
                            <button onClick={handleAddObservation} className="p-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50" disabled={isReadOnly}><Plus size={20}/></button>
                        </div>
                    </div>
                );
            case 'segments':
                return (
                    <div className="space-y-2">
                        {(editableJob.segments || []).map(segment => (
                            <div key={segment.segmentId} className="p-2 border rounded-md bg-gray-50 text-xs">
                                <p><strong>Date:</strong> {segment.date}</p>
                                <p><strong>Duration:</strong> {segment.duration} hrs</p>
                                <p><strong>Status:</strong> <span className="font-semibold">{segment.status}</span></p>
                                <p><strong>Lift:</strong> {segment.allocatedLift || 'N/A'}</p>
                                <p><strong>Engineer:</strong> {segment.engineerId ? engineerMap.get(segment.engineerId) : 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                );
        }
    }

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-indigo-700">Edit Job #{job.id}</h2>
                            <p className="text-sm text-gray-600">{job.description}</p>
                        </div>
                        {isSaving && (
                            <span className="flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-full">
                                <Loader2 size={12} className="animate-spin"/> Saving...
                            </span>
                        )}
                        {!isSaving && lastSaved && (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full animate-fade-in">
                                <CheckCircle size={12} /> Cloud Synced
                            </span>
                        )}
                    </div>
                    <button type="button" onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-6 gap-6 bg-gray-50">
                    <div className="lg:col-span-2 space-y-4">
                        <JobDetailsTab 
                            editableJob={editableJob}
                            vehicle={vehicle}
                            customer={customer}
                            isReadOnly={isReadOnly}
                            linkedBooking={linkedBooking}
                            rentalVehicleRegistration={linkedBooking ? vehicles.find(v => v.id === linkedBooking.rentalVehicleId)?.registration : undefined}
                            onBookCourtesyCar={handleBookCourtesyCar}
                            onOpenRentalBooking={onOpenRentalBooking}
                            onOpenConditionReport={onOpenConditionReport}
                            onChange={handleChange}
                        />
                         <div className="border rounded-lg bg-white shadow-sm p-4">
                            <h3 className="text-md font-bold mb-2 flex items-center gap-2"><DollarSign size={16}/> Billing</h3>
                            <div className="text-sm space-y-2">
                                <p><strong>Estimate:</strong> {editableEstimate ? `#${editableEstimate.estimateNumber}` : 'N/A'}</p>
                                <p><strong>Invoice:</strong> {job.invoiceId ? `#${job.invoiceId}` : 'Not Invoiced'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4">
                        <div className="flex gap-1 p-1 bg-gray-200 rounded-lg mb-4">
                            <button onClick={() => setActiveTab('estimate')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${activeTab === 'estimate' ? 'bg-white shadow' : 'text-gray-600'}`}>Estimate & Parts</button>
                            <button onClick={() => setActiveTab('inspection')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${activeTab === 'inspection' ? 'bg-white shadow' : 'text-gray-600'}`}>Inspection</button>
                            <button onClick={() => setActiveTab('notes')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${activeTab === 'notes' ? 'bg-white shadow' : 'text-gray-600'}`}>Technician Notes</button>
                            <button onClick={() => setActiveTab('segments')} className={`w-full py-2 rounded-md font-semibold text-sm transition ${activeTab === 'segments' ? 'bg-white shadow' : 'text-gray-600'}`}>Segments</button>
                        </div>
                        <div className="p-4 bg-white border rounded-lg min-h-[300px]">
                            {isReadOnly && <div className="p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm mb-4">This job has been invoiced and is now read-only.</div>}
                            {renderTabs()}
                        </div>
                    </div>
                </main>
                <footer className="flex-shrink-0 flex justify-end gap-2 p-4 border-t bg-gray-50">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Cancel</button>
                    <button type="button" onClick={handleSave} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50" disabled={isReadOnly}><Save size={14}/> Save</button>
                </footer>
            </div>
        </div>
    );
};

export default EditJobModal;
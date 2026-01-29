import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Job, Vehicle, Customer, Engineer, JobSegment, Lift, Estimate, TaxRate, EstimateLineItem, Part, ServicePackage, BusinessEntity, RentalBooking, User as AppUser, PurchaseOrder, Supplier, UnbillableTimeEvent, EngineerChangeEvent, PurchaseOrderLineItem, ChecklistSection, TyreCheckData, VehicleDamagePoint } from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateEstimateNumber, generatePurchaseOrderId } from '../core/utils/numberGenerators';
import SearchableSelect from './SearchableSelect';
import { calculateJobStatus } from '../utils/jobUtils';
import InspectionChecklist from './InspectionChecklist';
import VehicleDamageReport from './VehicleDamageReport';
import TyreCheck from './TyreCheck';
import { initialChecklistData, initialTyreCheckData } from '../core/data/initialChecklistData';

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50/70 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                {isOpen ? <ChevronUp size={20} className="text-gray-600"/> : <ChevronDown size={20} className="text-gray-600"/>}
            </h3>
            {isOpen && <div className="p-4">{children}</div>}
        </div>
    );
};


interface EditableLineItemRowProps {
    item: EstimateLineItem;
    taxRates: TaxRate[];
    filteredParts: Part[];
    activePartSearch: string | null;
    onLineItemChange: (id: string, field: keyof EstimateLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    onPartSearchChange: (value: string) => void;
    onSetActivePartSearch: (id: string | null) => void;
    onSelectPart: (lineItemId: string, part: Part) => void;
    isReadOnly: boolean;
    canViewPricing: boolean;
}

const MemoizedEditableLineItemRow = React.memo(({ item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart, isReadOnly, canViewPricing }: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

     const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onLineItemChange(item.id, 'description', value);
        if (!item.isLabor && !isPackageHeader && !isPackageComponent) {
            onPartSearchChange(value);
        }
    };

    return (
         <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
            <input type="text" placeholder="Part Number" value={item.partNumber || ''} onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} className="col-span-2 p-1 border rounded disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader || isPackageComponent || item.isLabor} />
            <div className="col-span-5 relative">
                 <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={handleDescriptionChange}
                    onFocus={() => !item.isLabor && !isPackageHeader && !isPackageComponent && onSetActivePartSearch(item.id)}
                    onBlur={() => setTimeout(() => onSetActivePartSearch(null), 150)}
                    className="w-full p-1 border rounded disabled:bg-gray-200"
                    disabled={isReadOnly || isPackageHeader || isPackageComponent}
                />
                 {activePartSearch === item.id && filteredParts.length > 0 && (
                    <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                        {filteredParts.map(part => (
                            <div key={part.id} onMouseDown={() => onSelectPart(item.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm">
                                <p className="font-semibold">{part.partNumber} - {part.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader} />
            {canViewPricing ? (
                <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right disabled:bg-gray-200" placeholder="Sale (Net)" disabled={isReadOnly || isPackageHeader || isPackageComponent}/>
            ) : (
                <div className="col-span-2 p-1 text-right font-semibold text-gray-500">Hidden</div>
            )}
            <select value={item.taxCodeId || ''} onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} className="col-span-1 p-1 border rounded text-xs disabled:bg-gray-200" disabled={isReadOnly || isPackageHeader}>
                <option value="">-- Tax --</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </select>
            <button onClick={() => onRemoveLineItem(item.id)} className="col-span-1 text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50" disabled={isReadOnly || isPackageComponent}><Trash2 size={14} /></button>
        </div>
    );
});


const EditJobModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedJobId: string;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    rentalBookings: RentalBooking[];
    onOpenRentalBooking: (booking: Partial<RentalBooking> | null) => void;
    onOpenConditionReport: (booking: RentalBooking, mode: 'checkOut' | 'checkIn') => void;
}> = ({ isOpen, onClose, selectedJobId, onOpenPurchaseOrder, rentalBookings, onOpenRentalBooking, onOpenConditionReport }) => {
    const {
        jobs, setJobs, vehicles, customers, engineers, estimates, setEstimates, purchaseOrders, setPurchaseOrders, suppliers, parts, servicePackages, taxRates, businessEntities
    } = useData();
    const { currentUser } = useApp();

    const job = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    
    const [editableJob, setEditableJob] = useState<Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<Estimate | null>(null);
    const [newObservation, setNewObservation] = useState('');
    const [activeTab, setActiveTab] = useState<'estimate' | 'inspection' | 'notes' | 'segments'>('estimate');
    const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);

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
                if (linkedEstimate) {
                    setEditableEstimate(JSON.parse(JSON.stringify(linkedEstimate)));
                } else {
                    setEditableEstimate(null); 
                }
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

    const handleTyreDepthChange = (tyre: 'osf' | 'nsf' | 'osr' | 'nsr', value: string) => {
        setEditableJob(prev => prev ? {
            ...prev,
            tyreDepths: { ...(prev.tyreDepths || {}), [tyre]: parseFloat(value) || undefined }
        } : null);
    };
    
    const handleAddObservation = () => {
        if (!newObservation.trim()) return;
        setEditableJob(prev => prev ? {
            ...prev,
            technicianObservations: [...(prev.technicianObservations || []), newObservation]
        } : null);
        setNewObservation('');
    };

    const handleRemoveObservation = (index: number) => {
         setEditableJob(prev => prev ? {
            ...prev,
            technicianObservations: (prev.technicianObservations || []).filter((_, i) => i !== index)
        } : null);
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
        if (!editableJob) {
            onClose();
            return;
        }
    
        let jobToSave = { ...editableJob };
        const newPOs: PurchaseOrder[] = [];
        let updatedPOs: PurchaseOrder[] = [];
        const newPurchaseOrderIds: string[] = [];
    
        if (editableEstimate) {
            const originalEstimate = estimates.find(e => e.id === editableEstimate.id);
            const originalLineItemIds = new Set((originalEstimate?.lineItems || []).map(item => item.id));
    
            const newPartItems = (editableEstimate.lineItems || []).filter(item =>
                !item.isLabor && item.partId && !originalLineItemIds.has(item.id)
            );
    
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
                        const newPoLineItems: PurchaseOrderLineItem[] = itemsForSupplier.map(item => ({
                            id: crypto.randomUUID(),
                            partNumber: item.partNumber,
                            description: item.description,
                            quantity: item.quantity,
                            receivedQuantity: 0,
                            unitPrice: item.unitCost || 0,
                            taxCodeId: item.taxCodeId,
                        }));
                        
                        const poToUpdate = updatedPOs.find(p => p.id === draftPO.id) || draftPO;
                        const updatedPO = { ...poToUpdate, lineItems: [...poToUpdate.lineItems, ...newPoLineItems] };
                        
                        const otherUpdatedPOs = updatedPOs.filter(p => p.id !== draftPO.id);
                        updatedPOs = [...otherUpdatedPOs, updatedPO];
    
                    } else {
                        const entity = businessEntities.find(e => e.id === jobToSave.entityId);
                        const vehicle = vehicles.find(v => v.id === jobToSave.vehicleId);
                        
                        const newPOId = generatePurchaseOrderId([...purchaseOrders, ...newPOs], entity?.shortCode || 'UNK');
                        newPurchaseOrderIds.push(newPOId);
                        
                        const newPO: PurchaseOrder = {
                            id: newPOId,
                            entityId: jobToSave.entityId,
                            supplierId: supplierId === 'no_supplier' ? null : supplierId,
                            vehicleRegistrationRef: vehicle?.registration || 'N/A',
                            orderDate: formatDate(new Date()),
                            status: 'Draft',
                            jobId: jobToSave.id,
                            lineItems: itemsForSupplier.map(item => ({
                                id: crypto.randomUUID(),
                                partNumber: item.partNumber,
                                description: item.description,
                                quantity: item.quantity,
                                receivedQuantity: 0,
                                unitPrice: item.unitCost || 0,
                                taxCodeId: item.taxCodeId,
                            }))
                        };
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
    
        if (newPurchaseOrderIds.length > 0) {
            jobToSave.purchaseOrderIds = [...(jobToSave.purchaseOrderIds || []), ...newPurchaseOrderIds];
        }
        
        if (newPOs.length > 0 || updatedPOs.length > 0) {
            const allPOsForJobNow = [
                ...purchaseOrders.filter(po => (jobToSave.purchaseOrderIds || []).includes(po.id) && !updatedPOs.some(upo => upo.id === po.id)),
                ...updatedPOs,
                ...newPOs
            ];
            
            if (allPOsForJobNow.length > 0) {
                if (allPOsForJobNow.every(p => p.status === 'Received')) {
                    jobToSave.partsStatus = 'Fully Received';
                } else if (allPOsForJobNow.some(p => p.status === 'Partially Received' || p.status === 'Received')) {
                    jobToSave.partsStatus = 'Partially Received';
                } else if (allPOsForJobNow.some(p => p.status === 'Ordered')) {
                    jobToSave.partsStatus = 'Ordered';
                } else if (allPOsForJobNow.some(p => p.status === 'Draft')) {
                    jobToSave.partsStatus = 'Awaiting Order';
                }
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

    const handleChecklistUpdate = (updatedChecklist: ChecklistSection[]) => {
        setEditableJob(prev => prev ? { ...prev, inspectionChecklist: updatedChecklist } : null);
    };

    const handleTyreCheckUpdate = (updatedTyreData: TyreCheckData) => {
        setEditableJob(prev => prev ? { ...prev, tyreCheck: updatedTyreData } : null);
    };

    const handleDamageReportUpdate = (updatedDamagePoints: VehicleDamagePoint[]) => {
        setEditableJob(prev => prev ? { ...prev, damagePoints: updatedDamagePoints } : null);
    };

    const linkedBooking = useMemo(() => rentalBookings.find(b => b.jobId === job?.id), [rentalBookings, job]);

    const handleBookCourtesyCar = () => {
        if (!editableJob) return;
        const booking: Partial<RentalBooking> = {
            jobId: editableJob.id,
            customerId: editableJob.customerId,
            bookingType: 'Courtesy Car',
            startDate: `${editableJob.scheduledDate || formatDate(new Date())}T09:00`,
            endDate: `${editableJob.scheduledDate || formatDate(new Date())}T17:00`,
        };
        onOpenRentalBooking(booking);
    };


    if (!isOpen || !editableJob || !vehicle || !customer) return null;

    const engineerMap = new Map(engineers.map(e => [e.id, e.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const renderTabs = () => {
        switch (activeTab) {
            case 'estimate':
                return (
                     <div className="space-y-4 text-sm">
                        <div>
                            <label className="font-semibold">Parts Status</label>
                             <select name="partsStatus" value={editableJob.partsStatus || 'Not Required'} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1" disabled={isReadOnly}>
                                <option>Not Required</option>
                                <option>Awaiting Order</option>
                                <option>Ordered</option>
                                <option>Partially Received</option>
                                <option>Fully Received</option>
                            </select>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold mb-2">Items</h4>
                             {!editableEstimate && !isReadOnly && <button onClick={handleCreateEstimateIfNeeded} className="text-indigo-600 hover:underline">This job has no estimate. Click here to add items.</button>}
                            
                            {editableEstimate && (
                                <div className="space-y-4">
                                     {!isReadOnly && (
                                        <div className="flex justify-between items-center pt-2">
                                            <div className="flex gap-2">
                                                <button onClick={() => addLineItem(true)} className="flex items-center text-xs py-1 px-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"><PlusCircle size={14} className="mr-1" /> Add Labor</button>
                                                <button onClick={() => addLineItem(false)} className="flex items-center text-xs py-1 px-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><PlusCircle size={14} className="mr-1" /> Add Part</button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <SearchableSelect
                                                    options={servicePackages.filter(p => p.entityId === editableJob.entityId).map(p => ({ id: p.id, label: p.name }))}
                                                    value={null} onChange={(packageId) => { if (packageId) addPackage(packageId); }}
                                                    placeholder="-- Add Package --"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                        <div className="col-span-2">Part No.</div><div className="col-span-5">Description</div>
                                        <div className="col-span-1 text-right">Qty/Hrs</div>
                                        {canViewPricing ? (
                                            <div className="col-span-2 text-right">Sell Price (Net)</div>
                                        ) : (
                                            <div className="col-span-2"></div>
                                        )}
                                        <div className="col-span-1 text-center">Tax</div><div className="col-span-1"></div>
                                    </div>
                                    
                                    {estimateBreakdown.packages.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Service Packages</h5>}
                                    {estimateBreakdown.packages.map(({ header, children }) => (<div key={header.id}><MemoizedEditableLineItemRow canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} /><div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">{children.map(child => (<MemoizedEditableLineItemRow key={child.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} />))}</div></div>))}
                                    
                                    {estimateBreakdown.standaloneLabor.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Standalone Labor</h5>}
                                    {estimateBreakdown.standaloneLabor.map(item => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} />)}
                                    
                                    {estimateBreakdown.standaloneParts.length > 0 && <h5 className="font-bold text-gray-800 text-xs uppercase pt-2">Standalone Parts</h5>}
                                    {estimateBreakdown.standaloneParts.map(item => <MemoizedEditableLineItemRow key={item.id} canViewPricing={canViewPricing} isReadOnly={isReadOnly} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} />)}
                                    
                                    {canViewPricing && (
                                        <div className="mt-4 pt-4 border-t flex justify-end">
                                            <div className="w-64 text-sm">
                                                <div className="flex justify-between"><span>Net Total</span><span className="font-semibold">{formatCurrency(totalNet)}</span></div>
                                                {vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                                                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-semibold">Linked Purchase Orders</h4>
                            <div className="space-y-2 mt-1">
                                {(editableJob.purchaseOrderIds || []).length > 0 ? (editableJob.purchaseOrderIds || []).map(poId => {
                                    const po = purchaseOrders.find(p => p.id === poId);
                                    if (!po) return <div key={poId} className="p-2 border rounded-md bg-red-50 text-xs text-red-700">Error: Purchase Order {poId} not found.</div>;
                                    const poTotal = (po.lineItems || []).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                                    return (
                                        <button key={poId} type="button" onClick={() => onOpenPurchaseOrder(po)} className="w-full text-left border rounded-md bg-gray-50 text-xs hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            <div className="p-2 flex justify-between items-center">
                                                <div><p><strong>{poId}</strong> - {po?.supplierId ? supplierMap.get(po.supplierId) : 'N/A'}</p><p>Status: <span className="font-semibold">{po.status}</span>{canViewPricing && <> - Total: <span className="font-semibold">{formatCurrency(poTotal)}</span></>} </p></div>
                                            </div>
                                        </button>
                                    );
                                }) : <p className="text-xs text-gray-500">No purchase orders linked.</p>}
                            </div>
                        </div>
                    </div>
                );
            case 'inspection':
                return (
                    <div className="space-y-4">
                        <InspectionChecklist
                            checklistData={editableJob.inspectionChecklist || []}
                            onUpdate={handleChecklistUpdate}
                            isReadOnly={isReadOnly}
                        />
                        <TyreCheck
                            tyreData={editableJob.tyreCheck || initialTyreCheckData}
                            onUpdate={handleTyreCheckUpdate}
                            isReadOnly={isReadOnly}
                        />
                        <VehicleDamageReport
                            activePoints={editableJob.damagePoints || []}
                            onUpdate={handleDamageReportUpdate}
                            isReadOnly={isReadOnly}
                            vehicleModel={vehicle?.model}
                            imageId={diagramImageId}
                        />
                    </div>
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
                    <div>
                        <h2 className="text-xl font-bold text-indigo-700">Edit Job #{job.id}</h2>
                        <p className="text-sm text-gray-600">{job.description}</p>
                    </div>
                    <button type="button" onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-6 gap-6 bg-gray-50">
                    <div className="lg:col-span-2 space-y-4">
                        <Section title="Customer & Vehicle" icon={Car}>
                            <div className="text-sm space-y-2">
                                <p><strong>Customer:</strong> {customer.forename} {customer.surname}</p>
                                <p><strong>Vehicle:</strong> {vehicle.make} {vehicle.model} ({vehicle.registration})</p>
                            </div>
                        </Section>
                        <Section title="Courtesy Car / Rental" icon={CarFront}>
                            <div className="text-sm space-y-2">
                                {linkedBooking ? (
                                    <div>
                                        <p><strong>Status:</strong> <span className="font-semibold">{linkedBooking.status}</span></p>
                                        <p><strong>Vehicle:</strong> {vehicles.find(v=>v.id === linkedBooking.rentalVehicleId)?.registration}</p>
                                        <p><strong>Dates:</strong> {new Date(linkedBooking.startDate).toLocaleString()} to {new Date(linkedBooking.endDate).toLocaleString()}</p>
                                        <button onClick={() => onOpenRentalBooking(linkedBooking)} className="mt-2 text-indigo-600 font-semibold hover:underline">Manage Booking</button>
                                        
                                        <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                                            {!linkedBooking.checkOutDetails ? (
                                                <button onClick={() => onOpenConditionReport(linkedBooking, 'checkOut')} className="w-full py-2 px-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Check Out Vehicle</button>
                                            ) : !linkedBooking.checkInDetails ? (
                                                <button onClick={() => onOpenConditionReport(linkedBooking, 'checkIn')} className="w-full py-2 px-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Check In Vehicle</button>
                                            ) : (
                                                <p className="text-sm text-center text-green-700 font-semibold">Vehicle Returned</p>
                                            )}
                                        </div>

                                        {linkedBooking.checkOutDetails && (
                                            <div className="mt-2 text-xs p-2 bg-gray-100 rounded">
                                                <p className="font-bold">Checked Out:</p>
                                                <p>Mileage: {linkedBooking.checkOutDetails.mileage.toLocaleString()}, Fuel: {linkedBooking.checkOutDetails.fuelLevel}%</p>
                                            </div>
                                        )}
                                        {linkedBooking.checkInDetails && (
                                            <div className="mt-1 text-xs p-2 bg-gray-100 rounded">
                                                <p className="font-bold">Checked In:</p>
                                                <p>Mileage: {linkedBooking.checkInDetails.mileage.toLocaleString()}, Fuel: {linkedBooking.checkInDetails.fuelLevel}%</p>
                                            </div>
                                        )}

                                    </div>
                                ) : (
                                    <button onClick={handleBookCourtesyCar} className="w-full py-2 px-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200">Book Courtesy Car</button>
                                )}
                            </div>
                        </Section>
                        <Section title="Job Details" icon={Wrench}>
                            <div className="space-y-3 text-sm">
                                <div><label className="font-semibold">Description</label><input name="description" value={editableJob.description} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                                <div><label className="font-semibold">Booking Notes</label><textarea name="notes" value={editableJob.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="font-semibold">Mileage In</label><input name="mileage" type="number" value={editableJob.mileage || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                                    <div><label className="font-semibold">Key Number</label><input name="keyNumber" type="number" value={editableJob.keyNumber || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={isReadOnly}/></div>
                                </div>
                            </div>
                        </Section>
                        <Section title="Billing" icon={DollarSign}>
                            <div className="text-sm space-y-2">
                                <p><strong>Estimate:</strong> {editableEstimate ? `#${editableEstimate.estimateNumber}` : 'N/A'}</p>
                                <p><strong>Invoice:</strong> {job.invoiceId ? `#${job.invoiceId}` : 'Not Invoiced'}</p>
                            </div>
                        </Section>
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
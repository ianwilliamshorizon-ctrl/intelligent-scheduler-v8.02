
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Job, Vehicle, Customer, Engineer, JobSegment, Lift, Estimate, TaxRate, EstimateLineItem, Part, ServicePackage, BusinessEntity, RentalBooking, User as AppUser, PurchaseOrder, Supplier, UnbillableTimeEvent, EngineerChangeEvent, PurchaseOrderLineItem, ChecklistSection, TyreCheckData, VehicleDamagePoint, CheckInPhoto } from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront, Image as ImageIcon, Ban } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateEstimateNumber, generatePurchaseOrderId } from '../core/utils/numberGenerators';
import SearchableSelect from './SearchableSelect';
import { calculateJobStatus } from '../utils/jobUtils';
import { JobInspectionTab } from './jobs/tabs/JobInspectionTab';
import { JobEstimateTab } from './jobs/tabs/JobEstimateTab';
import { JobDetailsTab } from './jobs/tabs/JobDetailsTab';
import { initialTyreCheckData } from '../core/data/initialChecklistData';
import MediaManagerModal from './MediaManagerModal';
import AsyncImage from './AsyncImage';
import PartFormModal from './PartFormModal';

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
    onRaiseSupplementaryEstimate: (job: Job) => void;
    onViewEstimate: (estimate: Estimate) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
    onCheckIn: (job: Job) => void;
    onCheckOut: (job: Job) => void;
    onSavePart?: (part: Part) => void;
    onDelete?: (jobId: string) => void;
}> = ({ isOpen, onClose, selectedJobId, onOpenPurchaseOrder, rentalBookings, onOpenRentalBooking, onOpenConditionReport, onRaiseSupplementaryEstimate, onViewEstimate, onViewCustomer, onViewVehicle, onCheckIn, onCheckOut, onSavePart, onDelete }) => {
    const {
        jobs, setJobs, vehicles, customers, engineers, estimates, setEstimates, purchaseOrders, setPurchaseOrders, suppliers, parts, servicePackages, taxRates, businessEntities, inspectionTemplates
    } = useData();
    const { currentUser } = useApp();

    const job = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    
    const [editableJob, setEditableJob] = useState<Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<Estimate | null>(null);
    const [newObservation, setNewObservation] = useState('');
    const [activeTab, setActiveTab] = useState<'estimate' | 'inspection' | 'notes' | 'segments'>('estimate');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    
    // Media Management
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaModalTitle, setMediaModalTitle] = useState('');
    const [mediaModalData, setMediaModalData] = useState<CheckInPhoto[]>([]);
    const [onMediaSaveCallback, setOnMediaSaveCallback] = useState<((media: CheckInPhoto[]) => void) | null>(null);

    // Part Creation State
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');

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

    // Robustly identify the "Main" estimate for this job
    const mainEstimate = useMemo(() => {
        if (!job) return null;
        
        // 1. Try explicit ID match
        if (job.estimateId) {
            const byId = estimates.find(e => e.id === job.estimateId);
            if (byId) return byId;
            
            // 2. Fallback: Try match by Estimate Number (legacy data support)
            const byNumber = estimates.find(e => e.estimateNumber === job.estimateId);
            if (byNumber) return byNumber;
        }

        // 3. Fallback: Find estimates linked to this job via jobId
        const linked = estimates.filter(e => e.jobId === job.id);
        
        // If there's only one linked estimate, assume it's the main one
        if (linked.length === 1) return linked[0];
        
        // If multiple, prioritize the one marked 'Converted to Job'
        const converted = linked.find(e => e.status === 'Converted to Job');
        if (converted) return converted;
        
        // If none converted, maybe one is approved?
        const approved = linked.find(e => e.status === 'Approved');
        if (approved) return approved;

        return null;
    }, [job, estimates]);

    const supplementaryEstimates = useMemo(() => {
        if (!job) return [];
        const mainId = mainEstimate?.id;
        // All estimates for this job EXCLUDING the main one
        return estimates.filter(e => e.jobId === job.id && e.id !== mainId);
    }, [estimates, job, mainEstimate]);

    useEffect(() => {
        if (job) {
            const jobCopy = JSON.parse(JSON.stringify(job));

            if (!jobCopy.inspectionChecklist || jobCopy.inspectionChecklist.length === 0) {
                 const defaultTemplate = inspectionTemplates.find(t => t.isDefault);
                 if (defaultTemplate) {
                     jobCopy.inspectionChecklist = defaultTemplate.sections.map(s => ({
                        id: s.id,
                        title: s.title,
                        items: s.items.map(i => ({
                            id: crypto.randomUUID(),
                            label: i.label,
                            status: 'na'
                        })),
                        comments: ''
                     }));
                 } else {
                     jobCopy.inspectionChecklist = [];
                 }
            }

            if (!jobCopy.tyreCheck) {
                jobCopy.tyreCheck = JSON.parse(JSON.stringify(initialTyreCheckData));
            }
            if (!jobCopy.damagePoints) {
                jobCopy.damagePoints = [];
            }
            setEditableJob(jobCopy);
            
            if (mainEstimate) {
                setEditableEstimate(JSON.parse(JSON.stringify(mainEstimate)));
            } else {
                setEditableEstimate(null);
            }
            setActiveTab('estimate');
        } else {
            setEditableJob(null);
            setEditableEstimate(null);
        }
    }, [job, isOpen, estimates, inspectionTemplates, mainEstimate]);

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
    
    const handleOpenTechnicianMedia = () => {
        setMediaModalTitle('Manage Technical Photos/Videos');
        setMediaModalData(editableJob?.technicianImages || []);
        setOnMediaSaveCallback(() => (newMedia: CheckInPhoto[]) => {
            setEditableJob(prev => prev ? { ...prev, technicianImages: newMedia } : null);
        });
        setIsMediaModalOpen(true);
    };

    const handleOpenLineItemMedia = (itemId: string) => {
        const item = editableEstimate?.lineItems?.find(li => li.id === itemId);
        if (!item) return;

        setMediaModalTitle(`Media for: ${item.description || 'Line Item'}`);
        setMediaModalData(item.media || []);
        setOnMediaSaveCallback(() => (newMedia: CheckInPhoto[]) => {
            setEditableEstimate(prev => {
                if (!prev) return null;
                const newItems = (prev.lineItems || []).map(li => li.id === itemId ? { ...li, media: newMedia } : li);
                return { ...prev, lineItems: newItems };
            });
        });
        setIsMediaModalOpen(true);
    };

    const handleCreateEstimateIfNeeded = useCallback(() => {
        if (!editableEstimate && editableJob && currentUser) {
            const entity = businessEntities.find(e => e.id === editableJob.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            
            const newEstimate: Estimate = {
                id: `est_${Date.now()}_temp`,
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
    }, [editableEstimate, editableJob, businessEntities, estimates, currentUser]);

    const handleLineItemChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => { setEditableEstimate(prev => prev ? ({ ...prev, lineItems: (prev.lineItems || []).map(item => item.id === id ? { ...item, [field]: ['quantity', 'unitPrice', 'unitCost'].includes(field as string) ? parseFloat(value) || 0 : value } : item) }) : null); }, []);

    const addLineItem = (isLabor: boolean) => {
        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;

        const entity = businessEntities.find(e => e.id === editableJob.entityId);

        const newItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: isLabor ? 'Labor' : '',
            quantity: 1,
            unitPrice: isLabor ? (entity?.laborRate || 0) : 0,
            unitCost: isLabor ? (entity?.laborCostRate || 0) : 0,
            isLabor,
            taxCodeId: standardTaxRateId
        };

        setEditableEstimate(prev => prev ? ({
            ...prev,
            lineItems: [...(prev.lineItems || []), newItem]
        }) : null);
    };

    const addPackage = (packageId: string) => {
        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
    
        const newItems: EstimateLineItem[] = [];
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: totalCost, // Cost is distributed among children to avoid double counting
            isLabor: false, taxCodeId: standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
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

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        setNewPartDescription(searchTerm);
        setIsAddingPart(true);
        setActivePartSearch(null); // Close dropdown
    };

    const handleSaveNewPart = (part: Part) => {
        if (onSavePart) {
            onSavePart(part);
        }
        // Auto-select the newly created part for the target line item
        if (targetLineItemId) {
            handleSelectPart(targetLineItemId, part);
        }
        setIsAddingPart(false);
        setTargetLineItemId(null);
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

    const handleSaveMain = () => {
        if (!editableJob) { onClose(); return; }

        let jobToSave = { ...editableJob };
        
        if (editableEstimate) {
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

        setJobs(prevJobs => prevJobs.map(j => (j.id === jobToSave.id ? jobToSave : j)));
        onClose();
    };
    
    const handleCancelJob = () => {
        if (editableJob && onDelete) {
            if (confirm("Are you sure you want to cancel this job? It will be moved to the Cancelled status but retained in history.")) {
                onDelete(editableJob.id);
                onClose();
            }
        }
    };

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
                        currentJobHours={editableJob.estimatedHours}
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
                        onManageMedia={handleOpenLineItemMedia}
                        vehicle={vehicle}
                        onAddNewPart={handleAddNewPartClick}
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
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-bold text-gray-700">Technician Observations</h4>
                             <button onClick={handleOpenTechnicianMedia} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 border border-indigo-200">
                                <ImageIcon size={14}/> Photos & Videos
                             </button>
                        </div>
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
                         {job.status === 'Cancelled' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase">Cancelled</span>}
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
                            onViewCustomer={onViewCustomer}
                            onViewVehicle={onViewVehicle}
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
                <footer className="flex-shrink-0 flex justify-end gap-2 p-4 border-t bg-gray-50 items-center">
                    {currentUser.role === 'Admin' && job.status !== 'Cancelled' && (
                        <button 
                            type="button" 
                            onClick={handleCancelJob} 
                            className="flex items-center gap-2 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 mr-auto text-sm font-semibold"
                        >
                            <Ban size={14}/> Cancel Job
                        </button>
                    )}
                    
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Close</button>
                    <button type="button" onClick={handleSaveMain} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50" disabled={isReadOnly}><Save size={14}/> Save Changes</button>
                </footer>
            </div>
            
            {isMediaModalOpen && (
                <MediaManagerModal
                    isOpen={isMediaModalOpen}
                    onClose={() => setIsMediaModalOpen(false)}
                    title={mediaModalTitle}
                    initialMedia={mediaModalData}
                    onSave={(newMedia) => {
                        if (onMediaSaveCallback) onMediaSaveCallback(newMedia);
                        setIsMediaModalOpen(false);
                    }}
                />
            )}

            {isAddingPart && (
                <PartFormModal 
                    isOpen={isAddingPart}
                    onClose={() => { setIsAddingPart(false); setTargetLineItemId(null); }}
                    onSave={handleSaveNewPart}
                    part={{ description: newPartDescription }}
                    suppliers={[]} // Or pass fetched suppliers if available in props
                    taxRates={taxRates}
                />
            )}
        </div>
    );
};

export default EditJobModal;
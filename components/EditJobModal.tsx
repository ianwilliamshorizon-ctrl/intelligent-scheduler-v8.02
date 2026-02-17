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
import { getScoredServicePackages } from '../utils/servicePackageScoring';

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
    
    const data = useData();
    const { currentUser } = useApp();

    const {
        jobs, setJobs, vehicles, customers, engineers, estimates, setEstimates, purchaseOrders, setPurchaseOrders, suppliers, parts, servicePackages, taxRates, businessEntities, inspectionTemplates
    } = data;

    // Core Data Hooks with enhanced array safety
    const job = useMemo(() => Array.isArray(jobs) ? jobs.find(j => j.id === selectedJobId) : undefined, [jobs, selectedJobId]);
    
    const [editableJob, setEditableJob] = useState<Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<Estimate | null>(null);
    const [newObservation, setNewObservation] = useState('');
    const [activeTab, setActiveTab] = useState<'estimate' | 'inspection' | 'notes' | 'segments'>('estimate');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaModalTitle, setMediaModalTitle] = useState('');
    const [mediaModalData, setMediaModalData] = useState<CheckInPhoto[]>([]);
    const [onMediaSaveCallback, setOnMediaSaveCallback] = useState<((media: CheckInPhoto[]) => void) | null>(null);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');

    const canViewPricing = useMemo(() => {
        if (!currentUser) return false;
        return ['Admin', 'Dispatcher', 'Sales', 'Garage Concierge'].includes(currentUser.role);
    }, [currentUser]);

    const vehicle = useMemo(() => (job && Array.isArray(vehicles)) ? vehicles.find(v => v.id === job.vehicleId) : undefined, [job, vehicles]);
    const customer = useMemo(() => (job && Array.isArray(customers)) ? customers.find(c => c.id === job.customerId) : undefined, [job, customers]);
    const diagramImageId = useMemo(() => (Array.isArray(vehicle?.images)) ? vehicle?.images?.find(img => img.isPrimaryDiagram)?.id ?? null : null, [vehicle]);
    const taxRatesMap = useMemo(() => new Map((Array.isArray(taxRates) ? taxRates : []).map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => (Array.isArray(taxRates) ? taxRates : []).find(t => t.code === 'T1')?.id, [taxRates]);
    
    const mainEstimate = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return null;
        const currentEstimates = estimates;
        if (job.estimateId) {
            const byId = currentEstimates.find(e => e.id === job.estimateId);
            if (byId) return byId;
            const byNumber = currentEstimates.find(e => e.estimateNumber === job.estimateId);
            if (byNumber) return byNumber;
        }
        const linked = currentEstimates.filter(e => e.jobId === job.id);
        if (linked.length === 1) return linked[0];
        const converted = linked.find(e => e.status === 'Converted to Job');
        if (converted) return converted;
        const approved = linked.find(e => e.status === 'Approved');
        if (approved) return approved;
        return null;
    }, [job, estimates]);

    const supplementaryEstimates = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return [];
        const mainId = mainEstimate?.id;
        return estimates.filter(e => e.jobId === job.id && e.id !== mainId);
    }, [estimates, job, mainEstimate]);

    useEffect(() => {
        if (job) {
            const jobCopy = JSON.parse(JSON.stringify(job));
            if (!jobCopy.inspectionChecklist || jobCopy.inspectionChecklist.length === 0) {
                 const defaultTemplate = Array.isArray(inspectionTemplates) ? inspectionTemplates.find(t => t.isDefault) : undefined;
                 if (defaultTemplate) {
                    jobCopy.inspectionChecklist = defaultTemplate.sections.map(s => ({
                        id: s.id,
                        title: s.title,
                        items: s.items.map(i => ({ id: crypto.randomUUID(), label: i.label, status: 'na' })),
                        comments: ''
                    }));
                 } else { jobCopy.inspectionChecklist = []; }
            }
            if (!jobCopy.tyreCheck) jobCopy.tyreCheck = JSON.parse(JSON.stringify(initialTyreCheckData));
            if (!jobCopy.damagePoints) jobCopy.damagePoints = [];
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
    
    const sortedPackages = useMemo(() => {
        const allAvailable = Array.isArray(servicePackages) ? servicePackages : [];
        if (!vehicle) {
            return allAvailable.map(pkg => ({
                ...pkg,
                id: pkg.id,
                label: pkg.name || 'Unnamed Package',
                value: pkg.id,
                description: pkg.description || 'Service Package',
                badge: { text: 'Generic', className: 'bg-gray-100 text-gray-800' }
            }));
        }

        const scoredResults = getScoredServicePackages(allAvailable, vehicle);
        return scoredResults.map(({ pkg, matchType, color }) => ({
            ...pkg,
            id: pkg.id,
            label: pkg.name || 'Unnamed Package',
            value: pkg.id,
            description: pkg.description || 'Service Package',
            badge: { text: matchType, className: color }
        }));
    }, [servicePackages, vehicle, editableJob?.entityId]);

    const handleCreateEstimateIfNeeded = useCallback(() => {
        if (!editableEstimate && editableJob && currentUser) {
            const entity = Array.isArray(businessEntities) ? businessEntities.find(e => e.id === editableJob.entityId) : undefined;
            const entityShortCode = entity?.shortCode || 'UNK';
            const newEstimate: Estimate = {
                id: `est_${Date.now()}_temp`,
                estimateNumber: generateEstimateNumber(Array.isArray(estimates) ? estimates : [], entityShortCode),
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

    const handleLineItemChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => { 
        setEditableEstimate(prev => {
            if (!prev) return null;
            const lineItems = prev.lineItems || [];
            const targetItem = lineItems.find(i => i.id === id);
            let processedValue = value;
            if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                 processedValue = parseFloat(value) || 0;
            }
            let updatedLineItems = lineItems.map(item => item.id === id ? { ...item, [field]: processedValue } : item);
            if (targetItem && field === 'isOptional' && targetItem.servicePackageId && !targetItem.isPackageComponent) {
                 updatedLineItems = updatedLineItems.map(item => {
                      if (item.servicePackageId === targetItem.servicePackageId && item.isPackageComponent) {
                        return { ...item, isOptional: processedValue };
                      }
                     return item;
                });
            }
            return { ...prev, lineItems: updatedLineItems };
        });
    }, []);

    const addPackage = (selection: any) => {
        const packageId = selection?.value || selection?.id || selection;
        const pkg = Array.isArray(servicePackages) ? servicePackages.find(p => p.id === packageId) : undefined;
        if (!pkg) return;

        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;

        const isOptional = !!editableJob?.id; 
        const newItems: EstimateLineItem[] = [];
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name || (pkg as any).description || '',
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: 0,
            isLabor: false, 
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
            isOptional: isOptional
        };
        newItems.push(mainPackageItem);
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                newItems.push({ 
                    ...costItem, 
                    id: crypto.randomUUID(), 
                    unitPrice: 0, 
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true,
                    isOptional: isOptional
                });
            });
        }
        setEditableEstimate(prev => prev ? ({ ...prev, lineItems: [...(prev.lineItems || []), ...newItems] }) : null);
    };

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

    const addLineItem = (isLabor: boolean) => {
        const currentEstimate = handleCreateEstimateIfNeeded();
        if (!currentEstimate) return;
        const entity = Array.isArray(businessEntities) ? businessEntities.find(e => e.id === editableJob.entityId) : undefined;
        const newItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: isLabor ? 'Labor' : '',
            quantity: 1,
            unitPrice: isLabor ? (entity?.laborRate || 0) : 0,
            unitCost: isLabor ? (entity?.laborCostRate || 0) : 0,
            isLabor,
            taxCodeId: standardTaxRateId,
            isOptional: true
        };
        setEditableEstimate(prev => prev ? ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }) : null);
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
        if (!partSearchTerm || !Array.isArray(parts)) return [];
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
        setActivePartSearch(null);
    };

    const handleSaveNewPart = (part: Part) => {
        if (onSavePart) onSavePart(part);
        if (targetLineItemId) handleSelectPart(targetLineItemId, part);
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

    const linkedBooking = useMemo(() => Array.isArray(rentalBookings) ? rentalBookings.find(b => b.jobId === job?.id) : undefined, [rentalBookings, job]);
    
    const engineerMap = useMemo(() => new Map((Array.isArray(engineers) ? engineers : []).map(e => [e.id, e.name])), [engineers]);
    const supplierMap = useMemo(() => new Map((Array.isArray(suppliers) ? suppliers : []).map(s => [s.id, s.name])), [suppliers]);

    const handleBookCourtesyCar = () => { 
        if (!editableJob) return;
        const booking: Partial<RentalBooking> = { 
            jobId: editableJob.id, 
            customerId: editableJob.customerId, 
            bookingType: 'Courtesy Car', 
            startDate: `${editableJob.scheduledDate || formatDate(new Date())}T09:00`, 
            endDate: `${editableJob.scheduledDate || formatDate(new Date())}T17:00` 
        }; 
        onOpenRentalBooking(booking); 
    };

    const handleSaveMain = () => {
        if (!editableJob) { onClose(); return; }
        let jobToSave = { ...editableJob };
        if (editableEstimate) {
            if (editableEstimate.id.endsWith('_temp')) {
                 const realEstimate = { ...editableEstimate, id: `est_${Date.now()}` };
                 setEstimates(prev => [...(prev || []), realEstimate]);
                 jobToSave.estimateId = realEstimate.id;
            } else {
                 setEstimates(prev => (prev || []).map(e => e.id === editableEstimate.id ? editableEstimate : e));
            }
            const totalLaborHours = (editableEstimate.lineItems || []).filter(li => li.isLabor).reduce((sum, li) => sum + li.quantity, 0);
            jobToSave.estimatedHours = totalLaborHours;
        }
        setJobs(prevJobs => (prevJobs || []).map(j => (j.id === jobToSave.id ? jobToSave : j)));
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

    const renderTabs = () => {
        switch (activeTab) {
            case 'estimate':
                return (
                    <JobEstimateTab
                        partsStatus={editableJob.partsStatus || 'Not Required'}
                        purchaseOrderIds={editableJob.purchaseOrderIds || []}
                        purchaseOrders={Array.isArray(purchaseOrders) ? purchaseOrders : []}
                        supplierMap={supplierMap}
                        editableEstimate={editableEstimate}
                        supplementaryEstimates={supplementaryEstimates}
                        estimateBreakdown={estimateBreakdown}
                        isReadOnly={isReadOnly}
                        canViewPricing={canViewPricing}
                        taxRates={Array.isArray(taxRates) ? taxRates : []}
                        filteredParts={filteredParts}
                        activePartSearch={activePartSearch}
                        servicePackages={sortedPackages as any}
                        totalNet={totalNet}
                        vatBreakdown={vatBreakdown}
                        grandTotal={grandTotal}
                        currentJobHours={editableJob.estimatedHours || 0}
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
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-indigo-700">Edit Job #{job?.id}</h2>
                            <p className="text-sm text-gray-600">{job?.description}</p>
                        </div>
                        {job?.status === 'Cancelled' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase">Cancelled</span>}
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
                            rentalVehicleRegistration={linkedBooking ? (Array.isArray(vehicles) ? vehicles.find(v => v.id === linkedBooking.rentalVehicleId)?.registration : undefined) : undefined}
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
                                <p><strong>Invoice:</strong> {job?.invoiceId ? `#${job.invoiceId}` : 'Not Invoiced'}</p>
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
                    {currentUser.role === 'Admin' && job?.status !== 'Cancelled' && (
                        <button type="button" onClick={handleCancelJob} className="flex items-center gap-2 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 mr-auto text-sm font-semibold">
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
                    suppliers={[]} 
                    taxRates={Array.isArray(taxRates) ? taxRates : []}
                />
            )}
        </div>
    );
};

export default EditJobModal;

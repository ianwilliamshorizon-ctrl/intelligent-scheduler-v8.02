import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront, Image as ImageIcon, Ban, Expand } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateEstimateNumber } from '../core/utils/numberGenerators';
import SearchableSelect from './SearchableSelect';
import { JobInspectionTab } from './jobs/tabs/JobInspectionTab';
import { JobEstimateTab } from './jobs/tabs/JobEstimateTab';
import JobDetailsTab from './jobs/tabs/JobDetailsTab';
import { initialTyreCheckData } from '../core/data/initialChecklistData';
import MediaManagerModal from './MediaManagerModal';
import PartFormModal from './PartFormModal';
import { useWorkshopActions } from '../core/hooks/useWorkshopActions';
import { getScoredServicePackages } from '../utils/servicePackageScoring';

const NotesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    notes: string;
    onSave: (notes: string) => void;
    title?: string;
    isReadOnly?: boolean;
}> = ({ isOpen, onClose, notes, onSave, title = "Edit Notes", isReadOnly = false }) => {
    const [localNotes, setLocalNotes] = useState(notes);

    useEffect(() => {
        setLocalNotes(notes);
    }, [notes, isOpen]);

    const handleSave = () => {
        onSave(localNotes);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-bold">{title}</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <div className="flex-grow p-4">
                    <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        className="w-full h-full p-2 border rounded resize-none text-sm"
                        placeholder="Enter notes..."
                        readOnly={isReadOnly}
                    />
                </div>
                <footer className="p-4 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
                    {!isReadOnly && <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>}
                </footer>
            </div>
        </div>
    );
};


const EditJobModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedJobId: string;
    purchaseOrders: T.PurchaseOrder[];
    onOpenPurchaseOrder: (po: T.PurchaseOrder) => void;
    rentalBookings: T.RentalBooking[];
    onOpenRentalBooking: (booking: Partial<T.RentalBooking> | null) => void;
    onOpenConditionReport: (booking: T.RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onRaiseSupplementaryEstimate: (job: T.Job) => void;
    onViewEstimate: (estimate: T.Estimate) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
    onCheckIn: (job: T.Job) => void;
    onCheckOut: (job: T.Job) => void;
    onDelete?: (jobId: string) => void;
    generatePurchaseOrderId: (allPurchaseOrders: T.PurchaseOrder[], entityShortCode: string) => string;
}> = ({ isOpen, onClose, selectedJobId, purchaseOrders, onOpenPurchaseOrder, rentalBookings, onOpenRentalBooking, onOpenConditionReport, onRaiseSupplementaryEstimate, onViewEstimate, onViewCustomer, onViewVehicle, onCheckIn, onCheckOut, onDelete, generatePurchaseOrderId }) => {
    
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { handleSaveItem, handleDeleteJob } = useWorkshopActions();

    const {
        jobs, setJobs, vehicles, customers, engineers, estimates, setEstimates, suppliers, parts, setParts, servicePackages, taxRates, businessEntities, inspectionTemplates
    } = data;

    const job = useMemo(() => Array.isArray(jobs) ? jobs.find(j => j.id === selectedJobId) : undefined, [jobs, selectedJobId]);
    const [editableJob, setEditableJob] = useState<T.Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<T.Estimate | null>(null);
    const [newObservation, setNewObservation] = useState('');
    const [activeTab, setActiveTab] = useState<'estimate' | 'inspection' | 'notes' | 'segments'>('estimate');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaModalTitle, setMediaModalTitle] = useState('');
    const [mediaModalData, setMediaModalData] = useState<T.CheckInPhoto[]>([]);
    const [onMediaSaveCallback, setOnMediaSaveCallback] = useState<((media: T.CheckInPhoto[]) => void) | null>(null);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

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
        return estimates.find(e => e.id === job.estimateId) || null;
    }, [job, estimates]);

    const supplementaryEstimates = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return [];
        const mainId = mainEstimate?.id;
        return estimates.filter(e => e.jobId === job.id && e.id !== mainId);
    }, [estimates, job, mainEstimate]);

    const handleApplyInspectionTemplate = (template: T.InspectionTemplate) => {
        if (!template || !template.sections) return;

        const apply = () => {
            const newChecklist: T.ChecklistSection[] = template.sections.map(s => ({
                id: s.id || crypto.randomUUID(),
                title: s.title,
                items: (s.items || []).map(i => ({ 
                    id: i.id || crypto.randomUUID(), 
                    label: i.label, 
                    status: 'na' 
                })),
                comments: ''
            }));
            setEditableJob(prev => prev ? { ...prev, inspectionChecklist: newChecklist, inspectionTemplateId: template.id } : null);
            setConfirmation({ isOpen: true, title: 'Template Loaded', message: `Applied ${template.name}.`, type: 'success' });
        };

        if (editableJob?.inspectionChecklist && editableJob.inspectionChecklist.length > 0) {
             setConfirmation({
                isOpen: true,
                title: 'Overwrite Confirmation',
                message: 'This will replace the current inspection checklist. Are you sure?',
                type: 'warning',
                onConfirm: () => apply(),
            });
        } else {
            apply();
        }
    };

    useEffect(() => {
        if (job) {
            const jobCopy = JSON.parse(JSON.stringify(job));
            if (!jobCopy.inspectionChecklist) jobCopy.inspectionChecklist = [];
            if (!jobCopy.tyreCheck) jobCopy.tyreCheck = JSON.parse(JSON.stringify(initialTyreCheckData));
            if (!jobCopy.damagePoints) jobCopy.damagePoints = [];
            setEditableJob(jobCopy);
            
            const currentEstimate = mainEstimate ? JSON.parse(JSON.stringify(mainEstimate)) : null;
            setEditableEstimate(currentEstimate);
            setActiveTab('estimate');
        } else {
            setEditableJob(null);
            setEditableEstimate(null);
        }
    }, [job, isOpen, mainEstimate]);

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
    }, [servicePackages, vehicle]);

    const handleCreateEstimateIfNeeded = useCallback(() => {
        if (!editableEstimate && editableJob && currentUser) {
            const entity = Array.isArray(businessEntities) ? businessEntities.find(e => e.id === editableJob.entityId) : undefined;
            const entityShortCode = entity?.shortCode || 'UNK';
            const newEstimate: T.Estimate = {
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

    const handleLineItemChange = useCallback((id: string, field: keyof T.EstimateLineItem, value: any) => { 
        setEditableEstimate(prev => {
            if (!prev) return null;
            let processedValue = value;
            if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                 processedValue = parseFloat(value) || 0;
            }
            let updatedLineItems = (prev.lineItems || []).map(item => item.id === id ? { ...item, [field]: processedValue } : item);
            return { ...prev, lineItems: updatedLineItems };
        });
    }, []);

    const addPackage = (selection: any) => {
        const packageId = selection?.value || selection?.id || selection;
        const pkg = Array.isArray(servicePackages) ? servicePackages.find(p => p.id === packageId) : undefined;
        if (!pkg) return;
        handleCreateEstimateIfNeeded();

        setEditableEstimate(prev => {
            if (!prev) return null;
            const newItems: T.EstimateLineItem[] = [];
            const mainPackageItem: T.EstimateLineItem = {
                id: crypto.randomUUID(),
                description: pkg.name || '',
                quantity: 1,
                unitPrice: pkg.totalPrice,
                unitCost: 0,
                isLabor: false, 
                taxCodeId: pkg.taxCodeId || standardTaxRateId,
                servicePackageId: pkg.id,
                servicePackageName: pkg.name,
                isPackageComponent: false,
                isOptional: true
            };
            newItems.push(mainPackageItem);
            (pkg.costItems || []).forEach(costItem => {
                newItems.push({ 
                    ...costItem, 
                    id: crypto.randomUUID(), 
                    unitPrice: 0, 
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true,
                    isOptional: true
                });
            });
            return { ...prev, lineItems: [...(prev.lineItems || []), ...newItems] };
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableJob(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleAddObservation = () => {
        if (!newObservation.trim() || !editableJob) return;
        const updatedObservations = [...(editableJob.technicianObservations || []), newObservation];
        setEditableJob({ ...editableJob, technicianObservations: updatedObservations });
        setNewObservation('');
    };

    const handleRemoveObservation = (index: number) => {
        if (!editableJob) return;
        const updatedObservations = (editableJob.technicianObservations || []).filter((_, i) => i !== index);
        setEditableJob({ ...editableJob, technicianObservations: updatedObservations });
    };
    
    const handleOpenTechnicianMedia = () => {
        if (!editableJob) return;
        setMediaModalTitle('Manage Technical Photos/Videos');
        setMediaModalData(editableJob.technicianImages || []);
        setOnMediaSaveCallback(() => (newMedia: T.CheckInPhoto[]) => {
            setEditableJob(prev => prev ? { ...prev, technicianImages: newMedia } : null);
        });
        setIsMediaModalOpen(true);
    };

    const handleOpenLineItemMedia = (itemId: string) => {
        const item = editableEstimate?.lineItems?.find(li => li.id === itemId);
        if (!item) return;
        setMediaModalTitle(`Media for: ${item.description || 'Line Item'}`);
        setMediaModalData(item.media || []);
        setOnMediaSaveCallback(() => (newMedia: T.CheckInPhoto[]) => {
            handleLineItemChange(itemId, 'media', newMedia);
        });
        setIsMediaModalOpen(true);
    };

    const addLineItem = (isLabor: boolean) => {
        handleCreateEstimateIfNeeded();
        setEditableEstimate(prev => {
            if (!prev) return null;
            const entity = Array.isArray(businessEntities) ? businessEntities.find(e => e.id === editableJob?.entityId) : undefined;
            const newItem: T.EstimateLineItem = {
                id: crypto.randomUUID(),
                description: isLabor ? 'Labor' : '',
                quantity: 1,
                unitPrice: isLabor ? (entity?.laborRate || 0) : 0,
                unitCost: isLabor ? (entity?.laborCostRate || 0) : 0,
                isLabor,
                taxCodeId: standardTaxRateId,
                isOptional: true
            };
            return { ...prev, lineItems: [...(prev.lineItems || []), newItem] };
        });
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

    const handleSelectPart = (lineItemId: string, part: T.Part) => {
        handleLineItemChange(lineItemId, 'partNumber', part.partNumber);
        handleLineItemChange(lineItemId, 'description', part.description);
        handleLineItemChange(lineItemId, 'unitPrice', part.salePrice);
        handleLineItemChange(lineItemId, 'unitCost', part.costPrice);
        handleLineItemChange(lineItemId, 'partId', part.id);
        handleLineItemChange(lineItemId, 'taxCodeId', part.taxCodeId || standardTaxRateId);
        handleLineItemChange(lineItemId, 'fromStock', part.stockQuantity > 0);
        setActivePartSearch(null);
        setPartSearchTerm('');
    };

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        setNewPartDescription(searchTerm);
        setIsAddingPart(true);
        setActivePartSearch(null);
    };

    const handleSaveNewPart = async (part: T.Part) => {
        const savedPart = await handleSaveItem(setParts, part, 'brooks_parts');
        if (targetLineItemId) handleSelectPart(targetLineItemId, savedPart);
        setIsAddingPart(false);
        setTargetLineItemId(null);
    };

    const estimateBreakdown = useMemo(() => {
        if (!editableEstimate) return { packages: [], standaloneLabor: [], standaloneParts: [] };
        const packagesMap = new Map<string, { header: T.EstimateLineItem, children: T.EstimateLineItem[] }>();
        const standaloneLabor: T.EstimateLineItem[] = [];
        const standaloneParts: T.EstimateLineItem[] = [];
        (editableEstimate.lineItems || []).forEach(item => {
            if (item.servicePackageId) {
                if (!item.isPackageComponent) {
                    packagesMap.set(item.servicePackageId, { header: item, children: [] });
                } 
            } else {
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
    const supplierMap = useMemo(() => new Map((Array.isArray(suppliers) ? suppliers : []).map(s => [s.id, s.name])), [suppliers]);
    const engineerMap = useMemo(() => new Map((Array.isArray(engineers) ? engineers : []).map(e => [e.id, e.name])), [engineers]);

    const derivedPartsStatus = useMemo(() => {
        if (!job) return 'Not Required';
        const poIds = job.purchaseOrderIds || [];
        const hasPartsOnEstimate = (editableEstimate?.lineItems || []).some(li => !li.isLabor && (li.partId || li.partNumber));
    
        if (poIds.length === 0) {
            return hasPartsOnEstimate ? 'Awaiting Parts' : 'Not Required';
        }
    
        const relatedPOs = purchaseOrders.filter(po => poIds.includes(po.id));
    
        if (relatedPOs.length === 0) {
            return hasPartsOnEstimate ? 'Awaiting Parts' : 'Not Required';
        }
        
        const allCompleted = relatedPOs.every(po => po.status === 'Received' || po.status === 'Finalized');
        if (allCompleted) {
            return 'Fully Received';
        }

        const anyReceived = relatedPOs.some(po => po.status === 'Received' || po.status === 'Finalized' || po.status === 'Partially Received');
        if (anyReceived) {
            return 'Partially Received';
        }
    
        const anySent = relatedPOs.some(po => po.status === 'Ordered');
        if (anySent) {
            return 'Ordered';
        }
        
        return 'Awaiting Order';
    }, [job, purchaseOrders, editableEstimate]);

    useEffect(() => {
        if (editableJob && derivedPartsStatus !== editableJob.partsStatus) {
            setEditableJob(prev => prev ? { ...prev, partsStatus: derivedPartsStatus } : null);
        }
    }, [derivedPartsStatus, editableJob]);


    const handleSaveMain = async () => {
        if (!editableJob) {
            onClose();
            return;
        }
    
        let jobToSave = { ...editableJob };
    
        if (editableEstimate) {
            let estimateToSave = { ...editableEstimate };
            let newEstimateId: string | null = null;
    
            if (estimateToSave.id.endsWith('_temp')) {
                estimateToSave.id = `est_${Date.now()}`;
                newEstimateId = estimateToSave.id;
            }
    
            // Intentionally not awaiting here to allow parallel saving
            handleSaveItem(setEstimates, estimateToSave, 'brooks_estimates');
    
            if (newEstimateId) {
                jobToSave.estimateId = newEstimateId;
            }
    
            const totalLaborHours = (estimateToSave.lineItems || [])
                .filter(li => li.isLabor)
                .reduce((sum, li) => sum + Number(li.quantity || 0), 0);
            jobToSave.estimatedHours = totalLaborHours;
        }
    
        await handleSaveItem(setJobs, jobToSave, 'brooks_jobs');
    
        onClose();
    };
    
    const handleCancelJob = () => {
        if (editableJob) {
            setConfirmation({
                isOpen: true,
                title: 'Confirm Cancellation',
                message: 'Are you sure you want to cancel this job? It will be moved to the Cancelled status but retained in history.',
                type: 'warning',
                onConfirm: async () => {
                    if(onDelete) onDelete(editableJob.id);
                    onClose();
                }
            });
        }
    };

    const jobRelatedPOs = useMemo(() => {
        const poIds = job?.purchaseOrderIds || [];
        return purchaseOrders.filter(po => poIds.includes(po.id));
    }, [job, purchaseOrders]);

    const poStatusKey = useMemo(() => {
        return jobRelatedPOs.map(po => `${po.id}:${po.status}`).join(',');
    }, [jobRelatedPOs]);

    const renderTabs = () => {
        switch (activeTab) {
            case 'estimate':
                return (
                    <JobEstimateTab
                        key={poStatusKey}
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
                        onOpenPurchaseOrder={(stalePo: T.PurchaseOrder) => {
                            const freshPo = purchaseOrders.find(p => p.id === stalePo.id);
                            if (freshPo) {
                                onOpenPurchaseOrder(freshPo);
                            } else {
                                onOpenPurchaseOrder(stalePo);
                            }
                        }}
                        onCreateEstimate={handleCreateEstimateIfNeeded}
                        onRaiseSupplementaryEstimate={() => editableJob && onRaiseSupplementaryEstimate(editableJob)}
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
                        onApplyTemplate={handleApplyInspectionTemplate}
                        selectedTemplateId={editableJob.inspectionTemplateId}
                    />
                );
            case 'notes':
                 return (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-bold text-gray-700">Technician Observations</h4>
                             <div className="flex items-center gap-2">
                                 <button onClick={() => setIsNotesModalOpen(true)} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm">
                                     <Expand size={14}/> Expand
                                 </button>
                                 <button onClick={handleOpenTechnicianMedia} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 border border-indigo-200">
                                    <ImageIcon size={14}/> Photos & Videos
                                 </button>
                             </div>
                        </div>
                        {(editableJob.technicianObservations || []).map((obs, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-md">
                                <span>{obs}</span>
                                {!isReadOnly && <button onClick={() => handleRemoveObservation(index)}><Trash2 size={14} className="text-red-500"/></button>}
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
                         {editableJob.segments.length === 0 && <p className="text-xs text-gray-500">No segments allocated.</p>}
                    </div>
                );
        }
    };

    if (!isOpen || !editableJob) return null;

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
                            onBookCourtesyCar={() => {
                                if (!editableJob) return;
                                const booking: Partial<T.RentalBooking> = { 
                                    jobId: editableJob.id, 
                                    customerId: editableJob.customerId, 
                                    bookingType: 'Courtesy Car', 
                                    startDate: `${editableJob.scheduledDate || formatDate(new Date())}T09:00`, 
                                    endDate: `${editableJob.scheduledDate || formatDate(new Date())}T17:00` 
                                }; 
                                onOpenRentalBooking(booking); 
                            }}
                            onOpenRentalBooking={onOpenRentalBooking}
                            onOpenConditionReport={onOpenConditionReport}
                            onChange={handleChange}
                            onViewCustomer={onViewCustomer}
                            onViewVehicle={onViewVehicle}
                            engineers={engineers || []}
                            onCheckIn={() => editableJob && onCheckIn(editableJob)}
                            onCheckOut={() => editableJob && onCheckOut(editableJob)}
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
                    {currentUser?.role === 'Admin' && job?.status !== 'Cancelled' && (
                        <button type="button" onClick={handleCancelJob} className="flex items-center gap-2 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 mr-auto text-sm font-semibold">
                            <Ban size={14}/> Cancel Job
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Close</button>
                    <button type="button" onClick={handleSaveMain} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50" disabled={isReadOnly}><Save size={14}/> Save Changes</button>
                </footer>
            </div>

            <NotesModal 
                isOpen={isNotesModalOpen} 
                onClose={() => setIsNotesModalOpen(false)} 
                notes={(editableJob.technicianObservations || []).join('\n')} 
                onSave={(newNotes) => setEditableJob(prev => ({...prev, technicianObservations: newNotes.split('\n')}))} 
                title="Technician Observations" 
                isReadOnly={isReadOnly} 
            />
            
            {isMediaModalOpen && (
                <MediaManagerModal
                    isOpen={isMediaModalOpen}
                    onClose={() => setIsMediaModalOpen(false)}
                    title={mediaModalTitle}
                    initialMedia={mediaModalData}
                    onSave={(newMedia) => {
                        if (onMediaSaveCallback) {
                            onMediaSaveCallback(newMedia);
                        }
                        setIsMediaModalOpen(false);
                    }}
                />
            )}

            {isAddingPart && (
                <PartFormModal 
                    isOpen={isAddingPart}
                    onClose={() => { setIsAddingPart(false); setTargetLineItemId(null); }}
                    onSave={handleSaveNewPart}
                    part={{
                        id: `new_${Date.now()}`,
                        partNumber: '',
                        description: newPartDescription,
                        stockQuantity: 0,
                        costPrice: 0,
                        salePrice: 0,
                        taxCodeId: standardTaxRateId || '',
                        defaultSupplierId: '',
                        isStockItem: false,
                    }}
                    suppliers={suppliers || []} 
                    taxRates={taxRates || []}
                />
            )}
        </div>
    );
};

export default EditJobModal;

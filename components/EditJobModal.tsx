import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront, Image as ImageIcon, Ban, Expand, Loader2, Printer, CalendarDays } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateEstimateNumber } from '../core/utils/numberGenerators';
import SearchableSelect from './SearchableSelect';
import { JobEstimateTab } from './jobs/tabs/JobEstimateTab';
import JobDetailsTab from './jobs/tabs/JobDetailsTab';
import MediaManagerModal from './MediaManagerModal';
import PartFormModal from './PartFormModal';
import { useWorkshopActions } from '../core/hooks/useWorkshopActions';
import { getScoredServicePackages } from '../utils/servicePackageScoring';
import { generateServicePackageName } from '../core/services/geminiService';
import ServicePackageFormModal from './ServicePackageFormModal';
import { useReactToPrint } from 'react-to-print';
import PrintableJobCard from './PrintableJobCard';
import InspectionChecklist from './InspectionChecklist';
import { calculatePackagePrices } from '../core/utils/packageUtils';
import { useDebouncedSave } from '../core/hooks/useDebouncedSave';

const EditJobModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedJobId: string;
    purchaseOrders: T.PurchaseOrder[];
    onOpenPurchaseOrder: (po: T.PurchaseOrder) => void;
    onRaiseSupplementaryEstimate: (job: T.Job) => void;
    onViewEstimate: (estimate: T.Estimate) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
    onCheckIn: (job: T.Job) => void;
    onCheckOut: (job: T.Job) => void;
    onDelete?: (jobId: string) => void;
    generatePurchaseOrderId: (allPurchaseOrders: T.PurchaseOrder[], entityShortCode: string) => string;
    rentalBookings: T.RentalBooking[];
    onOpenRentalBooking: (booking: T.RentalBooking) => void;
    onOpenConditionReport: (booking: T.RentalBooking, mode: 'checkIn' | 'checkOut') => void;
    forceRefresh: (collectionKey: string) => Promise<void>;
}> = ({ 
    isOpen, 
    onClose, 
    selectedJobId, 
    purchaseOrders, 
    onOpenPurchaseOrder, 
    onRaiseSupplementaryEstimate, 
    onViewEstimate, 
    onViewCustomer, 
    onViewVehicle, 
    onCheckIn, 
    onCheckOut, 
    onDelete, 
    generatePurchaseOrderId,
    rentalBookings,
    onOpenRentalBooking,
    onOpenConditionReport,
    forceRefresh
}) => {
    
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { handleSaveItem } = useWorkshopActions();

    const {
        jobs, setJobs, vehicles, customers, estimates, setEstimates, suppliers, parts, setParts, servicePackages, taxRates, businessEntities, setServicePackages, engineers, inspectionTemplates
    } = data;

    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
    const safeCustomers = Array.isArray(customers) ? customers : [];
    const safeEstimates = Array.isArray(estimates) ? estimates : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const safeParts = Array.isArray(parts) ? parts : [];
    const safeServicePackages = Array.isArray(servicePackages) ? servicePackages : [];
    const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
    const safeBusinessEntities = Array.isArray(businessEntities) ? businessEntities : [];
    const safeEngineers = Array.isArray(engineers) ? engineers : [];
    const safeInspectionTemplates = Array.isArray(inspectionTemplates) ? inspectionTemplates : [];
    const safePurchaseOrders = Array.isArray(purchaseOrders) ? purchaseOrders : [];
    const safeRentalBookings = Array.isArray(rentalBookings) ? rentalBookings : [];

    const [activeTab, setActiveTab] = useState('estimates');
    const [editableJob, setEditableJob] = useState<T.Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<T.Estimate | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printBlankSheet, setPrintBlankSheet] = useState(true);
    const componentToPrintRef = useRef<HTMLDivElement>(null);
    const [isRaisingPOs, setIsRaisingPOs] = useState(false);

    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaModalTitle, setMediaModalTitle] = useState('');
    const [mediaModalData, setMediaModalData] = useState<T.CheckInPhoto[]>([]);
    const [onMediaSaveCallback, setOnMediaSaveCallback] = useState<((media: T.CheckInPhoto[]) => void) | null>(null);
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [partToEdit, setPartToEdit] = useState<Partial<T.Part> | null>(null);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<T.ServicePackage> | null>(null);

    const job = useMemo(() => (Array.isArray(jobs) ? jobs : []).find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    const vehicle = useMemo(() => job ? (Array.isArray(vehicles) ? vehicles : []).find(v => v.id === job.vehicleId) : undefined, [job, vehicles]);
    const customer = useMemo(() => job ? (Array.isArray(customers) ? customers : []).find(c => c.id === job.customerId) : undefined, [job, customers]);
    const businessEntity = useMemo(() => (Array.isArray(businessEntities) ? businessEntities : []).find(e => e.id === editableJob?.entityId), [businessEntities, editableJob?.entityId]);
    
    const { isSaving, lastSaved } = useDebouncedSave('brooks_jobs', editableJob, 1500);


    const mainEstimate = useMemo(() => {
        if (!job) return null;
        return safeEstimates.find(e => e.id === job.estimateId) || null;
    }, [job, safeEstimates]);
    const supplementaryEstimates = useMemo(() => {
        if (!job) return [];
        const mainId = mainEstimate?.id;
        return safeEstimates.filter(e => e.jobId === job.id && e.id !== mainId);
    }, [safeEstimates, job, mainEstimate]);

    const handlePrint = useReactToPrint({
        contentRef: componentToPrintRef,
        documentTitle: `JobCard_${editableJob?.id}`,
        onAfterPrint: () => setIsPrinting(false),
    });

    const triggerPrint = useCallback(() => {
        if (editableJob && vehicle && customer) {
            setIsPrinting(true);
            handlePrint();
        } else {
            setConfirmation({
                isOpen: true,
                title: 'Cannot Print',
                message: 'Required data (Job, Vehicle, or Customer) is missing.',
                type: 'warning'
            });
        }
    }, [editableJob, vehicle, customer, handlePrint, setConfirmation]);

    const canViewPricing = useMemo(() => {
        if (!currentUser) return false;
        return ['Admin', 'Director', 'Sales'].includes(currentUser.role);
    }, [currentUser]);

    const taxRatesMap = useMemo(() => new Map(safeTaxRates.map(t => [t.id, t])), [safeTaxRates]);
    const standardTaxRateId = useMemo(() => safeTaxRates.find(t => t.code === 'T1')?.id, [safeTaxRates]);
    const t99RateId = useMemo(() => safeTaxRates.find(t => t.code === 'T99')?.id, [safeTaxRates]);
    const vehicleImage = useMemo(() => {
        if (vehicle && Array.isArray(vehicle.images)) {
            return vehicle.images.find(img => img.isPrimaryDiagram) || vehicle.images[0];
        }
        return null;
    }, [vehicle]);

    useEffect(() => {
        if (isOpen && job) {
            const jobCopy = JSON.parse(JSON.stringify(job));
            const obs = jobCopy.technicianObservations || [];
            jobCopy.technicianObservations = [...obs, ...Array(Math.max(0, 10 - obs.length)).fill('')].slice(0, 10);
            if (!jobCopy.inspectionChecklist && safeInspectionTemplates.some(t => t.isDefault)) {
                const defaultTemplate = safeInspectionTemplates.find(t => t.isDefault);
                if (defaultTemplate) {
                    jobCopy.inspectionTemplateId = defaultTemplate.id;
                    jobCopy.inspectionChecklist = (defaultTemplate.sections || []).map(s => ({
                        ...s,
                        id: crypto.randomUUID(),
                        items: (s.items || []).map(i => ({ ...i, id: crypto.randomUUID(), status: 'na' }))
                    }));
                }
            }
            setEditableJob(jobCopy);
        } else if (!isOpen) {
            setEditableJob(null);
        }
    }, [isOpen, job, safeInspectionTemplates]);

    useEffect(() => {
        if (isOpen) {
            const currentEstimate = mainEstimate ? JSON.parse(JSON.stringify(mainEstimate)) : null;
            setEditableEstimate(currentEstimate);
        } else if (!isOpen) {
            setEditableEstimate(null);
        }
    }, [isOpen, mainEstimate]);

    const isReadOnly = !!editableJob?.invoiceId;

    const sortedPackages = useMemo(() => {
        if (!vehicle) {
            return safeServicePackages.map(pkg => ({ ...pkg, id: pkg.id, label: pkg.name || 'Unnamed Package', value: pkg.id, description: pkg.description || 'Service Package', badge: { text: 'Generic', className: 'bg-gray-100 text-gray-800' } }));
        }
        const scoredResults = getScoredServicePackages(safeServicePackages, vehicle);
        return scoredResults.map(({ pkg, matchType, color }) => ({ ...pkg, id: pkg.id, label: pkg.name || 'Unnamed Package', value: pkg.id, description: pkg.description || 'Service Package', badge: { text: matchType, className: color } }));
    }, [safeServicePackages, vehicle]);

    const handleCreateEstimateIfNeeded = useCallback(() => {
        if (!editableEstimate && editableJob && currentUser) {
            const entity = safeBusinessEntities.find(e => e.id === editableJob.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            const newEstimate: T.Estimate = {
                id: `est_${Date.now()}_temp`,
                estimateNumber: generateEstimateNumber(safeEstimates, entityShortCode),
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
    }, [editableEstimate, editableJob, safeBusinessEntities, safeEstimates, currentUser]);

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

    const addPackage = useCallback(async (selection: any) => {
        const packageId = selection?.value || selection?.id || selection;
        const pkg = safeServicePackages.find(p => p.id === packageId);
        if (!pkg) return;
    
        const estimate = handleCreateEstimateIfNeeded();
        let currentLineItems = estimate?.lineItems || [];
    
        const { net, vat } = calculatePackagePrices(pkg, safeTaxRates);
        const mainPackageItem: T.EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name || '',
            quantity: 1,
            unitPrice: net,
            unitCost: 0,
            isLabor: false,
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
            isOptional: true,
            preCalculatedVat: pkg.taxCodeId === t99RateId ? vat : undefined,
        };
        currentLineItems.push(mainPackageItem);
    
        for (const costItem of (pkg.costItems || [])) {
            let part = safeParts.find(p => p.partNumber === costItem.partNumber && p.partNumber);
            if (!part && costItem.partNumber) {
                const newPart: T.Part = {
                    id: `new_${Date.now()}`,
                    partNumber: costItem.partNumber,
                    description: costItem.description,
                    stockQuantity: 0,
                    costPrice: costItem.unitCost || 0,
                    salePrice: (costItem.unitCost || 0) * 1.2, // Default 20% markup
                    taxCodeId: standardTaxRateId || '',
                    defaultSupplierId: '',
                    isStockItem: false
                };
                part = await handleSaveItem(setParts, newPart, 'brooks_parts');
            }
    
            const newItem: T.EstimateLineItem = {
                id: crypto.randomUUID(),
                description: costItem.description,
                quantity: costItem.quantity,
                unitPrice: 0,
                unitCost: part ? part.costPrice : costItem.unitCost,
                partNumber: costItem.partNumber,
                partId: part ? part.id : undefined,
                isLabor: costItem.isLabor,
                servicePackageId: pkg.id,
                servicePackageName: pkg.name,
                isPackageComponent: true,
                isOptional: true,
                supplierId: part ? part.defaultSupplierId : undefined,
            };
            currentLineItems.push(newItem);
        }
    
        setEditableEstimate(prev => ({ ...prev!, lineItems: currentLineItems }));
    
    }, [safeServicePackages, handleCreateEstimateIfNeeded, safeTaxRates, standardTaxRateId, t99RateId, safeParts, handleSaveItem, setParts]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableJob(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleTechObservationChange = (index: number, value: string) => {
        setEditableJob(prev => {
            if (!prev) return null;
            const newObservations = [...(prev.technicianObservations || [])];
            newObservations[index] = value;
            return { ...prev, technicianObservations: newObservations };
        });
    };

    const handleInspectionTemplateChange = (templateId: string) => {
        const template = safeInspectionTemplates.find(t => t.id === templateId);
        if (template && editableJob) {
            setEditableJob({
                ...editableJob,
                inspectionTemplateId: template.id,
                inspectionChecklist: (template.sections || []).map(s => ({
                    ...s,
                    id: crypto.randomUUID(),
                    items: (s.items || []).map(i => ({ ...i, id: crypto.randomUUID(), status: 'na' }))
                }))
            });
        }
    };

    const handleAddDamagePoint = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const notes = prompt('Enter notes for this damage point:');
        if (notes !== null) {
            const newPoint: T.VehicleDamagePoint = { id: crypto.randomUUID(), x, y, notes };
            setEditableJob(prev => prev ? { ...prev, damagePoints: [...(prev.damagePoints || []), newPoint] } : null);
        }
    };

    const handleDamagePointClick = (pointId: string) => {
        if (isReadOnly) return;
        if (window.confirm('Do you want to remove this damage point?')) {
            setEditableJob(prev => prev ? { ...prev, damagePoints: (prev.damagePoints || []).filter(p => p.id !== pointId) } : null);
        }
    };

    const handleTyreDataChange = (location: T.TyreLocation, field: keyof Omit<T.TyreData, 'indicator' | 'comments'>, value: string) => {
        setEditableJob(prev => {
            if (!prev) return null;
            const newTyreCheck = { ...(prev.tyreCheck || {}) } as T.TyreCheckData;
            if (!newTyreCheck[location]) { newTyreCheck[location] = { indicator: 'na' }; }
            (newTyreCheck[location] as any)[field] = parseFloat(value) || 0;
            return { ...prev, tyreCheck: newTyreCheck };
        });
    };
    
    const handleTyreTextDataChange = (location: T.TyreLocation, field: 'comments', value: string) => {
        setEditableJob(prev => {
            if (!prev) return null;
            const newTyreCheck = { ...(prev.tyreCheck || {}) } as T.TyreCheckData;
            if (!newTyreCheck[location]) { newTyreCheck[location] = { indicator: 'na' }; }
            newTyreCheck[location][field] = value;
            return { ...prev, tyreCheck: newTyreCheck };
        });
    };
    
    const handleTyreStatusChange = (location: T.TyreLocation, status: T.ChecklistItemStatus) => {
        setEditableJob(prev => {
            if (!prev) return null;
            const newTyreCheck = { ...(prev.tyreCheck || {}) } as T.TyreCheckData;
            if (!newTyreCheck[location]) { newTyreCheck[location] = { indicator: 'na' }; }
            newTyreCheck[location].indicator = status;
            return { ...prev, tyreCheck: newTyreCheck };
        });
    };

    const handleOpenLineItemMedia = (itemId: string) => {
        const item = (editableEstimate?.lineItems || []).find(li => li.id === itemId);
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
            const entity = safeBusinessEntities.find(e => e.id === editableJob?.entityId);
            const newItem: T.EstimateLineItem = { id: crypto.randomUUID(), description: isLabor ? 'Labor' : '', quantity: 1, unitPrice: isLabor ? (entity?.laborRate || 0) : 0, unitCost: isLabor ? (entity?.laborCostRate || 0) : 0, isLabor, taxCodeId: standardTaxRateId, isOptional: true };
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
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return safeParts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    }, [partSearchTerm, safeParts]);

    const handleRaisePurchaseOrders = useCallback(async () => {
        if (!editableJob || !editableEstimate || !vehicle || isRaisingPOs) return;
    
        setIsRaisingPOs(true);
        try {
            const itemsToOrder = (editableEstimate.lineItems || []).filter(li => !li.isLabor && li.partId && !li.fromStock && !li.purchaseOrderLineItemId);
    
            if (itemsToOrder.length === 0) {
                setConfirmation({ isOpen: true, title: 'No Parts to Order', message: 'There are no new parts on this estimate that require ordering.', type: 'info' });
                return;
            }
    
            const supplierGroups = new Map<string, T.EstimateLineItem[]>();
            itemsToOrder.forEach(lineItem => {
                const part = safeParts.find(p => p.id === lineItem.partId);
                if (!part) return;
                const supplierId = lineItem.supplierId || part.defaultSupplierId || 'UNKNOWN';
                if (!supplierGroups.has(supplierId)) {
                    supplierGroups.set(supplierId, []);
                }
                supplierGroups.get(supplierId)!.push(lineItem);
            });
    
            const posToUpdate: T.PurchaseOrder[] = [];
            const newPOs: T.PurchaseOrder[] = [];
            const newPoIdsToLink: string[] = [];
            let updatedLineItems = [...(editableEstimate.lineItems || [])];
            const entity = safeBusinessEntities.find(e => e.id === editableJob.entityId);
            const entityShortCode = entity?.shortCode || 'UNK';
            const jobPoIds = editableJob.purchaseOrderIds || [];
            const jobPOs = safePurchaseOrders.filter(po => jobPoIds.includes(po.id));
    
            supplierGroups.forEach((items, supplierId) => {
                const existingDraftPO = jobPOs.find(po => po.status === 'Draft' && (po.supplierId === supplierId || (supplierId === 'UNKNOWN' && !po.supplierId)));
                if (existingDraftPO) {
                    const newPoLineItems: T.PurchaseOrderLineItem[] = items.map(item => {
                        const newPoLineItemId = crypto.randomUUID();
                        const part = safeParts.find(p => p.id === item.partId!)!;
                        const originalIndex = updatedLineItems.findIndex(li => li.id === item.id);
                        if (originalIndex !== -1) {
                            updatedLineItems[originalIndex] = { ...updatedLineItems[originalIndex], purchaseOrderLineItemId: newPoLineItemId };
                        }
                        return { id: newPoLineItemId, partNumber: part.partNumber, description: part.description, quantity: item.quantity, unitPrice: part.costPrice, taxCodeId: part.taxCodeId };
                    });
                    const updatedPO = { ...existingDraftPO, lineItems: [...(existingDraftPO.lineItems || []), ...newPoLineItems] };
                    posToUpdate.push(updatedPO);
                } else {
                    const newPoId = generatePurchaseOrderId(safePurchaseOrders.concat(newPOs), entityShortCode);
                    newPoIdsToLink.push(newPoId);
                    const poLineItems: T.PurchaseOrderLineItem[] = items.map(item => {
                        const newPoLineItemId = crypto.randomUUID();
                        const part = safeParts.find(p => p.id === item.partId!)!;
                        const originalIndex = updatedLineItems.findIndex(li => li.id === item.id);
                        if (originalIndex !== -1) {
                            updatedLineItems[originalIndex] = { ...updatedLineItems[originalIndex], purchaseOrderLineItemId: newPoLineItemId };
                        }
                        return { id: newPoLineItemId, partNumber: part.partNumber, description: part.description, quantity: item.quantity, unitPrice: part.costPrice, taxCodeId: part.taxCodeId };
                    });
                    const newPo: T.PurchaseOrder = { id: newPoId, entityId: editableJob.entityId, supplierId: supplierId === 'UNKNOWN' ? undefined : supplierId, vehicleRegistrationRef: vehicle.registration, orderDate: formatDate(new Date()), status: 'Draft', lineItems: poLineItems, notes: `Generated from Job #${editableJob.id}` };
                    newPOs.push(newPo);
                }
            });
    
            const allPOsToSave = [...newPOs, ...posToUpdate];
            if (allPOsToSave.length > 0) {
                const poSavePromises = allPOsToSave.map(po => handleSaveItem(data.setPurchaseOrders, po, 'brooks_purchaseOrders'));
                await Promise.all(poSavePromises);
                const newEstimateState = { ...editableEstimate, lineItems: updatedLineItems };
                setEditableEstimate(newEstimateState);
                await handleSaveItem(setEstimates, newEstimateState, 'brooks_estimates');
                if (newPoIdsToLink.length > 0) {
                    setEditableJob(prev => prev ? { ...prev, purchaseOrderIds: [...(prev.purchaseOrderIds || []), ...newPoIdsToLink] } : null);
                }
            }
            setConfirmation({ isOpen: true, title: 'Purchase Orders Updated', message: `${newPOs.length} new purchase order(s) created and ${posToUpdate.length} existing draft PO(s) updated.`, type: 'success' });
        } finally {
            setIsRaisingPOs(false);
            if (forceRefresh) {
                await Promise.all([
                    forceRefresh('jobs'),
                    forceRefresh('purchaseOrders'),
                    forceRefresh('estimates'),
                ]);
            }
        }
    }, [editableJob, editableEstimate, vehicle, safeParts, safeBusinessEntities, safePurchaseOrders, generatePurchaseOrderId, handleSaveItem, data.setPurchaseOrders, setEstimates, setConfirmation, isRaisingPOs, forceRefresh]);

    const handleSelectPart = (lineItemId: string, part: T.Part) => {
        handleLineItemChange(lineItemId, 'partNumber', part.partNumber);
        handleLineItemChange(lineItemId, 'description', part.description);
        handleLineItemChange(lineItemId, 'unitPrice', part.salePrice);
        handleLineItemChange(lineItemId, 'unitCost', part.costPrice);
        handleLineItemChange(lineItemId, 'partId', part.id);
        handleLineItemChange(lineItemId, 'taxCodeId', part.taxCodeId || standardTaxRateId);
        handleLineItemChange(lineItemId, 'supplierId', part.defaultSupplierId);
        const fromStock = part.isStockItem && part.stockQuantity > 0;
        handleLineItemChange(lineItemId, 'fromStock', fromStock);
        setActivePartSearch(null);
        setPartSearchTerm('');
    };

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        setPartToEdit({ partNumber: '', description: searchTerm, isStockItem: false });
        setIsPartModalOpen(true);
        setActivePartSearch(null);
    };

    const handleEditPart = (part: T.Part) => {
        const fullPart = safeParts.find(p => p.id === part.id);
        if (fullPart) {
            setPartToEdit(fullPart);
            setIsPartModalOpen(true);
        }
    };

    const handleSavePart = async (part: T.Part) => {
        const savedPart = await handleSaveItem(setParts, part, 'brooks_parts');
        if (targetLineItemId) {
            handleSelectPart(targetLineItemId, savedPart);
        }
        setIsPartModalOpen(false);
        setPartToEdit(null);
        setTargetLineItemId(null);
        forceRefresh('parts');
        forceRefresh('estimates');
    };
    
    const handleCreatePackage = async () => {
        if (!editableEstimate || !(editableEstimate.lineItems || []).length || !vehicle || !editableJob) {
            setConfirmation({ isOpen: true, title: 'Cannot Create Package', message: 'A job, vehicle, and at least one estimate line item are required to create a package.', type: 'info' });
            return;
        }
        setIsCreatingPackage(true);
        try {
            const name = `${vehicle.make} ${vehicle.model} Service`;
            const description = "Generated service package";
            
            const totalNet = (editableEstimate.lineItems || []).filter(item => !item.isPackageComponent).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
            const costItems: T.EstimateLineItem[] = (editableEstimate.lineItems || []).filter(item => !item.servicePackageId || item.isPackageComponent).map(li => ({ id: crypto.randomUUID(), description: li.description, quantity: li.quantity, unitPrice: 0, unitCost: li.unitCost || 0, partNumber: li.partNumber, isLabor: li.isLabor }));
            const taxRateInfo = standardTaxRateId ? safeTaxRates.find(t => t.id === standardTaxRateId) : null;
            const taxRate = taxRateInfo ? taxRateInfo.rate / 100 : 0;
            const totalVat = totalNet * taxRate;
            const totalPrice = totalNet + totalVat;
            const newPackage: Partial<T.ServicePackage> = { entityId: editableJob.entityId, name, description, totalPrice, totalPriceNet: totalNet, costItems: costItems, taxCodeId: standardTaxRateId };
            setSuggestedPackage(newPackage);
            setIsPackageModalOpen(true);
        } catch (error: any) {
             setConfirmation({ isOpen: true, title: 'AI Error', message: `AI failed to create package: ${error.message}`, type: 'warning' });
        } finally {
            setIsCreatingPackage(false);
        }
    };

    const estimateBreakdown = useMemo(() => {
        if (!editableEstimate) return { packages: [], standaloneLabor: [], standaloneParts: [] };
        const items = Array.isArray(editableEstimate.lineItems) ? editableEstimate.lineItems : [];
        const packagesMap = new Map<string, { header: T.EstimateLineItem, children: T.EstimateLineItem[], pkg: T.ServicePackage, packageTotal: number }>();
        const standaloneLabor: T.EstimateLineItem[] = [];
        const standaloneParts: T.EstimateLineItem[] = [];
        items.forEach(item => {
            if (item.servicePackageId) {
                if (!item.isPackageComponent) {
                    const pkg = safeServicePackages.find(p => p.id === item.servicePackageId);
                    if (pkg) {
                        const { net } = calculatePackagePrices(pkg, safeTaxRates);
                        packagesMap.set(item.servicePackageId, { header: item, children: [], pkg, packageTotal: net });
                    }
                } 
            } else {
                if (item.isLabor) standaloneLabor.push(item);
                else standaloneParts.push(item);
            }
        });
        items.forEach(item => {
            if (item.servicePackageId && item.isPackageComponent) {
                const pkgEntry = packagesMap.get(item.servicePackageId);
                if (pkgEntry) pkgEntry.children.push(item);
            }
        });
        return { packages: Array.from(packagesMap.values()), standaloneLabor, standaloneParts };
    }, [editableEstimate, safeServicePackages, safeTaxRates]);
    
    const { totalNet, grandTotal, vatBreakdown } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        const safeLineItems = Array.isArray(editableEstimate?.lineItems) ? editableEstimate.lineItems : [];
        if (safeLineItems.length === 0) return { totalNet: 0, grandTotal: 0, vatBreakdown: [] };
    
        let currentTotalNet = 0;
        const billableItems = safeLineItems.filter(item => !item.isPackageComponent);
    
        billableItems.forEach(item => {
            const itemNet = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            currentTotalNet += itemNet;
            if (item.taxCodeId === t99RateId) {
                const taxCodeId = t99RateId;
                if (!breakdown[taxCodeId]) { breakdown[taxCodeId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' }; }
                breakdown[taxCodeId].net += itemNet;
                breakdown[taxCodeId].vat += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;
                const taxRate = taxRatesMap.get(taxCodeId);
                if (!taxRate) return;
                if (!breakdown[taxCodeId]) { breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name }; }
                breakdown[taxCodeId].net += itemNet;
                if (taxRate.rate > 0) { breakdown[taxCodeId].vat += itemNet * (taxRate.rate / 100); }
            }
        });
        
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net !== 0 || b.vat !== 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown };
    }, [editableEstimate, taxRatesMap, standardTaxRateId, t99RateId]);

    const supplierMap = useMemo(() => new Map(safeSuppliers.map(s => [s.id, s.name])), [safeSuppliers]);

    const poStatusKey = useMemo(() => {
        const poIds = Array.isArray(job?.purchaseOrderIds) ? job.purchaseOrderIds : [];
        if (poIds.length === 0) return '';
        const jobRelatedPOs = safePurchaseOrders.filter(po => poIds.includes(po.id));
        return jobRelatedPOs.map(po => `${po.id}:${po.status}`).join(',');
    }, [job, safePurchaseOrders]);

    const totalLaborHours = useMemo(() => {
        if (!editableEstimate) return 0;
        return (editableEstimate.lineItems || []).filter(li => li.isLabor).reduce((sum, li) => sum + Number(li.quantity || 0), 0);
    }, [editableEstimate]);

    const handleSaveMain = async () => {
        if (!editableJob) { onClose(); return; }
        let jobToSave = { ...editableJob };
        const obs = Array.isArray(jobToSave.technicianObservations) ? jobToSave.technicianObservations : [];
        jobToSave.technicianObservations = obs.filter(o => o.trim() !== '');
    
        if (editableEstimate) {
            let estimateToSave = { ...editableEstimate };
            let newEstimateId: string | null = null;
            if (estimateToSave.id.endsWith('_temp')) {
                estimateToSave.id = `est_${Date.now()}`;
                newEstimateId = estimateToSave.id;
            }
            await handleSaveItem(setEstimates, estimateToSave, 'brooks_estimates');
            if (newEstimateId) { jobToSave.estimateId = newEstimateId; }
        }
        await handleSaveItem(setJobs, jobToSave, 'brooks_jobs');
        onClose();
    };

    const TabButton = ({ tabId, label, icon, isFirst, isLast }: { tabId: string, label: string, icon: React.ReactNode, isFirst?: boolean, isLast?: boolean }) => (
        <button 
            onClick={() => setActiveTab(tabId)} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold relative 
                ${activeTab === tabId 
                    ? 'bg-white text-indigo-700' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}
                ${!isFirst ? 'border-l border-gray-200' : ''}
                transition-colors duration-150 ease-in-out`}>
            {icon}{label}
            {activeTab === tabId && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600"></div>}
        </button>
    );
    
    const tyreLocations: T.TyreLocation[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'spare'];
    const tyreLocationLabels: Record<T.TyreLocation, string> = { frontLeft: 'Front Left', frontRight: 'Front Right', rearLeft: 'Rear Left', rearRight: 'Rear Right', spare: 'Spare' };
    const statusColors: Record<T.ChecklistItemStatus, string> = { ok: 'bg-green-100 text-green-800', attention: 'bg-yellow-100 text-yellow-800', urgent: 'bg-red-100 text-red-800', na: 'bg-gray-100 text-gray-800' };

    if (!isOpen || !editableJob) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-gray-100 rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-white">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-indigo-700">Edit Job #{job?.id}</h2>
                        {job?.status === 'Archived' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase">Cancelled</span>}
                         <div className="flex items-center gap-2 text-sm">
                            {isSaving ? (
                                <span className="text-gray-500 italic flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Saving...</span>
                            ) : (
                                lastSaved && <span className="text-gray-500">Saved at {new Date(lastSaved).toLocaleTimeString()}</span>
                            )}
                        </div>
                    </div>
                    <button type="button" onClick={onClose}><X size={24} /></button>
                </header>

                <main className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-6 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <JobDetailsTab 
                            editableJob={editableJob}
                            vehicle={vehicle}
                            customer={customer}
                            isReadOnly={isReadOnly}
                            onChange={handleChange}
                            onViewCustomer={() => customer && onViewCustomer(customer.id)}
                            onViewVehicle={() => vehicle && onViewVehicle(vehicle.id)}
                        />
                    </div>

                    <div className="lg:col-span-4 flex flex-col">
                        <div className="flex items-stretch bg-gray-50 rounded-t-lg border border-gray-200 overflow-hidden">
                           <TabButton tabId="estimates" label="Estimates & Parts" icon={<DollarSign size={16}/>} isFirst />
                           <TabButton tabId="inspection" label="Inspection" icon={<ListChecks size={16}/>} />
                           <TabButton tabId="notes" label="Technician Notes" icon={<MessageSquare size={16}/>} />
                           <TabButton tabId="segments" label="Segments" icon={<CalendarDays size={16}/>} isLast />
                        </div>
                        <div className="bg-white border-x border-b border-gray-200 rounded-b-lg shadow-sm flex-grow p-4">
                            {activeTab === 'estimates' && (
                                <JobEstimateTab
                                    key={poStatusKey}
                                    partsStatus={editableJob.partsStatus || 'Not Required'}
                                    purchaseOrderIds={editableJob.purchaseOrderIds || []}
                                    purchaseOrders={safePurchaseOrders}
                                    supplierMap={supplierMap}
                                    suppliers={safeSuppliers}
                                    editableEstimate={editableEstimate}
                                    supplementaryEstimates={supplementaryEstimates}
                                    estimateBreakdown={estimateBreakdown}
                                    isReadOnly={isReadOnly}
                                    canViewPricing={canViewPricing}
                                    taxRates={safeTaxRates}
                                    filteredParts={filteredParts}
                                    activePartSearch={activePartSearch}
                                    servicePackages={sortedPackages as any}
                                    totalNet={totalNet}
                                    vatBreakdown={vatBreakdown}
                                    grandTotal={grandTotal}
                                    currentJobHours={totalLaborHours}
                                    onOpenPurchaseOrder={(stalePo: T.PurchaseOrder) => {
                                        const freshPo = safePurchaseOrders.find(p => p.id === stalePo.id);
                                        if (freshPo) onOpenPurchaseOrder(freshPo);
                                        else onOpenPurchaseOrder(stalePo);
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
                                    customer={customer}
                                    onAddNewPart={handleAddNewPartClick}
                                    onEditPart={handleEditPart}
                                    onRaisePurchaseOrders={handleRaisePurchaseOrders}
                                    isRaisingPOs={isRaisingPOs}
                                    onCreatePackage={handleCreatePackage}
                                />
                            )}
                             {activeTab === 'inspection' && (
                                <div className="space-y-8">
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-gray-800">Inspection Checklist</h3>
                                            <div className="w-64">
                                                <select id="inspectionTemplate" value={editableJob.inspectionTemplateId || ''} onChange={(e) => handleInspectionTemplateChange(e.target.value)} className="w-full p-2 border rounded-md bg-white shadow-sm text-sm" disabled={isReadOnly}>
                                                    <option value="">Select a template...</option>
                                                    {safeInspectionTemplates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                        {editableJob.inspectionChecklist ? (
                                            <InspectionChecklist checklistData={editableJob.inspectionChecklist} onUpdate={(sections) => setEditableJob(prev => prev ? { ...prev, inspectionChecklist: sections } : null)} isReadOnly={isReadOnly} />
                                        ) : (
                                            <div className="text-center py-10 px-4 bg-gray-50 rounded-lg"><ListChecks size={32} className="mx-auto text-gray-400"/><h3 className="mt-2 text-sm font-medium text-gray-900">No Inspection Selected</h3><p className="mt-1 text-sm text-gray-500">Please select an inspection template to begin.</p></div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Vehicle Damage Report</h3>
                                        <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden shadow-md bg-gray-200 cursor-crosshair" onClick={handleAddDamagePoint}>
                                            {vehicleImage ? (
                                                <img src={vehicleImage.dataUrl} alt="Vehicle Diagram" className="w-full" />
                                            ) : (
                                                <div className="h-64 flex items-center justify-center"><p className="text-gray-500">No vehicle image available</p></div>
                                            )}
                                            {(editableJob.damagePoints || []).map(point => (
                                                <div key={point.id} className="absolute w-6 h-6 rounded-full bg-red-500 bg-opacity-75 border-2 border-white shadow-lg cursor-pointer flex items-center justify-center" style={{ top: `${point.y}%`, left: `${point.x}%`, transform: 'translate(-50%, -50%)' }} title={point.notes} onClick={(e) => { e.stopPropagation(); handleDamagePointClick(point.id); }}></div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Tyre Check Report</h3>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm text-left text-gray-500">
                                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                                    <tr>
                                                        <th scope="col" className="py-3 px-4">Location</th>
                                                        <th scope="col" className="py-3 px-2">Outer</th>
                                                        <th scope="col" className="py-3 px-2">Middle</th>
                                                        <th scope="col" className="py-3 px-2">Inner</th>
                                                        <th scope="col" className="py-3 px-2">Pressure</th>
                                                        <th scope="col" className="py-3 px-4">Status</th>
                                                        <th scope="col" className="py-3 px-4">Comments</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tyreLocations.map(location => {
                                                        const tyreData = editableJob.tyreCheck?.[location];
                                                        return (
                                                            <tr key={location} className="bg-white border-b">
                                                                <th scope="row" className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{tyreLocationLabels[location]}</th>
                                                                <td className="py-2 px-1"><input type="number" value={tyreData?.outer || ''} onChange={e => handleTyreDataChange(location, 'outer', e.target.value)} className="w-16 p-1 border rounded" readOnly={isReadOnly}/></td>
                                                                <td className="py-2 px-1"><input type="number" value={tyreData?.middle || ''} onChange={e => handleTyreDataChange(location, 'middle', e.target.value)} className="w-16 p-1 border rounded" readOnly={isReadOnly}/></td>
                                                                <td className="py-2 px-1"><input type="number" value={tyreData?.inner || ''} onChange={e => handleTyreDataChange(location, 'inner', e.target.value)} className="w-16 p-1 border rounded" readOnly={isReadOnly}/></td>
                                                                <td className="py-2 px-1"><input type="number" value={tyreData?.pressure || ''} onChange={e => handleTyreDataChange(location, 'pressure', e.target.value)} className="w-16 p-1 border rounded" readOnly={isReadOnly}/></td>
                                                                <td className="py-2 px-2">
                                                                    <select value={tyreData?.indicator || 'na'} onChange={e => handleTyreStatusChange(location, e.target.value as T.ChecklistItemStatus)} className={`w-full p-1 border rounded ${statusColors[tyreData?.indicator || 'na']}`} disabled={isReadOnly}>
                                                                        <option value="ok">OK</option><option value="attention">Attention</option><option value="urgent">Urgent</option><option value="na">N/A</option>
                                                                    </select>
                                                                </td>
                                                                <td className="py-2 px-2"><input type="text" value={tyreData?.comments || ''} onChange={e => handleTyreTextDataChange(location, 'comments', e.target.value)} className="w-full p-1 border rounded" readOnly={isReadOnly}/></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'notes' && (
                                <div className="space-y-3">
                                    <h3 className="text-md font-bold">Internal Technician Notes</h3>
                                    {(editableJob.technicianObservations || []).map((obs, index) => (
                                        <textarea 
                                            key={index}
                                            value={obs}
                                            onChange={(e) => handleTechObservationChange(index, e.target.value)}
                                            readOnly={isReadOnly}
                                            className="w-full p-2 border rounded bg-gray-50 h-24"
                                            placeholder={`Observation ${index + 1}...`}
                                        />
                                    ))}
                                </div>
                            )}
                            {activeTab === 'segments' && (
                                <div>
                                    <h3 className="text-md font-bold mb-3">Job Segments</h3>
                                    <ul className="space-y-2">
                                        {(Array.isArray(editableJob.segments) ? editableJob.segments : []).map(seg => {
                                            const engineer = safeEngineers.find(e => e.id === seg.engineerId);
                                            return (
                                                <li key={seg.segmentId} className="p-3 bg-gray-50 rounded-md border text-sm">
                                                    <div className="font-semibold">Status: <span className="font-normal">{seg.status}</span></div>
                                                    <div className="font-semibold">Engineer: <span className="font-normal">{engineer?.name || 'Unassigned'}</span></div>
                                                    <div className="font-semibold">Date: <span className="font-normal">{seg.date ? formatDate(new Date(seg.date)) : 'Not Scheduled'}</span></div>
                                                    <div className="font-semibold">Duration: <span className="font-normal">{seg.duration} hours</span></div>
                                                </li>
                                            );
                                        })}
                                        {(!Array.isArray(editableJob.segments) || editableJob.segments.length === 0) && (
                                            <p className="text-gray-500 italic">No segments for this job.</p>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="flex-shrink-0 flex justify-between items-center p-4 border-t bg-white">
                    <div>
                        {onDelete && !isReadOnly && (
                            <button
                                type="button"
                                onClick={() => setConfirmation({
                                    isOpen: true,
                                    title: 'Confirm Cancellation',
                                    message: 'Are you sure you want to cancel this job? This action cannot be undone.',
                                    type: 'danger',
                                    onConfirm: () => {
                                        if(editableJob) onDelete(editableJob.id);
                                        onClose();
                                    }
                                })}
                                className="flex items-center gap-2 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                            >
                                <Ban size={14} /> Cancel Job
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="print-blank-sheet" checked={printBlankSheet} onChange={(e) => setPrintBlankSheet(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor="print-blank-sheet" className="text-sm text-gray-700">Print Blank Inspection Sheet</label>
                        </div>
                        <button type="button" onClick={triggerPrint} className="flex items-center gap-2 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold" disabled={isPrinting}>
                            <Printer size={14} /> {isPrinting ? 'Loading...' : 'Print Job Card'}
                        </button>
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Close</button>
                        <button type="button" onClick={handleSaveMain} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50" disabled={isReadOnly}><Save size={14}/> Save Changes</button>
                    </div>
                </footer>
            </div>

            <div className="hidden">
                <div ref={componentToPrintRef}>
                    {editableJob && vehicle && customer && (
                        <PrintableJobCard
                            job={editableJob}
                            estimates={mainEstimate ? [mainEstimate, ...supplementaryEstimates] : supplementaryEstimates}
                            customer={customer}
                            vehicle={vehicle}
                            entity={businessEntity}
                            engineers={safeEngineers}
                            taxRates={safeTaxRates}
                            printBlankInspectionSheet={printBlankSheet}
                            inspectionTemplates={safeInspectionTemplates}
                        />
                    )}
                </div>
            </div>

            {isMediaModalOpen && <MediaManagerModal isOpen={isMediaModalOpen} onClose={() => setIsMediaModalOpen(false)} title={mediaModalTitle} initialMedia={mediaModalData} onSave={(newMedia) => { if (onMediaSaveCallback) { onMediaSaveCallback(newMedia); } setIsMediaModalOpen(false); }} />}
            {isPartModalOpen && (
                 <PartFormModal 
                    isOpen={isPartModalOpen} 
                    onClose={() => { setIsPartModalOpen(false); setPartToEdit(null); setTargetLineItemId(null); }} 
                    onSave={handleSavePart} 
                    part={partToEdit || { id: `new_${Date.now()}`, partNumber: '', description: '', stockQuantity: 0, costPrice: 0, salePrice: 0, taxCodeId: standardTaxRateId || '', defaultSupplierId: '', isStockItem: false }}
                    suppliers={safeSuppliers} 
                    taxRates={safeTaxRates} 
                />
            )}
            {isPackageModalOpen && editableJob && <ServicePackageFormModal isOpen={isPackageModalOpen} onClose={() => setIsPackageModalOpen(false)} onSave={async (pkg) => { const savedPackage = await handleSaveItem(setServicePackages, pkg, 'brooks_servicePackages'); addPackage(savedPackage.id); setIsPackageModalOpen(false); }} servicePackage={suggestedPackage} taxRates={safeTaxRates} entityId={editableJob.entityId || ((safeBusinessEntities)[0]?.id || '')} businessEntities={safeBusinessEntities} parts={safeParts} />}
        </div>
    );
};

export default EditJobModal;

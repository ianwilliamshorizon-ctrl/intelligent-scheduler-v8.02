import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront, Image as ImageIcon, Ban, Expand, Loader2, Printer, CalendarDays, PlayCircle, PauseCircle, CheckCircle, RotateCcw, UserCheck, UserPlus, MoreHorizontal } from 'lucide-react';
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
import { calculateJobPartsStatus } from '../core/utils/jobUtils';
import { MOTBookingModal } from './MOTBookingModal';
import { TIME_SEGMENTS } from '../constants';
import { generateJobId } from '../core/utils/numberGenerators';
import { JobActionsMenu } from './shared/JobActionsMenu';
import AssignEngineerModal from './AssignEngineerModal';
import VehicleDamageReport from './VehicleDamageReport';
import { getHexFromColorName } from '../utils/colorUtils';

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
    const { 
        handleSaveItem, 
        handleSaveEstimate, 
        syncPurchaseOrdersFromEstimate,
        handleUpdateSegmentStatus,
        handleReassignEngineer
    } = useWorkshopActions();

    const { 
        jobs, setJobs, vehicles, customers, estimates, setEstimates, suppliers, parts, setParts, servicePackages, taxRates, businessEntities, setServicePackages, engineers, inspectionTemplates, inspectionDiagrams
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
    const [isMotBookingOpen, setIsMotBookingOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [activeSegmentForAssignment, setActiveSegmentForAssignment] = useState<T.JobSegment | null>(null);

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

    const matchedLibraryDiagram = useMemo(() => {
        if (!vehicle || !inspectionDiagrams || vehicleImage) return null;
        return inspectionDiagrams.find(d => 
            d.make?.toLowerCase() === vehicle.make?.toLowerCase() && 
            d.model?.toLowerCase() === vehicle.model?.toLowerCase()
        ) || inspectionDiagrams.find(d => 
            d.make?.toLowerCase() === vehicle.make?.toLowerCase()
        ) || null;
    }, [vehicle, inspectionDiagrams, vehicleImage]);

    useEffect(() => {
        if (editableJob && editableEstimate) {
            const nextPartsStatus = calculateJobPartsStatus(editableEstimate, safePurchaseOrders);
            if (editableJob.partsStatus !== nextPartsStatus) {
                setEditableJob({ ...editableJob, partsStatus: nextPartsStatus });
            }
        }
    }, [editableEstimate, safePurchaseOrders]);

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
            let updatedLineItems = (prev.lineItems || []).map(item => {
                if (item.id === id) {
                    const newItem = { ...item, [field]: processedValue };
                    
                    // 1. Handle Supplier Changes (Removal from old PO)
                    if (field === 'supplierId' && item.supplierId !== processedValue) {
                        if (item.purchaseOrderLineItemId) {
                            data.setPurchaseOrders(prevPOs => {
                                const oldPo = (prevPOs || []).find(po => po.lineItems?.some(li => li.id === item.purchaseOrderLineItemId));
                                if (oldPo && ['Draft', 'Ordered'].includes(oldPo.status)) {
                                    const newPoLineItems = (oldPo.lineItems || []).filter(li => li.id !== item.purchaseOrderLineItemId);
                                    const updatedPO = { ...oldPo, lineItems: newPoLineItems };
                                    handleSaveItem(data.setPurchaseOrders, updatedPO, 'brooks_purchaseOrders');
                                    
                                    const nextPOs = [...prevPOs];
                                    const idx = nextPOs.findIndex(p => p.id === oldPo.id);
                                    if (idx !== -1) nextPOs[idx] = updatedPO;
                                    return nextPOs;
                                }
                                return prevPOs;
                            });
                        }
                        newItem.purchaseOrderLineItemId = undefined;
                    }
                    
                    // 2. BIDIRECTIONAL SYNC: Update linked PO line item
                    if (newItem.purchaseOrderLineItemId && ['quantity', 'unitCost', 'partNumber', 'description', 'partId'].includes(field as string)) {
                        data.setPurchaseOrders(prevPOs => {
                            const linkedPo = (prevPOs || []).find(po => po.lineItems?.some(li => li.id === newItem.purchaseOrderLineItemId));
                            if (linkedPo && ['Draft', 'Ordered'].includes(linkedPo.status)) {
                                const updatedPoLineItems = (linkedPo.lineItems || []).map(li => {
                                    if (li.id === newItem.purchaseOrderLineItemId) {
                                        return {
                                            ...li,
                                            quantity: field === 'quantity' ? processedValue : li.quantity,
                                            unitPrice: field === 'unitCost' ? processedValue : li.unitPrice,
                                            partNumber: field === 'partNumber' ? processedValue : li.partNumber,
                                            description: field === 'description' ? processedValue : li.description,
                                            partId: field === 'partId' ? processedValue : li.partId
                                        };
                                    }
                                    return li;
                                });
                                
                                const updatedPO = { ...linkedPo, lineItems: updatedPoLineItems };
                                handleSaveItem(data.setPurchaseOrders, updatedPO, 'brooks_purchaseOrders');
                                
                                const nextPOs = [...prevPOs];
                                const idx = nextPOs.findIndex(p => p.id === linkedPo.id);
                                if (idx !== -1) nextPOs[idx] = updatedPO;
                                return nextPOs;
                            }
                            return prevPOs;
                        });
                    }
                    
                    return newItem;
                }
                return item;
            });
            return { ...prev, lineItems: updatedLineItems };
        });
    }, [data.setPurchaseOrders, handleSaveItem]);

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
            isOptional: false,
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
                ...costItem,
                id: crypto.randomUUID(),
                unitPrice: 0,
                unitCost: part ? part.costPrice : costItem.unitCost,
                partId: part ? part.id : undefined,
                servicePackageId: pkg.id,
                servicePackageName: pkg.name,
                isPackageComponent: true,
                isOptional: false,
                supplierId: part?.defaultSupplierId || costItem.supplierId,
                fromStock: costItem.fromStock ?? (costItem.isLabor ? true : (part?.isStockItem && (part.stockQuantity || 0) > 0)),
            };
            currentLineItems.push(newItem);
        }
    
        setEditableEstimate(prev => ({ ...prev!, lineItems: currentLineItems }));
    
        // Check if the added package contains an MOT
        const isMot = pkg.name?.toLowerCase().includes('mot') || pkg.costItems?.some(ci => ci.description?.toLowerCase().includes('mot'));
        if (isMot) {
            setIsMotBookingOpen(true);
        }
    }, [safeServicePackages, handleCreateEstimateIfNeeded, safeTaxRates, standardTaxRateId, t99RateId, safeParts, handleSaveItem, setParts]);

    const handleMotSelect = async (date: string, time: string, liftId: string) => {
        if (!editableJob) return;
        
        const entity = safeBusinessEntities.find(e => e.id === editableJob.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        const timeIndex = TIME_SEGMENTS.indexOf(time);
        
        const motJobId = `${editableJob.id}-MOT`;
        // Check if MOT job already exists to avoid duplicates
        if (safeJobs.some(j => j.id === motJobId)) {
            setConfirmation({
                isOpen: true,
                title: 'MOT Already Scheduled',
                message: 'A dedicated MOT job card already exists for this master job.',
                type: 'warning'
            });
            return;
        }

        const motJob: T.Job = {
            id: motJobId,
            entityId: editableJob.entityId,
            vehicleId: editableJob.vehicleId,
            vehicleRegistration: vehicle?.registration || editableJob.vehicleRegistration, // Ensure reg is passed for calendar visibility
            customerId: editableJob.customerId,
            description: `MOT Test - ${vehicle?.registration || 'N/A'} (Linked to ${editableJob.id})`,
            estimatedHours: 1,
            scheduledDate: date,
            status: 'Allocated',
            createdAt: formatDate(new Date()),
            createdByUserId: currentUser?.id || '',
            segments: [],
            vehicleStatus: 'Awaiting Arrival',
            notes: `Linked to Master Job #${editableJob.id}. Do not invoice separately.`,
            partsStatus: 'Not Required'
        };

        if (timeIndex !== -1) {
            motJob.segments = [{
                id: crypto.randomUUID(),
                description: 'MOT',
                segmentId: crypto.randomUUID(),
                date: date,
                duration: 1,
                status: 'Allocated',
                allocatedLift: liftId,
                scheduledStartSegment: timeIndex,
                engineerId: null
            }];
        }

        await handleSaveItem(setJobs, motJob, 'brooks_jobs');
        
        // Ensure UI updates by forcing a refresh of the jobs collection
        if (forceRefresh) {
            await forceRefresh('brooks_jobs');
        }
        
        // Update main job notes to reflect the link
        setEditableJob(prev => {
            if (!prev) return null;
            return {
                ...prev,
                notes: `${prev.notes || ''}\n\nLinked MOT Booking: #${motJobId} @ ${time}`
            };
        });

        setConfirmation({
            isOpen: true,
            title: 'MOT Job Created',
            message: `A separate MOT job (${motJobId}) has been created and scheduled for ${date} at ${time}.`,
            type: 'success'
        });
    };

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
            const newItem: T.EstimateLineItem = { id: crypto.randomUUID(), description: isLabor ? 'Labor' : '', quantity: 1, unitPrice: isLabor ? (entity?.laborRate || 0) : 0, unitCost: isLabor ? (entity?.laborCostRate || 0) : 0, isLabor, fromStock: isLabor, taxCodeId: standardTaxRateId, isOptional: true };
            return { ...prev, lineItems: [...(prev.lineItems || []), newItem] };
        });
    };

    const removeLineItem = useCallback((id: string) => {
        setEditableEstimate(prev => {
            if (!prev) return null;
            const itemToRemove = (prev.lineItems || []).find(i => i.id === id);
            
            // BIDIRECTIONAL SYNC: If the item being removed is linked to a PO, remove it from the PO too
            if (itemToRemove?.purchaseOrderLineItemId) {
                const linkedPo = safePurchaseOrders.find(po => po.lineItems?.some(li => li.id === itemToRemove.purchaseOrderLineItemId));
                if (linkedPo && ['Draft', 'Ordered'].includes(linkedPo.status)) {
                    const updatedPoLineItems = (linkedPo.lineItems || []).filter(li => li.id !== itemToRemove.purchaseOrderLineItemId);
                    handleSaveItem(data.setPurchaseOrders, { ...linkedPo, lineItems: updatedPoLineItems }, 'brooks_purchaseOrders');
                }
            }

            if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
                // If it's a package header, remove all children too
                const newItems = (prev.lineItems || []).filter(li => li.id !== id && li.servicePackageId !== itemToRemove.servicePackageId);
                return { ...prev, lineItems: newItems };
            }
            return { ...prev, lineItems: (prev.lineItems || []).filter(li => li.id !== id) };
        });
    }, [safePurchaseOrders, data.setPurchaseOrders, handleSaveItem]);

    const filteredParts = useMemo(() => {
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return safeParts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    }, [partSearchTerm, safeParts]);

    const handleRaisePurchaseOrders = useCallback(async () => {
        if (!editableJob || !editableEstimate || isRaisingPOs) return;

        setIsRaisingPOs(true);
        try {
             // CRITICAL: Save current state first to avoid refresh clearing local items
             await handleSaveEstimate(editableEstimate);
             await syncPurchaseOrdersFromEstimate(editableEstimate);
             setConfirmation({ 
                isOpen: true, 
                title: 'Purchase Orders Synchronized', 
                message: `Refresh complete. Purchase orders have been updated from the latest job card details.`, 
                type: 'success' 
            });
        } finally {
            setIsRaisingPOs(false);
            if (forceRefresh) {
                await Promise.all([
                    forceRefresh('brooks_jobs'),
                    forceRefresh('brooks_purchaseOrders'),
                    forceRefresh('brooks_estimates'),
                ]);
            }
        }
    }, [editableJob, editableEstimate, syncPurchaseOrdersFromEstimate, setConfirmation, isRaisingPOs, forceRefresh]);

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
            await handleSaveEstimate(estimateToSave);
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
                            purchaseOrders={safePurchaseOrders}
                            onOpenPurchaseOrder={onOpenPurchaseOrder}
                            onChange={handleChange}
                            onViewCustomer={() => customer && onViewCustomer(customer.id)}
                            onViewVehicle={() => vehicle && onViewVehicle(vehicle.id)}
                            allJobs={safeJobs}
                            onUpdateLinkedJob={async (id, updates) => {
                                const targetJob = safeJobs.find(j => j.id === id);
                                if (targetJob) {
                                    await handleSaveItem(setJobs, { ...targetJob, ...updates }, 'brooks_jobs');
                                    forceRefresh('jobs');
                                }
                            }}
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
                                    entityId={editableJob?.entityId}
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
                                        <VehicleDamageReport 
                                            activePoints={editableJob.damagePoints || []}
                                            onUpdate={(points) => setEditableJob(prev => prev ? { ...prev, damagePoints: points } : null)}
                                            isReadOnly={isReadOnly}
                                            vehicleModel={`${vehicle?.make} ${vehicle?.model}`}
                                            vehicleColor={vehicle?.colour}
                                            imageId={vehicle?.inspectionDiagramId || matchedLibraryDiagram?.imageId}
                                            imageUrl={vehicleImage?.dataUrl}
                                        />
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
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-gray-800">Operational Timeline</h3>
                                        <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-indigo-100 italic">
                                            {totalLaborHours} Total Estimation Hours
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {(Array.isArray(editableJob.segments) ? editableJob.segments : []).map((seg, idx) => {
                                            const engineer = safeEngineers.find(e => e.id === seg.engineerId);
                                            const isComplete = seg.status === 'Engineer Complete' || seg.status === 'QC Complete';
                                            const isInProgress = seg.status === 'In Progress';
                                            const isPaused = seg.status === 'Paused';

                                            const actions = [
                                                {
                                                    id: 'start',
                                                    label: isPaused ? 'Resume Work' : 'Start Segment',
                                                    icon: PlayCircle,
                                                    onClick: () => handleUpdateSegmentStatus(editableJob.id, seg.segmentId, 'In Progress'),
                                                    disabled: isComplete || isInProgress,
                                                    group: 'primary' as const
                                                },
                                                {
                                                    id: 'pause',
                                                    label: 'Pause Work',
                                                    icon: PauseCircle,
                                                    onClick: () => handleUpdateSegmentStatus(editableJob.id, seg.segmentId, 'Paused'),
                                                    disabled: !isInProgress,
                                                    group: 'primary' as const
                                                },
                                                {
                                                    id: 'complete',
                                                    label: 'Mark Complete',
                                                    icon: CheckCircle,
                                                    onClick: () => handleUpdateSegmentStatus(editableJob.id, seg.segmentId, 'Engineer Complete'),
                                                    disabled: isComplete,
                                                    group: 'primary' as const
                                                },
                                                {
                                                    id: 'assign',
                                                    label: seg.engineerId ? 'Change Engineer' : 'Assign Engineer',
                                                    icon: seg.engineerId ? UserCheck : UserPlus,
                                                    onClick: () => {
                                                        setActiveSegmentForAssignment(seg);
                                                        setIsAssignModalOpen(true);
                                                    },
                                                    group: 'secondary' as const
                                                },
                                                {
                                                    id: 'reset',
                                                    label: 'Reset Segment',
                                                    icon: RotateCcw,
                                                    onClick: () => handleUpdateSegmentStatus(editableJob.id, seg.segmentId, 'Allocated'),
                                                    disabled: seg.status === 'Allocated',
                                                    group: 'danger' as const
                                                }
                                            ];

                                            return (
                                                <div key={seg.segmentId} className="group relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${
                                                                isComplete ? 'bg-green-50 border-green-200 text-green-600' :
                                                                isInProgress ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
                                                                'bg-gray-50 border-gray-200 text-gray-400'
                                                            }`}>
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                                                    {seg.description || `Segment ${idx + 1}`}
                                                                </h4>
                                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                                    <span>{seg.date ? formatDate(new Date(seg.date)) : 'TBA'}</span>
                                                                    <span>•</span>
                                                                    <span>{seg.duration} hrs</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shadow-sm border ${
                                                                seg.status === 'Engineer Complete' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                seg.status === 'In Progress' ? 'bg-blue-600 text-white border-blue-700' :
                                                                seg.status === 'Paused' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                'bg-gray-100 text-gray-700 border-gray-200'
                                                            }`}>
                                                                {seg.status}
                                                            </span>
                                                            <JobActionsMenu actions={actions} colorScheme="light" size="md" />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-50">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Technician</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                                                                    <User size={12} className="text-gray-400" />
                                                                </div>
                                                                <span className="text-sm font-bold text-gray-700">
                                                                    {engineer?.name || 'Waiting for Assignment'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Location / Lift</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                                                                    <Car size={12} className="text-gray-400" />
                                                                </div>
                                                                <span className="text-sm font-bold text-gray-700">
                                                                    {seg.allocatedLift || 'General Bay'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!Array.isArray(editableJob.segments) || editableJob.segments.length === 0) && (
                                            <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                                <CalendarDays size={48} className="mx-auto text-gray-300 mb-3" />
                                                <h3 className="text-sm font-bold text-gray-900 mb-1">No Active Segments</h3>
                                                <p className="text-xs text-gray-500 italic max-w-xs mx-auto">This job has no time segments allocated on the schedule timeline.</p>
                                            </div>
                                        )}
                                    </div>
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
            {isMotBookingOpen && editableJob && (
                <MOTBookingModal 
                    isOpen={isMotBookingOpen}
                    onClose={() => setIsMotBookingOpen(false)}
                    onSelect={handleMotSelect}
                    entityId={editableJob.entityId || ''}
                    initialDate={editableJob.scheduledDate}
                />
            )}
            {isAssignModalOpen && activeSegmentForAssignment && (
                <AssignEngineerModal 
                    isOpen={isAssignModalOpen}
                    onClose={() => {
                        setIsAssignModalOpen(false);
                        setActiveSegmentForAssignment(null);
                    }}
                    engineers={safeEngineers}
                    jobInfo={{ resourceName: activeSegmentForAssignment.description || 'Segment' }}
                    initialStartSegmentIndex={activeSegmentForAssignment.scheduledStartSegment || 0}
                    initialEngineerId={activeSegmentForAssignment.engineerId}
                    timeSegments={TIME_SEGMENTS}
                    onAssign={(engineerId) => {
                        if (editableJob && activeSegmentForAssignment) {
                            handleReassignEngineer(editableJob.id, activeSegmentForAssignment.segmentId, engineerId);
                            setIsAssignModalOpen(false);
                            setActiveSegmentForAssignment(null);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default EditJobModal;

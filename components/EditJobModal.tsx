import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import * as T from '../types';
import { X, Save, Car, User, FileText, Wrench, Package, DollarSign, Edit, Plus, Trash2, KeyRound, MessageSquare, ChevronUp, ChevronDown, ListChecks, PlusCircle, ClipboardCheck, CarFront, Image as ImageIcon, Ban, Expand, Loader2, Printer } from 'lucide-react';
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
import { calculatePackagePrices } from '../core/utils/packageUtils';
import { useReactToPrint } from 'react-to-print';
import PrintableJobCard from './PrintableJobCard';

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
    onOpenConditionReport
}) => {
    
    const data = useData();
    const { currentUser, setConfirmation } = useApp();
    const { handleSaveItem } = useWorkshopActions();

    const {
        jobs, setJobs, vehicles, customers, estimates, setEstimates, suppliers, parts, setParts, servicePackages, taxRates, businessEntities, setServicePackages, engineers
    } = data;

    const job = useMemo(() => Array.isArray(jobs) ? jobs.find(j => j.id === selectedJobId) : undefined, [jobs, selectedJobId]);
    const [editableJob, setEditableJob] = useState<T.Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<T.Estimate | null>(null);
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaModalTitle, setMediaModalTitle] = useState('');
    const [mediaModalData, setMediaModalData] = useState<T.CheckInPhoto[]>([]);
    const [onMediaSaveCallback, setOnMediaSaveCallback] = useState<((media: T.CheckInPhoto[]) => void) | null>(null);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');
    const [isCreatingPackage, setIsCreatingPackage] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [suggestedPackage, setSuggestedPackage] = useState<Partial<T.ServicePackage> | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const componentToPrintRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => componentToPrintRef.current,
        onAfterPrint: () => setIsPrinting(false),
    });

    useEffect(() => {
        if (isPrinting && componentToPrintRef.current) {
            handlePrint();
        }
    }, [isPrinting, handlePrint]);

    const triggerPrint = () => {
        if (editableJob && vehicle && customer) {
            setIsPrinting(true);
        } else {
            setConfirmation({ isOpen: true, title: 'Cannot Print', message: 'Missing required data to print job card. Please ensure a customer and vehicle are assigned.', type: 'warning' });
        }
    };

    const canViewPricing = useMemo(() => {
        if (!currentUser) return false;
        return ['Admin', 'Director', 'Sales'].includes(currentUser.role);
    }, [currentUser]);

    const vehicle = useMemo(() => (job && Array.isArray(vehicles)) ? vehicles.find(v => v.id === job.vehicleId) : undefined, [job, vehicles]);
    const customer = useMemo(() => (job && Array.isArray(customers)) ? customers.find(c => c.id === job.customerId) : undefined, [job, customers]);
    const taxRatesMap = useMemo(() => new Map((Array.isArray(taxRates) ? taxRates : []).map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => (Array.isArray(taxRates) ? taxRates : []).find(t => t.code === 'T1')?.id, [taxRates]);
    const t99RateId = useMemo(() => taxRates.find(t => t.code === 'T99')?.id, [taxRates]);

    const mainEstimate = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return null;
        return estimates.find(e => e.id === job.estimateId) || null;
    }, [job, estimates]);

    const supplementaryEstimates = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return [];
        const mainId = mainEstimate?.id;
        return estimates.filter(e => e.jobId === job.id && e.id !== mainId);
    }, [estimates, job, mainEstimate]);

    const businessEntity = useMemo(() => businessEntities.find(e => e.id === editableJob?.entityId), [businessEntities, editableJob]);

    useEffect(() => {
        if (job) {
            const jobCopy = JSON.parse(JSON.stringify(job));
            const currentEstimate = mainEstimate ? JSON.parse(JSON.stringify(mainEstimate)) : null;
            setEditableJob(jobCopy);
            setEditableEstimate(currentEstimate);
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
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        handleCreateEstimateIfNeeded();

        setEditableEstimate(prev => {
            if (!prev) return null;
            const newItems: T.EstimateLineItem[] = [];
            const { net, vat } = calculatePackagePrices(pkg, taxRates);
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
            newItems.push(mainPackageItem);

            (pkg.costItems || []).forEach(costItem => {
                const newItem: T.EstimateLineItem = {
                    id: crypto.randomUUID(),
                    description: costItem.description,
                    quantity: costItem.quantity,
                    unitPrice: 0,
                    unitCost: costItem.unitCost,
                    partNumber: costItem.partNumber,
                    isLabor: costItem.isLabor,
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true,
                    isOptional: true
                };
                newItems.push(newItem);
            });

            return { ...prev, lineItems: [...(prev.lineItems || []), ...newItems] };
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableJob(prev => prev ? { ...prev, [name]: value } : null);
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

    const handleRaisePurchaseOrders = useCallback(async () => {
        if (!editableJob || !editableEstimate || !vehicle) return;

        const itemsToOrder = editableEstimate.lineItems.filter(li => {
            const isPackageHeader = !!li.servicePackageId && !li.isPackageComponent;
            return !li.isLabor &&
                !isPackageHeader &&
                li.partId &&
                !li.fromStock &&
                !li.purchaseOrderLineItemId;
        });

        if (itemsToOrder.length === 0) {
            setConfirmation({ isOpen: true, title: 'No Parts to Order', message: 'There are no new parts on this estimate that require ordering.', type: 'info' });
            return;
        }

        const supplierGroups = new Map<string, T.EstimateLineItem[]>();

        itemsToOrder.forEach(lineItem => {
            const part = parts.find(p => p.id === lineItem.partId);
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
        let updatedLineItems = [...editableEstimate.lineItems];

        const entity = businessEntities.find(e => e.id === editableJob.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        const jobPoIds = editableJob.purchaseOrderIds || [];
        const jobPOs = purchaseOrders.filter(po => jobPoIds.includes(po.id));

        supplierGroups.forEach((items, supplierId) => {
            const existingDraftPO = jobPOs.find(po => po.status === 'Draft' && (po.supplierId === supplierId || (supplierId === 'UNKNOWN' && !po.supplierId)));

            if (existingDraftPO) {
                const newPoLineItems: T.PurchaseOrderLineItem[] = items.map(item => {
                    const newPoLineItemId = crypto.randomUUID();
                    const part = parts.find(p => p.id === item.partId!)!;

                    const originalIndex = updatedLineItems.findIndex(li => li.id === item.id);
                    if (originalIndex !== -1) {
                        updatedLineItems[originalIndex] = { ...updatedLineItems[originalIndex], purchaseOrderLineItemId: newPoLineItemId };
                    }

                    return {
                        id: newPoLineItemId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: item.quantity,
                        unitPrice: part.costPrice,
                        taxCodeId: part.taxCodeId,
                    };
                });

                const updatedPO = {
                    ...existingDraftPO,
                    lineItems: [...(existingDraftPO.lineItems || []), ...newPoLineItems]
                };
                posToUpdate.push(updatedPO);

            } else {
                const newPoId = generatePurchaseOrderId(purchaseOrders.concat(newPOs), entityShortCode);
                newPoIdsToLink.push(newPoId);

                const poLineItems: T.PurchaseOrderLineItem[] = items.map(item => {
                    const newPoLineItemId = crypto.randomUUID();
                    const part = parts.find(p => p.id === item.partId!)!;

                    const originalIndex = updatedLineItems.findIndex(li => li.id === item.id);
                    if (originalIndex !== -1) {
                        updatedLineItems[originalIndex] = { ...updatedLineItems[originalIndex], purchaseOrderLineItemId: newPoLineItemId };
                    }

                    return {
                        id: newPoLineItemId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: item.quantity,
                        unitPrice: part.costPrice,
                        taxCodeId: part.taxCodeId,
                    };
                });

                const newPo: T.PurchaseOrder = {
                    id: newPoId,
                    entityId: editableJob.entityId,
                    supplierId: supplierId === 'UNKNOWN' ? undefined : supplierId,
                    vehicleRegistrationRef: vehicle.registration,
                    orderDate: formatDate(new Date()),
                    status: 'Draft',
                    lineItems: poLineItems,
                    notes: `Generated from Job #${editableJob.id}`
                };
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
                setEditableJob(prev => {
                    if (!prev) return null;
                    const updatedJob = {
                        ...prev,
                        purchaseOrderIds: [...(prev.purchaseOrderIds || []), ...newPoIdsToLink]
                    };
                    return updatedJob;
                });
            }
        }

        setConfirmation({
            isOpen: true,
            title: 'Purchase Orders Updated',
            message: `${newPOs.length} new purchase order(s) created and ${posToUpdate.length} existing draft PO(s) updated.`,
            type: 'success',
        });
    }, [editableJob, editableEstimate, vehicle, parts, businessEntities, purchaseOrders, generatePurchaseOrderId, handleSaveItem, data.setPurchaseOrders, setEstimates, setConfirmation]);

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
        setNewPartDescription(searchTerm);
        setIsAddingPart(true);
        setActivePartSearch(null);
    };

    const handleSaveNewPart = async (part: T.Part) => {
        const savedPart = await handleSaveItem(setParts, part, 'brooks_parts');
        if (targetLineItemId) {
            handleSelectPart(targetLineItemId, savedPart);
        }
        setIsAddingPart(false);
        setTargetLineItemId(null);
    };
    
    const handleCreatePackage = async () => {
        if (!editableEstimate || !editableEstimate.lineItems || editableEstimate.lineItems.length === 0) {
            setConfirmation({ isOpen: true, title: 'No Line Items', message: 'This job has no estimate or line items to create a package from.', type: 'info' });
            return;
        }
        if (!vehicle || !editableJob) {
            setConfirmation({ isOpen: true, title: 'Error', message: "Cannot create a package without an associated vehicle or job.", type: 'warning' });
            return;
        }

        setIsCreatingPackage(true);
        try {
            const { name, description } = await generateServicePackageName(editableEstimate.lineItems, vehicle.make, vehicle.model);
            const totalNet = (editableEstimate.lineItems || []).filter(item => !item.isPackageComponent).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            const costItems: T.EstimateLineItem[] = (editableEstimate.lineItems || [])
                .filter(item => !item.servicePackageId || item.isPackageComponent)
                .map(li => ({
                    id: crypto.randomUUID(),
                    description: li.description,
                    quantity: li.quantity,
                    unitPrice: 0,
                    unitCost: li.unitCost || 0,
                    partNumber: li.partNumber,
                    isLabor: li.isLabor
                }));

            const taxRate = standardTaxRateId ? (taxRates.find(t => t.id === standardTaxRateId)?.rate || 0) / 100 : 0;
            const totalVat = totalNet * taxRate;
            const totalPrice = totalNet + totalVat;

            const newPackage: Partial<T.ServicePackage> = {
                entityId: editableJob.entityId,
                name,
                description,
                totalPrice,
                totalPriceNet: totalNet,
                costItems: costItems,
                taxCodeId: standardTaxRateId
            };
            
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
        const packagesMap = new Map<string, { header: T.EstimateLineItem, children: T.EstimateLineItem[], pkg: T.ServicePackage, packageTotal: number }>();
        const standaloneLabor: T.EstimateLineItem[] = [];
        const standaloneParts: T.EstimateLineItem[] = [];
        (editableEstimate.lineItems || []).forEach(item => {
            if (item.servicePackageId) {
                if (!item.isPackageComponent) {
                    const pkg = servicePackages.find(p => p.id === item.servicePackageId);
                    if (pkg) {
                        const { net } = calculatePackagePrices(pkg, taxRates);
                        packagesMap.set(item.servicePackageId, { header: item, children: [], pkg, packageTotal: net });
                    }
                } 
            } else {
                if (item.isLabor) standaloneLabor.push(item);
                else standaloneParts.push(item);
            }
        });
        (editableEstimate.lineItems || []).forEach(item => {
            if (item.servicePackageId && item.isPackageComponent) {
                const pkgEntry = packagesMap.get(item.servicePackageId);
                if (pkgEntry) pkgEntry.children.push(item);
            }
        });
        return { packages: Array.from(packagesMap.values()), standaloneLabor, standaloneParts };
    }, [editableEstimate, servicePackages, taxRates]);

    const { totalNet, grandTotal, vatBreakdown } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        if (!editableEstimate || !editableEstimate.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [] };

        let currentTotalNet = 0;

        const billableItems = (editableEstimate.lineItems || []).filter(item => !item.isPackageComponent);

        billableItems.forEach(item => {
            const itemNet = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            currentTotalNet += itemNet;

            if (item.taxCodeId === t99RateId) {
                const taxCodeId = t99RateId;
                if (!breakdown[taxCodeId]) {
                    breakdown[taxCodeId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' };
                }
                breakdown[taxCodeId].net += itemNet;
                breakdown[taxCodeId].vat += (item.preCalculatedVat || 0) * (item.quantity || 1);

            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                if (!taxCodeId) return;

                const taxRate = taxRatesMap.get(taxCodeId);
                if (!taxRate) return;

                if (!breakdown[taxCodeId]) {
                    breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }
                breakdown[taxCodeId].net += itemNet;
                if (taxRate.rate > 0) {
                    breakdown[taxCodeId].vat += itemNet * (taxRate.rate / 100);
                }
            }
        });

        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net !== 0 || b.vat !== 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);

        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown };

    }, [editableEstimate, taxRatesMap, standardTaxRateId, t99RateId]);

    const supplierMap = useMemo(() => new Map((Array.isArray(suppliers) ? suppliers : []).map(s => [s.id, s.name])), [suppliers]);

    const derivedPartsStatus = useMemo(() => {
        if (!editableEstimate) return 'Not Required';

        const hasPartsOnEstimate = (editableEstimate.lineItems || []).some(li => !li.isLabor && !li.isPackageComponent && (li.partId || li.partNumber));
    
        if (!hasPartsOnEstimate) {
            return 'Not Required';
        }

        const poIds = editableJob?.purchaseOrderIds || [];
        const relatedPOs = purchaseOrders.filter(po => poIds.includes(po.id));

        if (relatedPOs.length === 0) {
            const needsOrdering = (editableEstimate.lineItems || []).some(li => !li.isLabor && !li.isPackageComponent && !li.fromStock);
            return needsOrdering ? 'Awaiting Parts' : 'Not Required';
        }
        
        const needsNewPO = (editableEstimate.lineItems || []).some(li => !li.isLabor && !li.isPackageComponent && !li.fromStock && !li.purchaseOrderLineItemId);
        const allPOsCompleted = relatedPOs.every(po => po.status === 'Received' || po.status === 'Finalized');

        if (allPOsCompleted && !needsNewPO) {
            return 'Fully Received';
        }

        const anyPOReceived = relatedPOs.some(po => po.status === 'Received' || po.status === 'Finalized' || po.status === 'Partially Received');
        if (anyPOReceived || (allPOsCompleted && needsNewPO)) {
            return 'Partially Received';
        }
    
        const anyPOOrdered = relatedPOs.some(po => po.status === 'Ordered');
        if (anyPOOrdered) {
            return 'Ordered';
        }
        
        if (poIds.length > 0) {
            return 'Awaiting Order';
        }

        return 'Awaiting Parts';
    }, [editableJob, purchaseOrders, editableEstimate]);

    useEffect(() => {
        if (editableJob && derivedPartsStatus !== editableJob.partsStatus) {
            setEditableJob(prev => prev ? { ...prev, partsStatus: derivedPartsStatus } : null);
        }
    }, [derivedPartsStatus, editableJob?.partsStatus]);


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
    
            await handleSaveItem(setEstimates, estimateToSave, 'brooks_estimates');
    
            if (newEstimateId) {
                jobToSave.estimateId = newEstimateId;
            }
        }
    
        await handleSaveItem(setJobs, jobToSave, 'brooks_jobs');
    
        onClose();
    };
    
    const handleCancelJob = () => {
        if (editableJob) {
            setConfirmation({
                isOpen: true,
                title: 'Confirm Cancellation',
                message: 'Are you sure you want to cancel this job? It will be moved to the Archived status.',
                type: 'warning',
                onConfirm: async () => {
                    setEditableJob(prev => prev ? { ...prev, status: 'Archived' } : null);
                    // This will be picked up by handleSaveMain
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

    const totalLaborHours = useMemo(() => {
        if (!editableEstimate) return 0;
        return (editableEstimate.lineItems || [])
            .filter(li => li.isLabor)
            .reduce((sum, li) => sum + Number(li.quantity || 0), 0);
    }, [editableEstimate]);

    if (!isOpen || !editableJob) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-indigo-700">Edit Job #{job?.id}</h2>
                            <p className="text-sm text-gray-600">{job?.notes}</p>
                        </div>
                        {job?.status === 'Archived' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase">Cancelled</span>}
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
                        <div className="p-4 bg-white border rounded-lg min-h-[300px]">
                            {isReadOnly && <div className="p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm mb-4">This job has been invoiced and is now read-only.</div>}
                            {isCreatingPackage && <div className="absolute inset-0 bg-white bg-opacity-80 flex justify-center items-center z-50"><Loader2 className="animate-spin" size={48} /></div>}
                            <JobEstimateTab
                                key={poStatusKey}
                                partsStatus={editableJob.partsStatus || 'Not Required'}
                                purchaseOrderIds={editableJob.purchaseOrderIds || []}
                                purchaseOrders={Array.isArray(purchaseOrders) ? purchaseOrders : []}
                                supplierMap={supplierMap}
                                suppliers={suppliers || []}
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
                                currentJobHours={totalLaborHours}
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
                                customer={customer}
                                onAddNewPart={handleAddNewPartClick}
                                onRaisePurchaseOrders={handleRaisePurchaseOrders}
                                onCreatePackage={handleCreatePackage}
                            />
                        </div>
                    </div>
                </main>

                <footer className="flex-shrink-0 flex justify-end gap-2 p-4 border-t bg-gray-50 items-center">
                    {currentUser?.role === 'Admin' && job?.status !== 'Archived' && (
                        <button type="button" onClick={handleCancelJob} className="flex items-center gap-2 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 mr-auto text-sm font-semibold">
                            <Ban size={14}/> Cancel Job
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={triggerPrint}
                        className="flex items-center gap-2 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                        disabled={isPrinting}
                    >
                        <Printer size={14} /> {isPrinting ? 'Loading...' : 'Print Job Card'}
                    </button>
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

            {isPackageModalOpen && editableJob && (
                <ServicePackageFormModal
                    isOpen={isPackageModalOpen}
                    onClose={() => setIsPackageModalOpen(false)}
                    onSave={async (pkg) => {
                        try {
                            const savedPackage = await handleSaveItem(setServicePackages, pkg, 'brooks_servicePackages');
                            setConfirmation({
                                isOpen: true,
                                title: 'Service Package Created',
                                message: `Service Package "${savedPackage.name}" has been saved successfully.`,
                                type: 'success'
                            });
                            addPackage(savedPackage.id);
                            setIsPackageModalOpen(false);
                        } catch (e) {
                             setConfirmation({
                                isOpen: true,
                                title: 'Error',
                                message: 'Failed to save service package.',
                                type: 'warning'
                            });
                        }
                    }}
                    servicePackage={suggestedPackage}
                    taxRates={taxRates}
                    entityId={editableJob.entityId || (businessEntities[0]?.id || '')}
                    businessEntities={businessEntities}
                    parts={parts}
                />
            )}
            <div className="hidden">
                {isPrinting && (
                    <div ref={componentToPrintRef}>
                        <PrintableJobCard
                            job={editableJob!}
                            estimates={mainEstimate ? [mainEstimate, ...supplementaryEstimates] : supplementaryEstimates}
                            customer={customer!}
                            vehicle={vehicle!}
                            entity={businessEntity}
                            engineers={engineers}
                            taxRates={taxRates}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditJobModal;
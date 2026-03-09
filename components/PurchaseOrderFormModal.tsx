import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PurchaseOrder, PurchaseOrderLineItem, Supplier, BusinessEntity, TaxRate, Part, Vehicle, Customer, Job } from '../types';
import { Save, PlusCircle, Trash2, X, CheckSquare, ArrowDownCircle, AlertTriangle, Info, Printer, Mail, Phone, Plus } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import useToaster from '../hooks/useToaster';
import { HoverInfo } from './shared/HoverInfo';
import PartFormModal from './PartFormModal';
import { PurchaseOrderPrint } from './PurchaseOrderPrint';
import EmailPurchaseOrderModal from './EmailPurchaseOrderModal';
import { usePrint } from '../core/hooks/usePrint';
import { useWorkshopActions } from '../core/hooks/useWorkshopActions';
import { useApp } from '../core/state/AppContext';

interface PurchaseOrderLineItemRowProps {
    item: PurchaseOrderLineItem;
    parts: Part[];
    onLineItemChange: (id: string, field: keyof PurchaseOrderLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    isReceivingDisabled: boolean;
    isOrderedOrLater: boolean;
    isCredit: boolean;
    isNewItem: boolean;
    onAddNewPart: (lineItemId: string, searchTerm: string) => void;
}

const PurchaseOrderLineItemRow: React.FC<PurchaseOrderLineItemRowProps> = ({
    item,
    parts,
    onLineItemChange,
    onRemoveLineItem,
    isReceivingDisabled,
    isOrderedOrLater,
    isCredit,
    isNewItem,
    onAddNewPart,
}) => {
    const [descriptionSearch, setDescriptionSearch] = useState(item.description || '');
    const [showResults, setShowResults] = useState(false);

    const filteredParts = useMemo(() => {
        if (descriptionSearch.length < 2) return [];
        const lowerSearch = descriptionSearch.toLowerCase();
        return parts.filter(p =>
            p.description.toLowerCase().includes(lowerSearch) ||
            p.partNumber.toLowerCase().includes(lowerSearch)
        ).slice(0, 10);
    }, [descriptionSearch, parts]);

    const handleSelectPart = (part: Part) => {
        onLineItemChange(item.id, 'partNumber', part.partNumber);
        onLineItemChange(item.id, 'description', part.description);
        onLineItemChange(item.id, 'unitPrice', part.costPrice);
        setDescriptionSearch(part.description);
        setShowResults(false);
    };

    useEffect(() => {
        setDescriptionSearch(item.description || '');
    }, [item.description]);

    const fieldsDisabled = isOrderedOrLater && !isNewItem;
    const ordered = item.quantity || 0;
    const received = item.receivedQuantity || 0;
    const isFullyReceived = isCredit ? (Math.abs(received) >= Math.abs(ordered)) : (received >= ordered && ordered > 0);
    const isPendingReturn = item.returnStatus === 'Pending';
    const canReceive = !isReceivingDisabled && !isCredit;
    const hasBeenReceived = (item.receivedQuantity || 0) > 0;

    return (
        <div className={`grid grid-cols-12 gap-2 items-start p-2 border bg-white rounded-lg ${isFullyReceived && isOrderedOrLater ? 'bg-green-50/50' : ''} ${isPendingReturn ? 'bg-amber-50 border-amber-200' : ''} ${isCredit ? 'bg-red-50/30' : ''}`}>
            <div className="col-span-4 relative">
                <input
                    type="text"
                    placeholder="Search Description or Part No..."
                    value={descriptionSearch}
                    onChange={e => {
                        setDescriptionSearch(e.target.value);
                        onLineItemChange(item.id, 'description', e.target.value);
                        if (!showResults) setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="w-full p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    disabled={fieldsDisabled}
                />
                {showResults && (
                    <div className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                        {filteredParts.map(part => (
                            <div key={part.id} onMouseDown={() => handleSelectPart(part)} className="p-2 hover:bg-indigo-50 cursor-pointer">
                                <p className="font-bold text-sm">{part.description}</p>
                                <p className="text-xs text-gray-500">{part.partNumber}</p>
                                <p className="text-xs text-gray-500">Stock: {part.stockQuantity}</p>
                            </div>
                        ))}
                         <div onMouseDown={() => onAddNewPart(item.id, descriptionSearch)} className="p-2 bg-indigo-50 hover:bg-indigo-100 cursor-pointer text-sm text-indigo-700 font-semibold border-t flex items-center gap-1">
                            <Plus size={14}/> Create New Part
                        </div>
                    </div>
                )}
            </div>

            <input type="text" placeholder="Part Number" value={item.partNumber || ''} onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} className="col-span-2 p-1 border rounded disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium" disabled={fieldsDisabled} />
            <input type="number" step="1" value={item.quantity ?? 0} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className={`col-span-1 p-1 border rounded text-right disabled:bg-gray-100 disabled:cursor-not-allowed text-sm ${isCredit ? 'text-red-600 font-bold' : ''}`} disabled={fieldsDisabled} />

            <div className="col-span-2 relative">
                <input
                    type="number"
                    step="1"
                    value={item.receivedQuantity ?? ''}
                    onChange={e => onLineItemChange(item.id, 'receivedQuantity', e.target.value)}
                    placeholder="0"
                    className={`w-full p-1 border rounded text-right disabled:bg-gray-100 text-sm`}
                    disabled={isReceivingDisabled}
                    title={`Ordered: ${ordered}`}
                />
            </div>

            <input type="number" step="0.01" value={item.unitPrice ?? 0} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Unit Cost"/>

            <div className="col-span-1 flex justify-center items-center">
                {canReceive && hasBeenReceived ? (
                    <button type="button" onClick={() => onLineItemChange(item.id, 'returnStatus', isPendingReturn ? 'None' : 'Pending')} className={`p-1 rounded ${isPendingReturn ? 'bg-amber-100 text-amber-600' : 'text-gray-300 hover:text-amber-500'}`} title={isPendingReturn ? 'Cancel Return Request' : 'Mark Item for Return'}>
                        <AlertTriangle size={16} fill={isPendingReturn ? "currentColor" : "none"}/>
                    </button>
                ) : (
                    <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete Line Item" disabled={isOrderedOrLater && hasBeenReceived}>
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

interface PurchaseOrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (po: PurchaseOrder) => void;
    onSavePart: (part: Part) => void;
    purchaseOrder: PurchaseOrder | null;
    suppliers: Supplier[];
    taxRates: TaxRate[];
    businessEntities: BusinessEntity[];
    allPurchaseOrders: PurchaseOrder[];
    selectedEntityId: string;
    parts: Part[];
    setParts: React.Dispatch<React.SetStateAction<Part[]>>;
    onViewPurchaseOrder?: (po: PurchaseOrder) => void;
    jobId?: string; 
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    generatePurchaseOrderId: (allPurchaseOrders: PurchaseOrder[], entityShortCode: string) => string;
    forceRefresh: (collectionKey: string) => Promise<void>;
}

const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({ isOpen, onClose, onSave, onSavePart, purchaseOrder, suppliers, taxRates, businessEntities, allPurchaseOrders, selectedEntityId, parts, setParts, onViewPurchaseOrder, jobId, jobs, vehicles, customers, setJobs, generatePurchaseOrderId, forceRefresh }) => {
    const { setConfirmation } = useApp();
    const { handleDeletePurchaseOrder } = useWorkshopActions();
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({ 
        lineItems: [],
        supplierId: '',
        vehicleRegistrationRef: '',
        supplierReference: '',
        secondarySupplierReference: '',
        notes: '',
        status: 'Draft',
        type: 'Standard',
        orderDate: formatDate(new Date()),
        jobId: '',
    });
    const { showError, showSuccess } = useToaster();
    const print = usePrint();
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [newPart, setNewPart] = useState<Partial<Part> | null>(null);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const saveAndLinkPo = useCallback((poToSave: PurchaseOrder) => {
        onSave(poToSave);
    
        if (poToSave.jobId && setJobs && allPurchaseOrders && jobs && parts) {
            const updatedPOsList = [...allPurchaseOrders.filter(p => p.id !== poToSave.id), poToSave];
            const poMap = new Map(updatedPOsList.map(p => [p.id, p]));
    
            setJobs(prevJobs => prevJobs.map(job => {
                if (job.id === poToSave.jobId) {
                    const newJobLineItemsFromPO = (poToSave.lineItems || []).map(poItem => {
                        const part = parts.find(p => p.partNumber.toLowerCase() === poItem.partNumber?.toLowerCase());
                        let salePrice = part?.salePrice;
                        if (salePrice === undefined || salePrice === null) {
                            console.warn(`Part ${poItem.partNumber} does not have a sale price. Using cost price from PO as a fallback.`);
                            salePrice = poItem.unitPrice;
                        }
    
                        return {
                            id: `po_item_${poItem.id}`,
                            purchaseOrderLineItemId: poItem.id,
                            description: poItem.description,
                            quantity: poItem.quantity,
                            unitPrice: salePrice,
                            isLabor: false,
                            partId: part?.id || null,
                            taxCodeId: poItem.taxCodeId,
                        };
                    });
    
                    const existingJobLineItems = job.lineItems || [];
                    const poItemIds = new Set((poToSave.lineItems || []).map(li => li.id));
    
                    const otherJobLineItems = existingJobLineItems.filter(
                        li => !li.purchaseOrderLineItemId || !poItemIds.has(li.purchaseOrderLineItemId)
                    );
    
                    const updatedJobLineItems = [...otherJobLineItems, ...newJobLineItemsFromPO];
    
                    const currentPoIds = job.purchaseOrderIds || [];
                    const newPurchaseOrderIds = Array.from(new Set([...currentPoIds, poToSave.id]));
                    
                    const jobPOs = newPurchaseOrderIds
                        .map(id => poMap.get(id))
                        .filter((p): p is PurchaseOrder => !!p && p.type !== 'Credit');
    
                    let newPartsStatus: Job['partsStatus'] = 'Not Required';
    
                    if (jobPOs.length > 0) {
                        const allReceived = jobPOs.every(p => p.status === 'Received');
                        const anyReceived = jobPOs.some(p => p.status === 'Received' || p.status === 'Partially Received');
                        const anyOrdered = jobPOs.some(p => p.status === 'Ordered');
    
                        if (allReceived) {
                            newPartsStatus = 'Fully Received';
                        } else if (anyReceived) {
                            newPartsStatus = 'Partially Received';
                        } else if (anyOrdered) {
                            newPartsStatus = 'Ordered';
                        } else {
                            newPartsStatus = 'Awaiting Order';
                        }
                    }
    
                    return {
                        ...job,
                        purchaseOrderIds: newPurchaseOrderIds,
                        partsStatus: newPartsStatus,
                        lineItems: updatedJobLineItems, 
                    };
                }
                return job;
            }));
        }
    }, [onSave, setJobs, allPurchaseOrders, jobs, parts]);
    
    const partsMap = useMemo(() => new Map(parts.map(p => [p.partNumber.toLowerCase(), p])), [parts]);
    const standardTaxRate = useMemo(() => taxRates.find(t => t.code === 'T1') || taxRates[0], [taxRates]);

    const originalLineItemIds = useMemo(() =>
        purchaseOrder ? new Set(purchaseOrder.lineItems.map(item => item.id)) : new Set()
    , [purchaseOrder]);

    const { associatedVehicle, associatedCustomer } = useMemo(() => {
        let vehicle: Vehicle | null | undefined = null;
        let customer: Customer | null | undefined = null;
        const targetJobId = formData.jobId;

        if (targetJobId && jobs && vehicles && customers) {
            const job = jobs.find(j => j.id === targetJobId);
            if (job) {
                vehicle = vehicles.find(v => v.id === job.vehicleId);
                customer = customers.find(c => c.id === job.customerId);
            }
        } else if (purchaseOrder && vehicles && customers) {
            const job = jobs.find(j => j.id === purchaseOrder.jobId);
            if (job) {
                 vehicle = vehicles.find(v => v.id === job.vehicleId);
                 customer = customers.find(c => c.id === job.customerId);
            }
        }
        
        return { associatedVehicle: vehicle, associatedCustomer: customer };
    }, [formData.jobId, purchaseOrder, jobs, vehicles, customers]);
    
    const title = useMemo(() => {
        if (!formData?.id) return 'Create New Purchase Order';
        if (formData.type === 'Credit') return `Credit Note Request #${formData.id}`;
        return `Edit Purchase Order #${formData.id}`;
    }, [formData.id, formData.type]);

    const statusOptions = useMemo(() => {
        if (formData.type === 'Credit') {
            return ['Draft', 'Awaiting Supplier Action', 'Finalized', 'Cancelled'];
        }
        return ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];
    }, [formData.type]);

    useEffect(() => {
        if (!isOpen) return;

        if (purchaseOrder) {
            const data = JSON.parse(JSON.stringify(purchaseOrder));
            const rawId = data.supplierId || data.supplier?.id || data.SupplierId || "";

            const isNewlyGenerated = !data.id && (data.lineItems || []).length > 0;
            let lineItemsToSet = data.lineItems || [];

            if (isNewlyGenerated) {
                lineItemsToSet = lineItemsToSet.filter((item: PurchaseOrderLineItem) => {
                    if (!item.partNumber) return true;
                    const part = partsMap.get(item.partNumber.toLowerCase());
                    return !part || !part.isStockItem;
                });
            }
            
            setFormData({
                ...data,
                supplierId: String(rawId), 
                vehicleRegistrationRef: data.vehicleRegistrationRef || '',
                supplierReference: data.supplierReference || '',
                secondarySupplierReference: data.secondarySupplierReference || '',
                notes: data.notes || '',
                status: data.status || 'Draft',
                type: data.type || 'Standard',
                lineItems: lineItemsToSet,
                jobId: data.jobId || ''
            });
        } else {
            setFormData({
                entityId: selectedEntityId,
                supplierId: '',
                orderDate: formatDate(new Date()),
                status: 'Draft', 
                lineItems: [],
                notes: '',
                vehicleRegistrationRef: '',
                supplierReference: '',
                secondarySupplierReference: '',
                type: 'Standard',
                jobId: jobId || '',
            });
        }
    }, [purchaseOrder, isOpen, selectedEntityId, jobId]);
    
    const isReceivingDisabled = useMemo(() => formData.status === 'Draft', [formData.status]);
    const isOrderedOrLater = useMemo(() => ['Ordered', 'Partially Received', 'Received'].includes(formData.status || ''), [formData.status]);
    const isOriginalStatusReceived = useMemo(() => purchaseOrder?.status === 'Received', [purchaseOrder]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLineItemChange = useCallback((id: string, field: keyof PurchaseOrderLineItem, value: any) => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).map(item => {
                if (item.id === id) {
                    const numericFields = ['quantity', 'unitPrice', 'receivedQuantity'];
                    let processedValue = value;
                    if (numericFields.includes(field as string)) {
                        const num = parseFloat(value);
                        processedValue = isNaN(num) ? 0 : num;
                    }
                    return { ...item, [field]: processedValue };
                }
                return item;
            })
        }));
    }, []);
    
    const addLineItem = () => {
        const newItem: PurchaseOrderLineItem = { 
            id: crypto.randomUUID(), 
            partNumber: '',
            description: '', 
            quantity: 1, 
            unitPrice: 0, 
            taxCodeId: standardTaxRate?.id || ''
        };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const removeLineItem = useCallback((id: string) => {
        setFormData(prev => ({ ...prev, lineItems: (prev.lineItems || []).filter(item => item.id !== id) }));
    }, []);

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        const newPartData: Partial<Part> = {
            description: searchTerm,
            partNumber: searchTerm,
            taxCodeId: standardTaxRate?.id || '',
        };
        setNewPart(newPartData);
        setIsAddingPart(true);
    };

    const handleSaveNewPart = (part: Part) => {
        const newPartWithId = { ...part, id: part.id || `part_${Date.now()}` };
        onSavePart(newPartWithId);

        if (targetLineItemId) {
            setFormData(prev => {
                const lineItems = prev.lineItems || [];
                const updatedLineItems = lineItems.map(item =>
                    item.id === targetLineItemId
                        ? {
                            ...item,
                            partNumber: newPartWithId.partNumber,
                            description: newPartWithId.description,
                            unitPrice: newPartWithId.costPrice,
                        }
                        : item
                );
                return { ...prev, lineItems: updatedLineItems };
            });
        }
        setIsAddingPart(false);
        setNewPart(null);
        setTargetLineItemId(null);
    };
    
    const handleFillBalance = () => {
        setFormData(prev => ({
            ...prev,
            lineItems: (prev.lineItems || []).map(item => ({ ...item, receivedQuantity: item.quantity }))
        }));
    };

    const calculateFinalStatus = (lineItems: PurchaseOrderLineItem[]): PurchaseOrder['status'] => {
        if (lineItems.length === 0) return formData.status as PurchaseOrder['status'] || 'Draft';
        
        const allReceived = lineItems.every(item => 
            Math.abs(Number(item.receivedQuantity || 0)) >= Math.abs(Number(item.quantity || 0))
        );
        const anyReceived = lineItems.some(item => 
            Math.abs(Number(item.receivedQuantity || 0)) > 0
        );

        if (allReceived) return 'Received';
        if (anyReceived) return 'Partially Received';
        return 'Ordered';
    };

    const handleSave = async () => {
        if (isOriginalStatusReceived) {
            showError('This purchase order has been received and cannot be modified.');
            return;
        }

        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            showError('Supplier and Internal Reference are required.');
            return;
        }

        const lineItems = formData.lineItems || [];
        let newStatus = formData.status as PurchaseOrder['status'] || 'Draft';

        if (newStatus !== 'Draft' && newStatus !== 'Cancelled') {
            newStatus = calculateFinalStatus(lineItems);
        }

        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        const payload = {
            ...formData,
            id: formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode),
            status: newStatus,
            jobId: formData.jobId,
        };
        
        saveAndLinkPo(payload as PurchaseOrder);
        await forceRefresh('brooks_purchaseOrders');
        await forceRefresh('brooks_jobs');
        onClose();
    };

    const handleDelete = () => {
        if (!formData.id) return;
        setConfirmation({
            isOpen: true,
            title: 'Delete Purchase Order',
            message: `Are you sure you want to permanently delete this purchase order? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                await handleDeletePurchaseOrder(formData.id!);
                onClose();
            },
        });
    };

    const handleFinalizeReceipt = async () => {
        if (isOriginalStatusReceived) {
            showError('This purchase order has already been finalized.');
            return;
        }

        if (!formData.supplierId || !formData.vehicleRegistrationRef) {
            showError('Supplier and Internal Reference are required.');
            return;
        }
        
        if (!formData.supplierReference) {
             showError('Please enter a Supplier Reference / Invoice No. to finalize this receipt.');
             return;
        }

        const lineItems = formData.lineItems || [];
        const newStatus = calculateFinalStatus(lineItems);

        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
    
        const updatedPO = {
            ...formData,
            id: formData.id || generatePurchaseOrderId(allPurchaseOrders, entityShortCode),
            status: newStatus,
            jobId: formData.jobId,
        };

        const itemsToReturn = (formData.lineItems || []).filter(item => item.returnStatus === 'Pending');

        if (itemsToReturn.length > 0) {
            const creditNote: Partial<PurchaseOrder> = {
                ...formData,
                id: generatePurchaseOrderId(allPurchaseOrders, entityShortCode) + "-CR",
                type: 'Credit',
                status: 'Awaiting Supplier Action',
                orderDate: formatDate(new Date()),
                supplierReference: `CR for ${formData.id}`,
                vehicleRegistrationRef: formData.vehicleRegistrationRef,
                lineItems: itemsToReturn.map(item => ({
                    ...item,
                    id: crypto.randomUUID(),
                    quantity: -Math.abs(item.receivedQuantity || 0),
                    receivedQuantity: 0,
                    returnStatus: undefined
                })),
                notes: `Credit Note for PO #${formData.id}. Covers returned items.`
            };
            saveAndLinkPo(creditNote as PurchaseOrder);
            showSuccess(`Receipt finalized. Credit note for ${itemsToReturn.length} item(s) has been raised.`);
        } else {
            showSuccess('Receipt finalized successfully.');
        }
        
        saveAndLinkPo(updatedPO as PurchaseOrder);
        await forceRefresh('brooks_purchaseOrders');
        await forceRefresh('brooks_jobs');
        onClose();
    };

    const { totalNet, totalTax, grandTotal } = useMemo(() => {
        let net = 0;
        (formData.lineItems || []).forEach(item => {
            net += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        });
        
        const taxRatePercent = standardTaxRate?.rate || 20;
        const tax = net * (taxRatePercent / 100);
        
        return { totalNet: net, totalTax: tax, grandTotal: net + tax };
    }, [formData.lineItems, standardTaxRate]);

    const currentSupplier = useMemo(() => suppliers.find(s => s.id === formData.supplierId), [formData.supplierId, suppliers]);
    const currentEntity = useMemo(() => businessEntities.find(e => e.id === formData.entityId), [formData.entityId, businessEntities]);

    const handlePrint = () => {
        if (!currentEntity || !currentSupplier) {
            showError("Please select a supplier and business entity before printing.");
            return;
        }
        print(<PurchaseOrderPrint purchaseOrder={formData as PurchaseOrder} entityDetails={currentEntity} supplier={currentSupplier} totals={{ net: totalNet, vat: totalTax, grandTotal: grandTotal }} />);
    };

    const handleOrderByPhone = () => {
        setFormData(prev => ({
            ...prev,
            status: 'Ordered',
            notes: `${prev.notes || ''}\n\n[System Note: Manually marked as 'Ordered by phone' on ${formatDate(new Date())}]`
        }));
        showSuccess('PO status has been set to Ordered.');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center border-b p-4">
                    <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="font-semibold text-sm block text-gray-700">Supplier*</label>
                            <select 
                                name="supplierId"
                                value={formData.supplierId || ''} 
                                onChange={handleChange}
                                className="w-full p-2 border rounded mt-1 bg-white disabled:bg-gray-100"
                                disabled={isOrderedOrLater}
                            >
                                <option value="">-- Select Supplier --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                             <label className="font-semibold text-sm block text-gray-700">
                                Internal Ref (Reg/Job)*
                                {associatedVehicle && (
                                    <HoverInfo
                                        title="Vehicle Details"
                                        data={{
                                            registration: associatedVehicle.registration,
                                            make: associatedVehicle.make,
                                            model: associatedVehicle.model,
                                            vin: associatedVehicle.vin
                                        }}
                                    >
                                        <Info size={14} className="text-gray-400 cursor-help ml-1.5" />
                                    </HoverInfo>
                                )}
                            </label>
                            <input name="vehicleRegistrationRef" value={formData.vehicleRegistrationRef || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={isOrderedOrLater} />
                        </div>
                        <div>
                             <label className="font-semibold text-sm block text-gray-700">
                                Job ID
                                {associatedCustomer && (
                                    <HoverInfo
                                        title="Customer Details"
                                        data={{
                                            name: `${associatedCustomer.forename} ${associatedCustomer.surname}`,
                                            address: associatedCustomer.addressLine1,
                                            city: associatedCustomer.city,
                                            postcode: associatedCustomer.postcode,
                                            contact: associatedCustomer.mobile || associatedCustomer.phone
                                        }}
                                    >
                                        <Info size={14} className="text-gray-400 cursor-help ml-1.5" />
                                    </HoverInfo>
                                )}
                            </label>
                            <input name="jobId" value={formData.jobId || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" disabled={!!formData.jobId} />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Status</label>
                            <select name="status" value={formData.status || 'Draft'} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Supplier Ref (Invoice #)</label>
                            <input name="supplierReference" value={formData.supplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Secondary Ref (Delivery Note)</label>
                            <input name="secondarySupplierReference" value={formData.secondarySupplierReference || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="font-semibold text-sm text-gray-700">Order Date</label>
                            <input type="date" name="orderDate" value={formData.orderDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 space-y-2">
                        <div className="flex justify-between items-end">
                            <h3 className="font-bold text-gray-800">Line Items</h3>
                            {isOrderedOrLater && !isReceivingDisabled && (
                                <button onClick={handleFillBalance} className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800 font-bold mb-1">
                                    <ArrowDownCircle size={14}/> Auto-fill "Rec'd" for all items
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-4">Description</div>
                            <div className="col-span-2">Part Number</div>
                            <div className="col-span-1 text-right">Qty</div>
                            <div className="col-span-2 text-right">Rec'd</div>
                            <div className="col-span-2 text-right">Unit Cost</div>
                            <div className="col-span-1"></div>
                        </div>

                        {(formData.lineItems || []).map(item => (
                            <PurchaseOrderLineItemRow 
                                key={item.id} 
                                item={item} 
                                parts={parts}
                                onLineItemChange={handleLineItemChange} 
                                onRemoveLineItem={removeLineItem} 
                                isReceivingDisabled={isReceivingDisabled}
                                isOrderedOrLater={isOrderedOrLater}
                                isCredit={formData.type === 'Credit'}
                                isNewItem={!originalLineItemIds.has(item.id)}
                                onAddNewPart={handleAddNewPartClick}
                            />
                        ))}
                         {['Draft', 'Ordered', 'Partially Received'].includes(formData.status || '') && formData.type !== 'Credit' && (
                            <button onClick={addLineItem} className="text-indigo-600 font-semibold flex items-center gap-1 mt-2 hover:text-indigo-800">
                                <PlusCircle size={16}/> Add New Line
                            </button>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t flex justify-between items-start">
                        <div className="w-1/2">
                            <label className="font-semibold text-sm text-gray-700 block mb-1">Internal Notes</label>
                            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded text-sm bg-white" placeholder="Add any internal notes here..." />
                        </div>
                        <div className="w-64 space-y-1">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Net Total</span>
                                <span>{formatCurrency(totalNet)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 italic">
                                <span>VAT ({standardTaxRate?.rate || 20}%)</span>
                                <span>{formatCurrency(totalTax)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t text-indigo-900">
                                <span>Grand Total</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="p-4 border-t flex justify-between bg-gray-50">
                     <div className="flex gap-2">
                        {formData.id && (
                            <button 
                                onClick={handleDelete} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 font-bold shadow-sm disabled:bg-red-300"
                                disabled={isOriginalStatusReceived || (isOrderedOrLater && formData.status !== 'Cancelled')}
                            >
                                <Trash2 size={16}/> Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                         {formData.status === 'Draft' && formData.type !== 'Credit' && (
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrint} className="px-3 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 font-semibold shadow-sm"><Printer size={16}/> Print</button>
                                <button onClick={() => setIsEmailModalOpen(true)} className="px-3 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 font-semibold shadow-sm"><Mail size={16}/> Email</button>
                                <button onClick={handleOrderByPhone} className="px-3 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 font-semibold shadow-sm"><Phone size={16}/> Order by Phone</button>
                            </div>
                        )}
                        {!isReceivingDisabled && formData.type !== 'Credit' && (
                            <button onClick={handleFinalizeReceipt} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold shadow-sm">
                                <CheckSquare size={16}/> Save & Finalize Receipt
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                        <button 
                            onClick={handleSave} 
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold shadow-sm disabled:bg-indigo-300 disabled:cursor-not-allowed"
                            disabled={isOriginalStatusReceived}
                        >
                            <Save size={16}/> Save Changes
                        </button>
                    </div>
                </footer>
            </div>

            {isAddingPart && (
                <PartFormModal
                    isOpen={isAddingPart}
                    onClose={() => setIsAddingPart(false)}
                    onSave={handleSaveNewPart}
                    part={newPart}
                    suppliers={suppliers}
                    taxRates={taxRates}
                />
            )}

            {isEmailModalOpen && currentEntity && currentSupplier && (
                 <EmailPurchaseOrderModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={() => {}}
                    purchaseOrder={formData as PurchaseOrder}
                    businessEntity={currentEntity}
                    supplier={currentSupplier}
                 />
            )}
        </div>
    );
};

export default PurchaseOrderFormModal;
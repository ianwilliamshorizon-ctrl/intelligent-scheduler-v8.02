import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem, Job, User, CheckInPhoto, Supplier } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus, Image as ImageIcon, History, Car, Wand2, Expand } from 'lucide-react';
import { formatDate, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import { generateEstimateNumber } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import SearchableSelect from './SearchableSelect';
import FormModal from './FormModal';
import MediaManagerModal from './MediaManagerModal';
import PartFormModal from './PartFormModal';
import LiveAssistant from './LiveAssistant';
import { getScoredServicePackages } from '../utils/servicePackageScoring';
import SupplierSelectionModal from './SupplierSelectionModal';

interface EditableLineItemRowProps {
    item: EstimateLineItem;
    taxRates: TaxRate[];
    suppliers: Supplier[];
    onLineItemChange: (id: string, field: keyof EstimateLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    onOpenSupplierSelection: (lineItemId: string) => void;
    filteredParts: Part[];
    activePartSearch: string | null;
    onPartSearchChange: (value: string) => void;
    onSetActivePartSearch: (id: string | null) => void;
    onSelectPart: (lineItemId: string, part: Part) => void;
    onAddNewPart: (lineItemId: string, searchTerm: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ 
    item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, 
    activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart, onAddNewPart, suppliers, onOpenSupplierSelection 
}: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

    const supplierShortCode = useMemo(() => {
        if (item.isLabor) return 'N/A';
        if (!item.supplierId) return <span className="text-gray-400">-</span>;
        const supplier = suppliers.find(s => s.id === item.supplierId);
        return <span className="font-mono bg-gray-200 px-1 rounded">{supplier?.shortCode || '???'}</span>;
    }, [item.supplierId, suppliers, item.isLabor]);

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        onLineItemChange(item.id, 'description', value);
        if (!item.isLabor && !isPackageHeader && !isPackageComponent) {
            onPartSearchChange(value);
        }
    };

    return (
         <div className={`grid grid-cols-12 gap-2 items-start p-2 rounded-lg border ${isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
            <div className="col-span-5 flex items-start gap-2">
                 {!isPackageComponent && (
                    <input 
                        type="checkbox" 
                        checked={item.isOptional || false} 
                        onChange={e => onLineItemChange(item.id, 'isOptional', e.target.checked)}
                        className="h-4 w-4 mt-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                        title="Mark as Optional"
                    />
                )}
                <div className="w-full space-y-1">
                    <input 
                        type="text" 
                        placeholder="Part No." 
                        value={item.partNumber || ''} 
                        onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} 
                        className="w-full p-1 border rounded disabled:bg-gray-200 text-sm" 
                        disabled={isPackageComponent || item.isLabor} 
                    />
                    <div className="relative w-full">
                        <textarea 
                            placeholder="Description" 
                            value={item.description || ''} 
                            onChange={handleDescriptionChange}
                            onFocus={() => {
                                if (!item.isLabor && !item.servicePackageId && !item.isPackageComponent) {
                                    onSetActivePartSearch(item.id);
                                    onPartSearchChange(item.description || '');
                                }
                            }}
                            onBlur={() => setTimeout(() => onSetActivePartSearch(null), 150)}
                            rows={1}
                            style={{ whiteSpace: 'pre-wrap', minHeight: '38px' }}
                            className="w-full p-1 border rounded disabled:bg-gray-200 text-sm resize-y-none overflow-hidden"
                            disabled={!!isPackageComponent} 
                        />
                         {activePartSearch === item.id && (
                            <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-60 overflow-y-auto mt-1">
                                {filteredParts.map(part => (
                                    <div key={part.id} onMouseDown={() => onSelectPart(item.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm border-b last:border-0">
                                        <p className="font-semibold text-indigo-700">{part.partNumber}</p>
                                        <p className="text-gray-600 truncate">{part.description}</p>
                                    </div>
                                ))}
                                <div onMouseDown={() => onAddNewPart(item.id, item.description || '')} className="p-2 bg-indigo-50 hover:bg-indigo-100 cursor-pointer text-sm text-indigo-700 font-semibold border-t flex items-center gap-1">
                                    <Plus size={14}/> Create New Part
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right text-sm" />
            <input type="number" step="0.01" value={item.unitCost || ''} onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Cost" />
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Sell" disabled={!!isPackageComponent}/>
            <div className="col-span-1">
                <button 
                    type="button" 
                    onClick={() => onOpenSupplierSelection(item.id)} 
                    className="w-full p-1 border rounded text-sm text-center hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed h-full" 
                    disabled={item.isLabor || isPackageComponent || isPackageHeader}
                >
                    {supplierShortCode}
                </button>
            </div>
            <div className="col-span-1 flex justify-center items-center gap-1">
                <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1" disabled={!!isPackageComponent}><Trash2 size={14} /></button>
            </div>
         </div>
    );
});

const Section = ({ title, icon: Icon, children, defaultOpen = true, actions }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean, actions?: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                <div className="flex items-center gap-2">
                    {actions}
                    <button type="button">
                        {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                    </button>
                </div>
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
        </div>
    );
};

interface NotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    notes: string;
    onSave: (notes: string) => void;
}

const NotesModal: React.FC<NotesModalProps> = ({ isOpen, onClose, notes, onSave }) => {
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
                    <h2 className="text-lg font-bold">Edit Notes</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <div className="flex-grow p-4">
                    <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        className="w-full h-full p-2 border rounded resize-none text-sm"
                        placeholder="Enter notes..."
                    />
                </div>
                <footer className="p-4 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
                </footer>
            </div>
        </div>
    );
};

interface EstimateFormModalProps {
    isOpen: boolean; onClose: () => void; onSave: (estimate: Estimate) => void;
    estimate: Partial<Estimate> | null; jobContext?: Job | null; customers: Customer[];
    onSaveCustomer: (customer: Customer) => void; vehicles: Vehicle[];
    onSaveVehicle: (vehicle: Vehicle) => void;
    businessEntities: BusinessEntity[]; taxRates: TaxRate[]; servicePackages: ServicePackage[];
    parts: Part[]; estimates: Estimate[]; currentUser: User; selectedEntityId: string;
    onSavePart?: (part: Part) => void;
    suppliers: Supplier[];
}

const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ 
    isOpen, onClose, onSave, estimate, jobContext, customers, onSaveCustomer, 
    vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, 
    estimates, currentUser, selectedEntityId, onSavePart, suppliers
}) => {
    const [formData, setFormData] = useState<Partial<Estimate>>({ 
        lineItems: [], customerId: '', vehicleId: '', entityId: '', issueDate: '', expiryDate: '', status: 'Draft', notes: '', media: []
    });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [newPart, setNewPart] = useState<Part | null>(null);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [lineItemForSupplier, setLineItemForSupplier] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [isSupplierSelectionOpen, setIsSupplierSelectionOpen] = useState(false);
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);
    const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;
    const t99RateId = taxRates.find(t => t.code === 'T99')?.id;

    useEffect(() => {
        if (estimate && Object.keys(estimate).length > 0) {
            setFormData(JSON.parse(JSON.stringify(estimate)));
        } else {
            const initialEntity = selectedEntityId !== 'all'
                ? selectedEntityId
                : (businessEntities.length > 0 ? businessEntities[0].id : '');
            setFormData({
                customerId: '', vehicleId: '',
                entityId: initialEntity,
                issueDate: getTodayISOString(), expiryDate: getFutureDateISOString(30),
                status: 'Draft', lineItems: [], notes: '', createdByUserId: currentUser.id, media: []
            });
        }
    }, [estimate, isOpen, businessEntities, selectedEntityId, currentUser.id]);

    const totals = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number | string; name: string; } } = {};
        const taxRatesMap = new Map(taxRates.map(t => [t.id, t]));

        if (!formData || !formData.lineItems) {
            return { totalNet: 0, grandTotal: 0, vatBreakdown: [], totalCost: 0, totalProfit: 0, profitMargin: 0 };
        }
        
        let totalCost = 0;

        (formData.lineItems || []).forEach(item => {
            if (item.isOptional) return;

            const qty = Number(item.quantity) || 0;
            const cost = Number(item.unitCost) || 0;
            totalCost += qty * cost;

            if (item.isPackageComponent) return;

            const price = Number(item.unitPrice) || 0;
            const itemNet = qty * price;

            if (item.taxCodeId === t99RateId) {
                 if (!breakdown[t99RateId]) {
                    breakdown[t99RateId] = { net: 0, vat: 0, rate: 'Mixed', name: 'Mixed VAT' };
                }
                breakdown[t99RateId].net += itemNet;
                breakdown[t99RateId].vat += (item.preCalculatedVat || 0) * qty;

            } else {
                const effectiveTaxId = item.taxCodeId || standardTaxRateId;
                
                if (!effectiveTaxId) {
                    const noTaxKey = 'no_tax';
                    if (!breakdown[noTaxKey]) breakdown[noTaxKey] = { net: 0, vat: 0, rate: 0, name: 'No Tax' };
                    breakdown[noTaxKey].net += itemNet;
                    return;
                }

                const taxRate = taxRatesMap.get(effectiveTaxId);
                if (!taxRate) {
                    const noTaxKey = 'no_tax_rate';
                    if (!breakdown[noTaxKey]) breakdown[noTaxKey] = { net: 0, vat: 0, rate: 0, name: 'Invalid Tax' };
                    breakdown[noTaxKey].net += itemNet;
                    return;
                }

                if (!breakdown[effectiveTaxId]) {
                    breakdown[effectiveTaxId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
                }

                breakdown[effectiveTaxId].net += itemNet;
                if (taxRate.rate > 0) {
                    breakdown[effectiveTaxId].vat += itemNet * (taxRate.rate / 100);
                }
            }
        });

        const finalVatBreakdown = Object.values(breakdown);
        const totalNet = finalVatBreakdown.reduce((sum, b) => sum + b.net, 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const grandTotal = totalNet + totalVat;
        
        const profit = totalNet - totalCost;
        const margin = totalNet > 0 ? (profit / totalNet) * 100 : 0;

        return {
            totalNet,
            grandTotal,
            vatBreakdown: finalVatBreakdown.filter(b => b.net > 0 || b.vat > 0),
            totalCost,
            totalProfit: profit,
            profitMargin: margin
        };
    }, [formData.lineItems, taxRates, standardTaxRateId, t99RateId]);

    const currentVehicle = vehicles.find(v => v.id === formData.vehicleId);
    const customerOptions = customers.map(c => {
        const fullName = c.companyName
            ? c.companyName 
            : `${c.forename || ''} ${c.surname || ''}`.trim() || 'Unnamed Customer';
        return {
            label: fullName,
            value: c.id,
            description: c.postcode || 'No postcode',
            searchField: `${fullName} ${c.forename || ''} ${c.surname || ''} ${c.companyName || ''} ${c.phone || ''} ${c.postcode || ''}`.toLowerCase()
        };
    });

    const vehicleOptions = vehicles.map(v => ({
        label: v.registration,
        value: v.id,
        description: `${v.make} ${v.model}`,
        searchField: `${v.registration} ${v.make} ${v.model}`.toLowerCase()
    }));

    const sortedPackages = (() => {
        const allAvailable = Array.isArray(servicePackages) ? servicePackages : [];
        const entityPackages = allAvailable; 
        if (!currentVehicle) {
            return entityPackages.map(pkg => ({
                ...pkg,
                id: pkg.id,
                label: pkg.name || 'Unnamed Package',
                value: pkg.id,
                description: pkg.description || 'Service Package',
                badge: { text: 'Generic', className: 'bg-gray-100 text-gray-800' }
            }));
        }
        const scoredResults = getScoredServicePackages(entityPackages, currentVehicle);
        return scoredResults.map(({ pkg, matchType, color }) => ({
            ...pkg,
            id: pkg.id,
            label: pkg.name || 'Unnamed Package',
            value: pkg.id,
            description: pkg.description || 'Service Package',
            badge: { text: matchType, className: color }
        }));
    })();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleCustomerSelect = (selection: any) => {
        const customerId = selection?.value || selection?.id || selection;
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        setRecentCustomerIds(prev => [customer.id, ...prev.filter(id => id !== customer.id)].slice(0, 3));

        setFormData(prev => {
            const customersCars = vehicles.filter(v => v.customerId === customer.id);
            let newVehicleId = prev.vehicleId;

            // If there's no vehicle selected, or the selected vehicle does not belong to the new customer
            if (!newVehicleId || !customersCars.some(car => car.id === newVehicleId)) {
                // If the new customer has only one car, select it. Otherwise, clear selection.
                newVehicleId = customersCars.length === 1 ? customersCars[0].id : '';
            }

            return {
                ...prev,
                customerId: customer.id,
                vehicleId: newVehicleId
            };
        });
    };

    const handleVehicleSelect = (selection: any) => {
        const vehicleId = selection?.value || selection?.id || selection;
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return;
        const ownerId = vehicle.customerId;
        setFormData(prev => ({ 
            ...prev, 
            vehicleId: vehicle.id, 
            customerId: ownerId || prev.customerId 
        }));
        if (ownerId && ownerId !== formData.customerId) {
            setRecentCustomerIds(prev => [ownerId, ...prev.filter(id => id !== ownerId)].slice(0, 3));
        }
    };
    
    const handleSaveCustomerAndVehicle = (customer: Customer, vehicle: Vehicle) => {
        if (!customers.some(c => c.id === customer.id)) {
            onSaveCustomer(customer);
        }
        onSaveVehicle(vehicle);
        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            vehicleId: vehicle.id,
        }));
        setIsAddingVehicle(false);
    };

    const handleLineItemChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => {
        setFormData(prev => {
            const lineItems = prev.lineItems || [];
            const targetItem = lineItems.find(i => i.id === id);
            if (!targetItem) return prev;

            let processedValue = value;

            if (field === 'unitPrice' && targetItem.unitPrice === 0 && (Number(value) || 0) > 0) {
                const grossPrice = Number(value) || 0;
                const taxCodeId = targetItem.taxCodeId || standardTaxRateId;
                const taxRateInfo = taxRates.find(t => t.id === taxCodeId);
                const rate = taxRateInfo ? taxRateInfo.rate : 20;

                if (rate > 0) {
                    processedValue = grossPrice / (1 + (rate / 100));
                } else {
                    processedValue = grossPrice;
                }
            } else if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                processedValue = Number(value) || 0;
            }

            const updatedLineItems = lineItems.map(item =>
                item.id === id
                    ? { ...item, [field]: processedValue }
                    : item
            );

            if (targetItem && field === 'isOptional' && targetItem.servicePackageId && !targetItem.isPackageComponent) {
                return {
                    ...prev,
                    lineItems: updatedLineItems.map(item =>
                        item.servicePackageId === targetItem.servicePackageId && item.isPackageComponent
                            ? { ...item, isOptional: value as boolean }
                            : item
                    )
                };
            }
            return { ...prev, lineItems: updatedLineItems };
        });
    }, [taxRates, standardTaxRateId]);
    
    const entityLaborRate = businessEntities.find(e => e.id === formData.entityId)?.laborRate;
    const entityLaborCostRate = businessEntities.find(e => e.id === formData.entityId)?.laborCostRate;

    const addLineItem = (isLabor: boolean) => {
        const isOptional = false;
        const newItem: EstimateLineItem = { 
            id: crypto.randomUUID(), description: '', quantity: 1, 
            unitPrice: isLabor ? (entityLaborRate || 0) : 0, 
            unitCost: isLabor ? (entityLaborCostRate || 0) : 0, 
            isLabor, taxCodeId: standardTaxRateId, isOptional, partNumber: isLabor ? 'LABOUR' : '' 
        };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const addPackage = (selection: any) => {
        const packageId = selection?.id || selection;
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        const isOptional = false;
        const newItems: EstimateLineItem[] = [];
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(), 
            description: pkg.name || (pkg as any).description || '', 
            quantity: 1, 
            unitPrice: pkg.totalPriceNet ?? pkg.totalPrice, 
            unitCost: 0, 
            isLabor: false, 
            taxCodeId: pkg.taxCodeId || standardTaxRateId, 
            servicePackageId: pkg.id, 
            servicePackageName: pkg.name, 
            isPackageComponent: false, 
            isOptional,
            preCalculatedVat: pkg.taxCodeId === t99RateId ? pkg.totalPriceVat : undefined
        };
        newItems.push(mainPackageItem);

        let runningTotal = 0;
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                const itemPrice = costItem.unitPrice || 0;
                runningTotal += itemPrice * (costItem.quantity || 1);
                newItems.push({ 
                    ...costItem, 
                    id: crypto.randomUUID(), 
                    unitPrice: itemPrice, 
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true, 
                    isOptional 
                });
            });
        }

        // If the main package price is zero, calculate it from components
        if (mainPackageItem.unitPrice === 0 && runningTotal > 0) {
            mainPackageItem.unitPrice = runningTotal;
        }

        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), ...newItems] }));
    };

    const removeLineItem = useCallback((id: string) => {
        setFormData(prev => {
            const itemToRemove = (prev.lineItems || []).find(i => i.id === id);
            if (itemToRemove && itemToRemove.servicePackageId && !itemToRemove.isPackageComponent) {
                const packageId = itemToRemove.servicePackageId;
                return { ...prev, lineItems: (prev.lineItems || []).filter(item => item.servicePackageId !== packageId) };
            }
            return { ...prev, lineItems: (prev.lineItems || []).filter(item => item.id !== id) };
        });
    }, []);

    const filteredPartsList = (() => {
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return parts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    })();

    const handleSelectPart = (lineItemId: string, part: Part) => {
         setFormData(prev => {
            const lineItems = prev.lineItems || [];
            const updatedLineItems = lineItems.map(item => 
                item.id === lineItemId ? { 
                    ...item, 
                    partNumber: part.partNumber, 
                    description: part.description, 
                    unitPrice: part.salePrice, 
                    unitCost: part.costPrice, 
                    partId: part.id, 
                    taxCodeId: part.taxCodeId || standardTaxRateId, 
                    fromStock: part.stockQuantity > 0 
                } : item
            );
            return { ...prev, lineItems: updatedLineItems };
        });
        setActivePartSearch(null);
        setPartSearchTerm('');
    };

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        const newPart: Part = {
            id: `part_${Date.now()}`,
            partNumber: '',
            description: searchTerm,
            salePrice: 0,
            costPrice: 0,
            stockQuantity: 0,
            isStockItem: true,
            defaultSupplierId: '',
            taxCodeId: standardTaxRateId || '',
        };
        setNewPart(newPart);
        setIsAddingPart(true);
        setActivePartSearch(null);
    };

    const handleSaveNewPart = (part: Part) => {
        if (onSavePart) onSavePart(part);
        if (targetLineItemId) handleSelectPart(targetLineItemId, part);
        setIsAddingPart(false); 
        setTargetLineItemId(null);
        setNewPart(null);
    };

    const handleSave = () => {
        if (!formData.customerId || !formData.entityId) return alert('Customer and Business Entity are required.');
        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        onSave({ 
            id: formData.id || `est_${Date.now()}`,
            estimateNumber: formData.estimateNumber || generateEstimateNumber(estimates, entityShortCode), 
            ...formData 
        } as Estimate);
        onClose();
    };
    
    const handleManageMedia = () => setIsMediaModalOpen(true);
    const handleSaveMedia = (media: CheckInPhoto[]) => setFormData(prev => ({ ...prev, media }));
    const openSupplierSelection = (lineItemId: string) => {
        setLineItemForSupplier(lineItemId);
        setIsSupplierSelectionOpen(true);
    };
    
    const handleSelectSupplier = (supplierId: string) => {
        if (lineItemForSupplier) {
            handleLineItemChange(lineItemForSupplier, 'supplierId', supplierId);
        }
    };

    const estimateBreakdown = (() => {
        const packages: { header: EstimateLineItem, children: EstimateLineItem[] }[] = [];
        const customLabor: EstimateLineItem[] = [];
        const customParts: EstimateLineItem[] = [];
        const packageHeaders = (formData.lineItems || []).filter(item => item.servicePackageId && !item.isPackageComponent);
        const allItems = formData.lineItems || [];
        packageHeaders.forEach(header => {
            packages.push({ header, children: allItems.filter(item => item.isPackageComponent && item.servicePackageId === header.servicePackageId) });
        });
        (formData.lineItems || []).forEach(item => {
            if (!item.servicePackageId) {
                if (item.isLabor) customLabor.push(item);
                else customParts.push(item);
            }
        });
        return { packages, customLabor, customParts };
    })();

    const linkedVehicles = vehicles.filter(v => v.customerId === formData.customerId);
    const recentCustomers = customers.filter(c => recentCustomerIds.includes(c.id));

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            onSave={handleSave} 
            title={formData.id ? `Edit Estimate #${formData.estimateNumber}` : 'Create New Estimate'} 
            maxWidth="max-w-screen-2xl"
        >
            <div className="mb-4 flex justify-end">
                <button 
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-black transition-all active:scale-95"
                >
                    <Wand2 size={18} /> Live Assistant
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Section title="Estimate Details" icon={Info}>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="font-semibold">Customer</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect
                                        options={customerOptions}
                                        onSelect={handleCustomerSelect}
                                        defaultValue={formData.customerId}
                                        placeholder="Search name, phone or postcode..."
                                    />
                                    <button type="button" onClick={() => setIsAddingCustomer(true)} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0"><Plus size={20} /></button>
                                </div>
                                {recentCustomers.length > 0 && !formData.customerId && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase w-full mb-1 flex items-center gap-1">
                                            <History size={10}/> Recent:
                                        </span>
                                        {recentCustomers.map(c => (
                                            <button 
                                                key={c.id} 
                                                type="button" 
                                                onClick={() => handleCustomerSelect(c)} 
                                                className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded hover:bg-indigo-50"
                                            >
                                                {c.companyName || `${c.forename || ''} ${c.surname || ''}`.trim() || 'Unnamed'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="font-semibold">Vehicle (Optional)</label>
                                <div className="flex flex-col gap-2 mt-1">
                                    <div className="flex items-center gap-2">
                                        <SearchableSelect
                                            options={vehicleOptions}
                                            onSelect={handleVehicleSelect}
                                            defaultValue={formData.vehicleId}
                                            placeholder="Search registration or make..."
                                        />
                                        <button type="button" onClick={() => setIsAddingVehicle(true)} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0"><Plus size={20} /></button>
                                    </div>
                                    {linkedVehicles.length > 0 && (
                                        <div className="p-2 bg-blue-50 border border-blue-100 rounded">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1 flex items-center gap-1"><Car size={10}/> Customer's Cars:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {linkedVehicles.map(v => (
                                                <button key={v.id} type="button" onClick={() => setFormData(prev => ({ ...prev, vehicleId: v.id }))} className={`text-xs px-2 py-1 rounded font-medium border ${formData.vehicleId === v.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-100'}`}>{v.registration}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold">Business Entity</label>
                                <select name="entityId" value={formData.entityId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                    <option value="">-- Select Entity --</option>
                                    {businessEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="font-semibold">Issue Date</label><input name="issueDate" type="date" value={formData.issueDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" /></div>
                                <div><label className="font-semibold">Expiry Date</label><input name="expiryDate" type="date" value={formData.expiryDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" /></div>
                            </div>
                            <div><label className="font-semibold">Status</label><select name="status" value={formData.status || 'Draft'} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1"><option>Draft</option><option>Sent</option><option>Approved</option><option>Declined</option><option>Converted to Job</option><option>Closed</option></select></div>
                            <div className="bg-gray-50 p-2 rounded-lg border mt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="font-semibold text-sm">Notes & Media</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setIsNotesModalOpen(true)} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><Expand size={14}/> Expand</button>
                                        <button type="button" onClick={handleManageMedia} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><ImageIcon size={14}/> Photos & Videos</button>
                                    </div>
                                </div>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={8} className="w-full p-2 border rounded text-sm" placeholder="Internal notes..." />
                            </div>
                        </div>
                    </Section>
                </div>

                <div className="lg:col-span-2 space-y-4">
                     <Section title="Line Items" icon={FileText}>
                         <div className="space-y-4">
                            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                <div className="col-span-5">Part / Description</div>
                                <div className="col-span-1 text-right">Qty/Hrs</div>
                                <div className="col-span-2 text-right">Cost</div>
                                <div className="col-span-2 text-right">Sell</div>
                                <div className="col-span-1 text-center">Supplier</div>
                                <div className="col-span-1"></div>
                            </div>
                            {estimateBreakdown.packages.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Service Packages</h4>
                                    <div className="space-y-2">
                                        {estimateBreakdown.packages.map(({ header, children }) => (
                                            <div key={header.id}>
                                                <MemoizedEditableLineItemRow 
                                                    item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onAddNewPart={()=>{}} suppliers={suppliers} onOpenSupplierSelection={openSupplierSelection}
                                                />
                                                <div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">
                                                      {children.map(child => (
                                                         <MemoizedEditableLineItemRow 
                                                            key={child.id} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onAddNewPart={()=>{}} suppliers={suppliers} onOpenSupplierSelection={openSupplierSelection}
                                                         />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {estimateBreakdown.customLabor.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Labor</h4>
                                    <div className="space-y-2">{estimateBreakdown.customLabor.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredPartsList} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} onAddNewPart={handleAddNewPartClick} suppliers={suppliers} onOpenSupplierSelection={openSupplierSelection}/>)}</div>
                                </div>
                            )}
                             {estimateBreakdown.customParts.length > 0 && (
                                 <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Parts</h4>
                                    <div className="space-y-2">{estimateBreakdown.customParts.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredPartsList} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} onAddNewPart={handleAddNewPartClick} suppliers={suppliers} onOpenSupplierSelection={openSupplierSelection}/>)}</div>
                                 </div>
                             )}
                            <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-2">
                                    <button onClick={() => addLineItem(true)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Labor</button>
                                    <button onClick={() => addLineItem(false)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Part</button>
                                 </div>
                                 <div className="w-64">
                                    <SearchableSelect 
                                        options={sortedPackages}
                                        onSelect={(val) => addPackage(val)} 
                                        placeholder="Search & Add Package..." 
                                        dropdownClassName="min-w-[450px] right-0" 
                                    />
                                </div>
                            </div>
                        </div>
                    </Section>
                                  
                    <Section title="Totals Summary" icon={Gauge}>
                        <div className="w-full text-sm space-y-1">
                             <div className="flex justify-between text-gray-600"><span>Total Cost Price:</span><span>{formatCurrency(totals.totalCost)}</span></div>
                             <div className="flex justify-between text-gray-600"><span>Total Sale Price (Net):</span><span>{formatCurrency(totals.totalNet)}</span></div>
                             <div className={`flex justify-between font-bold ${totals.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}><span>Total Profit:</span><span>{formatCurrency(totals.totalProfit)}</span></div>
                            <div className="flex justify-between text-gray-600 border-b pb-2 mb-2"><span>Profit Margin:</span><span>{totals.profitMargin.toFixed(1)}%</span></div>
                            {totals.vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-500 text-xs"><span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
                        </div>
                    </Section>
                </div>
            </div>

            <LiveAssistant 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)} 
                jobId={formData.id || null}
                onAddNote={(note) => setFormData(prev => ({ ...prev, notes: (prev.notes || '') + '\n' + note }))}
            />

            <NotesModal 
                isOpen={isNotesModalOpen} 
                onClose={() => setIsNotesModalOpen(false)} 
                notes={formData.notes || ''} 
                onSave={(newNotes) => setFormData(prev => ({...prev, notes: newNotes}))}
            />

            {isAddingCustomer && (
                <CustomerFormModal 
                    isOpen={isAddingCustomer} 
                    onClose={() => setIsAddingCustomer(false)} 
                    onSave={(newCustomer) => { 
                        onSaveCustomer(newCustomer); 
                        handleCustomerSelect(newCustomer); 
                        setIsAddingCustomer(false); 
                    }} 
                    customer={null}
                    existingCustomers={customers}
                    jobs={[]}
                    vehicles={[]}
                    estimates={[]}
                    invoices={[]}
                />
            )}

            {isMediaModalOpen && (
                <MediaManagerModal
                    isOpen={isMediaModalOpen}
                    onClose={() => setIsMediaModalOpen(false)}
                    onSave={handleSaveMedia}
                    initialMedia={formData.media || []} 
                    title="Estimate Photos & Videos"
                />
            )}

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
             {isSupplierSelectionOpen && (
                <SupplierSelectionModal 
                    isOpen={isSupplierSelectionOpen}
                    onClose={() => setIsSupplierSelectionOpen(false)}
                    onSelect={handleSelectSupplier}
                    suppliers={suppliers}
                />
            )}


            {isAddingVehicle && (
                <VehicleFormModal
                    isOpen={isAddingVehicle}
                    onClose={() => setIsAddingVehicle(false)}
                    onSave={(newVehicle) => {
                        onSaveVehicle(newVehicle);
                        setIsAddingVehicle(false);
                    }}
                    onSaveWithCustomer={handleSaveCustomerAndVehicle}
                    vehicle={null}
                    customers={customers}
                    initialCustomerId={formData.customerId} 
                />
            )}
        </FormModal>
    );
};

export default EstimateFormModal;

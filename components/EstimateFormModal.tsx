
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem, Job, User, CheckInPhoto } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus, Image as ImageIcon, History, Car, Wand2 } from 'lucide-react';
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

interface EditableLineItemRowProps {
    item: EstimateLineItem;
    taxRates: TaxRate[];
    onLineItemChange: (id: string, field: keyof EstimateLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
    filteredParts: Part[];
    activePartSearch: string | null;
    onPartSearchChange: (value: string) => void;
    onSetActivePartSearch: (id: string | null) => void;
    onSelectPart: (lineItemId: string, part: Part) => void;
    onAddNewPart: (lineItemId: string, searchTerm: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ 
    item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, 
    activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart, onAddNewPart 
}: EditableLineItemRowProps) => {
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
             <input 
                type="text" 
                placeholder="Part No." 
                value={item.partNumber || ''} 
                onChange={e => onLineItemChange(item.id, 'partNumber', e.target.value)} 
                className="col-span-2 p-1 border rounded disabled:bg-gray-200" 
                disabled={isPackageComponent || item.isLabor} 
            />
            <div className="col-span-4 flex items-center gap-2 relative">
                {!isPackageComponent && (
                    <input 
                        type="checkbox" 
                        checked={item.isOptional || false} 
                        onChange={e => onLineItemChange(item.id, 'isOptional', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                        title="Mark as Optional"
                    />
                )}
                <div className="relative w-full">
                    <input 
                        type="text" 
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
                        className="w-full p-1 border rounded disabled:bg-gray-200" 
                        disabled={!!isPackageComponent} 
                        autoComplete="off"
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
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right" />
            <input type="number" step="0.01" value={item.unitCost || ''} onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Cost Price" />
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Sale Price" disabled={!!isPackageComponent}/>
            <div className="col-span-1 flex justify-center gap-1">
                <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1" disabled={!!isPackageComponent}><Trash2 size={14} /></button>
            </div>
         </div>
    );
});

const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white shadow-sm">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
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
}

const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ 
    isOpen, onClose, onSave, estimate, jobContext, customers, onSaveCustomer, 
    vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, 
    estimates, currentUser, selectedEntityId, onSavePart
}) => {
    const [formData, setFormData] = useState<Partial<Estimate>>({ 
        lineItems: [], customerId: '', vehicleId: '', entityId: '', issueDate: '', expiryDate: '', status: 'Draft', notes: '', media: []
    });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);

    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

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

    const currentVehicle = useMemo(() => 
        vehicles.find(v => v.id === formData.vehicleId), 
    [vehicles, formData.vehicleId]);

    const customerOptions = useMemo(() => customers.map(c => {
        const fullName = c.companyName
            ? c.companyName 
            : `${c.forename || ''} ${c.surname || ''}`.trim() || 'Unnamed Customer';
    
        return {
            label: fullName,
            value: c.id,
            description: c.postcode || 'No postcode',
            searchField: `${fullName} ${c.forename || ''} ${c.surname || ''} ${c.companyName || ''} ${c.phone || ''} ${c.postcode || ''}`.toLowerCase()
        };
    }), [customers]);

    const vehicleOptions = useMemo(() => vehicles.map(v => ({
        label: v.registration,
        value: v.id,
        description: `${v.make} ${v.model}`,
        searchField: `${v.registration} ${v.make} ${v.model}`.toLowerCase()
    })), [vehicles]);

    const sortedPackages = useMemo(() => {
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
    }, [servicePackages, currentVehicle]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleCustomerSelect = (selection: any) => {
        const customerId = selection?.value || selection?.id || selection;
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        setRecentCustomerIds(prev => [customer.id, ...prev.filter(id => id !== customer.id)].slice(0, 3));
        const customersCars = vehicles.filter(v => v.customerId === customer.id);
        setFormData(prev => ({ 
            ...prev, 
            customerId: customer.id, 
            vehicleId: customersCars.length === 1 ? customersCars[0].id : '' 
        }));
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
    
    const entityLaborRate = useMemo(() => businessEntities.find(e => e.id === formData.entityId)?.laborRate, [businessEntities, formData.entityId]);
    const entityLaborCostRate = useMemo(() => businessEntities.find(e => e.id === formData.entityId)?.laborCostRate, [businessEntities, formData.entityId]);
    
    const addLineItem = (isLabor: boolean) => {
        const isOptional = !!formData.jobId;
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
        const isOptional = !!formData.jobId;
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
            isOptional
        };
        newItems.push(mainPackageItem);
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                newItems.push({ ...costItem, id: crypto.randomUUID(), unitPrice: 0, servicePackageId: pkg.id, servicePackageName: pkg.name, isPackageComponent: true, isOptional });
            });
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

    const filteredPartsList = useMemo(() => {
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return parts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    }, [partSearchTerm, parts]);

    const handleSelectPart = (lineItemId: string, part: Part) => {
         setFormData(prev => {
            const lineItems = prev.lineItems || [];
            const updatedLineItems = lineItems.map(item => 
                item.id === lineItemId ? { 
                    ...item, partNumber: part.partNumber, description: part.description, unitPrice: part.salePrice, 
                    unitCost: part.costPrice, partId: part.id, taxCodeId: part.taxCodeId || item.taxCodeId, fromStock: part.stockQuantity > 0 
                } : item
            );
            return { ...prev, lineItems: updatedLineItems };
        });
        setActivePartSearch(null);
        setPartSearchTerm('');
    };

    const handleAddNewPartClick = (lineItemId: string, searchTerm: string) => {
        setTargetLineItemId(lineItemId);
        setNewPartDescription(searchTerm);
        setIsAddingPart(true); setActivePartSearch(null);
    };

    const handleSaveNewPart = (part: Part) => {
        if (onSavePart) onSavePart(part);
        if (targetLineItemId) handleSelectPart(targetLineItemId, part);
        setIsAddingPart(false); setTargetLineItemId(null);
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

    const estimateBreakdown = useMemo(() => {
        const packages: { header: EstimateLineItem, children: EstimateLineItem[] }[] = [];
        const customLabor: EstimateLineItem[] = [];
        const customParts: EstimateLineItem[] = [];
        const packageHeaders = (formData.lineItems || []).filter(item => item.servicePackageId && !item.isPackageComponent);
        const allItems = formData.lineItems || [];
        packageHeaders.forEach(header => {
            packages.push({ header: header, children: allItems.filter(item => item.isPackageComponent && item.servicePackageId === header.servicePackageId) });
        });
        (formData.lineItems || []).forEach(item => {
            if (!item.servicePackageId) {
                if (item.isLabor) customLabor.push(item);
                else customParts.push(item);
            }
        });
        return { packages, customLabor, customParts };
    }, [formData.lineItems]);

    const { totalNet, grandTotal, vatBreakdown, totalCost, totalProfit, profitMargin } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        if (!formData || !formData.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [], totalCost: 0, totalProfit: 0, profitMargin: 0 };
        let cost = 0; let currentTotalNet = 0;
        formData.lineItems.forEach(item => {
            if (item.isPackageComponent) return; 
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId);
            if (!taxRate) return;
            if (!breakdown[taxCodeId]) breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            if (!item.isOptional) {
                 breakdown[taxCodeId].net += itemTotal; currentTotalNet += itemTotal;
                cost += (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
            }
        });
        Object.values(breakdown).forEach(summary => { summary.vat = summary.net * (summary.rate / 100); });
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0 && b.rate > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const profit = currentTotalNet - cost;
        const margin = currentTotalNet > 0 ? (profit / currentTotalNet) * 100 : 0;
        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown, totalCost: cost, totalProfit: profit, profitMargin: margin };
    }, [formData.lineItems, taxRatesMap, standardTaxRateId]);

    const linkedVehicles = useMemo(() => {
        if (!formData.customerId) return [];
        return vehicles.filter(v => v.customerId === formData.customerId);
    }, [vehicles, formData.customerId]);

    const recentCustomers = useMemo(() => customers.filter(c => recentCustomerIds.includes(c.id)), [customers, recentCustomerIds]);

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
                                                <button key={v.id} type="button" 
                                                    onClick={() => setFormData(prev => ({ ...prev, vehicleId: v.id }))} className={`text-xs px-2 py-1 rounded font-medium border ${formData.vehicleId === v.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-100'}`}>{v.registration}</button>
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
                                     <button type="button" onClick={handleManageMedia} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><ImageIcon size={14}/> Photos & Videos</button>
                                </div>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded text-sm" placeholder="Internal notes..." />
                            </div>
                        </div>
                    </Section>
                </div>

                <div className="lg:col-span-2 space-y-4">
                     <Section title="Line Items" icon={FileText}>
                         <div className="space-y-4">
                            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                <div className="col-span-2">Part No.</div> <div className="col-span-4">Description</div>
                                <div className="col-span-1 text-right">Qty/Hrs</div> <div className="col-span-2 text-right">Cost Price</div>
                                <div className="col-span-2 text-right">Sell Price</div> <div className="col-span-1"></div>
                            </div>
                            {estimateBreakdown.packages.length > 0 && (
                                 <div>
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Service Packages</h4>
                                    <div className="space-y-2">
                                        {estimateBreakdown.packages.map(({ header, children }) => (
                                            <div key={header.id}>
                                                 <MemoizedEditableLineItemRow 
                                                    item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onAddNewPart={()=>{}} 
                                                 />
                                                <div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">
                                                     {children.map(child => (
                                                        <MemoizedEditableLineItemRow 
                                                            key={child.id} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} onAddNewPart={()=>{}} 
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
                                    <div className="space-y-2">{estimateBreakdown.customLabor.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredPartsList} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} onAddNewPart={handleAddNewPartClick} />)}</div>
                                </div>
                             )}
                             {estimateBreakdown.customParts.length > 0 && (
                                 <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Parts</h4>
                                    <div className="space-y-2">{estimateBreakdown.customParts.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredPartsList} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} onAddNewPart={handleAddNewPartClick} />)}</div>
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
                             <div className="flex justify-between text-gray-600"><span>Total Cost Price:</span><span>{formatCurrency(totalCost)}</span></div>
                             <div className="flex justify-between text-gray-600"><span>Total Sale Price (Net):</span><span>{formatCurrency(totalNet)}</span></div>
                             <div className={`flex justify-between font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}><span>Total Profit:</span><span>{formatCurrency(totalProfit)}</span></div>
                            <div className="flex justify-between text-gray-600 border-b pb-2 mb-2"><span>Profit Margin:</span><span>{profitMargin.toFixed(1)}%</span></div>
                            {vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-500 text-xs"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                        </div>
                    </Section>
                </div>
            </div>

            <LiveAssistant 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)} 
                jobId={formData.id || null}
                onAddNote={(note) => setFormData(prev => ({ ...prev, notes: (prev.notes || '') + '\n' + note }))}
                apiKey={import.meta.env.VITE_API_KEY}
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
                    customerId={null}
                    customers={customers}
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
                    media={formData.media || []}
                    jobId={formData.id || ''}
                />
            )}

            {isAddingPart && (
                <PartFormModal
                    isOpen={isAddingPart}
                    onClose={() => setIsAddingPart(false)}
                    onSave={handleSaveNewPart}
                    initialData={{ description: newPartDescription }}
                    parts={parts}
                    taxRates={taxRates}
                />
            )}

            {isAddingVehicle && (
                <VehicleFormModal
                    isOpen={isAddingVehicle}
                    onClose={() => setIsAddingVehicle(false)}
                    onSave={(newVehicle) => { // This is for edit mode, which is not used here
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem, Job, User } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus } from 'lucide-react';
import { formatDate, addDays, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import { generateEstimateNumber } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import SearchableSelect from './SearchableSelect';
import FormModal from './FormModal';

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
}

const MemoizedEditableLineItemRow = React.memo(({ item, taxRates, onLineItemChange, onRemoveLineItem, filteredParts, activePartSearch, onPartSearchChange, onSetActivePartSearch, onSelectPart }: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onLineItemChange(item.id, 'description', value);
        if (!item.isLabor && !isPackageHeader && !isPackageComponent) {
            onPartSearchChange(value);
        }
    };

    if (isPackageHeader) {
        return (
            <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-indigo-600 text-white border-indigo-700`}>
                <div className="col-span-6 flex items-center gap-2 font-bold">
                     <input 
                        type="checkbox" 
                        checked={item.isOptional || false} 
                        onChange={e => onLineItemChange(item.id, 'isOptional', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                        title="Mark as Optional"
                    />
                    <span>{item.description}</span>
                </div>
                <div className="col-span-1 text-right">{item.quantity}</div>
                <div className="col-span-2 text-right"></div> {/* Cost price is hidden on header */}
                <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
                <button onClick={() => onRemoveLineItem(item.id)} className="col-span-1 text-indigo-200 hover:text-white justify-self-center"><Trash2 size={14} /></button>
            </div>
        );
    }

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
                        value={item.description} 
                        onChange={handleDescriptionChange}
                        onFocus={() => {
                            if (!item.isLabor && !item.servicePackageId && !item.isPackageComponent) {
                                onSetActivePartSearch(item.id);
                                onPartSearchChange(item.description);
                            }
                        }}
                        onBlur={() => setTimeout(() => onSetActivePartSearch(null), 150)}
                        className="w-full p-1 border rounded disabled:bg-gray-200" 
                        disabled={!!isPackageComponent} 
                        autoComplete="off"
                    />
                     {activePartSearch === item.id && filteredParts.length > 0 && (
                        <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                            {filteredParts.map(part => (
                                <div key={part.id} onMouseDown={() => onSelectPart(item.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm border-b last:border-0">
                                    <p className="font-semibold text-indigo-700">{part.partNumber}</p>
                                    <p className="text-gray-600 truncate">{part.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right" />
            <input type="number" step="0.01" value={item.unitCost || ''} onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Cost Price" />
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Sale Price" disabled={!!isPackageComponent}/>
            <button onClick={() => onRemoveLineItem(item.id)} className="col-span-1 text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50" disabled={!!isPackageComponent}><Trash2 size={14} /></button>
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
    isOpen: boolean;
    onClose: () => void;
    onSave: (estimate: Estimate) => void;
    estimate: Partial<Estimate> | null;
    jobContext?: Job | null;
    customers: Customer[];
    onSaveCustomer: (customer: Customer) => void;
    vehicles: Vehicle[];
    onSaveVehicle: (vehicle: Vehicle) => void;
    businessEntities: BusinessEntity[];
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    parts: Part[];
    estimates: Estimate[];
    currentUser: User;
    selectedEntityId: string;
}

const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ 
    isOpen, onClose, onSave, estimate, jobContext, customers, onSaveCustomer, 
    vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, 
    estimates, currentUser, selectedEntityId 
}) => {
    const [formData, setFormData] = useState<Partial<Estimate>>({ lineItems: [] });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    
    // Search state
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    useEffect(() => { 
        setFormData(estimate && Object.keys(estimate).length > 0 
            ? JSON.parse(JSON.stringify(estimate)) 
            : { 
                customerId: '', 
                vehicleId: '', 
                entityId: selectedEntityId !== 'all' ? selectedEntityId : businessEntities[0]?.id || '', 
                issueDate: getTodayISOString(), 
                expiryDate: getFutureDateISOString(30),
                status: 'Draft', 
                lineItems: [], 
                notes: '',
                createdByUserId: currentUser.id
            });
    }, [estimate, isOpen, businessEntities, selectedEntityId, currentUser.id]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleLineItemChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => {
        setFormData(prev => {
            const lineItems = prev.lineItems || [];
            const targetItem = lineItems.find(i => i.id === id);
            
            // Standard value processing
            let processedValue = value;
            if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                 processedValue = parseFloat(value) || 0;
            }
            
            let updatedLineItems = lineItems.map(item => 
                item.id === id ? { ...item, [field]: processedValue } : item
            );

            // Cascade optional status to package children if header is changed
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
        // Default to Optional if this is a supplementary estimate (has a jobId)
        const isOptional = !!formData.jobId;
        
        const newItem: EstimateLineItem = { 
            id: crypto.randomUUID(), 
            description: '', 
            quantity: 1, 
            unitPrice: isLabor ? (entityLaborRate || 0) : 0, 
            unitCost: isLabor ? (entityLaborCostRate || 0) : 0, 
            isLabor, 
            taxCodeId: standardTaxRateId,
            isOptional,
            partNumber: isLabor ? 'LABOUR' : '' 
        };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const addPackage = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
        
        // Default to Optional if this is a supplementary estimate (has a jobId)
        const isOptional = !!formData.jobId;
    
        const newItems: EstimateLineItem[] = [];
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: totalCost,
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
                const detailItem: EstimateLineItem = { 
                    ...costItem, 
                    id: crypto.randomUUID(), 
                    unitPrice: 0, 
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true,
                    isOptional 
                };
                newItems.push(detailItem);
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

    const filteredParts = useMemo(() => {
        if (!partSearchTerm) return [];
        const lowerSearch = partSearchTerm.toLowerCase();
        return parts.filter(p => p.partNumber.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)).slice(0, 10);
    }, [partSearchTerm, parts]);

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
                    taxCodeId: part.taxCodeId || item.taxCodeId, 
                    fromStock: part.stockQuantity > 0 
                } : item
            );
            return { ...prev, lineItems: updatedLineItems };
        });
        setActivePartSearch(null);
        setPartSearchTerm('');
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

    const filteredVehicles = useMemo(() => vehicles.filter(v => v.customerId === formData.customerId), [vehicles, formData.customerId]);

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
    
    const { totalNet, grandTotal, vatBreakdown, totalProfit, profitMargin } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        if (!formData || !formData.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [], totalProfit: 0, profitMargin: 0 };
        let totalCost = 0;
        let currentTotalNet = 0;
        formData.lineItems.forEach(item => {
            const taxCodeId = item.taxCodeId || standardTaxRateId;
            if (!taxCodeId) return;
            const taxRate = taxRatesMap.get(taxCodeId);
            if (!taxRate) return;
            if (!breakdown[taxCodeId]) breakdown[taxCodeId] = { net: 0, vat: 0, rate: taxRate.rate, name: taxRate.name };
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            breakdown[taxCodeId].net += itemTotal;
            currentTotalNet += itemTotal;
            totalCost += (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
        });
        Object.values(breakdown).forEach(summary => { summary.vat = summary.net * (summary.rate / 100); });
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0 && b.rate > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const profit = currentTotalNet - totalCost;
        const margin = currentTotalNet > 0 ? (profit / currentTotalNet) * 100 : 0;
        return { totalNet: currentTotalNet, grandTotal: currentTotalNet + totalVat, vatBreakdown: finalVatBreakdown, totalProfit: profit, profitMargin: margin };
    }, [formData.lineItems, taxRatesMap, standardTaxRateId]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={estimate?.id ? `Edit Estimate #${estimate.estimateNumber}` : 'Create New Estimate'} maxWidth="max-w-screen-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                     <Section title="Estimate Details" icon={Info}>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="font-semibold">Customer</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect
                                        options={customers.map(c => ({ id: c.id, label: `${c.forename} ${c.surname} (${c.postcode || 'No postcode'})` }))}
                                        value={formData.customerId || null}
                                        onChange={(value) => { setFormData(prev => ({ ...prev, customerId: value || '', vehicleId: '' }))}}
                                        placeholder="Search customers..."
                                    />
                                    <button type="button" onClick={() => setIsAddingCustomer(true)} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0"><Plus size={20} /></button>
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold">Vehicle (Optional)</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect
                                        options={filteredVehicles.map(v => ({ id: v.id, label: `${v.registration} - ${v.make} ${v.model}` }))}
                                        value={formData.vehicleId || null}
                                        onChange={(value) => { setFormData(prev => ({ ...prev, vehicleId: value || '' }))}}
                                        placeholder="Search vehicles..."
                                        disabled={!formData.customerId}
                                    />
                                    <button type="button" onClick={() => setIsAddingVehicle(true)} disabled={!formData.customerId} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"><Plus size={20} /></button>
                                </div>
                            </div>
                            <div><label className="font-semibold">Business Entity</label><select name="entityId" value={formData.entityId} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1"><option value="">-- Select Entity --</option>{businessEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                            <div><label className="font-semibold">Issue Date</label><input name="issueDate" type="date" value={formData.issueDate} onChange={handleChange} className="w-full p-2 border rounded mt-1" /></div>
                             <div><label className="font-semibold">Expiry Date</label><input name="expiryDate" type="date" value={formData.expiryDate} onChange={handleChange} className="w-full p-2 border rounded mt-1" /></div>
                            <div><label className="font-semibold">Status</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1"><option>Draft</option><option>Sent</option><option>Approved</option><option>Declined</option><option>Converted to Job</option><option>Closed</option></select></div>
                            <div><label className="font-semibold">Notes</label><textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded mt-1" /></div>
                        </div>
                    </Section>
                </div>
                 <div className="lg:col-span-2 space-y-4">
                     <Section title="Line Items" icon={FileText}>
                         <div className="space-y-4">
                            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                <div className="col-span-2">Part No.</div>
                                <div className="col-span-4">Description</div>
                                <div className="col-span-1 text-right">Qty/Hrs</div>
                                <div className="col-span-2 text-right">Cost Price</div>
                                <div className="col-span-2 text-right">Sell Price</div>
                                <div className="col-span-1"></div>
                            </div>
                            {estimateBreakdown.packages.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Service Packages</h4>
                                    <div className="space-y-2">{estimateBreakdown.packages.map(({ header, children }) => (<div key={header.id}><MemoizedEditableLineItemRow item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} /><div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">{children.map(child => (<MemoizedEditableLineItemRow key={child.id} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={[]} activePartSearch={null} onPartSearchChange={()=>{}} onSetActivePartSearch={()=>{}} onSelectPart={()=>{}} />))}</div></div>))}</div>
                                </div>
                            )}
                             {estimateBreakdown.customLabor.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Labor</h4>
                                    <div className="space-y-2">{estimateBreakdown.customLabor.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} />)}</div>
                                </div>
                            )}
                             {estimateBreakdown.customParts.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Parts</h4>
                                    <div className="space-y-2">{estimateBreakdown.customParts.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} filteredParts={filteredParts} activePartSearch={activePartSearch} onPartSearchChange={setPartSearchTerm} onSetActivePartSearch={setActivePartSearch} onSelectPart={handleSelectPart} />)}</div>
                                </div>
                            )}
                             <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-2">
                                    <button onClick={() => addLineItem(true)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Labor</button>
                                    <button onClick={() => addLineItem(false)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Part</button>
                                </div>
                                <div className="w-64">
                                    <SearchableSelect
                                        options={servicePackages.filter(p => p.entityId === formData.entityId).map(p => ({ id: p.id, label: p.name }))}
                                        value={null}
                                        onChange={(packageId) => { if (packageId) addPackage(packageId); }}
                                        placeholder="Search & Add Package..."
                                    />
                                </div>
                            </div>
                         </div>
                    </Section>
                    <Section title="Totals Summary" icon={Gauge}>
                        <div className="w-full text-sm">
                            <div className="flex justify-between"><span>Net Total</span><span className="font-semibold">{formatCurrency(totalNet)}</span></div>
                            {vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-600"><span>VAT @ {b.rate}%</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><TrendingUp size={16}/> Profitability</h4>
                            <div className="text-sm space-y-1">
                                <div className={`flex justify-between font-semibold ${totalProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                    <span>Est. Profit</span>
                                    <span>{formatCurrency(totalProfit)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Margin %</span>
                                    <span>{profitMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
            {isAddingCustomer && (
                <CustomerFormModal
                    isOpen={isAddingCustomer}
                    onClose={() => setIsAddingCustomer(false)}
                    onSave={(newCustomer) => {
                        onSaveCustomer(newCustomer);
                        setFormData(prev => ({ ...prev, customerId: newCustomer.id, vehicleId: '' }));
                        setIsAddingCustomer(false);
                    }}
                    customer={null}
                    existingCustomers={customers}
                />
            )}
            {isAddingVehicle && formData.customerId && (
                <VehicleFormModal
                    isOpen={isAddingVehicle}
                    onClose={() => setIsAddingVehicle(false)}
                    onSave={(newVehicle) => {
                        onSaveVehicle(newVehicle);
                        setFormData(prev => ({ ...prev, vehicleId: newVehicle.id }));
                        setIsAddingVehicle(false);
                    }}
                    vehicle={{ customerId: formData.customerId }}
                    customers={customers}
                />
            )}
        </FormModal>
    );
};

export default EstimateFormModal;
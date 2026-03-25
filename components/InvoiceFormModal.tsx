import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem as InvoiceLineItem, Job, DiscountCode } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus, Tag } from 'lucide-react';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateInvoiceId } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import SearchableSelect from './SearchableSelect';
import FormModal from './FormModal';
import { useData } from '../core/state/DataContext';
import { calculatePackagePrices } from '../core/utils/packageUtils';

interface EditableLineItemRowProps {
    item: InvoiceLineItem;
    taxRates: TaxRate[];
    onLineItemChange: (id: string, field: keyof InvoiceLineItem, value: any) => void;
    onRemoveLineItem: (id: string) => void;
}

const MemoizedEditableLineItemRow = React.memo(({ item, taxRates, onLineItemChange, onRemoveLineItem }: EditableLineItemRowProps) => {
    const isPackageComponent = item.isPackageComponent;
    const isPackageHeader = !!item.servicePackageId && !item.isPackageComponent;

    return (
        <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${isPackageComponent ? 'bg-gray-100' : 'bg-white'}`}>
            <input 
                type="text" 
                placeholder="Description" 
                value={item.description || ''} 
                onChange={e => onLineItemChange(item.id, 'description', e.target.value)} 
                className="col-span-4 p-1 border rounded" 
                disabled={isPackageHeader || isPackageComponent} 
            />
            <input 
                type="number" 
                step="0.1" 
                value={item.quantity} 
                onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} 
                className="col-span-1 p-1 border rounded text-right" 
                disabled={isPackageHeader} 
            />
            <input 
                type="number" 
                step="0.01" 
                value={item.unitCost || ''} 
                onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} 
                className="col-span-2 p-1 border rounded text-right" 
                placeholder="Cost Price" 
                disabled={isPackageHeader}
            />
            <input 
                type="number" 
                step="0.01" 
                value={item.unitPrice} 
                onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} 
                className="col-span-2 p-1 border rounded text-right" 
                placeholder="Sale Price" 
                disabled={isPackageHeader || isPackageComponent}
            />
            <select 
                value={item.taxCodeId || ''} 
                onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} 
                className="col-span-2 p-1 border rounded text-xs" 
                disabled={isPackageHeader}
            >
                <option value="">-- Tax --</option>
                {(taxRates || []).map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </select>
            <button 
                onClick={() => onRemoveLineItem(item.id)} 
                className="text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50" 
                disabled={isPackageComponent}
            >
                <Trash2 size={14} />
            </button>
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

interface InvoiceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (invoice: Invoice) => void;
    invoice?: Partial<Invoice> | null;
    job?: Job | null;
    customers: Customer[];
    onSaveCustomer: (customer: Customer) => void;
    vehicles: Vehicle[];
    onSaveVehicle: (vehicle: Vehicle) => void;
    businessEntities: BusinessEntity[];
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    parts: Part[];
    invoices: Invoice[];
    discountCodes: DiscountCode[];
}

const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({ 
    isOpen, onClose, onSave, invoice, job, customers, onSaveCustomer, 
    vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, invoices, discountCodes 
}) => {
    const { estimates } = useData();
    const [formData, setFormData] = useState<Partial<Invoice>>({});
    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);

    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);

    const [discountCodeInput, setDiscountCodeInput] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
    const [discountError, setDiscountError] = useState<string | null>(null);

    const taxRatesMap = useMemo(() => new Map((taxRates || []).map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => (taxRates || []).find(t => t.code === 'T1')?.id, [taxRates]);
    const t99RateId = useMemo(() => (taxRates || []).find(t => t.code === 'T99')?.id, [taxRates]);

    const mainEstimate = useMemo(() => {
        if (!job || !Array.isArray(estimates)) return null;
        if (job.estimateId) {
            const byId = estimates.find(e => e.id === job.estimateId);
            if (byId) return byId;
        }
        const linked = estimates.filter(e => e.jobId === job.id);
        if (linked.length === 1) return linked[0];
        const converted = linked.find(e => e.status === 'Converted to Job');
        if (converted) return converted;
        const approved = linked.find(e => e.status === 'Approved');
        if (approved) return approved;
        const draft = linked.find(e => e.status === 'Draft');
        if (draft) return draft;
        return null;
    }, [job, estimates]);

    useEffect(() => { 
        if (isOpen) {
            let initialData: Partial<Invoice>;
            if (invoice) {
                initialData = { ...invoice };
            } else if (job) {
                const linkedEstimate = mainEstimate;
                initialData = {
                    jobId: job.id,
                    customerId: linkedEstimate?.customerId || job.customerId,
                    vehicleId: linkedEstimate?.vehicleId || job.vehicleId,
                    entityId: job.entityId,
                    lineItems: linkedEstimate ? (linkedEstimate.lineItems || []).filter(li => !li.isOptional) : [],
                    status: 'Draft',
                    issueDate: formatDate(new Date()), 
                    dueDate: formatDate(addDays(new Date(), 30)),
                    notes: linkedEstimate?.notes || job.notes || ''
                };
            } else {
                initialData = { 
                    customerId: '', 
                    vehicleId: '', 
                    entityId: (businessEntities || [])[0]?.id || '', 
                    issueDate: formatDate(new Date()), 
                    dueDate: formatDate(addDays(new Date(), 30)),
                    status: 'Draft', 
                    lineItems: [], 
                    notes: '' 
                };
            }
            setFormData(initialData);
            setAppliedDiscount(null);
            setDiscountCodeInput('');
            setDiscountError(null);
        }
    }, [invoice, job, isOpen, businessEntities, mainEstimate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleLineItemChange = useCallback((id: string, field: keyof InvoiceLineItem, value: any) => { 
        setFormData(prev => ({ 
            ...prev, 
            lineItems: (prev.lineItems || []).map(item => 
                item.id === id ? { 
                    ...item, 
                    [field]: ['quantity', 'unitPrice', 'unitCost'].includes(field as string) ? parseFloat(value) || 0 : value 
                } : item
            ) 
        })); 
    }, []);

    const entityLaborRate = useMemo(() => {
        const safeEntities = Array.isArray(businessEntities) ? businessEntities : [];
        const entity = safeEntities.find(e => e.id === formData.entityId);
        return entity?.laborRate ?? 0;
    }, [businessEntities, formData.entityId]);

    const entityLaborCostRate = useMemo(() => {
        const safeEntities = Array.isArray(businessEntities) ? businessEntities : [];
        const entity = safeEntities.find(e => e.id === formData.entityId);
        return entity?.laborCostRate ?? 0;
    }, [businessEntities, formData.entityId]);

    const addLineItem = (isLabor: boolean) => {
        const newItem: InvoiceLineItem = { 
            id: crypto.randomUUID(), 
            description: '', 
            quantity: 1, 
            unitPrice: isLabor ? (entityLaborRate || 0) : 0, 
            unitCost: isLabor ? (entityLaborCostRate || 0) : 0, 
            isLabor, 
            taxCodeId: standardTaxRateId 
        };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };


    const handlePackageSelect = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (pkg) {
            setSelectedPackage(pkg);
        }
    };

    const addPackage = (pkg: ServicePackage) => {
        if (!pkg) return;
        const { net, vat } = calculatePackagePrices(pkg, taxRates);
        const newItems: InvoiceLineItem[] = [];
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const mainPackageItem: InvoiceLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: net,
            unitCost: totalCost,
            isLabor: false, 
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
            preCalculatedVat: pkg.taxCodeId === t99RateId ? vat : undefined,
        };
        newItems.push(mainPackageItem);
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                const detailItem: InvoiceLineItem = { 
                    ...costItem, 
                    id: crypto.randomUUID(), 
                    unitPrice: 0, 
                    servicePackageId: pkg.id, 
                    servicePackageName: pkg.name, 
                    isPackageComponent: true 
                };
                newItems.push(detailItem);
            });
        }
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), ...newItems] }));
    };

    const confirmAddPackage = () => {
        if (selectedPackage) {
            addPackage(selectedPackage);
            setSelectedPackage(null);
        }
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

    const handleApplyDiscount = () => {
        const code = (discountCodes || []).find(d => d.code === discountCodeInput && d.isActive);
        if (!code) {
            setDiscountError('Invalid or inactive discount code.');
            setAppliedDiscount(null);
            return;
        }
        setAppliedDiscount(code);
        setDiscountError(null);
    };

    const calculateDiscountAmount = useCallback(() => {
        if (!appliedDiscount || !formData.lineItems) return 0;
        let eligibleTotal = 0;
        formData.lineItems.forEach(item => {
            if (item.isPackageComponent) return;
            let isEligible = false;
            if (appliedDiscount.applicability === 'All') isEligible = true;
            else if (appliedDiscount.applicability === 'Labor' && item.isLabor) isEligible = true;
            else if (appliedDiscount.applicability === 'Parts' && !item.isLabor && !item.servicePackageId) isEligible = true;
            else if (appliedDiscount.applicability === 'Packages' && item.servicePackageId) isEligible = true;

            if (isEligible) {
                eligibleTotal += (item.quantity || 0) * (item.unitPrice || 0);
            }
        });
        if (appliedDiscount.type === 'Fixed') return Math.min(appliedDiscount.value, eligibleTotal);
        return eligibleTotal * (appliedDiscount.value / 100);
    }, [appliedDiscount, formData.lineItems]);

    const { totalNet, grandTotal, vatBreakdown, totalProfit, profitMargin, discountAmount } = useMemo(() => {
        const breakdown: { [key: string]: { net: number; vat: number; rate: number; name: string; } } = {};
        if (!formData || !formData.lineItems) return { totalNet: 0, grandTotal: 0, vatBreakdown: [], totalProfit: 0, profitMargin: 0, discountAmount: 0 };
        
        let totalCost = 0;
        let currentTotalNet = 0;
        (formData.lineItems || []).forEach(item => {
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

        const discountVal = calculateDiscountAmount();
        const netAfterDiscount = currentTotalNet - discountVal;

        if (discountVal > 0 && standardTaxRateId && breakdown[standardTaxRateId]) {
             breakdown[standardTaxRateId].net -= discountVal;
        }

        Object.values(breakdown).forEach(summary => { summary.vat = summary.net * (summary.rate / 100); });
        const finalVatBreakdown = Object.values(breakdown).filter(b => b.net > 0 && b.rate > 0);
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const profit = netAfterDiscount - totalCost;
        const margin = netAfterDiscount > 0 ? (profit / netAfterDiscount) * 100 : 0;

        return { 
            totalNet: currentTotalNet, 
            grandTotal: netAfterDiscount + totalVat, 
            vatBreakdown: finalVatBreakdown, 
            totalProfit: profit, 
            profitMargin: margin,
            discountAmount: discountVal 
        };
    }, [formData.lineItems, taxRatesMap, standardTaxRateId, calculateDiscountAmount]);

    const handleSave = () => {
        if (!formData.customerId || !formData.entityId) return alert('Customer and Business Entity are required.');
        const entity = (businessEntities || []).find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        let finalLineItems = [...(formData.lineItems || [])];
        if (appliedDiscount && discountAmount > 0) {
            finalLineItems.push({
                id: crypto.randomUUID(),
                description: `Discount: ${appliedDiscount.code} - ${appliedDiscount.description}`,
                quantity: 1,
                unitPrice: -discountAmount,
                unitCost: 0,
                isLabor: false,
                taxCodeId: standardTaxRateId
            } as InvoiceLineItem);
        }

        onSave({ 
            id: formData.id || generateInvoiceId(invoices || [], entityShortCode), 
            ...formData,
            lineItems: finalLineItems,
            grandTotal,
        } as Invoice);
        onClose();
    };

    const customerOptions = useMemo(() => (customers || []).map(c => ({
        label: c.companyName ? c.companyName : `${c.forename || ''} ${c.surname || ''}`.trim(),
        value: c.id,
        description: c.phone || 'No phone',
        searchField: `${c.companyName || ''} ${c.forename || ''} ${c.surname || ''} ${c.phone || ''} ${c.postcode || ''}`.toLowerCase()
    })), [customers]);

    const filteredVehicles = useMemo(() => 
        (vehicles || []).filter(v => v.customerId === formData.customerId), 
    [vehicles, formData.customerId]);

    const vehicleOptions = useMemo(() => filteredVehicles.map(v => ({
        label: v.registration,
        value: v.id,
        description: `${v.make} ${v.model}`,
        searchField: `${v.registration} ${v.make} ${v.model}`.toLowerCase()
    })), [filteredVehicles]);

    const invoiceBreakdown = useMemo(() => {
        const packages: { header: InvoiceLineItem, children: InvoiceLineItem[] }[] = [];
        const customLabor: InvoiceLineItem[] = [];
        const customParts: InvoiceLineItem[] = [];
        const allItems = formData.lineItems || [];
        const packageHeaders = allItems.filter(item => item.servicePackageId && !item.isPackageComponent);
    
        packageHeaders.forEach(header => {
            packages.push({ header: header, children: allItems.filter(item => item.isPackageComponent && item.servicePackageId === header.servicePackageId) });
        });
    
        allItems.forEach(item => {
            if (!item.servicePackageId) {
                if (item.isLabor) customLabor.push(item);
                else customParts.push(item);
            }
        });
        return { packages, customLabor, customParts };
    }, [formData.lineItems]);

    const handleCustomerSelect = (selection: any) => {
        const customerId = selection?.value || selection?.id;
        if (!customerId) return;
        setFormData(prev => {
            const customerVehicles = (vehicles || []).filter(v => v.customerId === customerId);
            const isCurrentVehicleOwned = customerVehicles.some(v => v.id === prev.vehicleId);
            return { 
                ...prev, 
                customerId: customerId, 
                vehicleId: isCurrentVehicleOwned ? prev.vehicleId : (customerVehicles.length === 1 ? customerVehicles[0].id : '') 
            };
        });
    };

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            onSave={handleSave} 
            title={invoice?.id ? `Edit Invoice #${invoice.id}` : 'Create New Invoice'} 
            maxWidth="max-w-screen-2xl" 
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Section title="Invoice Details" icon={Info}>
                        <div className="space-y-4 text-sm">
                            <div>
                                <label className="font-semibold text-gray-700">Customer</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect options={customerOptions} initialValue={formData.customerId} onSelect={handleCustomerSelect} placeholder="Search customers..." />
                                    <button type="button" onClick={() => setIsAddingCustomer(true)} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0">
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-gray-700">Vehicle (Optional)</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect options={vehicleOptions} initialValue={formData.vehicleId} onSelect={(selection) => setFormData(prev => ({ ...prev, vehicleId: selection?.value || '' }))} placeholder="Search vehicles..." disabled={!formData.customerId} />
                                    <button type="button" onClick={() => setIsAddingVehicle(true)} disabled={!formData.customerId} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                            <hr className="my-2" />
                            <div>
                                <label className="font-semibold text-gray-700">Business Entity</label>
                                <select name="entityId" value={formData.entityId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                    <option value="">-- Select Entity --</option>
                                    {(businessEntities || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-semibold text-gray-700">Issue Date</label>
                                    <input name="issueDate" type="date" value={formData.issueDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                                </div>
                                <div>
                                    <label className="font-semibold text-gray-700">Due Date</label>
                                    <input name="dueDate" type="date" value={formData.dueDate || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-gray-700">Status</label>
                                <select name="status" value={formData.status || 'Draft'} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1">
                                    <option>Draft</option>
                                    <option>Sent</option>
                                    <option>Part Paid</option>
                                    <option>Paid</option>
                                    <option>Overdue</option>
                                </select>
                            </div>
                            <div className="pt-2 border-t">
                                <label className="font-semibold text-gray-700 flex items-center gap-2"><Tag size={16}/> Discount Code</label>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        type="text" 
                                        value={discountCodeInput} 
                                        onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())} 
                                        placeholder="Enter code" 
                                        className="flex-1 p-2 border rounded text-sm uppercase"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleApplyDiscount} 
                                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
                                    >
                                        Apply
                                    </button>
                                </div>
                                {discountError && <p className="text-red-500 text-xs mt-1">{discountError}</p>}
                                {appliedDiscount && (
                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                                        <div className="text-xs">
                                            <p className="font-bold text-green-800">{appliedDiscount.code}</p>
                                            <p className="text-green-600">{appliedDiscount.description}</p>
                                        </div>
                                        <button onClick={() => setAppliedDiscount(null)} className="text-green-800 hover:text-green-900"><X size={14}/></button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="font-semibold text-gray-700">Notes</label>
                                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded mt-1" />
                            </div>
                        </div>
                    </Section>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <Section title="Line Items" icon={FileText}>
                        <div className="space-y-4">
                            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
                                <div className="col-span-4">Description</div>
                                <div className="col-span-1 text-right">Qty/Hrs</div>
                                <div className="col-span-2 text-right">Cost Price</div>
                                <div className="col-span-2 text-right">Sell Price</div>
                                <div className="col-span-2 text-center">Tax</div>
                                <div className="col-span-1"></div>
                            </div>
                            {invoiceBreakdown.packages.map(({ header, children }) => (
                                <div key={header.id} className="space-y-1 border-l-4 border-indigo-400 pl-2">
                                    <MemoizedEditableLineItemRow item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />
                                    {children.map(child => <MemoizedEditableLineItemRow key={child.id} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />)}
                                </div>
                            ))}
                            {invoiceBreakdown.customLabor.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />)}
                            {invoiceBreakdown.customParts.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />)}

                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                                <button type="button" onClick={() => addLineItem(true)} className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium">
                                    <Plus size={14} /> Add Labor
                                </button>
                                <button type="button" onClick={() => addLineItem(false)} className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium">
                                    <Plus size={14} /> Add Part
                                </button>
                                <select onChange={(e) => { if (e.target.value) { handlePackageSelect(e.target.value); e.target.value = ''; } }} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium border-none outline-none">
                                    <option value="">+ Add Package</option>
                                    {(servicePackages || []).map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </Section>

                    <Section title="Totals Summary" icon={TrendingUp}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal (Net)</span>
                                    <span>{formatCurrency(totalNet)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-sm font-medium text-green-600">
                                        <span className="flex items-center gap-1"><Tag size={12}/> Discount</span>
                                        <span>-{formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                {vatBreakdown.map(v => (
                                    <div key={v.name} className="flex justify-between text-sm">
                                        <span className="text-gray-600">VAT ({v.rate}%)</span>
                                        <span>{formatCurrency(v.vat)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                    <span>Grand Total</span>
                                    <span className="text-indigo-600">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 font-medium">Estimated Profit</span>
                                    <span className="text-green-600 font-bold">{formatCurrency(totalProfit)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 font-medium">Margin</span>
                                    <span className="font-bold">{profitMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>

            {selectedPackage && (
                <FormModal
                    isOpen={!!selectedPackage}
                    onClose={() => setSelectedPackage(null)}
                    onSave={confirmAddPackage}
                    title="Confirm Add Package"
                    saveText="Confirm & Add"
                    maxWidth="max-w-lg"
                    zIndex="z-[80]"
                >
                    <div className="space-y-4 p-2">
                        <h3 className="text-lg font-bold">{selectedPackage.name}</h3>
                        <p className="text-sm text-gray-600">{selectedPackage.description}</p>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Package Gross Price</label>
                                <p className="text-2xl font-bold">{formatCurrency(selectedPackage.totalPrice || 0)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Package Net Price</label>
                                <p className="text-2xl font-bold">{formatCurrency(calculatePackagePrices(selectedPackage, taxRates).net)}</p>
                            </div>
                        </div>
                    </div>
                </FormModal>
            )}

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
                    vehicles={vehicles}
                />
            )}
        </FormModal>
    );
};

export default InvoiceFormModal;

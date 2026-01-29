import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem as InvoiceLineItem } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus } from 'lucide-react';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { generateInvoiceId } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import SearchableSelect from './SearchableSelect';
import FormModal from './FormModal';

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
            <input type="text" placeholder="Description" value={item.description} onChange={e => onLineItemChange(item.id, 'description', e.target.value)} className="col-span-4 p-1 border rounded" disabled={isPackageHeader || isPackageComponent} />
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right" disabled={isPackageHeader} />
            <input type="number" step="0.01" value={item.unitCost || ''} onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Cost Price" disabled={isPackageHeader}/>
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right" placeholder="Sale Price" disabled={isPackageHeader || isPackageComponent}/>
            <select value={item.taxCodeId || ''} onChange={e => onLineItemChange(item.id, 'taxCodeId', e.target.value)} className="col-span-2 p-1 border rounded text-xs" disabled={isPackageHeader}>
                <option value="">-- Tax --</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </select>
            <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50" disabled={isPackageComponent}><Trash2 size={14} /></button>
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
    invoice: Partial<Invoice> | null;
    customers: Customer[];
    onSaveCustomer: (customer: Customer) => void;
    vehicles: Vehicle[];
    onSaveVehicle: (vehicle: Vehicle) => void;
    businessEntities: BusinessEntity[];
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    parts: Part[];
    invoices: Invoice[];
}

const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({ isOpen, onClose, onSave, invoice, customers, onSaveCustomer, vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, invoices }) => {
    const [formData, setFormData] = useState<Partial<Invoice>>({ lineItems: [] });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);

    useEffect(() => { 
        setFormData(invoice && Object.keys(invoice).length > 0 
            ? JSON.parse(JSON.stringify(invoice)) 
            : { 
                customerId: '', 
                vehicleId: '', 
                entityId: businessEntities[0]?.id || '', 
                issueDate: formatDate(new Date()), 
                dueDate: formatDate(addDays(new Date(), 30)),
                status: 'Draft', 
                lineItems: [], 
                notes: '' 
            });
    }, [invoice, isOpen, businessEntities]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleLineItemChange = useCallback((id: string, field: keyof InvoiceLineItem, value: any) => { setFormData(prev => ({ ...prev, lineItems: (prev.lineItems || []).map(item => item.id === id ? { ...item, [field]: ['quantity', 'unitPrice', 'unitCost'].includes(field as string) ? parseFloat(value) || 0 : value } : item) })); }, []);
    
    const entityLaborRate = useMemo(() => businessEntities.find(e => e.id === formData.entityId)?.laborRate, [businessEntities, formData.entityId]);
    const entityLaborCostRate = useMemo(() => businessEntities.find(e => e.id === formData.entityId)?.laborCostRate, [businessEntities, formData.entityId]);
    
    const addLineItem = (isLabor: boolean) => {
        const newItem: InvoiceLineItem = { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: isLabor ? (entityLaborRate || 0) : 0, unitCost: isLabor ? (entityLaborCostRate || 0) : 0, isLabor, taxCodeId: standardTaxRateId };
        setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    };

    const addPackage = (packageId: string) => {
        const pkg = servicePackages.find(p => p.id === packageId);
        if (!pkg) return;
    
        const newItems: InvoiceLineItem[] = [];
        const totalCost = (pkg.costItems || []).reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
        const mainPackageItem: InvoiceLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name,
            quantity: 1,
            unitPrice: pkg.totalPrice,
            unitCost: totalCost,
            isLabor: false, 
            taxCodeId: standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
        };
        newItems.push(mainPackageItem);
    
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                const detailItem: InvoiceLineItem = { ...costItem, id: crypto.randomUUID(), unitPrice: 0, servicePackageId: pkg.id, servicePackageName: pkg.name, isPackageComponent: true };
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
    
    const handleSave = () => {
        if (!formData.customerId || !formData.entityId) return alert('Customer and Business Entity are required.');
        
        const entity = businessEntities.find(e => e.id === formData.entityId);
        const entityShortCode = entity?.shortCode || 'UNK';
        
        onSave({ 
            id: formData.id || generateInvoiceId(invoices, entityShortCode), 
            ...formData 
        } as Invoice);
        onClose();
    };

    const filteredVehicles = useMemo(() => vehicles.filter(v => v.customerId === formData.customerId), [vehicles, formData.customerId]);

    const invoiceBreakdown = useMemo(() => {
        const packages: { header: InvoiceLineItem, children: InvoiceLineItem[] }[] = [];
        const customLabor: InvoiceLineItem[] = [];
        const customParts: InvoiceLineItem[] = [];
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
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={invoice?.id ? `Edit Invoice #${invoice.id}` : 'Create New Invoice'} maxWidth="max-w-screen-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                     <Section title="Invoice Details" icon={Info}>
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
                             <div><label className="font-semibold">Due Date</label><input name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} className="w-full p-2 border rounded mt-1" /></div>
                            <div><label className="font-semibold">Status</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white mt-1"><option>Draft</option><option>Sent</option><option>Part Paid</option><option>Paid</option><option>Overdue</option></select></div>
                            <div><label className="font-semibold">Notes</label><textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded mt-1" /></div>
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
                            {invoiceBreakdown.packages.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Service Packages</h4>
                                    <div className="space-y-2">{invoiceBreakdown.packages.map(({ header, children }) => (<div key={header.id}><MemoizedEditableLineItemRow item={header} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} /><div className="pl-6 border-l-2 ml-2 space-y-1 mt-1">{children.map(child => (<MemoizedEditableLineItemRow key={child.id} item={child} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />))}</div></div>))}</div>
                                </div>
                            )}
                             {invoiceBreakdown.customLabor.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Labor</h4>
                                    <div className="space-y-2">{invoiceBreakdown.customLabor.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />)}</div>
                                </div>
                            )}
                             {invoiceBreakdown.customParts.length > 0 && (
                                <div className="p-2 border rounded-lg bg-gray-50/50">
                                    <h4 className="font-bold text-gray-800 mb-2 text-sm">Parts</h4>
                                    <div className="space-y-2">{invoiceBreakdown.customParts.map(item => <MemoizedEditableLineItemRow key={item.id} item={item} taxRates={taxRates} onLineItemChange={handleLineItemChange} onRemoveLineItem={removeLineItem} />)}</div>
                                </div>
                            )}
                             <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-2">
                                    <button onClick={() => addLineItem(true)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Labor</button>
                                    <button onClick={() => addLineItem(false)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={16} className="mr-1" /> Add Part</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select onChange={e => { addPackage(e.target.value); e.target.value = ''; }} value="" className="p-1 border rounded bg-white text-sm"><option value="">-- Add Package --</option>{servicePackages.filter(p => p.entityId === formData.entityId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
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

export default InvoiceFormModal;
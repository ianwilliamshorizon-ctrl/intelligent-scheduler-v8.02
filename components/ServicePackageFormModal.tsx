import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ServicePackage, EstimateLineItem, TaxRate, BusinessEntity, Part } from '../types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';

const ServicePackageFormModal = ({ isOpen, onClose, onSave, servicePackage, taxRates, entityId, businessEntities, parts }: { isOpen: boolean, onClose: () => void, onSave: (pkg: ServicePackage) => void, servicePackage: Partial<ServicePackage> | null, taxRates: TaxRate[], entityId: string, businessEntities: BusinessEntity[], parts: Part[] }) => {
    const [formData, setFormData] = useState<Partial<ServicePackage>>({});
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    
    // State for part search
    const [activeSearchRow, setActiveSearchRow] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { 
        if (isOpen) {
            setFormData(servicePackage 
                ? { ...servicePackage, costItems: servicePackage.costItems || [] }
                : { entityId, name: '', description: '', totalPrice: 0, costItems: [], taxCodeId: standardTaxRateId }
            ); 
        }
    }, [servicePackage, isOpen, entityId, standardTaxRateId]);
    
    const partOptions = useMemo(() => parts.map(p => ({id: p.id, label: `${p.partNumber} - ${p.description} (Stock: ${p.stockQuantity})`})), [parts]);

    const filteredParts = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return parts.filter(p => 
            p.partNumber.toLowerCase().includes(lower) || 
            p.description.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [parts, searchTerm]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const processedValue = name === 'totalPrice' ? parseFloat(value) || 0 : value;
        setFormData(p => ({...p, [name]: processedValue}));
    };

    const handleLineChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => { 
        setFormData(p => ({
            ...p, 
            costItems: (p.costItems||[]).map(li => 
                li.id === id 
                    ? {...li, [field]:['quantity', 'unitCost'].includes(field as string) ? parseFloat(value) || 0 : value } 
                    : li
            )
        })); 

        const item = formData.costItems?.find(i => i.id === id);
        if (item && !item.isLabor && (field === 'description' || field === 'partNumber')) {
            if (activeSearchRow === id) {
                setSearchTerm(value);
            }
        }
    }, [formData.costItems, activeSearchRow]);
    
    const addLine = (isLabor: boolean) => { 
        const newLine:EstimateLineItem = {id:crypto.randomUUID(), description:'', quantity:1, unitPrice:0, unitCost:0, isLabor, taxCodeId:standardTaxRateId, fromStock: false}; 
        setFormData(p => ({...p, costItems: [...(p.costItems||[]), newLine]})); 
    };
    
    const removeLine = (id: string) => setFormData(p => ({...p, costItems: (p.costItems||[]).filter(li => li.id !== id)}));
    
    const handleSave = () => { 
        if(!formData.name || !formData.totalPrice) return alert('Package name and total price are required.'); 
        onSave({id:formData.id || crypto.randomUUID(), ...formData} as ServicePackage);
        onClose();
    };
    
    const handleSelectPart = (lineItemId: string, part: Part) => {
        setFormData(p => ({...p, costItems: (p.costItems||[]).map(li => li.id === lineItemId ? {
            ...li,
            partId: part.id,
            partNumber: part.partNumber,
            description: part.description,
            unitCost: part.costPrice,
            unitPrice: part.salePrice,
            fromStock: part.stockQuantity > 0,
        } : li)}));
        setActiveSearchRow(null);
        setSearchTerm('');
    };

    const packageTotals = useMemo(() => {
        const costItems = formData.costItems || [];
        const totalCost = costItems.reduce((sum, item) => sum + ((item.unitCost || 0) * (item.quantity || 0)), 0);
        const totalSale = formData.totalPrice || 0;
        const totalProfit = totalSale - totalCost;
        const margin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;
        return { totalCost, totalSale, totalProfit, margin };
    }, [formData.costItems, formData.totalPrice]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={servicePackage?.id ? "Edit Service Package" : "Add Service Package"} maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g., Porsche 911 Minor Service" className="w-full p-2 border rounded" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Sell Price (£)</label>
                    <input name="totalPrice" type="number" step="0.01" value={formData.totalPrice || ''} onChange={handleChange} placeholder="e.g., 495.00" className="w-full p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Code</label>
                    <select name="taxCodeId" value={formData.taxCodeId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} ({t.rate}%)</option>)}
                    </select>
                </div>
            </div>
            <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Optional details about the package" className="w-full p-2 border rounded" rows={2}/>
            </div>
            
            <h4 className="font-bold mb-2 mt-4">Cost Items (Parts & Labor)</h4>
            <div className="grid grid-cols-12 gap-2 items-center text-xs font-semibold text-gray-500 px-2 pb-1 border-b">
                <div className="col-span-2">Part No.</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-2 text-right">Qty/Hrs</div>
                <div className="col-span-1 text-center">Type</div>
                <div className="col-span-2 text-right">Unit Cost (£)</div>
                <div className="col-span-1"></div>
            </div>

            <div className="space-y-2 mt-2 pr-2">
                {(formData.costItems || []).map(li => {
                    return (
                        <div key={li.id} className="grid grid-cols-12 gap-2 items-start relative">
                             <div className="col-span-2">
                                {!li.isLabor && (
                                    <input
                                        value={li.partNumber || ''}
                                        onChange={(e) => handleLineChange(li.id, 'partNumber', e.target.value)}
                                        onFocus={() => { setActiveSearchRow(li.id); setSearchTerm(li.partNumber || ''); }}
                                        onBlur={() => setTimeout(() => setActiveSearchRow(null), 200)}
                                        placeholder="Part No."
                                        className="w-full p-1 border rounded text-sm"
                                    />
                                )}
                            </div>
                            <div className="col-span-4">
                                {li.isLabor ? (
                                    <input value={li.description} onChange={e=>handleLineChange(li.id, 'description', e.target.value)} placeholder="Labor Description" className="w-full p-1 border rounded text-sm"/>
                                ) : (
                                     <input
                                        value={li.description}
                                        onChange={(e) => handleLineChange(li.id, 'description', e.target.value)}
                                        onFocus={() => { setActiveSearchRow(li.id); setSearchTerm(li.description); }}
                                        onBlur={() => setTimeout(() => setActiveSearchRow(null), 200)}
                                        placeholder="Search part description..."
                                        className="w-full p-1 border rounded text-sm"
                                    />
                                )}
                                {activeSearchRow === li.id && filteredParts.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                        {filteredParts.map(part => (
                                            <div key={part.id} onMouseDown={() => handleSelectPart(li.id, part)} className="p-2 hover:bg-indigo-100 cursor-pointer text-sm">
                                                <p className="font-semibold">{part.partNumber} - {part.description}</p>
                                                <p className="text-xs text-gray-500">Cost: {formatCurrency(part.costPrice)} | Stock: {part.stockQuantity}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input type="number" step="0.1" value={li.quantity} onChange={e=>handleLineChange(li.id, 'quantity', e.target.value)} placeholder="Qty" className="col-span-2 p-1 border rounded text-sm text-right"/>
                            <div className="col-span-1 text-center flex items-center justify-center">
                                {li.isLabor ? <span className="text-xs font-semibold">LABOR</span> : (
                                    <div className="flex items-center gap-1.5" title="Use from stock?">
                                        <input type="checkbox" checked={!!li.fromStock} onChange={(e) => handleLineChange(li.id, 'fromStock', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <label className="text-xs">Stock</label>
                                    </div>
                                )}
                            </div>
                            <input type="number" step="0.01" value={li.unitCost || ''} onChange={e=>handleLineChange(li.id, 'unitCost', e.target.value)} placeholder="Cost" className="w-full p-1 border rounded text-sm text-right"/>
                            <button onClick={()=>removeLine(li.id)} className="col-span-1 text-red-500 justify-self-center"><Trash2 size={16}/></button>
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-4">
                <button onClick={() => addLine(true)} className="text-indigo-600 font-semibold text-sm mt-2 flex items-center gap-1"><PlusCircle size={14}/> Add Labor Cost</button>
                <button onClick={() => addLine(false)} className="text-indigo-600 font-semibold text-sm mt-2 flex items-center gap-1"><PlusCircle size={14}/> Add Part Cost</button>
            </div>
       
            <div className="mt-6 pt-6 border-t">
                <h4 className="font-bold mb-2">Package Summary</h4>
                <div className="grid grid-cols-2 gap-x-8 text-sm bg-gray-50 p-4 rounded-lg border">
                    <div className="space-y-1">
                        <div className="flex justify-between"><span>Total Cost Price:</span><span className="font-mono">{formatCurrency(packageTotals.totalCost)}</span></div>
                        <div className="flex justify-between"><span>Total Sale Price (Net):</span><span className="font-mono">{formatCurrency(packageTotals.totalSale)}</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className={`flex justify-between font-semibold ${packageTotals.totalProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            <span>Total Profit:</span>
                            <span className="font-mono">{formatCurrency(packageTotals.totalProfit)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>Profit Margin:</span>
                            <span className="font-mono">{packageTotals.margin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default ServicePackageFormModal;


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ServicePackage, EstimateLineItem, TaxRate, BusinessEntity, Part, Supplier } from '../types';
import { PlusCircle, Trash2, Filter, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';
import FormModal from './FormModal';
import PartFormModal from './PartFormModal';
import { useData } from '../core/state/DataContext';

const ServicePackageFormModal = ({ isOpen, onClose, onSave, servicePackage, taxRates, entityId, businessEntities, parts }: { isOpen: boolean, onClose: () => void, onSave: (pkg: ServicePackage) => void, servicePackage: Partial<ServicePackage> | null, taxRates: TaxRate[], entityId: string, businessEntities: BusinessEntity[], parts: Part[] }) => {
    const [formData, setFormData] = useState<Partial<ServicePackage>>({});
    const { suppliers, saveRecord } = useData();
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.shortCode])), [suppliers]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id, [taxRates]);
    const t99RateId = useMemo(() => taxRates.find(t => t.code === 'T99')?.id, [taxRates]);
    const defaultSupplierId = useMemo(() => (suppliers && suppliers.length > 0) ? suppliers[0].id : undefined, [suppliers]);

    const [activeSearchRow, setActiveSearchRow] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [newPartDraft, setNewPartDraft] = useState<Partial<Part> | null>(null);
    const [activeLineItemId, setActiveLineItemId] = useState<string | null>(null);

    useEffect(() => { 
        if (isOpen) {
            const initialData = servicePackage 
                ? { ...servicePackage, costItems: servicePackage.costItems || [] }
                : { entityId, name: '', description: '', totalPrice: 0, costItems: [], taxCodeId: standardTaxRateId };
            
            if (!initialData.taxCodeId) {
                initialData.taxCodeId = standardTaxRateId;
            }

            if (initialData.costItems) {
                initialData.costItems = initialData.costItems.map(item => ({
                    ...item,
                    taxCodeId: item.taxCodeId || initialData.taxCodeId
                }));
            }
            setFormData(initialData);
        }
    }, [servicePackage, isOpen, entityId, standardTaxRateId]);

    const filteredParts = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const lower = searchTerm.toLowerCase();
        return parts.filter(p => 
            p.partNumber.toLowerCase().includes(lower) || 
            p.description.toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [parts, searchTerm]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let processedValue: string | number = value;
        if (type === 'number') {
            processedValue = parseFloat(value) || 0;
        }
        setFormData(p => ({...p, [name]: processedValue}));

        if (name === 'taxCodeId') {
             setFormData(p => ({...p, costItems: (p.costItems || []).map(item => ({ ...item, taxCodeId: value }))}));
        }
    };

    const handleLineChange = useCallback((id: string, field: keyof EstimateLineItem, value: any) => { 
        setFormData(p => ({
            ...p, 
            costItems: (p.costItems||[]).map(li => 
                li.id === id 
                    ? {...li, [field]:['quantity', 'unitCost', 'unitPrice'].includes(field as string) ? parseFloat(value) || 0 : value } 
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
        const newLine:EstimateLineItem = {
            id:crypto.randomUUID(), 
            description:'', 
            quantity:1, 
            unitPrice:0, 
            unitCost:0, 
            isLabor, 
            taxCodeId:formData.taxCodeId || standardTaxRateId, 
            fromStock: false,
            supplierId: isLabor ? undefined : defaultSupplierId
        }; 
        setFormData(p => ({...p, costItems: [...(p.costItems||[]), newLine]})); 
    };
    
    const removeLine = (id: string) => setFormData(p => ({...p, costItems: (p.costItems||[]).filter(li => li.id !== id)}));

    const packageTotals = useMemo(() => {
        const costItems = formData.costItems || [];
        const grossTargetPrice = formData.totalPrice || 0;
        const totalCost = costItems.reduce((sum, item) => sum + ((item.unitCost || 0) * (item.quantity || 0)), 0);
        const isT99Package = formData.taxCodeId === t99RateId;

        const calculateFromItems = () => {
            const totalSaleNetFromItems = costItems.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
            const totalVatFromItems = costItems.reduce((sum, item) => {
                const itemTaxRateInfo = taxRates.find(t => t.id === item.taxCodeId);
                const rate = itemTaxRateInfo ? itemTaxRateInfo.rate : 0;
                const itemVat = ((item.unitPrice || 0) * (item.quantity || 0)) * (rate / 100);
                return sum + itemVat;
            }, 0);
            const grossFromItems = totalSaleNetFromItems + totalVatFromItems;
            const profit = totalSaleNetFromItems - totalCost;
            const margin = totalSaleNetFromItems > 0 ? (profit / totalSaleNetFromItems) * 100 : 0;
            return { totalCost, totalSaleNet: totalSaleNetFromItems, totalVat: totalVatFromItems, calculatedGross: grossFromItems, totalProfit: profit, margin };
        };

        const calculateFromGross = () => {
            if (grossTargetPrice > 0) {
                const packageTaxRateInfo = taxRates.find(t => t.id === formData.taxCodeId) || taxRates.find(t => t.code === 'T1');
                const rate = packageTaxRateInfo ? packageTaxRateInfo.rate : 20;
                let net = grossTargetPrice;
                let vat = 0;
                if (rate > 0) {
                    net = grossTargetPrice / (1 + (rate / 100));
                    vat = grossTargetPrice - net;
                }
                const profit = net - totalCost;
                const margin = net > 0 ? (profit / net) * 100 : 0;
                return { totalCost, totalSaleNet: net, totalVat: vat, calculatedGross: grossTargetPrice, totalProfit: profit, margin };
            }
            return calculateFromItems(); // Fallback if no gross price
        };

        if (isT99Package) {
            return calculateFromItems();
        } else {
            return calculateFromGross();
        }
    }, [formData.costItems, taxRates, formData.totalPrice, formData.taxCodeId, t99RateId]);
            
    const handleSave = () => {
        const { id, name, description, entityId, costItems, applicableMake, applicableModel, applicableVariant, applicableEngineSize, totalPrice, taxCodeId: defaultTaxCodeId } = formData;
    
        if (!name) return alert('Package name is required.');
        
        const finalCostItems = costItems || [];
        const isMixedVat = new Set(finalCostItems.map(i => i.taxCodeId)).size > 1;
    
        let finalPackageTaxCodeId = defaultTaxCodeId;
        if (isMixedVat && t99RateId) {
            finalPackageTaxCodeId = t99RateId;
        } else if (!isMixedVat && defaultTaxCodeId === t99RateId) {
            finalPackageTaxCodeId = standardTaxRateId;
        }

        const { totalSaleNet, totalVat, totalCost, calculatedGross } = packageTotals;
    
        const packageToSave: ServicePackage = {
            id: id || `pkg_${Date.now()}`.replace('.', ''),
            name: name || '',
            entityId: entityId || '',
            description: description || '',
            applicableMake: applicableMake || undefined,
            applicableModel: applicableModel || undefined,
            applicableVariant: applicableVariant || undefined,
            applicableEngineSize: applicableEngineSize || undefined,
            totalPrice: totalPrice || calculatedGross, 
            totalPriceNet: totalSaleNet,
            totalPriceVat: totalVat,
            totalCost: totalCost,
            isMixedVat: isMixedVat,
            taxCodeId: finalPackageTaxCodeId || standardTaxRateId || '',
            costItems: finalCostItems,
        };
        
        onSave(packageToSave);
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
            supplierId: part.defaultSupplierId,
            fromStock: part.stockQuantity > 0,
            taxCodeId: part.taxCodeId || formData.taxCodeId || standardTaxRateId
        } : li)}));
        setActiveSearchRow(null);
        setSearchTerm('');
    };
    
    const handleCreateNewPart = (lineId: string) => {
        const draft: Partial<Part> = {
            partNumber: searchTerm,
            description: searchTerm,
            defaultSupplierId: defaultSupplierId
        };
        setNewPartDraft(draft);
        setActiveLineItemId(lineId);
        setIsPartModalOpen(true);
        setActiveSearchRow(null);
    };

    const handleSaveNewPart = async (newPart: Part) => {
        if (!saveRecord) {
            alert("Error: Save function not available.");
            return;
        }
        try {
            const partToSave: Part = { ...newPart, id: newPart.id || `part_${Date.now()}`.replace('.', '') };
            const savedPart = await saveRecord('parts', partToSave);
            
            if (activeLineItemId && savedPart) {
                handleSelectPart(activeLineItemId, savedPart);
            }
        } catch (error) {
            console.error("Failed to save new part:", error);
            alert("An error occurred while saving the part. See console for details.");
        } finally {
            setIsPartModalOpen(false);
            setNewPartDraft(null);
            setActiveLineItemId(null);
        }
    };

    const recalculateTotalPrice = useCallback(() => {
        setFormData(p => ({ ...p, totalPrice: packageTotals.calculatedGross }));
    }, [packageTotals.calculatedGross]);

    const handleBlur = () => {
        setTimeout(() => {
            setActiveSearchRow(null);
        }, 300);
    };

    return (
        <>
            <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={servicePackage?.id ? "Edit Service Package" : "Add Service Package"} maxWidth="max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Entity</label>
                        <select name="entityId" value={formData.entityId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            {businessEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                        <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g., Porsche 911 Minor Service" className="w-full p-2 border rounded" />
                    </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Line Item Tax</label>
                        <select name="taxCodeId" value={formData.taxCodeId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} ({t.rate}%)</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                         <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Package Gross Price</label>
                                <div className="flex items-center gap-2">
                                    <input name="totalPrice" type="number" value={formData.totalPrice || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                                    <button onClick={recalculateTotalPrice} className="p-2 bg-gray-200 rounded hover:bg-gray-300" title="Recalculate from line items"><RefreshCw size={16}/></button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Package Net Price</label>
                                <input 
                                    type="text" 
                                    readOnly 
                                    value={formatCurrency(packageTotals.totalSaleNet)} 
                                    className="w-full p-2 border rounded bg-gray-100 text-gray-600"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Optional details about the package" className="w-full p-2 border rounded" rows={2}/>
                </div>
                
                <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                    <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Filter size={16}/> Vehicle Compatibility (Hierarchical)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Make (Level 1)</label>
                            <input name="applicableMake" value={formData.applicableMake || ''} onChange={handleChange} placeholder="e.g. Porsche" className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Model (Level 2)</label>
                            <input name="applicableModel" value={formData.applicableModel || ''} onChange={handleChange} placeholder="e.g. Cayman" className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Variant/Type (Level 3)</label>
                            <input name="applicableVariant" value={formData.applicableVariant || ''} onChange={handleChange} placeholder="e.g. GT4" className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Engine Size (cc)</label>
                            <input name="applicableEngineSize" type="number" value={formData.applicableEngineSize || ''} onChange={handleChange} placeholder="e.g. 3996" className="w-full p-2 border rounded text-sm" />
                        </div>
                    </div>
                </div>
                
                <h4 className="font-bold mb-2 mt-4">Cost & Sale Items (Parts & Labor)</h4>
                <div className="grid grid-cols-13 gap-2 items-center text-xs font-semibold text-gray-500 px-2 pb-1 border-b">
                    <div className="col-span-2">Part Number</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-1">Supplier</div>
                    <div className="col-span-1">Qty</div>
                    <div className="col-span-1 text-right">Unit Cost</div>
                    <div className="col-span-1 text-right">Unit Price</div>
                    <div className="col-span-1">Tax</div>
                    <div className="col-span-1">Stock</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="space-y-2 mt-2 pr-2">
                    {(formData.costItems || []).map(li => {
                        const showSearch = !li.isLabor && activeSearchRow === li.id && searchTerm.length > 1;
                        return (
                            <div key={li.id} className="grid grid-cols-13 gap-2 items-start relative">
                                <div className="col-span-2">
                                    {!li.isLabor && (
                                        <input
                                            value={li.partNumber || ''}
                                            onFocus={() => { setActiveSearchRow(li.id); setSearchTerm(li.partNumber || ''); }}
                                            onBlur={handleBlur}
                                            onChange={e => handleLineChange(li.id, 'partNumber', e.target.value)}
                                            placeholder="Part Number"
                                            className="w-full p-1 border rounded text-sm"
                                            autoComplete="off"
                                        />
                                    )}
                                </div>
                                <div className="col-span-3 relative">
                                    <input
                                        value={li.description}
                                        onFocus={() => { if (!li.isLabor) { setActiveSearchRow(li.id); setSearchTerm(li.description); } else { setActiveSearchRow(null) } }}
                                        onBlur={handleBlur}
                                        onChange={e => handleLineChange(li.id, 'description', e.target.value)}
                                        placeholder={li.isLabor ? "Labor Description" : "Part Description"}
                                        className="w-full p-1 border rounded text-sm"
                                        autoComplete="off"
                                    />
                                    {showSearch && (
                                        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                            {filteredParts.length > 0 ? (
                                                filteredParts.map(part => (
                                                    <div
                                                        key={part.id}
                                                        className="p-2 cursor-pointer hover:bg-gray-100"
                                                        onMouseDown={() => handleSelectPart(li.id, part)}
                                                    >
                                                        <p className="font-semibold">{part.partNumber} - {part.description}</p>
                                                        <p className="text-sm text-gray-600">Stock: {part.stockQuantity}, Price: {formatCurrency(part.salePrice)}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-2 text-gray-500">No matching parts found.</div>
                                            )}
                                            <div
                                                className="p-2 cursor-pointer hover:bg-gray-100 border-t"
                                                onMouseDown={() => handleCreateNewPart(li.id)}
                                            >
                                                <p className="font-semibold text-indigo-600 flex items-center gap-2"><PlusCircle size={14} /> Add as new part</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-1 flex items-center justify-center pt-1">
                                    {!li.isLabor && li.supplierId && (
                                        <span className="font-mono bg-gray-200 px-1 rounded text-xs">
                                            {supplierMap.get(li.supplierId) || '???'}
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-1"><input type="number" step="0.1" value={li.quantity} onChange={e=>handleLineChange(li.id, 'quantity', e.target.value)} placeholder="Qty" className="p-1 border rounded text-sm text-right w-full"/></div>
                                <div className="col-span-1"><input type="number" step="0.01" value={li.unitCost || ''} onChange={e=>handleLineChange(li.id, 'unitCost', e.target.value)} placeholder="Cost" className="w-full p-1 border rounded text-sm text-right"/></div>
                                <div className="col-span-1"><input type="number" step="0.01" value={li.unitPrice || ''} onChange={e=>handleLineChange(li.id, 'unitPrice', e.target.value)} placeholder="Price" className="w-full p-1 border rounded text-sm text-right"/></div>
                                <div className="col-span-1">
                                    <select value={li.taxCodeId || ''} onChange={e => handleLineChange(li.id, 'taxCodeId', e.target.value)} className="w-full p-1 border rounded text-sm bg-white">
                                        {taxRates.map(t => <option key={t.id} value={t.id}>{t.code} ({t.rate}%)</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    {!li.isLabor && (
                                        <input 
                                            type="checkbox" 
                                            checked={li.fromStock || false} 
                                            onChange={e => handleLineChange(li.id, 'fromStock', e.target.checked)}
                                            className="h-4 w-4 rounded"
                                            title="Is this part from existing stock?"
                                        />
                                    )}
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    {li.isLabor ? <span className="text-xs font-semibold">LABOR</span> : <span className="text-xs font-semibold">PART</span>}
                                </div>
                                <button onClick={()=>removeLine(li.id)} className="col-span-1 text-red-500 justify-self-center"><Trash2 size={16}/></button>
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-4">
                    <button onClick={() => addLine(true)} className="text-indigo-600 font-semibold text-sm mt-2 flex items-center gap-1"><PlusCircle size={14}/> Add Labor</button>
                    <button onClick={() => addLine(false)} className="text-indigo-600 font-semibold text-sm mt-2 flex items-center gap-1"><PlusCircle size={14}/> Add Part</button>
                </div>
           
                <div className="mt-6 pt-6 border-t">
                    <h4 className="font-bold mb-2">Package Financial Summary (Calculated from Line Items)</h4>
                    <div className="grid grid-cols-2 gap-x-8 text-sm bg-gray-50 p-4 rounded-lg border">
                        <div className="space-y-1">
                            <div className="flex justify-between"><span>Total Cost Price:</span><span className="font-mono">{formatCurrency(packageTotals.totalCost)}</span></div>
                            <div className="flex justify-between"><span>Total Sale Price (Net):</span><span className="font-mono">{formatCurrency(packageTotals.totalSaleNet)}</span></div>
                            <div className="flex justify-between"><span>Total VAT:</span><span className="font-mono text-red-500 font-bold">{formatCurrency(packageTotals.totalVat)}</span></div>
                            <div className="flex justify-between font-bold"><span>Total Sale Price (Gross):</span><span className="font-mono">{formatCurrency(packageTotals.calculatedGross)}</span></div>
                        </div>
                        <div className="space-y-1">
                            <div className={`flex justify-between font-semibold ${packageTotals.totalProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                <span>Est. Profit:</span>
                                <span className="font-mono">{formatCurrency(packageTotals.totalProfit)}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span>Est. Margin:</span>
                                <span className="font-mono">{packageTotals.margin.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </FormModal>

            {isPartModalOpen && (
                <PartFormModal 
                    isOpen={isPartModalOpen} 
                    onClose={() => setIsPartModalOpen(false)} 
                    onSave={handleSaveNewPart} 
                    part={newPartDraft} 
                    suppliers={suppliers} 
                    taxRates={taxRates} 
                />
            )}
        </>
    );
};

export default ServicePackageFormModal;

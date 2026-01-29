import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrderLineItem, Job, Vehicle, Supplier, TaxRate, BusinessEntity, Part } from '../types';
import { X, Save, Plus, Trash2, Package, FileText, Calendar, Car, AlertCircle } from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';

interface BatchAddPurchasesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (purchaseOrder: Omit<PurchaseOrder, 'id'>) => void;
    jobs: Job[];
    vehicles: Vehicle[];
    suppliers: Supplier[];
    taxRates: TaxRate[];
    selectedEntityId: string;
    businessEntities: BusinessEntity[];
    parts?: Part[]; // Make parts optional
}

interface LineItem {
    id: string;
    partNumber: string;
    description: string;
    quantity: string;
    unitPrice: string; // Net cost
    taxCodeId: string;
}

const BatchAddPurchasesModal: React.FC<BatchAddPurchasesModalProps> = ({ isOpen, onClose, onSave, jobs, vehicles, suppliers, taxRates, selectedEntityId, businessEntities, parts = [] }) => {
    const taxRatesMap = useMemo(() => new Map(taxRates.map(t => [t.id, t])), [taxRates]);
    const standardTaxRateId = useMemo(() => taxRates.find(t => t.code === 'T1')?.id || '', [taxRates]);
    
    const defaultLineItem = useMemo(() => ({
        partNumber: '',
        description: '',
        quantity: '1',
        unitPrice: '',
        taxCodeId: standardTaxRateId
    }), [standardTaxRateId]);

    const [commonData, setCommonData] = useState({
        supplierId: suppliers?.[0]?.id || '',
        supplierReference: '',
        jobId: 'null',
        purchaseDate: formatDate(new Date()),
        vehicleRegistrationRef: 'STOCK',
    });
    
    const [lineItems, setLineItems] = useState<LineItem[]>([{ id: crypto.randomUUID(), ...defaultLineItem }]);
    const [errors, setErrors] = useState<string[]>([]);
    
    // Part Search State
    const [activeSearchRow, setActiveSearchRow] = useState<string | null>(null);
    const [activeSearchField, setActiveSearchField] = useState<'partNumber' | 'description' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v.registration])), [vehicles]);
    const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, { vehicleId: j.vehicleId, description: j.description }])), [jobs]);

    useEffect(() => {
        const selectedJob = jobMap.get(commonData.jobId);
        if (selectedJob) {
            const reg = vehicleMap.get(selectedJob.vehicleId);
            setCommonData(prev => ({ ...prev, vehicleRegistrationRef: reg || '' }));
        } else {
            setCommonData(prev => ({ ...prev, vehicleRegistrationRef: 'STOCK' }));
        }
    }, [commonData.jobId, jobMap, vehicleMap]);

    const filteredParts = useMemo(() => {
        if (!searchTerm) return [];
        // CRITICAL FIX: Ensure parts is an array before filtering
        const safeParts = Array.isArray(parts) ? parts : [];
        if (safeParts.length === 0) return [];
        
        const lower = searchTerm.toLowerCase();
        return safeParts.filter(p => 
            (p.partNumber || '').toLowerCase().includes(lower) || 
            (p.description || '').toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [parts, searchTerm]);

    const handleCommonDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setCommonData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLineItemChange = useCallback((id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
        setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
        
        if (field === 'description' || field === 'partNumber') {
            if (activeSearchRow === id) {
                 setSearchTerm(value);
            }
        }
    }, [activeSearchRow]);
    
    const handleSelectPart = (itemId: string, part: Part) => {
        setLineItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    partNumber: part.partNumber,
                    description: part.description,
                    unitPrice: part.costPrice.toString(),
                    taxCodeId: part.taxCodeId || item.taxCodeId
                };
            }
            return item;
        }));
        setActiveSearchRow(null);
        setActiveSearchField(null);
        setSearchTerm('');
    };

    const addLineItem = () => {
        setLineItems(prev => [...prev, { id: crypto.randomUUID(), ...defaultLineItem }]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
             setLineItems(prev => prev.filter(item => item.id !== id));
        }
    };
    
    const totals = useMemo(() => {
        let net = 0;
        let gross = 0;
        lineItems.forEach(item => {
            const qty = parseInt(item.quantity, 10) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            const taxRateInfo = taxRatesMap.get(item.taxCodeId);
            const rate = taxRateInfo ? taxRateInfo.rate / 100 : 0;

            const lineNet = qty * price;
            const lineGross = lineNet * (1 + rate);

            net += lineNet;
            gross += lineGross;
        });
        return { net, gross };
    }, [lineItems, taxRatesMap]);


    const handleSubmit = () => {
        const newErrors: string[] = [];
        if (!commonData.supplierId) newErrors.push("A supplier must be selected.");
        if (!commonData.supplierReference) newErrors.push("Supplier Reference / Invoice No. is required.");
        if (!commonData.vehicleRegistrationRef) newErrors.push("A Reference (e.g., vehicle reg or 'STOCK') is required.");

        const isStock = commonData.jobId === 'null';
        const selectedJobId = isStock ? null : commonData.jobId;

        const jobForEntity = jobs.find(j => j.id === selectedJobId);
        const entityId = jobForEntity ? jobForEntity.entityId : (selectedEntityId !== 'all' ? selectedEntityId : undefined);

        if (!entityId) newErrors.push("Could not determine a business entity. Please assign to a job or select a specific entity view.");
        
        const finalLineItems: PurchaseOrderLineItem[] = [];
        lineItems.forEach((item, index) => {
            const price = parseFloat(item.unitPrice);
            const qty = parseInt(item.quantity, 10);
            
            if (!item.description.trim()) newErrors.push(`Row ${index + 1}: Item description is required.`);
            if (isNaN(qty) || qty <= 0) newErrors.push(`Row ${index + 1}: Quantity must be a positive number.`);
            if (isNaN(price) || price < 0) newErrors.push(`Row ${index + 1}: Unit price must be a valid number.`);
            
            finalLineItems.push({
                id: crypto.randomUUID(),
                partNumber: item.partNumber,
                description: item.description,
                quantity: qty,
                receivedQuantity: 0,
                unitPrice: price,
                taxCodeId: item.taxCodeId
            });
        });
        
        setErrors(newErrors);

        if (newErrors.length === 0 && finalLineItems.length > 0) {
            const newPO: Omit<PurchaseOrder, 'id'> = {
                entityId: entityId!,
                supplierId: commonData.supplierId || null,
                supplierReference: commonData.supplierReference,
                vehicleRegistrationRef: commonData.vehicleRegistrationRef,
                orderDate: commonData.purchaseDate,
                status: 'Draft',
                jobId: selectedJobId,
                lineItems: finalLineItems,
            };
            onSave(newPO);
            handleClose();
        } else if (newErrors.length === 0 && finalLineItems.length === 0) {
            setErrors(["Please add at least one item to the purchase order."]);
        }
    };
    
    const handleClose = () => {
        setLineItems([{ id: crypto.randomUUID(), ...defaultLineItem }]);
        setCommonData({
            supplierId: suppliers?.[0]?.id || '',
            supplierReference: '',
            jobId: 'null',
            purchaseDate: formatDate(new Date()),
            vehicleRegistrationRef: 'STOCK',
        });
        setErrors([]);
        setActiveSearchRow(null);
        setActiveSearchField(null);
        setSearchTerm('');
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col p-6">
                <div className="flex justify-between items-center border-b pb-3 mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-indigo-700">Add Purchases to New Purchase Order</h2>
                    <button onClick={handleClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                {errors.length > 0 && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm mb-4 flex-shrink-0">
                        <ul className="list-disc list-inside">
                            {errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                )}
                
                {/* Common Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pb-4 border-b flex-shrink-0">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Package size={14}/> Supplier</label>
                        <select name="supplierId" value={commonData.supplierId} onChange={handleCommonDataChange} className="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="">-- Select Supplier --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><FileText size={14}/> Supplier Invoice No.</label>
                        <input type="text" name="supplierReference" value={commonData.supplierReference} onChange={handleCommonDataChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Car size={14}/> Allocation</label>
                        <select name="jobId" value={commonData.jobId} onChange={handleCommonDataChange} className="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="null">Workshop Stock</option>
                            <optgroup label="Assign to Job">
                                {jobs.filter(j => !j.invoiceId).map(j => (
                                    <option key={j.id} value={j.id}>
                                        {vehicleMap.get(j.vehicleId)} - {j.description}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Calendar size={14}/> Purchase Date</label>
                        <input type="date" name="purchaseDate" value={commonData.purchaseDate} onChange={handleCommonDataChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><FileText size={14}/> Reference</label>
                         <input type="text" name="vehicleRegistrationRef" value={commonData.vehicleRegistrationRef} onChange={handleCommonDataChange} className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100" />
                    </div>
                </div>

                {/* Line Items */}
                <main className="flex-grow overflow-y-auto pr-2 pb-20">
                    <div className="space-y-2">
                        {/* Headers */}
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 px-1 pb-1">
                            <div className="col-span-3">Part Number</div>
                            <div className="col-span-4">Description</div>
                            <div className="col-span-1 text-right">Qty</div>
                            <div className="col-span-2 text-right">Unit Price (Net £)</div>
                            <div className="col-span-1">Tax</div>
                            <div className="col-span-1"></div>
                        </div>
                        {lineItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center relative">
                                <div className="col-span-3 relative">
                                    <input 
                                        type="text" 
                                        value={item.partNumber} 
                                        onChange={e => handleLineItemChange(item.id, 'partNumber', e.target.value)} 
                                        onFocus={() => { setActiveSearchRow(item.id); setActiveSearchField('partNumber'); setSearchTerm(item.partNumber); }}
                                        onBlur={() => setTimeout(() => { setActiveSearchRow(null); setActiveSearchField(null); }, 200)}
                                        placeholder="Part No." 
                                        className="w-full p-1.5 border rounded" 
                                    />
                                    {activeSearchRow === item.id && activeSearchField === 'partNumber' && filteredParts.length > 0 && (
                                        <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                            {filteredParts.map(part => (
                                                <div 
                                                    key={part.id} 
                                                    onMouseDown={() => handleSelectPart(item.id, part)} 
                                                    className="p-2 hover:bg-indigo-100 cursor-pointer text-sm"
                                                >
                                                    <p className="font-semibold">{part.partNumber}</p>
                                                    <p className="text-xs text-gray-500 truncate">{part.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="col-span-4 relative">
                                    <input 
                                        type="text" 
                                        value={item.description} 
                                        onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} 
                                        onFocus={() => { setActiveSearchRow(item.id); setActiveSearchField('description'); setSearchTerm(item.description); }}
                                        onBlur={() => setTimeout(() => { setActiveSearchRow(null); setActiveSearchField(null); }, 200)}
                                        placeholder="Item Description" 
                                        className="w-full p-1.5 border rounded" 
                                    />
                                    {activeSearchRow === item.id && activeSearchField === 'description' && filteredParts.length > 0 && (
                                        <div className="absolute z-20 top-full left-0 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                            {filteredParts.map(part => (
                                                <div 
                                                    key={part.id} 
                                                    onMouseDown={() => handleSelectPart(item.id, part)} 
                                                    className="p-2 hover:bg-indigo-100 cursor-pointer text-sm"
                                                >
                                                    <p className="font-semibold">{part.description}</p>
                                                    <p className="text-xs text-gray-500">{part.partNumber} | Stock: {part.stockQuantity}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="number" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', e.target.value)} placeholder="Qty" className="col-span-1 p-1.5 border rounded text-right" />
                                <input type="number" step="0.01" value={item.unitPrice} onChange={e => handleLineItemChange(item.id, 'unitPrice', e.target.value)} placeholder="e.g. 100.00" className="col-span-2 p-1.5 border rounded text-right" />
                                <select value={item.taxCodeId} onChange={e => handleLineItemChange(item.id, 'taxCodeId', e.target.value)} className="col-span-1 p-1.5 border rounded text-xs">
                                    {taxRates.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                                </select>
                                <button type="button" onClick={() => removeLineItem(item.id)} className="col-span-1 text-red-500 hover:text-red-700 justify-self-center disabled:opacity-50" disabled={lineItems.length <= 1}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addLineItem} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800 mt-2">
                        <Plus size={14} className="mr-1"/> Add Another Item
                    </button>
                </main>

                {/* Footer */}
                <footer className="flex justify-between items-center mt-4 pt-4 border-t flex-shrink-0">
                    <div className="text-sm font-semibold">
                        <p>Total Net: {formatCurrency(totals.net)}</p>
                        <p>Total Gross: {formatCurrency(totals.gross)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={handleClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                        <button type="button" onClick={handleSubmit} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                            <Save size={16} className="mr-2"/> Create Purchase Order
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default BatchAddPurchasesModal;
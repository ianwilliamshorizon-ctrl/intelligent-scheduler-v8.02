import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleVehicle, Vehicle, Customer, Job, Estimate, SaleUpsell, SalePrepCost, ServicePackage, SaleOverhead, SaleOverheadPackage, Invoice, BatteryCharger, ChargingEvent, SaleNonRecoverableCost, SaleVersion, TaxRate, BusinessEntity, EstimateLineItem, Prospect } from '../types';
import { X, Save, Car, Tag, Repeat, DollarSign, Wrench, Shield, Trash2, PlusCircle, CheckCircle, Briefcase, Plus, FileText, ChevronDown, ChevronUp, BatteryCharging, TrendingUp, KeyRound, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { formatDate, addDays } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import SearchableSelect from './SearchableSelect';
import { generateInvoiceId } from '../core/utils/numberGenerators';

const Section = ({ title, children, defaultOpen = false, icon: Icon }: { title: string, children?: React.ReactNode, defaultOpen?: boolean, icon: React.ElementType }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg bg-white mb-4">
            <h3 onClick={() => setIsOpen(!isOpen)} className="text-md font-bold p-3 flex justify-between items-center cursor-pointer bg-gray-50 rounded-t-lg">
                <span className="flex items-center gap-2">{Icon && <Icon size={16}/>} {title}</span>{isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </h3>
            {isOpen && <div className="p-3">{children}</div>}
        </div>
    );
};

const FinancialRow = ({ label, value, isTotal = false, isSubTotal = false, isNegative = false }: { label: string, value: number, isTotal?: boolean, isSubTotal?: boolean, isNegative?: boolean }) => (
    <div className={`flex justify-between ${isTotal ? 'font-bold text-lg text-green-700 border-t mt-1 pt-1' : isSubTotal ? 'font-bold text-gray-800 border-t mt-1 pt-1' : 'text-gray-600'}`}>
        <span>{label}</span>
        <span className={isNegative ? 'text-red-600' : ''}>{isNegative ? `(${formatCurrency(value)})` : formatCurrency(value)}</span>
    </div>
);

const FinancialsDisplay = ({ summary, saleType }: { summary: any, saleType: 'Sale or Return' | 'Stock' }) => {
    if (saleType === 'Stock') {
        return (
            <div className="space-y-4 text-sm">
                <FinancialRow label="Sale Price" value={summary.finalSalePrice} />
                <FinancialRow label="Upsell Revenue" value={summary.upsellRevenue} />
                <FinancialRow label="Total Revenue" value={(summary.finalSalePrice || 0) + (summary.upsellRevenue || 0)} isSubTotal />
                <div className="h-2"></div>
                <FinancialRow label="Vehicle Cost" value={summary.totalVehicleCost} isNegative />
                <FinancialRow label="Non-recoverable Costs" value={summary.totalNonRecoverableCosts} isNegative />
                <FinancialRow label="Upsell Costs" value={summary.upsellCosts} isNegative />
                <div className="h-2"></div>
                <FinancialRow label="Gross Profit" value={summary.grossProfit} isSubTotal />
                <FinancialRow label="VAT on Margin (approx)" value={summary.vatOnMargin} isNegative />
                <FinancialRow label="Overheads" value={summary.totalOverheads} isNegative />
                <FinancialRow label="Est. Net Profit" value={summary.netSalesProfit} isTotal />
            </div>
        );
    }

    return (
         <div className="space-y-4 text-sm">
            <div>
                <h4 className="font-bold text-gray-800 mb-1">Profit & Loss</h4>
                <div className="space-y-1">
                    <FinancialRow label="Sale Price" value={summary.finalSalePrice} />
                    <FinancialRow label="Upsell Revenue" value={summary.upsellRevenue} />
                    <FinancialRow label="Total Revenue" value={(summary.finalSalePrice || 0) + (summary.upsellRevenue || 0)} isSubTotal />
                    <div className="h-2"></div>
                    <FinancialRow label="Final Payment to Owner" value={summary.returnToCustomer} isNegative />
                    <FinancialRow label="Non-recoverable Costs" value={summary.totalNonRecoverableCosts} isNegative />
                    <FinancialRow label="Upsell Costs" value={summary.upsellCosts} isNegative />
                    <div className="h-2"></div>
                    <FinancialRow label="Gross Profit" value={summary.grossProfit} isSubTotal />
                    <FinancialRow label="VAT on Margin (approx)" value={summary.vatOnMargin} isNegative />
                    <FinancialRow label="Overheads" value={summary.totalOverheads} isNegative />
                    <FinancialRow label="Est. Net Profit" value={summary.netSalesProfit} isTotal />
                </div>
            </div>
            <div className="pt-3 border-t">
                <h4 className="font-bold text-gray-800 mb-1">Owner Payout Calculation</h4>
                 <div className="space-y-1">
                    <FinancialRow label="Agreed Return Price" value={summary.baseReturn} />
                    <FinancialRow label="Less Prep Costs" value={summary.prepCosts} isNegative />
                    <FinancialRow label="Final Payment to Owner" value={summary.returnToCustomer} isSubTotal />
                 </div>
            </div>
         </div>
    );
};

const ItemList = ({ items = [], onRemove, icon: Icon, costKey = 'cost', saleKey }: { items: any[], onRemove: (id: string) => void, icon: React.ElementType, costKey?: string, saleKey?: string }) => (
    <div className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
        {(!items || items.length === 0) && <p className="text-xs text-gray-500 text-center p-2">No items added.</p>}
        {(items || []).map(item => (
            <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2"><Icon size={14} className="text-gray-500"/>
                    <div>
                        <p className="font-semibold">{item.description}</p>
                        {saleKey && <p className="text-xs text-green-600">Sale: {formatCurrency(item[saleKey])}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`font-semibold ${saleKey ? 'text-red-600' : ''}`}>{formatCurrency(item[costKey])}</span>
                    <button type="button" onClick={() => onRemove(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                </div>
            </div>
        ))}
    </div>
);

interface ManageSaleVehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (saleVehicle: SaleVehicle) => void;
    onSaleFinalized: (saleVehicle: SaleVehicle, invoice: Invoice) => void;
    onOpenOwnerStatement: (saleVehicle: SaleVehicle) => void;
    onOpenSorContract: (saleVehicle: SaleVehicle) => void;
    onOpenInternalStatement: (saleVehicle: SaleVehicle) => void;
    onViewInvoice: (saleVehicle: SaleVehicle) => void;
    onRaiseInvoice: (invoice: Invoice) => void;
    saleVehicle: SaleVehicle;
    allJobs: Job[];
    allEstimates: Estimate[];
    customers: Customer[];
    vehicles: Vehicle[];
    allServicePackages: ServicePackage[];
    saleOverheadPackages: SaleOverheadPackage[]; // Fix: Renamed from allSaleOverheadPackages to match AppModals.tsx
    allInvoices: Invoice[];
    allBatteryChargers: BatteryCharger[];
    taxRates: TaxRate[];
    businessEntities: BusinessEntity[];
    prospects: Prospect[];
    onUpdateProspect: (prospect: Prospect) => void;
}

const ManageSaleVehicleModal: React.FC<ManageSaleVehicleModalProps> = ({ isOpen, onClose, onSave, onSaleFinalized, onOpenOwnerStatement, onOpenSorContract, onOpenInternalStatement, onViewInvoice, onRaiseInvoice, saleVehicle, allJobs, allEstimates, customers, vehicles, allServicePackages, saleOverheadPackages, allInvoices, allBatteryChargers, taxRates, businessEntities, prospects, onUpdateProspect }) => {
    const [formData, setFormData] = useState<SaleVehicle>(() => ({
        ...saleVehicle,
        versions: saleVehicle?.versions || [],
        prepCosts: saleVehicle?.prepCosts || [],
        upsells: saleVehicle?.upsells || [],
        overheads: saleVehicle?.overheads || [],
        nonRecoverableCosts: saleVehicle?.nonRecoverableCosts || [],
        chargingHistory: saleVehicle?.chargingHistory || []
    }));

    const [currentVersionId, setCurrentVersionId] = useState(saleVehicle?.activeVersionId || '');
    const [newUpsell, setNewUpsell] = useState({ description: '', costPrice: '', salePrice: '' });
    const [isAddingUpsell, setIsAddingUpsell] = useState(false);
    const [isAddingOneOffPrepCost, setIsAddingOneOffPrepCost] = useState(false);
    const [newOneOffCost, setNewOneOffCost] = useState({ description: '', cost: '' });
    const [addOverheadType, setAddOverheadType] = useState<'Package' | 'OneOff' | null>(null);
    const [newOverhead, setNewOverhead] = useState({ description: '', cost: '' });
    const [isAddingNonRecoverable, setIsAddingNonRecoverable] = useState(false);
    const [newNonRecoverable, setNewNonRecoverable] = useState({ description: '', cost: '' });
    const [isMarkingSold, setIsMarkingSold] = useState(false);
    const [soldData, setSoldData] = useState({ finalSalePrice: '', buyerCustomerId: '' });
    const [isCharging, setIsCharging] = useState(false);
    const [selectedChargerId, setSelectedChargerId] = useState('');

    useEffect(() => {
        if (!isOpen || !saleVehicle) return;

        let initialFormData = { ...saleVehicle };
        
        if (!initialFormData.versions || initialFormData.versions.length === 0) {
            const legacyVersion: SaleVersion = {
                versionId: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                listPrice: (initialFormData as any).listPrice || 0,
                sorReturnPrice: (initialFormData as any).sorReturnPrice,
            };
            initialFormData.versions = [legacyVersion];
            initialFormData.activeVersionId = legacyVersion.versionId;
        }

        initialFormData.prepCosts = initialFormData.prepCosts || [];
        initialFormData.upsells = initialFormData.upsells || [];
        initialFormData.overheads = initialFormData.overheads || [];
        initialFormData.nonRecoverableCosts = initialFormData.nonRecoverableCosts || [];
        initialFormData.chargingHistory = initialFormData.chargingHistory || [];

        setFormData(initialFormData);
        setCurrentVersionId(initialFormData.activeVersionId || '');
        
        const activeVersion = initialFormData.versions.find(v => v.versionId === initialFormData.activeVersionId);
        setSoldData({ finalSalePrice: String(activeVersion?.listPrice || ''), buyerCustomerId: initialFormData.buyerCustomerId || '' });

        setIsAddingUpsell(false);
        setIsAddingOneOffPrepCost(false);
        setAddOverheadType(null);
        setIsAddingNonRecoverable(false);
        setIsMarkingSold(false);
        setIsCharging(false);
    }, [saleVehicle, isOpen]);

    const sortedVersions = useMemo(() => {
        return [...(formData?.versions || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [formData?.versions]);

    const currentVersion = useMemo(() => {
        if (!formData?.versions || formData.versions.length === 0) return null;
        return formData.versions.find(v => v.versionId === currentVersionId) || sortedVersions[sortedVersions.length - 1];
    }, [formData?.versions, currentVersionId, sortedVersions]);
    
    const vehicle = useMemo(() => vehicles.find(v => v.id === formData.vehicleId), [formData.vehicleId, vehicles]);
    
    const availableInvoices = useMemo(() => {
        if (!allJobs || !allInvoices) return [];
        const vehicleJobs = allJobs.filter(j => j.vehicleId === formData.vehicleId);
        const vehicleJobIds = new Set(vehicleJobs.map(j => j.id));
        const vehicleInvoices = allInvoices.filter(inv => inv.jobId && vehicleJobIds.has(inv.jobId));
        const linkedInvoiceIds = new Set((formData.prepCosts || []).filter(pc => pc.type === 'Invoice').map(pc => pc.sourceId));
        return vehicleInvoices.filter(inv => !linkedInvoiceIds.has(inv.id));
    }, [allJobs, allInvoices, formData.vehicleId, formData.prepCosts]);

    const financialSummary = useMemo(() => {
        if (!currentVersion) return {};
        
        const prepCosts = (formData.prepCosts || []).reduce((sum, cost) => sum + (cost.cost || 0), 0);
        const upsellCosts = (formData.upsells || []).reduce((sum, upsell) => sum + (upsell.costPrice || 0), 0);
        const upsellRevenue = (formData.upsells || []).reduce((sum, upsell) => sum + (upsell.salePrice || 0), 0);
        const totalOverheads = (formData.overheads || []).reduce((sum, overhead) => sum + (overhead.cost || 0), 0);
        const totalNonRecoverableCosts = (formData.nonRecoverableCosts || []).reduce((sum, cost) => sum + (cost.cost || 0), 0);
        const finalSalePrice = formData.status === 'Sold' ? (formData.finalSalePrice || currentVersion.listPrice) : currentVersion.listPrice;
        
        let grossProfit = 0;
        let returnToCustomer = 0;
        let baseReturn = 0; 
        let totalVehicleCost = 0; 
        const purchasePrice = formData.purchasePrice || 0;

        if (formData.saleType === 'Sale or Return') {
            baseReturn = currentVersion.sorReturnPrice || 0;
            returnToCustomer = baseReturn - prepCosts;
            grossProfit = (finalSalePrice + upsellRevenue) - (returnToCustomer + upsellCosts + totalNonRecoverableCosts);
        } else { 
            totalVehicleCost = purchasePrice + prepCosts;
            const totalDealCost = totalVehicleCost + upsellCosts + totalNonRecoverableCosts;
            grossProfit = (finalSalePrice + upsellRevenue) - totalDealCost;
        }

        const vatOnMargin = grossProfit > 0 ? grossProfit / 6 : 0;
        const netSalesProfit = grossProfit - vatOnMargin - totalOverheads;

        return { prepCosts, upsellRevenue, upsellCosts, returnToCustomer, grossProfit, totalOverheads, vatOnMargin, netSalesProfit, finalSalePrice, baseReturn, purchasePrice, totalVehicleCost, totalNonRecoverableCosts };
    }, [formData, currentVersion]);

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    const confirmSold = () => {
        const finalPrice = parseFloat(soldData.finalSalePrice) || 0;
        const entity = businessEntities.find(e => e.id === formData.entityId);
        const t0TaxRate = taxRates.find(t => t.code === 'T0') || taxRates[0];
        const t1TaxRate = taxRates.find(t => t.code === 'T1') || taxRates[0];

        const newInvoice: Invoice = {
            id: generateInvoiceId(allInvoices, entity?.shortCode || 'UNK'),
            entityId: formData.entityId,
            customerId: soldData.buyerCustomerId,
            saleVehicleId: formData.id,
            vehicleId: formData.vehicleId,
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            status: 'Draft',
            lineItems: [
                {
                    id: crypto.randomUUID(),
                    description: `Vehicle Sale: ${vehicle?.make} ${vehicle?.model} (${vehicle?.registration})`,
                    quantity: 1,
                    unitPrice: finalPrice,
                    isLabor: false,
                    taxCodeId: t0TaxRate?.id
                },
                ...(formData.upsells || []).map(u => ({
                    id: crypto.randomUUID(),
                    description: u.description,
                    quantity: 1,
                    unitPrice: u.salePrice,
                    isLabor: false,
                    taxCodeId: t1TaxRate?.id
                }))
            ]
        };

        const updatedVehicle: SaleVehicle = {
            ...formData,
            status: 'Sold',
            soldDate: new Date().toISOString().split('T')[0],
            finalSalePrice: finalPrice,
            buyerCustomerId: soldData.buyerCustomerId,
            invoiceId: newInvoice.id
        };

        const prospect = prospects.find(p => p.linkedSaleVehicleId === formData.id);
        if (prospect) {
            onUpdateProspect({
                ...prospect,
                status: 'Converted',
                customerId: soldData.buyerCustomerId
            });
        }

        onSaleFinalized(updatedVehicle, newInvoice);
        onRaiseInvoice(newInvoice); 
        onClose();
    };

    const handleAddInvoicePrepCost = (invoiceId: string) => {
        const invoice = allInvoices.find(inv => inv.id === invoiceId);
        if (!invoice) return;
        const totalCost = invoice.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const newCost: SalePrepCost = { id: crypto.randomUUID(), type: 'Invoice', sourceId: invoice.id, description: `Invoice #${invoice.id}`, cost: totalCost };
        setFormData(prev => ({ ...prev, prepCosts: [...(prev.prepCosts || []), newCost] }));
    };

    const handleAddOneOffPrepCost = () => {
        if (!newOneOffCost.description || !newOneOffCost.cost) return;
        const newCost: SalePrepCost = { id: crypto.randomUUID(), type: 'OneOff', description: newOneOffCost.description, cost: parseFloat(newOneOffCost.cost) };
        setFormData(prev => ({ ...prev, prepCosts: [...(prev.prepCosts || []), newCost] }));
        setNewOneOffCost({ description: '', cost: '' });
        setIsAddingOneOffPrepCost(false);
    };

    const handleRemovePrepCost = (id: string) => {
        setFormData(prev => ({ ...prev, prepCosts: (prev.prepCosts || []).filter(c => c.id !== id) }));
    };

    const handleAddUpsell = () => {
        if (!newUpsell.description || !newUpsell.costPrice || !newUpsell.salePrice) return;
        const upsell: SaleUpsell = { id: crypto.randomUUID(), description: newUpsell.description, costPrice: parseFloat(newUpsell.costPrice), salePrice: parseFloat(newUpsell.salePrice) };
        setFormData(prev => ({ ...prev, upsells: [...(prev.upsells || []), upsell] }));
        setNewUpsell({ description: '', costPrice: '', salePrice: '' });
        setIsAddingUpsell(false);
    };

    const handleRemoveUpsell = (id: string) => {
        setFormData(prev => ({ ...prev, upsells: (prev.upsells || []).filter(u => u.id !== id) }));
    };

    const handleAddOverhead = () => {
        if (!newOverhead.description || !newOverhead.cost) return;
        const overhead: SaleOverhead = { id: crypto.randomUUID(), description: newOverhead.description, cost: parseFloat(newOverhead.cost) };
        setFormData(prev => ({ ...prev, overheads: [...(prev.overheads || []), overhead] }));
        setNewOverhead({ description: '', cost: '' });
        setAddOverheadType(null);
    };

    const handleAddOverheadPackage = (packageId: string) => {
        const pkg = saleOverheadPackages.find(p => p.id === packageId);
        if (pkg) {
            const overhead: SaleOverhead = { id: crypto.randomUUID(), description: pkg.name, cost: pkg.cost, sourcePackageId: pkg.id };
            setFormData(prev => ({ ...prev, overheads: [...(prev.overheads || []), overhead] }));
        }
        setAddOverheadType(null);
    };

    const handleRemoveOverhead = (id: string) => {
        setFormData(prev => ({ ...prev, overheads: (prev.overheads || []).filter(o => o.id !== id) }));
    };

    const handleAddNonRecoverable = () => {
        if (!newNonRecoverable.description || !newNonRecoverable.cost) return;
        const cost: SaleNonRecoverableCost = { id: crypto.randomUUID(), description: newNonRecoverable.description, cost: parseFloat(newNonRecoverable.cost) };
        setFormData(prev => ({ ...prev, nonRecoverableCosts: [...(prev.nonRecoverableCosts || []), cost] }));
        setNewNonRecoverable({ description: '', cost: '' });
        setIsAddingNonRecoverable(false);
    };

    const handleRemoveNonRecoverable = (id: string) => {
        setFormData(prev => ({ ...prev, nonRecoverableCosts: (prev.nonRecoverableCosts || []).filter(c => c.id !== id) }));
    };

    const entityChargers = useMemo(() => {
        return (allBatteryChargers || []).filter(c => c.entityId === formData.entityId);
    }, [allBatteryChargers, formData.entityId]);

    const activeChargingEvent = useMemo(() => {
        return (formData.chargingHistory || []).find(event => event.endDate === null);
    }, [formData.chargingHistory]);

    const handleStartCharging = () => {
        if (!selectedChargerId) return;
        const newEvent: ChargingEvent = {
            id: crypto.randomUUID(),
            chargerId: selectedChargerId,
            startDate: new Date().toISOString(),
            endDate: null
        };
        setFormData(prev => ({
            ...prev,
            chargingHistory: [...(prev.chargingHistory || []), newEvent]
        }));
        setIsCharging(false);
    };

    const handleStopCharging = () => {
        if (!activeChargingEvent) return;
        setFormData(prev => ({
            ...prev,
            chargingHistory: (prev.chargingHistory || []).map(event => 
                event.id === activeChargingEvent.id ? { ...event, endDate: new Date().toISOString() } : event
            )
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-indigo-700">Manage Sale: {vehicle?.registration}</h2>
                        <p className="text-sm text-gray-500">{vehicle?.make} {vehicle?.model} - {formData.saleType}</p>
                    </div>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </header>
                
                <main className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-50">
                    <div className="lg:col-span-2 space-y-4">
                        <Section title="Preparation Costs (Recoverable)" icon={Wrench} defaultOpen>
                            <ItemList items={formData.prepCosts || []} onRemove={handleRemovePrepCost} icon={Wrench}/>
                            <div className="flex gap-2 mt-3 pt-2 border-t">
                                <SearchableSelect options={availableInvoices.map(inv => ({id: inv.id, label: `Inv #${inv.id} - ${formatCurrency(inv.lineItems.reduce((s,i)=>s+(i.unitPrice*i.quantity),0))}`}))} value={null} onChange={(val) => {if(val) handleAddInvoicePrepCost(val)}} placeholder="Link Invoice..." />
                                <button onClick={() => setIsAddingOneOffPrepCost(true)} className="flex items-center text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 rounded hover:bg-indigo-100 flex-shrink-0"><PlusCircle size={14} className="mr-1"/> Add One-Off</button>
                            </div>
                            {isAddingOneOffPrepCost && (
                                <div className="flex gap-2 mt-2 items-center bg-gray-100 p-2 rounded">
                                    <input value={newOneOffCost.description} onChange={e => setNewOneOffCost({...newOneOffCost, description: e.target.value})} placeholder="Description" className="flex-grow p-1 border rounded text-sm"/>
                                    <input type="number" value={newOneOffCost.cost} onChange={e => setNewOneOffCost({...newOneOffCost, cost: e.target.value})} placeholder="Cost" className="w-24 p-1 border rounded text-sm"/>
                                    <button onClick={handleAddOneOffPrepCost} className="text-green-600"><CheckCircle size={18}/></button>
                                    <button onClick={() => setIsAddingOneOffPrepCost(false)} className="text-red-600"><X size={18}/></button>
                                </div>
                            )}
                        </Section>

                        <Section title="Non-Recoverable Costs" icon={Shield} defaultOpen>
                            <ItemList items={formData.nonRecoverableCosts || []} onRemove={handleRemoveNonRecoverable} icon={Shield}/>
                            <div className="mt-2 pt-2 border-t"><button onClick={() => setIsAddingNonRecoverable(true)} className="text-sm font-semibold text-indigo-600 flex items-center gap-1"><PlusCircle size={14}/> Add Cost</button></div>
                            {isAddingNonRecoverable && (
                                <div className="flex gap-2 mt-2 items-center bg-gray-100 p-2 rounded">
                                    <input value={newNonRecoverable.description} onChange={e => setNewNonRecoverable({...newNonRecoverable, description: e.target.value})} placeholder="Description (e.g. Warranty)" className="flex-grow p-1 border rounded text-sm"/>
                                    <input type="number" value={newNonRecoverable.cost} onChange={e => setNewNonRecoverable({...newNonRecoverable, cost: e.target.value})} placeholder="Cost" className="w-24 p-1 border rounded text-sm"/>
                                    <button onClick={handleAddNonRecoverable} className="text-green-600"><CheckCircle size={18}/></button>
                                    <button onClick={() => setIsAddingNonRecoverable(false)} className="text-red-600"><X size={18}/></button>
                                </div>
                            )}
                        </Section>

                        <Section title="Overheads" icon={Briefcase} defaultOpen>
                            <ItemList items={formData.overheads || []} onRemove={handleRemoveOverhead} icon={Briefcase}/>
                            <div className="flex gap-2 mt-2 pt-2 border-t">
                                <button onClick={() => setAddOverheadType('Package')} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">Add Package</button>
                                <button onClick={() => setAddOverheadType('OneOff')} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">Add Custom</button>
                            </div>
                            {addOverheadType === 'Package' && (
                                <div className="mt-2"><SearchableSelect options={saleOverheadPackages.map(p => ({id: p.id, label: `${p.name} (${formatCurrency(p.cost)})`}))} value={null} onChange={(val) => {if(val) handleAddOverheadPackage(val)}} placeholder="Select package..." /></div>
                            )}
                            {addOverheadType === 'OneOff' && (
                                <div className="flex gap-2 mt-2 items-center bg-gray-100 p-2 rounded">
                                    <input value={newOverhead.description} onChange={e => setNewOverhead({...newOverhead, description: e.target.value})} placeholder="Description" className="flex-grow p-1 border rounded text-sm"/>
                                    <input type="number" value={newOverhead.cost} onChange={e => setNewOverhead({...newOverhead, cost: e.target.value})} placeholder="Cost" className="w-24 p-1 border rounded text-sm"/>
                                    <button onClick={handleAddOverhead} className="text-green-600"><CheckCircle size={18}/></button>
                                    <button onClick={() => setAddOverheadType(null)} className="text-red-600"><X size={18}/></button>
                                </div>
                            )}
                        </Section>

                        <Section title="Upsells & Add-ons" icon={TrendingUp} defaultOpen>
                            <ItemList items={formData.upsells || []} onRemove={handleRemoveUpsell} icon={Tag} costKey="costPrice" saleKey="salePrice"/>
                            <div className="mt-2 pt-2 border-t"><button onClick={() => setIsAddingUpsell(true)} className="text-sm font-semibold text-indigo-600 flex items-center gap-1"><PlusCircle size={14}/> Add Upsell</button></div>
                            {isAddingUpsell && (
                                <div className="flex gap-2 mt-2 items-center bg-gray-100 p-2 rounded">
                                    <input value={newUpsell.description} onChange={e => setNewUpsell({...newUpsell, description: e.target.value})} placeholder="Description" className="flex-grow p-1 border rounded text-sm"/>
                                    <input type="number" value={newUpsell.costPrice} onChange={e => setNewUpsell({...newUpsell, costPrice: e.target.value})} placeholder="Cost" className="w-20 p-1 border rounded text-sm"/>
                                    <input type="number" value={newUpsell.salePrice} onChange={e => setNewUpsell({...newUpsell, salePrice: e.target.value})} placeholder="Sale" className="w-20 p-1 border rounded text-sm"/>
                                    <button onClick={handleAddUpsell} className="text-green-600"><CheckCircle size={18}/></button>
                                    <button onClick={() => setIsAddingUpsell(false)} className="text-red-600"><X size={18}/></button>
                                </div>
                            )}
                        </Section>

                        <Section title="Battery Charging Log" icon={BatteryCharging}>
                            <div className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2 mb-2">
                                {(formData.chargingHistory || []).map(event => (
                                    <div key={event.id} className="p-2 bg-gray-50 rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{allBatteryChargers.find(c => c.id === event.chargerId)?.name || 'Unknown Charger'}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(event.startDate).toLocaleString()} - {event.endDate ? new Date(event.endDate).toLocaleString() : 'Ongoing'}
                                            </p>
                                        </div>
                                        {event.endDate === null && (
                                            <button onClick={handleStopCharging} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded">Stop</button>
                                        )}
                                    </div>
                                ))}
                                {(!formData.chargingHistory || formData.chargingHistory.length === 0) && <p className="text-xs text-gray-500 text-center">No charging history.</p>}
                            </div>
                            <div className="pt-2 border-t">
                                {!activeChargingEvent && !isCharging && (
                                    <button onClick={() => setIsCharging(true)} className="flex items-center text-sm text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircle size={14} className="mr-1"/> Add Charging Event</button>
                                )}
                                {isCharging && (
                                    <div className="flex gap-2 items-center">
                                        <select value={selectedChargerId} onChange={e => setSelectedChargerId(e.target.value)} className="w-full p-1.5 border rounded text-sm">
                                            <option value="">-- Select Charger --</option>
                                            {entityChargers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button onClick={handleStartCharging} className="px-3 py-1.5 bg-green-500 text-white rounded text-sm">Start</button>
                                        <button onClick={() => setIsCharging(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
                                    </div>
                                )}
                            </div>
                        </Section>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg border shadow-sm sticky top-0">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><DollarSign size={18}/> Financial Summary</h3>
                            <FinancialsDisplay summary={financialSummary} saleType={formData.saleType} />
                            
                            <div className="mt-6 pt-4 border-t space-y-2">
                                {formData.status !== 'Sold' ? (
                                    <>
                                        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700">
                                            <Save size={18}/> Save Changes
                                        </button>
                                        <button onClick={() => setIsMarkingSold(true)} className="w-full bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700">
                                            <CheckCircle size={18}/> Finalize Sale
                                        </button>
                                    </>
                                ) : (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-green-800 font-bold flex items-center gap-2"><CheckCircle size={18}/> Sold on {formData.soldDate ? formatDate(new Date(formData.soldDate)) : 'Unknown Date'}</p>
                                        <button onClick={() => onViewInvoice(formData)} className="w-full mt-2 text-indigo-600 text-sm font-semibold flex items-center justify-center gap-1"><FileText size={14}/> View Sale Invoice</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={18}/> Documents</h3>
                            <div className="space-y-2">
                                {formData.saleType === 'Sale or Return' && (
                                    <>
                                        <button onClick={() => onOpenSorContract(formData)} className="w-full text-left p-2 text-sm hover:bg-gray-50 rounded border flex items-center gap-2"><FileText size={16} className="text-gray-400"/> SOR Contract</button>
                                        <button onClick={() => onOpenOwnerStatement(formData)} className="w-full text-left p-2 text-sm hover:bg-gray-50 rounded border flex items-center gap-2"><FileText size={16} className="text-gray-400"/> Owner Statement</button>
                                    </>
                                )}
                                <button onClick={() => onOpenInternalStatement(formData)} className="w-full text-left p-2 text-sm hover:bg-gray-50 rounded border flex items-center gap-2"><FileText size={16} className="text-gray-400"/> Internal Deal Sheet</button>
                            </div>
                        </div>
                    </div>
                </main>

                {isMarkingSold && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center p-4">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
                            <h3 className="text-lg font-bold mb-4">Finalize Sale</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Final Sale Price</label>
                                    <input type="number" value={soldData.finalSalePrice} onChange={e => setSoldData({...soldData, finalSalePrice: e.target.value})} className="w-full p-2 border rounded" placeholder="0.00"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Buyer (Customer)</label>
                                    <SearchableSelect 
                                        options={customers.map(c => ({
                                            id: c.id, 
                                            label: `${(c as any).firstName || ''} ${(c as any).lastName || ''}`.trim() || (c as any).email || 'Unknown Customer'
                                        }))} 
                                        value={soldData.buyerCustomerId} 
                                        onChange={(val) => setSoldData({...soldData, buyerCustomerId: val || ''})} 
                                        placeholder="Select buyer..." 
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={confirmSold} disabled={!soldData.buyerCustomerId || !soldData.finalSalePrice} className="flex-grow bg-green-600 text-white py-2 rounded font-bold disabled:opacity-50">Confirm Sold</button>
                                    <button onClick={() => setIsMarkingSold(false)} className="flex-grow bg-gray-200 text-gray-800 py-2 rounded font-bold">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageSaleVehicleModal;
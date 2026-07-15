import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from '../core/utils/cloudSpeech';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Estimate, Customer, Vehicle, BusinessEntity, TaxRate, ServicePackage, Part, EstimateLineItem, Job, User, CheckInPhoto, Supplier, DiscountCode } from '../types';
import { Save, PlusCircle, Gauge, Info, FileText, ChevronUp, ChevronDown, Trash2, X, TrendingUp, Plus, Image as ImageIcon, History, Car, Wand2, Expand, Edit, Volume2, Tag, Film } from 'lucide-react';
import { formatDate, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import { generateEstimateNumber } from '../core/utils/numberGenerators';
import { formatCurrency } from '../utils/formatUtils';
import { db } from '../core/services/firebaseServices';
import { doc, getDoc } from 'firebase/firestore';
import { updateEstimateWithAI } from '../core/services/geminiService';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import SearchableSelect from './SearchableSelect';
import FormModal from './FormModal';
import MediaManagerModal from './MediaManagerModal';
import PartFormModal from './PartFormModal';
import LiveAssistant from './LiveAssistant';
import { getScoredServicePackages } from '../utils/servicePackageScoring';
import SupplierSelectionModal from './SupplierSelectionModal';
import { calculatePackagePrices } from '../core/utils/packageUtils';
import { HoverInfo } from './shared/HoverInfo';
import LookupModal from './LookupModal';
import { AddressDetails } from '../services/postcodeLookupService';
import SpeechToTextButton from './shared/SpeechToTextButton';
import { findBestVoice, prepareTextForSpeech } from '../core/utils/speechUtils';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import AsyncImage from './AsyncImage';
import AsyncMedia from './AsyncMedia';

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

    if (isPackageHeader) {
        return (
            <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-indigo-50 border-indigo-200 transition-all hover:shadow-md mb-2`}>
                <div className="col-span-5 flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={item.isOptional || false} 
                        onChange={e => onLineItemChange(item.id, 'isOptional', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                        title="Mark Package as Optional"
                    />
                    <div className="bg-indigo-600 text-white text-[10px] uppercase font-black px-1.5 py-0.5 rounded shadow-sm">Pkg</div>
                    <div className="w-full flex flex-col gap-1">
                        <input 
                            type="text" 
                            value={item.description || ''} 
                            onChange={e => onLineItemChange(item.id, 'description', e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 font-bold text-indigo-900 placeholder:text-indigo-300"
                            placeholder="Package Description"
                        />
                        {item.isOptional && (
                            <div className="flex gap-1 pl-1">
                                <input 
                                    type="text" 
                                    placeholder="Group (e.g. EXHAUST)" 
                                    value={item.optionGroupId || ''} 
                                    onChange={e => onLineItemChange(item.id, 'optionGroupId', e.target.value)} 
                                    className="w-1/2 p-1 border border-indigo-200 rounded text-[10px] bg-indigo-50 font-bold" 
                                    title="Items with same Group ID are mutually exclusive"
                                />
                                <input 
                                    type="text" 
                                    placeholder="Label (e.g. Option 1)" 
                                    value={item.optionLabel || ''} 
                                    onChange={e => onLineItemChange(item.id, 'optionLabel', e.target.value)} 
                                    className="w-1/2 p-1 border border-slate-200 rounded text-[10px] bg-slate-50" 
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="col-span-1">
                    <input 
                        type="number" 
                        step="0.1" 
                        value={item.quantity} 
                        onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} 
                        className="w-full p-1 border border-indigo-100 rounded text-right text-sm bg-white" 
                    />
                </div>
                <div className="col-span-2 text-center text-[10px] text-indigo-400 font-bold uppercase tracking-widest bg-white/50 py-1 rounded">Package Total</div>
                <div className="col-span-2">
                    <input 
                        type="number" 
                        step="0.01" 
                        value={item.unitPrice} 
                        onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} 
                        className="w-full p-1 border border-indigo-100 rounded text-right text-sm bg-white font-bold text-indigo-800" 
                        placeholder="Sell" 
                    />
                </div>
                <div className="col-span-1 text-center text-xs text-indigo-500 font-medium">
                     {item.taxCodeId === 'tax_99' ? 'Mix' : 'T1'}
                </div>
                <div className="col-span-1 flex justify-center items-center gap-1">
                    <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 bg-white p-1 rounded-full shadow-sm hover:shadow transition-all"><Trash2 size={14} /></button>
                </div>
            </div>
        );
    }

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
                        disabled={item.isLabor} 
                    />
                    <div className="relative w-full">
                        <textarea 
                            placeholder="Description" 
                            value={item.description || ''} 
                            onChange={handleDescriptionChange}
                            onFocus={() => {
                                if (!item.isLabor && !isPackageComponent) {
                                    onSetActivePartSearch(item.id);
                                    onPartSearchChange(item.description || '');
                                }
                            }}
                            onBlur={() => setTimeout(() => onSetActivePartSearch(null), 150)}
                            rows={1}
                            style={{ whiteSpace: 'pre-wrap', minHeight: '38px' }}
                            className="w-full p-1 border rounded disabled:bg-gray-200 text-sm resize-y-none overflow-hidden"
                            disabled={false} 
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
                    {item.isOptional && !isPackageComponent && (
                        <div className="flex gap-1">
                            <input 
                                type="text" 
                                placeholder="Group (e.g. EXHAUST)" 
                                value={item.optionGroupId || ''} 
                                onChange={e => onLineItemChange(item.id, 'optionGroupId', e.target.value)} 
                                className="w-1/2 p-1 border border-indigo-200 rounded text-[10px] bg-indigo-50 font-bold" 
                                title="Items with same Group ID are mutually exclusive"
                            />
                            <input 
                                type="text" 
                                placeholder="Label (e.g. Option 1)" 
                                value={item.optionLabel || ''} 
                                onChange={e => onLineItemChange(item.id, 'optionLabel', e.target.value)} 
                                className="w-1/2 p-1 border border-slate-200 rounded text-[10px] bg-slate-50" 
                            />
                        </div>
                    )}
                </div>
            </div>
            <input type="number" step="0.1" value={item.quantity} onChange={e => onLineItemChange(item.id, 'quantity', e.target.value)} className="col-span-1 p-1 border rounded text-right text-sm" />
            <input type="number" step="0.01" value={item.unitCost || ''} onChange={e => onLineItemChange(item.id, 'unitCost', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Cost" />
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => onLineItemChange(item.id, 'unitPrice', e.target.value)} className="col-span-2 p-1 border rounded text-right text-sm" placeholder="Sell" />
            <div className="col-span-1">
                <button 
                    type="button" 
                    onClick={() => onOpenSupplierSelection(item.id)} 
                    className="w-full p-1 border rounded text-sm text-center hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed h-full" 
                    disabled={item.isLabor}
                >
                    {supplierShortCode}
                </button>
            </div>
            <div className="col-span-1 flex justify-center items-center gap-1">
                <button onClick={() => onRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"><Trash2 size={14} /></button>
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
    const { preferredVoiceName } = useApp();
    const [localNotes, setLocalNotes] = useState(notes);
    const [voices, setVoices] = useState<any[]>([]);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = cloudSpeechSynthesis.getVoices();
            if (availableVoices.length > 0) setVoices(availableVoices);
        };
        loadVoices();
        cloudSpeechSynthesis.onvoiceschanged = loadVoices;
        return () => { cloudSpeechSynthesis.onvoiceschanged = null; };
    }, []);

    useEffect(() => {
        setLocalNotes(notes);
    }, [notes, isOpen]);

    const handleSave = () => {
        onSave(localNotes);
        onClose();
    };

    const handleSpeak = () => {
        cloudSpeechSynthesis.cancel();
        if (!localNotes) return;

        const plainText = prepareTextForSpeech(localNotes);
        if (!plainText) return;

        const selectedVoice = findBestVoice(voices, { 
            gender: 'female', 
            lang: 'en-GB',
            preferredVoiceName 
        });

        const utterance = new CloudSpeechSynthesisUtterance(plainText);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.lang = 'en-GB';
        utterance.pitch = 0.95; // Softer/Calmer
        utterance.rate = 0.95;  // More charismatic/deliberate
        utterance.volume = 1.0;
        cloudSpeechSynthesis.speak(utterance);
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-gray-800">Edit Notes</h2>
                        <div className="flex items-center gap-2 border-l pl-4">
                            <SpeechToTextButton 
                                onTranscript={(text) => {
                                    const current = localNotes || '';
                                    const space = current && !current.endsWith(' ') ? ' ' : '';
                                    setLocalNotes(current + space + text);
                                }}
                                className="!bg-white !shadow-sm hover:!bg-indigo-50 border border-gray-200"
                            />
                            <button
                                type="button"
                                onClick={handleSpeak}
                                className="p-2 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-indigo-50 text-indigo-600 transition-all active:scale-90"
                                title="Read Aloud"
                            >
                                <Volume2 size={18} />
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                </header>
                <div className="flex-grow p-4 relative">
                    <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        className="w-full h-full p-4 border rounded-xl resize-none text-base focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50"
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
    discountCodes?: DiscountCode[];
}

const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ 
    isOpen, onClose, onSave, estimate, jobContext, customers, onSaveCustomer, 
    vehicles, onSaveVehicle, businessEntities, taxRates, servicePackages, parts, 
    estimates, currentUser, selectedEntityId, onSavePart, suppliers, discountCodes
}) => {
    const [formData, setFormData] = useState<Partial<Estimate>>({ 
        lineItems: [], customerId: '', vehicleId: '', entityId: '', issueDate: '', expiryDate: '', status: 'Draft', notes: '', discountCodeId: ''
    });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [isAddingPart, setIsAddingPart] = useState(false);
    const [newPart, setNewPart] = useState<Part | null>(null);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const { inquiries, saveRecord } = useData();
    const [targetLineItemId, setTargetLineItemId] = useState<string | null>(null);

    const relatedInquiries = useMemo(() => {
        if (!formData.id) return [];
        return inquiries.filter(inq => inq.linkedEstimateId === formData.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [inquiries, formData.id]);

    useEffect(() => {
        if (isOpen && formData.id && formData.hasNewReply) {
            // Clear new reply flag when opening the modal
            saveRecord('estimates', { ...formData, hasNewReply: false } as Estimate);
        }
    }, [isOpen, formData.id, formData.hasNewReply]);
    const [lineItemForSupplier, setLineItemForSupplier] = useState<string | null>(null);
    const [newPartDescription, setNewPartDescription] = useState('');
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [isSupplierSelectionOpen, setIsSupplierSelectionOpen] = useState(false);
    const [activePartSearch, setActivePartSearch] = useState<string | null>(null);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [showAllEntities, setShowAllEntities] = useState(false);
    const [packageSearchTerm, setPackageSearchTerm] = useState('');
    const [isAIUpdating, setIsAIUpdating] = useState(false);
    
    const handleAIUpdate = async () => {
        if (!formData.linkedInquiryId) {
            toast.error("This estimate is not linked to an inquiry.");
            return;
        }
        setIsAIUpdating(true);
        try {
            const inquiryDoc = await getDoc(doc(db, 'brooks_inquiries', formData.linkedInquiryId));
            if (!inquiryDoc.exists()) {
                toast.error("Linked inquiry not found.");
                setIsAIUpdating(false);
                return;
            }
            const inquiryData = inquiryDoc.data();
            const message = inquiryData.message || '';
            const logs = inquiryData.logs || [];
            
            const updatedItems = await updateEstimateWithAI(formData.lineItems || [], message, logs);
            
            // Ensure any new items get a unique ID if they don't have one
            const parsedItems = updatedItems.map(item => ({
                ...item,
                id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                taxCodeId: item.taxCodeId || taxRates[0]?.id || ''
            }));
            
            setFormData(prev => ({ ...prev, lineItems: parsedItems }));
            toast.success("Estimate updated by AI successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to update estimate via AI.");
        } finally {
            setIsAIUpdating(false);
        }
    };

    const [hasToastedNoMatch, setHasToastedNoMatch] = useState(false);

    const [discountCodeInput, setDiscountCodeInput] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
    const [discountError, setDiscountError] = useState<string | null>(null);

    const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
    const [lookupTarget, setLookupTarget] = useState<'customer' | 'vehicle' | null>(null);
    const [initialVehicleData, setInitialVehicleData] = useState<Partial<Vehicle> | null>(null);
    const [initialCustomerData, setInitialCustomerData] = useState<Partial<Customer> | null>(null);

    const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;
    const t99RateId = taxRates.find(t => t.code === 'T99')?.id;

    useEffect(() => {
        if (!isOpen) return;

        setFormData(prev => {
            if (estimate && Object.keys(estimate).length > 0) {
                // If we are already editing this estimate, don't overwrite local changes with background syncs
                if (prev && prev.id === estimate.id) return prev;
                return JSON.parse(JSON.stringify(estimate));
            } else {
                // Only reset if we don't have a partial form or the jobId context has changed
                // We also allow reset if entityId is missing to ensure it gets the default from selectedEntityId
                if (prev && !prev.id && prev.entityId && (jobContext ? prev.jobId === jobContext.id : true)) return prev;

                const initialEntity = (selectedEntityId && selectedEntityId !== 'all')
                    ? selectedEntityId
                    : (businessEntities.length > 0 ? businessEntities[0].id : '');
                return {
                    customerId: '', vehicleId: '',
                    entityId: initialEntity,
                    issueDate: getTodayISOString(), expiryDate: getFutureDateISOString(30),
                    status: 'Draft', lineItems: [], notes: '', createdByUserId: currentUser.id,
                    jobId: jobContext?.id || ''
                };
            }
        });
        setAppliedDiscount(null);
        setDiscountCodeInput('');
        setDiscountError(null);
    }, [estimate, isOpen, businessEntities, selectedEntityId, currentUser.id, jobContext]);

    const handleApplyDiscount = () => {
        const codes = discountCodes || [];
        const code = codes.find(d => d.code === discountCodeInput && d.isActive);
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
        if (appliedDiscount.type === 'Fixed' || appliedDiscount.discountType === 'Fixed') return Math.min(appliedDiscount.value, eligibleTotal);
        return eligibleTotal * (appliedDiscount.value / 100);
    }, [appliedDiscount, formData.lineItems]);

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

        const discountVal = calculateDiscountAmount();
        
        if (discountVal > 0 && standardTaxRateId && breakdown[standardTaxRateId]) {
            breakdown[standardTaxRateId].net -= discountVal;
            const taxRateObj = taxRatesMap.get(standardTaxRateId);
            if (taxRateObj && taxRateObj.rate > 0) {
                breakdown[standardTaxRateId].vat -= discountVal * (Number(taxRateObj.rate) / 100);
            }
        }

        const finalVatBreakdownOriginal = Object.values(breakdown).map(b => ({...b})); // clone to avoid mutation reference issues
        
        const finalVatBreakdown = Object.values(breakdown);
        const currentTotalNet = finalVatBreakdown.reduce((sum, b) => sum + b.net, 0) + discountVal; // Display pre-discount net as TotalNet
        const discountedTotalNet = finalVatBreakdown.reduce((sum, b) => sum + b.net, 0); // Used for grand total
        const totalVat = finalVatBreakdown.reduce((sum, b) => sum + b.vat, 0);
        const grandTotal = discountedTotalNet + totalVat;
        
        const profit = discountedTotalNet - totalCost;
        const margin = discountedTotalNet > 0 ? (profit / discountedTotalNet) * 100 : 0;

        return {
            totalNet: currentTotalNet,
            grandTotal,
            vatBreakdown: finalVatBreakdown.filter(b => b.net > 0 || b.vat > 0),
            totalCost,
            totalProfit: profit,
            profitMargin: margin,
            discountAmount: discountVal
        };
    }, [formData.lineItems, taxRates, standardTaxRateId, t99RateId, calculateDiscountAmount]);

    const currentCustomer = customers.find(c => c.id === formData.customerId);
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

    // Compute matches for current branch vs other branches
    const matchingPackagesResult = useMemo(() => {
        const term = packageSearchTerm.toLowerCase().trim();
        const allPkgs = Array.isArray(servicePackages) ? servicePackages : [];
        const currentPkgs = allPkgs.filter(p => !p.entityId || p.entityId === formData.entityId);
        const otherPkgs = allPkgs.filter(p => p.entityId && p.entityId !== formData.entityId);
        
        if (showAllEntities) {
            return {
                packages: allPkgs,
                isShowingOthers: false
            };
        }
        
        if (!term) {
            const currentScored = getScoredServicePackages(currentPkgs, currentVehicle);
            const currentVehicleMatches = currentScored.filter(res => res.status !== 'other' && res.status !== 'generic');
            
            if (currentVehicleMatches.length > 0) {
                return {
                    packages: currentPkgs,
                    isShowingOthers: false
                };
            }
            
            const otherScored = getScoredServicePackages(otherPkgs, currentVehicle);
            const otherVehicleMatches = otherScored.filter(res => res.status !== 'other' && res.status !== 'generic');
            
            if (otherVehicleMatches.length > 0) {
                return {
                    packages: [...currentPkgs, ...otherVehicleMatches.map(res => res.pkg)],
                    isShowingOthers: true
                };
            }
            
            return {
                packages: currentPkgs,
                isShowingOthers: false
            };
        }
        
        const matchedCurrent = currentPkgs.filter(p => 
            (p.name || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term)
        );
        
        if (matchedCurrent.length > 0) {
            return {
                packages: matchedCurrent,
                isShowingOthers: false
            };
        }
        
        const matchedOthers = otherPkgs.filter(p => 
            (p.name || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term)
        );
        
        if (matchedOthers.length > 0) {
            return {
                packages: matchedOthers,
                isShowingOthers: true
            };
        }
        
        return {
            packages: [],
            isShowingOthers: false
        };
    }, [servicePackages, formData.entityId, showAllEntities, packageSearchTerm, currentVehicle]);

    // Handle toast notification when cross-entity packages are exposed
    useEffect(() => {
        if (!matchingPackagesResult.isShowingOthers) {
            setHasToastedNoMatch(false);
        }
    }, [matchingPackagesResult.isShowingOthers]);

    useEffect(() => {
        if (matchingPackagesResult.isShowingOthers && !hasToastedNoMatch) {
            const message = packageSearchTerm 
                ? "No matching package found for this branch. Showing results from other branches."
                : "No packages matching this vehicle found for this branch. Showing matching options from other branches.";
            toast.info(message);
            setHasToastedNoMatch(true);
        }
    }, [matchingPackagesResult.isShowingOthers, packageSearchTerm, hasToastedNoMatch]);

    const sortedPackages = useMemo(() => {
        const pkgs = matchingPackagesResult.packages;
        
        if (!currentVehicle) {
            return pkgs.map(pkg => {
                let badgeText = 'Generic';
                let badgeColor = 'bg-gray-100 text-gray-800';
                
                if (pkg.entityId && pkg.entityId !== formData.entityId) {
                    const branch = businessEntities.find(e => e.id === pkg.entityId);
                    const branchName = branch?.shortCode || branch?.name || 'Other';
                    badgeText = `Generic (${branchName})`;
                    badgeColor = 'bg-orange-100 text-orange-800 border border-orange-200';
                }
                
                return {
                    id: pkg.id,
                    value: pkg.id,
                    label: pkg.name || 'Unnamed Package',
                    description: pkg.description || 'Service Package',
                    badge: { text: badgeText, className: badgeColor }
                };
            });
        }
        
        const scoredResults = getScoredServicePackages(pkgs, currentVehicle);
        return scoredResults.map(({ pkg, matchType, color }) => {
            let badgeText = matchType;
            let badgeColor = color;
            
            if (pkg.entityId && pkg.entityId !== formData.entityId) {
                const branch = businessEntities.find(e => e.id === pkg.entityId);
                const branchName = branch?.shortCode || branch?.name || 'Other';
                badgeText = `${matchType} (${branchName})`;
                badgeColor = 'bg-orange-100 text-orange-800 border border-orange-200';
            }
            
            return {
                id: pkg.id,
                value: pkg.id,
                label: pkg.name || 'Unnamed Package',
                description: pkg.description || 'Service Package',
                badge: { text: badgeText, className: badgeColor }
            };
        });
    }, [matchingPackagesResult.packages, currentVehicle, formData.entityId, businessEntities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleCustomerSelect = (selection: any) => {
        const customerId = selection?.value || selection?.id || selection;
        let customer = customers.find(c => c.id === customerId);
        if (!customer && typeof selection === 'object' && selection.id) {
            customer = selection;
        }
        if (!customer) return;

        setRecentCustomerIds(prev => [customer.id, ...prev.filter(id => id !== customer.id)].slice(0, 3));

        setFormData(prev => {
            const customersCars = vehicles.filter(v => v.customerId === customer.id);
            let newVehicleId = prev.vehicleId;

            if (!newVehicleId || !customersCars.some(car => car.id === newVehicleId)) {
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

            if (['quantity', 'unitPrice', 'unitCost'].includes(field as string)) {
                // Allow empty strings so the user can clear the input for typing
                processedValue = value === '' ? '' : (Number(value) || 0);
            }

            let updatedLineItems = lineItems.map(item =>
                item.id === id
                    ? { ...item, [field]: processedValue }
                    : item
            );

            if (targetItem.isPackageComponent && targetItem.servicePackageId && ['quantity', 'unitPrice'].includes(field as string)) {
                const pkgId = targetItem.servicePackageId;
                const packageNetTotal = updatedLineItems
                    .filter(item => item.servicePackageId === pkgId && item.isPackageComponent)
                    .reduce((sum, item) => {
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.unitPrice) || 0;
                        return sum + (qty * price);
                    }, 0);

                updatedLineItems = updatedLineItems.map(item =>
                    item.servicePackageId === pkgId && !item.isPackageComponent
                        ? { ...item, unitPrice: packageNetTotal }
                        : item
                );
            }

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

    const handlePackageSelect = (packageId: string | null) => {
        if (packageId) {
            const pkg = servicePackages.find(p => p.id === packageId);
            if (pkg) {
                setSelectedPackage(pkg);
            }
        }
    };

    const addPackage = (pkg: ServicePackage) => {
        if (!pkg) return;
        const isOptional = false;
        const { net, vat } = calculatePackagePrices(pkg, taxRates);
    
        const newItems: EstimateLineItem[] = [];
        const mainPackageItem: EstimateLineItem = {
            id: crypto.randomUUID(),
            description: pkg.name || (pkg as any).description || '',
            quantity: 1,
            unitPrice: net,
            unitCost: 0,
            isLabor: false,
            taxCodeId: pkg.taxCodeId || standardTaxRateId,
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            isPackageComponent: false,
            isOptional,
            preCalculatedVat: pkg.taxCodeId === t99RateId ? vat : undefined
        };
        newItems.push(mainPackageItem);
    
        if (pkg.costItems) {
            pkg.costItems.forEach(costItem => {
                const part = (costItem.partId ? (parts || []).find(p => p.id === costItem.partId) : null) || (costItem.partNumber ? (parts || []).find(p => p.partNumber === costItem.partNumber) : null);
                newItems.push({ 
                    ...costItem, 
                    id: crypto.randomUUID(),
                    unitPrice: costItem.unitPrice || 0,
                    unitCost: part ? part.costPrice : costItem.unitCost,
                    partId: part ? part.id : costItem.partId,
                    servicePackageId: pkg.id,
                    servicePackageName: pkg.name,
                    isPackageComponent: true,
                    isOptional,
                    supplierId: part?.defaultSupplierId || costItem.supplierId,
                    fromStock: costItem.fromStock ?? (part?.isStockItem && part.stockQuantity > 0)
                });
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
        let finalLineItems = [...(formData.lineItems || [])];
        if (appliedDiscount && totals.discountAmount > 0) {
            finalLineItems.push({
                id: crypto.randomUUID(),
                description: `Discount: ${appliedDiscount.code} - ${appliedDiscount.description}`,
                quantity: 1,
                unitPrice: -totals.discountAmount,
                unitCost: 0,
                isLabor: false,
                taxCodeId: standardTaxRateId,
                partNumber: 'DISCOUNT'
            } as EstimateLineItem);
        }

        onSave({ 
            id: formData.id || `est_${Date.now()}`,
            estimateNumber: formData.estimateNumber || generateEstimateNumber(estimates, entityShortCode), 
            ...formData,
            discountCodeId: appliedDiscount ? appliedDiscount.id : formData.discountCodeId,
            lineItems: finalLineItems
        } as Estimate);
        onClose();
    };
    
    const handleManageMedia = () => setIsMediaModalOpen(true);
    const handleSaveMedia = (media: CheckInPhoto[]) => {
        setFormData(prev => ({ ...prev, media }));
    };
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

    const customerInfoData = currentCustomer ? {
        phone: currentCustomer.phone || currentCustomer.mobile,
        email: currentCustomer.email,
        address: `${currentCustomer.addressLine1 || ''}, ${currentCustomer.postcode || ''}`.replace(/^,|,$/g, '').trim(),
        company: currentCustomer.companyName,
    } : {};

    const vehicleInfoData = currentVehicle ? {
        type: `${currentVehicle.year || ''} ${currentVehicle.make || ''} ${currentVehicle.model || ''}`.trim(),
        colour: currentVehicle.colour,
        'Year of Manufacture': currentVehicle.manufactureDate,
        vin: currentVehicle.vin,
        motDue: currentVehicle.nextMotDate,
    } : {};

    const handleOpenLookup = (target: 'customer' | 'vehicle') => {
        setLookupTarget(target);
        setIsLookupModalOpen(true);
    };

    const handleVehicleFound = (vehicleData: Partial<Vehicle>) => {
        setInitialVehicleData(vehicleData);
        setIsAddingVehicle(true);
        setIsLookupModalOpen(false);
    };

    const handleAddressFound = (addresses: AddressDetails[]) => {
        if (addresses.length > 0) {
            const address = addresses[0];
            const customerData: Partial<Customer> = {
                addressLine1: address.street || '',
                city: address.postTown || '',
                county: address.county || '',
                postcode: address.postcode || '',
            } as any;
            setInitialCustomerData(customerData);
            setIsAddingCustomer(true);
        } else {
            handleManualEntry();
        }
        setIsLookupModalOpen(false);
    };
    
    const handleManualEntry = () => {
        setIsLookupModalOpen(false);
        if (lookupTarget === 'customer') {
            setInitialCustomerData(null);
            setIsAddingCustomer(true);
        } else if (lookupTarget === 'vehicle') {
            setInitialVehicleData(null);
            setIsAddingVehicle(true);
        }
    };

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
                                <label className="font-semibold flex items-center gap-2">Customer
                                    {currentCustomer && (
                                        <HoverInfo title="Customer Info" data={customerInfoData}>
                                            <Info size={14} className="text-indigo-500 cursor-help" />
                                        </HoverInfo>
                                    )}
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                    <SearchableSelect
                                        options={customerOptions}
                                        onSelect={handleCustomerSelect}
                                        defaultValue={formData.customerId}
                                        placeholder="Search name, phone or postcode..."
                                    />
                                    <button type="button" onClick={() => handleOpenLookup('customer')} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0"><Plus size={20} /></button>
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
                                <label className="font-semibold flex items-center gap-2">Vehicle (Optional)
                                    {currentVehicle && (
                                        <HoverInfo title="Vehicle Info" data={vehicleInfoData}>
                                            <Info size={14} className="text-indigo-500 cursor-help" />
                                        </HoverInfo>
                                    )}
                                </label>
                                <div className="flex flex-col gap-2 mt-1">
                                    <div className="flex items-center gap-2">
                                        <SearchableSelect
                                            options={vehicleOptions}
                                            onSelect={handleVehicleSelect}
                                            defaultValue={formData.vehicleId}
                                            placeholder="Search registration or make..."
                                        />
                                        <button type="button" onClick={() => handleOpenLookup('vehicle')} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex-shrink-0"><Plus size={20} /></button>
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
                            <div className="pt-2 border-t mt-2">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div className="bg-gray-50 p-2 rounded-lg border flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="font-semibold text-sm">Internal Notes</label>
                                        <button type="button" onClick={() => setIsNotesModalOpen(true)} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><Expand size={14}/> Expand</button>
                                    </div>
                                    <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full p-2 border rounded text-sm flex-1 min-h-[120px] bg-white" placeholder="Internal notes..." />
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg border flex flex-col h-full min-h-[160px]">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="font-semibold text-sm">Photos & Videos</label>
                                        <button type="button" onClick={handleManageMedia} className="text-xs bg-white border border-gray-300 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 shadow-sm"><ImageIcon size={14}/> Manage Media</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto bg-white border rounded p-2">
                                        {formData.media && formData.media.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                {formData.media.map((m: any, idx: number) => (
                                                    <div key={idx} className="relative aspect-square border rounded overflow-hidden group bg-gray-100 flex items-center justify-center cursor-pointer" onClick={handleManageMedia}>
                                                        {m.type === 'video' ? (
                                                            <div className="flex flex-col items-center justify-center text-gray-400">
                                                                <Film size={20} />
                                                            </div>
                                                        ) : (
                                                            <AsyncImage imageId={m.id} className="w-full h-full object-cover" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-4" onClick={handleManageMedia}>
                                                <ImageIcon size={32} className="mb-2 opacity-30 cursor-pointer hover:opacity-50 transition" />
                                                <span className="text-xs">No media attached</span>
                                                <button type="button" className="text-indigo-600 text-xs font-semibold mt-1 hover:underline">Click to upload</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                                      {formData.linkedInquiryId && (
                                          <button 
                                              onClick={handleAIUpdate} 
                                              disabled={isAIUpdating}
                                              className="flex items-center text-sm text-fuchsia-600 font-semibold hover:text-fuchsia-800 disabled:opacity-50 ml-2"
                                              title="Update line items using AI based on the customer inquiry"
                                          >
                                              <Wand2 size={16} className={`mr-1 ${isAIUpdating ? 'animate-spin' : ''}`} /> 
                                              {isAIUpdating ? 'Updating...' : 'AI Update'}
                                          </button>
                                      )}
                                   </div>
                                 <div className="flex items-center gap-2">
                                     <SearchableSelect 
                                         options={sortedPackages}
                                         onSelect={handlePackageSelect}
                                         placeholder="Search & Add Package..." 
                                         dropdownClassName="min-w-[450px] right-0" 
                                         onSearchChange={setPackageSearchTerm}
                                     />
                                     <label className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-gray-500 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={showAllEntities} 
                                            onChange={(e) => setShowAllEntities(e.target.checked)}
                                            className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                        />
                                        Show All
                                     </label>
                                 </div>
                            </div>
                        </div>
                    </Section>
                                  
                     <Section title="Totals Summary" icon={Gauge}>
                        <div className="w-full text-sm space-y-1">
                             <div className="flex justify-between text-gray-600"><span>Total Cost Price:</span><span>{formatCurrency(totals.totalCost)}</span></div>
                             <div className="flex justify-between text-gray-600"><span>Total Sale Price (Net):</span><span>{formatCurrency(totals.totalNet)}</span></div>
                             {totals.discountAmount > 0 && (
                                 <div className="flex justify-between text-sm font-medium text-green-600">
                                     <span className="flex items-center gap-1"><Tag size={12}/> Discount</span>
                                     <span>-{formatCurrency(totals.discountAmount)}</span>
                                 </div>
                             )}
                             <div className={`flex justify-between font-bold ${totals.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}><span>Total Profit:</span><span>{formatCurrency(totals.totalProfit)}</span></div>
                            <div className="flex justify-between text-gray-600 border-b pb-2 mb-2"><span>Profit Margin:</span><span>{totals.profitMargin.toFixed(1)}%</span></div>
                            {totals.vatBreakdown.map(b => (<div key={b.name} className="flex justify-between text-gray-500 text-xs"><span>{b.rate === 'Mixed' ? b.name : `VAT @ ${b.rate}%`}</span><span>{formatCurrency(b.vat)}</span></div>))}
                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
                        </div>
                    </Section>

                    {relatedInquiries.length > 0 && (
                        <Section title="Booking Requests & Communications" icon={History} defaultOpen={false}>
                            <div className="p-4 bg-gray-50 flex flex-col gap-3 max-h-80 overflow-y-auto">
                                {relatedInquiries.map(inq => (
                                    <div key={inq.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-sm text-gray-800">{inq.fromName || inq.fromContact}</div>
                                            <div className="text-xs text-gray-500">{formatDate(new Date(inq.createdAt))}</div>
                                        </div>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{inq.message || inq.actionNotes}</div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
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

            {isLookupModalOpen && lookupTarget && (
                <LookupModal
                    isOpen={isLookupModalOpen}
                    onClose={() => setIsLookupModalOpen(false)}
                    onVehicleFound={handleVehicleFound}
                    onAddressFound={handleAddressFound}
                    onManualEntry={handleManualEntry}
                    lookupType={lookupTarget === 'customer' ? 'postcode' : 'vrm'}
                />
            )}

            {isAddingCustomer && (
                <CustomerFormModal 
                    isOpen={isAddingCustomer} 
                    onClose={() => {
                        setIsAddingCustomer(false);
                        setInitialCustomerData(null);
                    }} 
                    onSave={(newCustomer) => { 
                        onSaveCustomer(newCustomer); 
                        handleCustomerSelect(newCustomer); 
                        setIsAddingCustomer(false); 
                        setInitialCustomerData(null);
                    }} 
                    customer={initialCustomerData}
                    existingCustomers={customers}
                    jobs={[]}
                    vehicles={[]}
                    estimates={[]}
                    invoices={[]}
                    onViewVehicle={(vehicleId, customerId) => {
                        setIsAddingCustomer(false);
                        setInitialCustomerData(null);
                        setFormData(prev => ({...prev, customerId}));
                        setInitialVehicleData(null);
                        setIsAddingVehicle(true);
                    }}
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
                    onClose={() => {
                        setIsAddingVehicle(false);
                        setInitialVehicleData(null);
                    }}
                    onSave={(newVehicle) => {
                        onSaveVehicle(newVehicle);
                        setFormData(prev => ({
                            ...prev,
                            vehicleId: newVehicle.id,
                            customerId: newVehicle.customerId || prev.customerId
                        }));
                        setIsAddingVehicle(false);
                        setInitialVehicleData(null);
                    }}
                    onSaveWithCustomer={(customer, vehicle) => {
                        handleSaveCustomerAndVehicle(customer, vehicle);
                        setInitialVehicleData(null);
                    }}
                    vehicle={initialVehicleData}
                    customers={customers}
                    vehicles={vehicles}
                    initialCustomerId={formData.customerId} 
                    onSaveCustomer={onSaveCustomer}
                />
            )}
        </FormModal>
    );
};

export default EstimateFormModal;

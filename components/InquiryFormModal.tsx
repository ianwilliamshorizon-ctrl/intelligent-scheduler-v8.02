import React, { useState, useEffect } from 'react';
import { Inquiry, User, Customer, Vehicle, Estimate, PurchaseOrder } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../core/state/AppContext';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { Wand2, Loader2, Link as LinkIcon, UserCheck, Car, XCircle, User as UserIcon, FileText, CalendarCheck, Edit, Camera, PlusCircle } from 'lucide-react';
import { parseInquiryMessage, generateEmailReply, updateEstimateWithAI } from '../core/services/geminiService';
import { sendOutboundEmail } from '../core/services/emailService';
import { useData } from '../core/state/DataContext';
import { generateInquiryNumber } from '../core/utils/numberGenerators';
import { toast } from 'react-toastify';

interface InquiryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (inquiry: Inquiry, closeModal?: boolean) => void;
    inquiry: Partial<Inquiry> | null;
    users: User[];
    customers: Customer[];
    vehicles: Vehicle[];
    estimates: Estimate[];
    onViewEstimate?: (estimate: Estimate) => void;
    onScheduleEstimate?: (estimate: Estimate, inquiryId?: string) => void; 
    onOpenPurchaseOrder?: (po: PurchaseOrder) => void;
    onEditEstimate?: (estimate: Estimate) => void;
    updateEstimate?: (estimate: Estimate) => void;
    onAddNewCustomer?: () => void;
    onCreateNewEstimate?: (inquiry: Inquiry) => void;
    onSmartCreateEstimate?: (inquiry: Inquiry, prompt: string) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewVehicle?: (vehicleId: string) => void;
}

// FIXED: Added updateEstimate to the destructuring list below
const InquiryFormModal: React.FC<InquiryFormModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    inquiry, 
    users, 
    customers, 
    vehicles, 
    estimates, 
    onViewEstimate, 
    onScheduleEstimate, 
    onEditEstimate,
    updateEstimate,
    onAddNewCustomer,
    onCreateNewEstimate,
    onSmartCreateEstimate,
    onViewCustomer,
    onViewVehicle
}) => {
    const { currentUser, selectedEntityId, businessEntities: entities } = useApp();
    const { purchaseOrders, inquiries } = useData();
    const [formData, setFormData] = useState<Partial<Inquiry>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isUpdatingAI, setIsUpdatingAI] = useState(false);
    const [suggestedCustomer, setSuggestedCustomer] = useState<Customer | null>(null);
    const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null);

    // Reply state
    const [replyText, setReplyText] = useState('');
    const [isDraftingReply, setIsDraftingReply] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'communication' | 'estimates'>('details');

    // Split Name states
    const [firstNameInput, setFirstNameInput] = useState('');
    const [surnameInput, setSurnameInput] = useState('');

    useEffect(() => {
        const parts = (formData.fromName || '').split(' ');
        const derivedFirst = parts[0] || '';
        const derivedSurname = parts.slice(1).join(' ') || '';
        
        const currentLocal = `${firstNameInput} ${surnameInput}`.trim();
        if (currentLocal !== (formData.fromName || '').trim()) {
            setFirstNameInput(derivedFirst);
            setSurnameInput(derivedSurname);
        }
    }, [formData.fromName, firstNameInput, surnameInput]);

    const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFirstNameInput(val);
        setFormData(p => ({ ...p, fromName: `${val} ${surnameInput}`.trim() }));
    };

    const handleSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSurnameInput(val);
        setFormData(p => ({ ...p, fromName: `${firstNameInput} ${val}`.trim() }));
    };

    useEffect(() => {
        if (!isOpen) return;

        setFormData(prev => {
            if (inquiry && inquiry.id) {
                // Prevent background sync from overwriting local changes if we're already editing this inquiry
                if (prev && prev.id === inquiry.id) return prev;
                const linkedCustomer = inquiry.linkedCustomerId ? customers.find(c => c.id === inquiry.linkedCustomerId) : null;
                return { 
                    ...inquiry,
                    fromEmail: inquiry.fromEmail || linkedCustomer?.email || '',
                    fromPhone: inquiry.fromPhone || linkedCustomer?.mobile || linkedCustomer?.phone || ''
                };
            } else {
                // Initialize a new inquiry, using any pre-filled data provided
                return {
                    entityId: inquiry?.entityId || (selectedEntityId === 'all' ? (entities && entities.length > 0 ? entities[0].id : '') : selectedEntityId),
                    fromName: inquiry?.fromName || '',
                    fromContact: inquiry?.fromContact || '',
                    fromEmail: inquiry?.fromEmail || '',
                    fromPhone: inquiry?.fromPhone || '',
                    message: inquiry?.message || '',
                    status: inquiry?.status || 'Inbox',
                    isUrgent: inquiry?.isUrgent || false,
                    actionNotes: inquiry?.actionNotes || '',
                    takenByUserId: currentUser.id,
                    assignedToUserId: '',
                    assignedToEntityId: '',
                    logs: [{
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        userId: currentUser.id,
                        actionType: 'Created',
                        notes: 'Inquiry initialized'
                    }],
                    linkedCustomerId: inquiry?.linkedCustomerId || null,
                    linkedVehicleId: inquiry?.linkedVehicleId || null,
                    linkedEstimateId: inquiry?.linkedEstimateId || null,
                };
            }
        });
        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);

        if (inquiry && inquiry.logs && inquiry.logs.some(l => l.actionType === 'Email Sent')) {
            setActiveTab('estimates');
        } else {
            setActiveTab('details');
        }
    }, [isOpen, inquiry, selectedEntityId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        setFormData(p => {
            const nextData = { ...p, [name]: value };

            if (name === 'fromName' && value.length > 2) {
                const lowerName = value.toLowerCase().trim();
                const existingCustomer = customers.find(c => 
                    getCustomerDisplayName(c).toLowerCase() === lowerName || 
                    (c.companyName || '').toLowerCase() === lowerName
                );

                if (existingCustomer && !p.linkedCustomerId) {
                    nextData.linkedCustomerId = existingCustomer.id;
                    nextData.fromEmail = nextData.fromEmail || existingCustomer.email || '';
                    nextData.fromPhone = nextData.fromPhone || existingCustomer.phone || existingCustomer.mobile || '';
                    // Also clear suggested customer since we auto-linked
                    setSuggestedCustomer(null);
                }
            }

            if (name === 'status' && value === 'Awaiting Customer') {
                const fDate = new Date();
                fDate.setDate(fDate.getDate() + 3);
                nextData.followUpDate = fDate.toISOString().split('T')[0];
            }

            return nextData;
        });
    };

    const handleAIUpdateEstimate = async (linkedEstimate: Estimate) => {
        if (!updateEstimate) {
            toast.error("Estimate updating is not available here.");
            return;
        }
        
        try {
            setIsUpdatingAI(true);
            const newItems = await updateEstimateWithAI(linkedEstimate.lineItems || [], formData.message || '', formData.logs || [], formData.actionNotes);
            const subtotal = newItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
            const vat = subtotal * 0.20; // 20% VAT
            const totalAmount = subtotal + vat;
            
            const updatedEstimate = {
                ...linkedEstimate,
                lineItems: newItems,
                subtotal,
                vat,
                totalAmount
            };
            
            updateEstimate(updatedEstimate);
            toast.success("Estimate updated via AI!");
        } catch (err: any) {
            console.error("AI Update failed:", err);
            toast.error(err.message || "Failed to update estimate via AI");
        } finally {
            setIsUpdatingAI(false);
        }
    };

    const handleSave = () => {
        if (!formData.fromName || !formData.message) {
            toast.error('"From" name and message are required.');
            return;
        }

        let updatedLogs = formData.logs || [];
        let updatedFollowUpDate = formData.followUpDate;

        if (inquiry) {
            if (formData.actionNotes !== inquiry.actionNotes) {
                const newLog = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    actionType: 'Notes Updated',
                    notes: `Action Notes updated.`
                };
                updatedLogs = [...updatedLogs, newLog];
            }
            
            if (formData.status !== inquiry.status) {
                const newLog = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    actionType: 'Status Update',
                    notes: `Status changed from ${inquiry.status} to ${formData.status}.`
                };
                updatedLogs = [...updatedLogs, newLog];
                
                if (formData.status === 'Awaiting Customer') {
                    const fDate = new Date();
                    fDate.setDate(fDate.getDate() + 3);
                    updatedFollowUpDate = fDate.toISOString().split('T')[0];
                }
            }
        }

        const inquiryToSave: Inquiry = {
            id: formData.id || crypto.randomUUID(),
            createdAt: formData.createdAt || new Date().toISOString(),
            takenByUserId: formData.takenByUserId || currentUser.id,
            inquiryNumber: formData.inquiryNumber || generateInquiryNumber(inquiries),
            ...formData,
            logs: updatedLogs,
            followUpDate: updatedFollowUpDate,
            hasNewReply: false
        } as Inquiry;
        
        onSave(inquiryToSave, true);
    };


    const handleLinkCustomer = (customer: Customer) => {
        setFormData(p => ({ 
            ...p, 
            linkedCustomerId: customer.id,
            fromEmail: p.fromEmail || customer.email || '',
            fromPhone: p.fromPhone || customer.phone || customer.mobile || ''
        }));
        setSuggestedCustomer(null);
    };

    const handleLinkVehicle = (vehicle: Vehicle) => {
        setFormData(p => ({ ...p, linkedVehicleId: vehicle.id }));
        setSuggestedVehicle(null);
    };

    const handleUnlinkCustomer = () => {
        setFormData(p => ({ ...p, linkedCustomerId: null }));
    };
    
    const handleUnlinkVehicle = () => {
        setFormData(p => ({ ...p, linkedVehicleId: null }));
    };

    const linkedCustomer = customers.find(c => c.id === formData.linkedCustomerId);
    const linkedVehicle = vehicles.find(v => v.id === formData.linkedVehicleId);
    const linkedEstimate = formData.linkedEstimateId ? estimates.find(e => e.id === formData.linkedEstimateId) : null;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title={formData.inquiryNumber ? `Edit Inquiry / Message [${formData.inquiryNumber}]` : inquiry?.id ? 'Edit Inquiry / Message' : 'Log New Inquiry / Message'}
            maxWidth="max-w-[90vw] lg:max-w-7xl"
        >
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`${activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Initial Email & Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('estimates')}
                        className={`${activeTab === 'estimates' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Estimates
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('communication')}
                        className={`${activeTab === 'communication' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Communication, Notes & Logs
                    </button>
                </nav>
            </div>
            <div className="min-h-[500px]">
                {activeTab === 'details' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                                <input value={firstNameInput} onChange={handleFirstNameChange} className="w-full p-2 border rounded" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                                <input value={surnameInput} onChange={handleSurnameChange} className="w-full p-2 border rounded" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" name="fromEmail" value={formData.fromEmail || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input type="tel" name="fromPhone" value={formData.fromPhone || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <label className="block text-sm font-medium text-gray-700">Message*</label>
                            <button 
                                type="button" 
                                onClick={async () => {
                                    if (!formData.message) return;
                                    setIsAnalyzing(true);
                                    setAiError('');
                                    try {
                                        const parsed = await parseInquiryMessage(formData.message);
                                        
                                        // Update form data with extracted info
                                        setFormData(p => ({
                                            ...p,
                                            fromName: parsed.fromName || p.fromName || '',
                                            fromEmail: parsed.fromEmail || p.fromEmail || '',
                                            fromPhone: parsed.fromPhone || p.fromPhone || '',
                                        }));

                                        // Try to find matching customer/vehicle
                                        if (parsed.fromEmail || parsed.fromPhone || parsed.fromName) {
                                            const lowerEmail = (parsed.fromEmail || '').toLowerCase();
                                            const lowerPhone = (parsed.fromPhone || '').replace(/\D/g,'');
                                            const lowerName = (parsed.fromName || '').toLowerCase();
                                            
                                            const foundCust = customers.find(c => 
                                                (lowerEmail && c.email?.toLowerCase() === lowerEmail) ||
                                                (lowerPhone && (c.phone?.replace(/\D/g,'') === lowerPhone || c.mobile?.replace(/\D/g,'') === lowerPhone)) ||
                                                (lowerName && (c.forename + ' ' + c.surname).toLowerCase() === lowerName) ||
                                                (lowerName && c.companyName?.toLowerCase() === lowerName)
                                            );
                                            if (foundCust) setSuggestedCustomer(foundCust);
                                        }

                                        if (parsed.vehicleRegistration) {
                                            const lowerReg = parsed.vehicleRegistration.toLowerCase().replace(/\s/g, '');
                                            const foundVeh = vehicles.find(v => v.registration?.toLowerCase().replace(/\s/g, '') === lowerReg);
                                            if (foundVeh) setSuggestedVehicle(foundVeh);
                                        }

                                        const aiLogNotes = parsed.summary 
                                            ? `AI Summary: ${parsed.summary}` 
                                            : `AI Scan Completed (No summary provided). Data: ${JSON.stringify(parsed)}`;
                                        
                                        const newLog = {
                                            id: crypto.randomUUID(),
                                            timestamp: new Date().toISOString(),
                                            userId: currentUser.id,
                                            actionType: 'AI Scan',
                                            notes: aiLogNotes
                                        };
                                        setFormData(p => ({ ...p, logs: [...(p.logs || []), newLog] }));

                                    } catch (e) {
                                        console.error(e);
                                        setAiError('Failed to parse message with AI.');
                                    } finally {
                                        setIsAnalyzing(false);
                                    }
                                }}
                                disabled={isAnalyzing || !formData.message}
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 border border-indigo-200 transition disabled:opacity-50"
                            >
                                {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} 
                                Scan with AI
                            </button>
                        </div>
                        <div className="relative">
                            <textarea name="message" value={formData.message || ''} onChange={handleChange} rows={18} className="w-full p-2 border rounded text-sm" required />
                        </div>
                    </div>
                    
                    { (suggestedCustomer || suggestedVehicle || aiError) && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2 animate-fade-in">
                            <h4 className="font-semibold text-indigo-800 text-sm">AI Suggestions</h4>
                            {aiError && <p className="text-red-600 text-xs">{aiError}</p>}
                            
                            {suggestedCustomer && !formData.linkedCustomerId && (
                            <div className="flex justify-between items-center text-sm p-2 bg-white rounded-md border">
                                <div className="flex items-center gap-2">
                                    <UserIcon size={14} className="text-blue-500" />
                                    <p>Found Customer: <span className="font-semibold">{getCustomerDisplayName(suggestedCustomer)}</span></p>
                                </div>
                                <button type="button" onClick={() => handleLinkCustomer(suggestedCustomer)} className="flex items-center gap-1 text-xs py-1 px-2 bg-green-100 text-green-700 font-semibold rounded hover:bg-green-200">
                                <LinkIcon size={12}/> Link
                                </button>
                            </div>
                            )}
                            
                            {suggestedVehicle && !formData.linkedVehicleId && (
                            <div className="flex justify-between items-center text-sm p-2 bg-white rounded-md border">
                                <div className="flex items-center gap-2">
                                    <Car size={14} className="text-green-500" />
                                    <p>Found Vehicle: <span className="font-semibold">{suggestedVehicle.registration}</span> ({suggestedVehicle.make} {suggestedVehicle.model})</p>
                                </div>
                                <button type="button" onClick={() => handleLinkVehicle(suggestedVehicle)} className="flex items-center gap-1 text-xs py-1 px-2 bg-green-100 text-green-700 font-semibold rounded hover:bg-green-200">
                                <LinkIcon size={12}/> Link
                                </button>
                            </div>
                            )}
                        </div>
                    )}

                        </div>
                        <div className="space-y-4">
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Status & Ownership</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Branch / Entity</label>
                                <select name="entityId" value={formData.entityId || ''} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50">
                                    {entities?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                    <select name="status" value={formData.status || 'Inbox'} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50">
                                        <option value="Inbox">Inbox</option>
                                        <option value="New Requests">New Requests</option>
                                        <option value="In-Flight">In-Flight (Priority)</option>
                                        <option value="Awaiting Customer">Awaiting Customer</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Urgent</label>
                                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                                        <input type="checkbox" className="sr-only peer" checked={!!formData.isUrgent} onChange={e => setFormData(p => ({ ...p, isUrgent: e.target.checked }))} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Action Status (Optional)</label>
                                <select name="actionStatus" value={formData.actionStatus || ''} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50">
                                    <option value="">-- None --</option>
                                    <optgroup label="Communication">
                                        <option value="New Mail">New Mail</option>
                                        <option value="Email Sent">Email Sent</option>
                                        <option value="Email Responded">Email Responded</option>
                                        <option value="Call Required">Call Required</option>
                                        <option value="Voicemail Left">Voicemail Left</option>
                                    </optgroup>
                                    <optgroup label="Estimates">
                                        <option value="Estimate Required">Estimate Required</option>
                                        <option value="Estimate Sent">Estimate Sent</option>
                                        <option value="Estimate Approved">Estimate Approved</option>
                                        <option value="Estimate Rejected">Estimate Rejected</option>
                                    </optgroup>
                                    <optgroup label="Operations">
                                        <option value="Internal Review">Internal Review</option>
                                    </optgroup>
                                </select>
                            </div>
                            {formData.status === 'Closed' && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 text-red-600">Reason for Closing</label>
                                    <select name="closedReason" value={formData.closedReason || ''} onChange={handleChange} className="w-full p-2 border border-red-200 rounded text-sm bg-red-50">
                                        <option value="">Select a reason...</option>
                                        <option value="Lost to Competitor">Lost to Competitor</option>
                                        <option value="Too Expensive">Too Expensive</option>
                                        <option value="No Response / Ghosted">No Response / Ghosted</option>
                                        <option value="Project Cancelled / Changed Mind">Project Cancelled / Changed Mind</option>
                                        <option value="Duplicate Inquiry">Duplicate Inquiry</option>
                                        <option value="Spam / Invalid">Spam / Invalid</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Follow Up Date</label>
                                <input type="date" name="followUpDate" value={formData.followUpDate || ''} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Taken By</label>
                                    <SearchableSelect
                                        options={users.map(u => ({ id: u.id, label: u.name, value: u.id }))}
                                        defaultValue={formData.takenByUserId || null}
                                        onSelect={(value) => {
                                            if (value !== formData.takenByUserId) {
                                                const userName = users.find(u => u.id === value)?.name || value;
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Reassigned',
                                                    notes: `Taken By changed to: ${userName}`
                                                };
                                                setFormData(p => ({ ...p, takenByUserId: value, logs: [...(p.logs || []), newLog] }));
                                            }
                                        }}
                                        placeholder="Taken by..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned To</label>
                                    <SearchableSelect
                                        options={[
                                            ...users.map(u => ({ id: u.id, label: `👤 ${u.name}`, value: `user_${u.id}` })),
                                            ...(entities || []).map(e => ({ id: e.id, label: `🏢 ${e.name} (Team)`, value: `entity_${e.id}` }))
                                        ]}
                                        defaultValue={
                                            formData.assignedToUserId ? `user_${formData.assignedToUserId}` : 
                                            formData.assignedToEntityId ? `entity_${formData.assignedToEntityId}` : null
                                        }
                                        onSelect={(value) => {
                                            if (!value) return;
                                            const isUser = value.startsWith('user_');
                                            const id = value.replace(/^(user_|entity_)/, '');
                                            
                                            const prevId = formData.assignedToUserId || formData.assignedToEntityId;
                                            if (id !== prevId) {
                                                const assignName = isUser 
                                                    ? users.find(u => u.id === id)?.name || id
                                                    : entities?.find(e => e.id === id)?.name || id;
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Assigned',
                                                    notes: `Assigned To changed to: ${assignName}`
                                                };
                                                setFormData(p => ({ 
                                                    ...p, 
                                                    assignedToUserId: isUser ? id : undefined,
                                                    assignedToEntityId: !isUser ? id : undefined,
                                                    logs: [...(p.logs || []), newLog] 
                                                }));
                                            }
                                        }}
                                        placeholder="Assign to user or team..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Links & Assignments</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Connection</label>
                                {linkedCustomer ? (
                                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center text-sm shadow-xs">
                                        <button 
                                            type="button" 
                                            onClick={() => onViewCustomer?.(linkedCustomer.id)}
                                            className="flex items-center gap-2 text-green-800 hover:text-green-600 hover:underline text-left cursor-pointer transition font-semibold"
                                            title={getCustomerDisplayName(linkedCustomer)}
                                        >
                                            <UserCheck size={16} className="text-green-700 shrink-0"/>
                                            <span className="truncate max-w-[200px]">{getCustomerDisplayName(linkedCustomer)}</span>
                                        </button>
                                        <button type="button" onClick={handleUnlinkCustomer} title="Unlink Customer" className="text-gray-400 hover:text-red-500 transition">
                                            <XCircle size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c), value: c.id }))}
                                        defaultValue={formData.linkedCustomerId || null}
                                        onSelect={(value) => {
                                            const cust = customers.find(c => c.id === value);
                                            setFormData(p => {
                                                const customersCars = vehicles.filter(v => v.customerId === value);
                                                let newVehicleId = p.linkedVehicleId;
                                                if (!newVehicleId || !customersCars.some(car => car.id === newVehicleId)) {
                                                    newVehicleId = customersCars.length === 1 ? customersCars[0].id : null;
                                                }
                                                return { 
                                                    ...p, 
                                                    linkedCustomerId: value,
                                                    linkedVehicleId: newVehicleId,
                                                    fromEmail: p.fromEmail || cust?.email || '',
                                                    fromPhone: p.fromPhone || cust?.phone || cust?.mobile || ''
                                                };
                                            });
                                        }}
                                        placeholder="Link to an existing customer..."
                                    />
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle Connection</label>
                                {linkedVehicle ? (
                                     <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center text-sm shadow-xs">
                                        <button 
                                            type="button" 
                                            onClick={() => onViewVehicle?.(linkedVehicle.id)}
                                            className="flex items-center gap-2 text-green-800 hover:text-green-600 hover:underline text-left cursor-pointer transition font-semibold"
                                            title={`${linkedVehicle.registration} - ${linkedVehicle.make} ${linkedVehicle.model}`}
                                        >
                                            <Car size={16} className="text-green-700 shrink-0"/>
                                            <span className="font-semibold truncate max-w-[200px]">{linkedVehicle.registration} {linkedVehicle.make ? `(${linkedVehicle.make} ${linkedVehicle.model})` : ''}</span>
                                        </button>
                                        <button type="button" onClick={handleUnlinkVehicle} title="Unlink Vehicle" className="text-gray-400 hover:text-red-500 transition">
                                            <XCircle size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={vehicles.map(v => ({ id: v.id, label: `${v.registration} - ${v.make} ${v.model}`, value: v.id }))}
                                        defaultValue={formData.linkedVehicleId || null}
                                        onSelect={(value) => {
                                            const vehicle = vehicles.find(v => v.id === value);
                                            const ownerId = vehicle?.customerId;
                                            setFormData(p => {
                                                const cust = customers.find(c => c.id === (ownerId || p.linkedCustomerId));
                                                return { 
                                                    ...p, 
                                                    linkedVehicleId: value,
                                                    linkedCustomerId: ownerId || p.linkedCustomerId,
                                                    fromEmail: p.fromEmail || cust?.email || '',
                                                    fromPhone: p.fromPhone || cust?.phone || cust?.mobile || ''
                                                };
                                            });
                                        }}
                                        placeholder="Link to an existing vehicle..."
                                    />
                                )}
                            </div>

                            {(!linkedCustomer || !linkedVehicle) && onAddNewCustomer && (
                                <div className="pt-2 border-t mt-2">
                                    <button 
                                        type="button" 
                                        onClick={onAddNewCustomer}
                                        className="w-full py-1.5 flex justify-center items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition"
                                    >
                                        <UserCheck size={14} /> Create Customer / Vehicle
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                        </div>
                    </div>
                )}

                {activeTab === 'communication' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>
                        <div>
                            <textarea 
                                value={replyText} 
                                onChange={e => setReplyText(e.target.value)} 
                                rows={18} 
                                className="w-full p-2 border rounded text-sm mb-2" 
                                placeholder="Type your reply or use AI to draft one..."
                            />
                            
                            <div className="flex flex-col gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition flex items-center gap-1 border border-gray-300">
                                        <Camera size={14} /> Add Attachment(s)
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="hidden" 
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setReplyAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                                }
                                                e.target.value = ''; // Reset to allow selecting same file again
                                            }} 
                                        />
                                    </label>
                                </div>
                                {replyAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {replyAttachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-1 text-[10px] bg-gray-50 border rounded px-2 py-1 shadow-sm">
                                                <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-500 hover:text-red-700 ml-1 font-bold"
                                                    title="Remove attachment"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        if (!formData.message) return;
                                        setIsDraftingReply(true);
                                        try {
                                            const draft = await generateEmailReply(formData.message, 'Brookspeed', formData.actionNotes, formData.logs);
                                            setReplyText(draft);
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Failed to draft reply using AI.');
                                        } finally {
                                            setIsDraftingReply(false);
                                        }
                                    }}
                                    disabled={isDraftingReply || !formData.message}
                                    className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded hover:bg-purple-100 border border-purple-200 transition disabled:opacity-50"
                                >
                                    {isDraftingReply ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Draft with AI
                                </button>

                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        const emailAddress = formData.fromEmail || formData.fromContact;
                                        if (!replyText || !emailAddress || !emailAddress.includes('@')) {
                                            toast.error('Please enter a valid email reply and ensure the customer has an email address.');
                                            return;
                                        }
                                        setIsSendingReply(true);
                                        try {
                                            const emailAttachments = await Promise.all(replyAttachments.map(async file => {
                                                return new Promise<{content: string, filename: string, type: string}>((resolve, reject) => {
                                                    const reader = new FileReader();
                                                    reader.readAsDataURL(file);
                                                    reader.onload = () => {
                                                        const result = reader.result as string;
                                                        const base64Content = result.split(',')[1];
                                                        resolve({
                                                            content: base64Content,
                                                            filename: file.name,
                                                            type: file.type || 'application/octet-stream'
                                                        });
                                                    };
                                                    reader.onerror = error => reject(error);
                                                });
                                            }));

                                            const generatedId = formData.id || crypto.randomUUID();
                                            const generatedInquiryNumber = formData.inquiryNumber || generateInquiryNumber(inquiries);

                                            const success = await sendOutboundEmail({
                                                to: emailAddress,
                                                fromName: 'Brookspeed',
                                                fromEmail: 'info@brookspeed.com',
                                                subject: `Re: Your Inquiry [${generatedInquiryNumber}]`,
                                                body: replyText,
                                                attachments: emailAttachments.length > 0 ? emailAttachments : undefined
                                            });
                                            if (success) {
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Email Sent',
                                                    notes: `To: ${emailAddress}\nAttachments: ${replyAttachments.length}\n\n${replyText}`
                                                };
                                                const updatedLogs = [...(formData.logs || []), newLog];
                                                setFormData(p => ({ 
                                                    ...p, 
                                                    id: generatedId,
                                                    inquiryNumber: generatedInquiryNumber,
                                                    hasNewReply: false,
                                                    status: 'Awaiting Customer',
                                                    actionStatus: 'Email Sent',
                                                    followUpDate: null,
                                                    logs: updatedLogs 
                                                }));
                                                setReplyText('');
                                                setReplyAttachments([]);
                                                setActiveTab('estimates');
                                                
                                                const inquiryToSave: Inquiry = {
                                                    ...formData,
                                                    id: generatedId,
                                                    createdAt: formData.createdAt || new Date().toISOString(),
                                                    takenByUserId: formData.takenByUserId || currentUser.id,
                                                    inquiryNumber: generatedInquiryNumber,
                                                    hasNewReply: false,
                                                    status: 'Awaiting Customer',
                                                    followUpDate: null,
                                                    logs: updatedLogs,
                                                    fromName: formData.fromName || formData.fromEmail || 'Unknown Customer',
                                                    message: formData.message || `Outbound reply sent to ${emailAddress}`
                                                } as Inquiry;
                                                onSave(inquiryToSave, false);
                                                toast.success('Email sent successfully!');
                                            } else {
                                                toast.error('Failed to send email.');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            toast.error('Failed to send email.');
                                        } finally {
                                            setIsSendingReply(false);
                                        }
                                    }}
                                    disabled={isSendingReply || !replyText}
                                    className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSendingReply ? <Loader2 size={14} className="animate-spin" /> : 'Send Reply'}
                                </button>
                            </div>
                        </div>
                    </div>
                    </div>
                        <div className="space-y-4">
                            <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>
                        <div className="border rounded bg-gray-50 p-2 space-y-2 mb-2 h-96 overflow-y-auto">
                            {(!formData.logs || formData.logs.length === 0) && !formData.actionNotes && (
                                <p className="text-xs text-gray-500 italic">No logs recorded yet.</p>
                            )}
                            {[...(formData.logs || [])]
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                .map(log => (
                                <div key={log.id} className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <div className="flex justify-between text-gray-500 mb-1">
                                        <span className="font-semibold">{log.userId === 'System' ? 'System' : users.find(u => u.id === log.userId)?.name || 'User'}</span>
                                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    {log.actionType && <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">{log.actionType}</span>}
                                    <p className="text-gray-800 whitespace-pre-wrap">{log.notes}</p>
                                </div>
                            ))}
                            {formData.actionNotes && (
                                <div className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <p className="font-semibold text-gray-600 mb-1">Legacy Notes</p>
                                    <p className="text-gray-800 whitespace-pre-wrap">{formData.actionNotes}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Type a note and press enter..." 
                                className="flex-1 p-2 border rounded text-sm"
                                id="newLogInput"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                            const newLog = {
                                                id: crypto.randomUUID(),
                                                timestamp: new Date().toISOString(),
                                                userId: currentUser.id,
                                                notes: val
                                            };
                                            const updatedLogs = [...(formData.logs || []), newLog];
                                            
                                            let nextFollowUp = formData.followUpDate;
                                            if (formData.status === 'Awaiting Customer') {
                                                const fDate = new Date();
                                                fDate.setDate(fDate.getDate() + 3);
                                                nextFollowUp = fDate.toISOString().split('T')[0];
                                            } else if (formData.followUpDate && new Date(formData.followUpDate) <= new Date()) {
                                                nextFollowUp = null;
                                            }

                                            setFormData(p => ({ ...p, logs: updatedLogs, followUpDate: nextFollowUp }));
                                            
                                            if (formData.fromName && formData.message) {
                                                const inquiryToSave: Inquiry = {
                                                    id: formData.id || crypto.randomUUID(),
                                                    createdAt: formData.createdAt || new Date().toISOString(),
                                                    takenByUserId: formData.takenByUserId || currentUser.id,
                                                    ...formData,
                                                    followUpDate: nextFollowUp,
                                                    logs: updatedLogs
                                                } as Inquiry;
                                                onSave(inquiryToSave, false);
                                            }

                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                            <button 
                                type="button"
                                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                                onClick={() => {
                                    const input = document.getElementById('newLogInput') as HTMLInputElement;
                                    const val = input?.value.trim();
                                    if (val) {
                                        const newLog = {
                                            id: crypto.randomUUID(),
                                            timestamp: new Date().toISOString(),
                                            userId: currentUser.id,
                                            notes: val
                                        };
                                        const updatedLogs = [...(formData.logs || []), newLog];
                                        
                                        let nextFollowUp = formData.followUpDate;
                                        if (formData.status === 'Awaiting Customer') {
                                            const fDate = new Date();
                                            fDate.setDate(fDate.getDate() + 3);
                                            nextFollowUp = fDate.toISOString().split('T')[0];
                                        } else if (formData.followUpDate && new Date(formData.followUpDate) <= new Date()) {
                                            nextFollowUp = null;
                                        }

                                        setFormData(p => ({ ...p, logs: updatedLogs, followUpDate: nextFollowUp }));

                                        if (formData.fromName && formData.message) {
                                            const inquiryToSave: Inquiry = {
                                                id: formData.id || crypto.randomUUID(),
                                                createdAt: formData.createdAt || new Date().toISOString(),
                                                takenByUserId: formData.takenByUserId || currentUser.id,
                                                ...formData,
                                                followUpDate: nextFollowUp,
                                                logs: updatedLogs
                                            } as Inquiry;
                                            onSave(inquiryToSave, false);
                                        }

                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                        </div>
                    </div>
                )}

                {activeTab === 'estimates' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            {linkedEstimate ? (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <p className="font-bold text-indigo-800 flex items-center gap-2 text-sm"><FileText size={16}/> Linked Estimate</p>
                                    <p className="text-xs text-indigo-600 font-medium mt-0.5">#{linkedEstimate.estimateNumber} - {linkedEstimate.status}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {onViewEstimate && (
                                        <button 
                                            onClick={() => {
                                                onViewEstimate(linkedEstimate);
                                                onClose(); 
                                            }}
                                            className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 font-bold rounded-lg hover:bg-indigo-50 text-xs shadow-sm transition"
                                        >
                                            Review Estimate
                                        </button>
                                    )}
                                    {onEditEstimate && linkedEstimate.status === 'Draft' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onEditEstimate(linkedEstimate);
                                                onClose();
                                            }}
                                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 shadow-sm transition"
                                        >
                                            <Edit size={14}/> Edit Estimate
                                        </button>
                                    )}
                                    {linkedEstimate.status === 'Draft' && (
                                        <button
                                            type="button"
                                            onClick={() => handleAIUpdateEstimate(linkedEstimate)}
                                            disabled={isUpdatingAI}
                                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 shadow-sm transition"
                                        >
                                            {isUpdatingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            {isUpdatingAI ? 'Updating...' : 'AI Update'}
                                        </button>
                                    )}
                                    {linkedEstimate.status === 'Approved' && !linkedEstimate.jobId && onScheduleEstimate && (
                                         <button 
                                            onClick={() => {
                                                onScheduleEstimate(linkedEstimate, formData.id);
                                                onClose();
                                            }}
                                            className="px-3 py-1.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1 text-xs transition"
                                        >
                                            <CalendarCheck size={14}/> Schedule Job
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={16} className="text-indigo-600"/> Estimates</h4>
                            <div className="flex flex-col gap-2">
                                {onCreateNewEstimate && (
                                    <button
                                        type="button"
                                        onClick={() => onCreateNewEstimate(formData as Inquiry)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-indigo-300 text-indigo-700 bg-white rounded-lg font-semibold hover:bg-indigo-100 transition shadow-sm text-xs"
                                    >
                                        <PlusCircle size={14} /> Create Standard Estimate
                                    </button>
                                )}
                                {onSmartCreateEstimate && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const fullPrompt = [
                                                `Customer Name: ${formData.fromName || 'Unknown'}`,
                                                formData.fromEmail ? `Email: ${formData.fromEmail}` : null,
                                                formData.fromPhone ? `Phone: ${formData.fromPhone}` : null,
                                                `Request Details: ${formData.message || ''}`
                                            ].filter(Boolean).join('\n');
                                            onSmartCreateEstimate(formData as Inquiry, fullPrompt);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-transparent shadow-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition text-xs"
                                    >
                                        <Wand2 size={14} /> Smart Create Estimate (AI)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                            {/* Attachments Section */}
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center border-b pb-2 mb-3">
                                <label className="block text-sm font-bold text-gray-800">Attachments ({formData.media ? formData.media.length : 0})</label>
                                <label className="cursor-pointer text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition flex items-center gap-1 border border-indigo-200 shadow-sm">
                                    <PlusCircle size={14} /> Add Attachment
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        onChange={async (e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                const { saveImage } = await import('../utils/imageStore');
                                                const newMedia = [];
                                                for (const file of e.target.files) {
                                                    const isImage = file.type.startsWith('image/');
                                                    const mediaItem = {
                                                        id: crypto.randomUUID(),
                                                        type: isImage ? 'Photo' : 'Document',
                                                        name: file.name,
                                                        uploadedAt: new Date().toISOString()
                                                    };
                                                    await saveImage(mediaItem.id, file);
                                                    newMedia.push(mediaItem);
                                                }
                                                setFormData(p => ({ ...p, media: [...(p.media || []), ...newMedia] }));
                                            }
                                            e.target.value = '';
                                        }} 
                                    />
                                </label>
                            </div>
                            {formData.media && formData.media.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                                {formData.media.map((item: any) => {
                                    const isPhoto = item.type === 'Photo';
                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isPhoto ? <Camera size={16} className="text-indigo-500 shrink-0" /> : <FileText size={16} className="text-gray-500 shrink-0" />}
                                                <span className="truncate font-medium text-gray-700 text-[11px]" title={item.name}>{item.name}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={async () => {
                                                      // Open window immediately to bypass popup blockers
                                                      const win = window.open('about:blank', '_blank');
                                                      
                                                      const { getImage } = await import('../utils/imageStore');
                                                      const dataUrl = await getImage(item.id);
                                                      
                                                      if (dataUrl && win) {
                                                          const isPhoto = item.type === 'Photo';
                                                          win.document.write(`
                                                              <!DOCTYPE html>
                                                              <html>
                                                              <head>
                                                                  <title>Attachment: ${item.name || 'File'}</title>
                                                                  <style>
                                                                      body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #1f2937; min-height: 100vh; font-family: system-ui, sans-serif; }
                                                                      .download-btn { padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-bottom: 24px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                                                                      .download-btn:hover { background: #4338ca; }
                                                                      img { max-width: 90vw; max-height: 80vh; object-fit: contain; box-shadow: 0 10px 15px rgba(0,0,0,0.5); }
                                                                      p { color: white; font-size: 1.2rem; }
                                                                  </style>
                                                              </head>
                                                              <body>
                                                                  <a href="${dataUrl}" download="${item.name || 'attachment'}" class="download-btn">Download ${item.name || 'File'}</a>
                                                                  ${isPhoto ? `<img src="${dataUrl}" alt="Attachment preview" />` : `<p>This file type cannot be previewed in the browser.</p>`}
                                                              </body>
                                                              </html>
                                                          `);
                                                          win.document.close();
                                                      } else {
                                                          win?.close();
                                                          if (!dataUrl) toast.error('Could not retrieve file data.');
                                                      }
                                                  }} 
                                                className="text-[10px] bg-white px-2 py-1 rounded shadow-sm border font-bold hover:bg-gray-100 transition shrink-0"
                                            >
                                                View / Download
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            ) : (
                                <div className="text-gray-400 text-xs py-6 text-center border-2 border-dashed rounded-lg">No attachments found</div>
                            )}
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </FormModal>
    );
};

export default InquiryFormModal;
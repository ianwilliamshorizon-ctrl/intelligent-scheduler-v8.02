import React, { useState, useEffect } from 'react';
import { Inquiry, User, Customer, Vehicle, Estimate, PurchaseOrder } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../core/state/AppContext';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { Wand2, Loader2, Link as LinkIcon, UserCheck, Car, XCircle, User as UserIcon, FileText, CalendarCheck, Edit, Camera } from 'lucide-react';
import { parseInquiryMessage, generateEmailReply } from '../core/services/geminiService';
import { sendOutboundEmail } from '../core/services/emailService';
import { useData } from '../core/state/DataContext';

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
    updateEstimate 
}) => {
    const { currentUser, selectedEntityId } = useApp();
    const { purchaseOrders } = useData();
    const [formData, setFormData] = useState<Partial<Inquiry>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [suggestedCustomer, setSuggestedCustomer] = useState<Customer | null>(null);
    const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null);

    // Reply state
    const [replyText, setReplyText] = useState('');
    const [isDraftingReply, setIsDraftingReply] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
    const [isSendingReply, setIsSendingReply] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setFormData(prev => {
            if (inquiry && inquiry.id) {
                // Prevent background sync from overwriting local changes if we're already editing this inquiry
                if (prev && prev.id === inquiry.id) return prev;
                return { ...inquiry };
            } else {
                // If it's a new inquiry, only reset if we don't have a partial form already
                if (prev && !prev.id) return prev;

                return {
                    entityId: selectedEntityId,
                    fromName: '',
                    fromContact: '',
                    fromEmail: '',
                    fromPhone: '',
                    message: '',
                    status: 'New',
                    actionNotes: '',
                    takenByUserId: currentUser.id,
                    assignedToUserId: '',
                    logs: [{
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        userId: currentUser.id,
                        actionType: 'Created',
                        notes: 'Inquiry initialized'
                    }],
                    linkedCustomerId: null,
                    linkedVehicleId: null,
                    linkedEstimateId: null,
                };
            }
        });
        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);
    }, [isOpen, inquiry, selectedEntityId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handleSave = () => {
        if (!formData.fromName || !formData.message) {
            alert('"From" name and message are required.');
            return;
        }

        const inquiryToSave: Inquiry = {
            id: formData.id || crypto.randomUUID(),
            createdAt: formData.createdAt || new Date().toISOString(),
            takenByUserId: formData.takenByUserId || currentUser.id,
            ...formData
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
            title={inquiry?.id ? 'Edit Inquiry / Message' : 'Log New Inquiry / Message'}
            maxWidth="max-w-[90vw] lg:max-w-7xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1 - Core Message & Links */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From (Name)*</label>
                            <input name="fromName" value={formData.fromName || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
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
                                            fromName: p.fromName || parsed.fromName || '',
                                            fromEmail: p.fromEmail || parsed.fromEmail || '',
                                            fromPhone: p.fromPhone || parsed.fromPhone || '',
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

                                        if (parsed.summary) {
                                            const newLog = {
                                                id: crypto.randomUUID(),
                                                timestamp: new Date().toISOString(),
                                                userId: currentUser.id,
                                                actionType: 'AI Scan',
                                                notes: `AI Summary: ${parsed.summary}`
                                            };
                                            setFormData(p => ({ ...p, logs: [...(p.logs || []), newLog] }));
                                        }

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
                            <textarea name="message" value={formData.message || ''} onChange={handleChange} rows={12} className="w-full p-2 border rounded text-sm" required />
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

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Links & Assignments</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Connection</label>
                                {linkedCustomer ? (
                                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center text-sm shadow-xs">
                                        <div className="flex items-center gap-2 text-green-800">
                                            <UserCheck size={16} className="text-green-700 shrink-0"/>
                                            <p className="font-semibold truncate max-w-[200px]" title={getCustomerDisplayName(linkedCustomer)}>{getCustomerDisplayName(linkedCustomer)}</p>
                                        </div>
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
                                        <div className="flex items-center gap-2 text-green-800">
                                            <Car size={16} className="text-green-700 shrink-0"/>
                                            <p className="font-semibold truncate max-w-[200px]" title={`${linkedVehicle.registration} - ${linkedVehicle.make} ${linkedVehicle.model}`}>{linkedVehicle.registration}</p>
                                        </div>
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
                        </div>
                    </div>
                </div>

                {/* Column 2 - Status & Reply */}
                <div className="space-y-4">
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Status & Ownership</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                <select name="status" value={formData.status || 'New'} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50">
                                    <option value="New">New</option>
                                    <option value="Immediate Quote">Immediate Quote</option>
                                    <option value="Escalated/Urgent">Escalated/Urgent</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Quoted or Responded">Quoted or Responded</option>
                                    <option>Rejected</option>
                                    <option>Closed</option>
                                </select>
                            </div>
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
                                        options={users.map(u => ({ id: u.id, label: u.name, value: u.id }))}
                                        defaultValue={formData.assignedToUserId || null}
                                        onSelect={(value) => {
                                            if (value !== formData.assignedToUserId) {
                                                const userName = users.find(u => u.id === value)?.name || value;
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Assigned',
                                                    notes: `Assigned To changed to: ${userName}`
                                                };
                                                setFormData(p => ({ ...p, assignedToUserId: value, logs: [...(p.logs || []), newLog] }));
                                            }
                                        }}
                                        placeholder="Assign to..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>
                        <div>
                            <textarea 
                                value={replyText} 
                                onChange={e => setReplyText(e.target.value)} 
                                rows={8} 
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
                                            const draft = await generateEmailReply(formData.message, 'Brookspeed');
                                            setReplyText(draft);
                                        } catch (e) {
                                            console.error(e);
                                            alert('Failed to draft reply using AI.');
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
                                            alert('Please enter a valid email reply and ensure the customer has an email address.');
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

                                            const success = await sendOutboundEmail({
                                                to: emailAddress,
                                                fromName: 'Brookspeed',
                                                fromEmail: 'info@brookspeed.com',
                                                subject: `Re: Your Inquiry`,
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
                                                setFormData(p => ({ ...p, logs: updatedLogs }));
                                                setReplyText('');
                                                setReplyAttachments([]);
                                                
                                                if (formData.fromName && formData.message) {
                                                    const inquiryToSave: Inquiry = {
                                                        id: formData.id || crypto.randomUUID(),
                                                        createdAt: formData.createdAt || new Date().toISOString(),
                                                        takenByUserId: formData.takenByUserId || currentUser.id,
                                                        ...formData,
                                                        logs: updatedLogs
                                                    } as Inquiry;
                                                    onSave(inquiryToSave, false);
                                                }
                                                alert('Email sent successfully!');
                                            } else {
                                                alert('Failed to send email.');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('Failed to send email.');
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

                {/* Column 3 - Remainder (Logs, Estimate, Attachments) */}
                <div className="space-y-4">
                    {linkedEstimate && (
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
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>
                        <div className="border rounded bg-gray-50 p-2 space-y-2 mb-2 max-h-60 overflow-y-auto">
                            {(!formData.logs || formData.logs.length === 0) && !formData.actionNotes && (
                                <p className="text-xs text-gray-500 italic">No logs recorded yet.</p>
                            )}
                            {formData.actionNotes && (
                                <div className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <p className="font-semibold text-gray-600 mb-1">Legacy Notes</p>
                                    <p className="text-gray-800 whitespace-pre-wrap">{formData.actionNotes}</p>
                                </div>
                            )}
                            {(formData.logs || []).map(log => (
                                <div key={log.id} className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <div className="flex justify-between text-gray-500 mb-1">
                                        <span className="font-semibold">{log.userId === 'System' ? 'System' : users.find(u => u.id === log.userId)?.name || 'User'}</span>
                                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    {log.actionType && <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">{log.actionType}</span>}
                                    <p className="text-gray-800 whitespace-pre-wrap">{log.notes}</p>
                                </div>
                            ))}
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
                                            setFormData(p => ({ ...p, logs: updatedLogs }));
                                            
                                            if (formData.fromName && formData.message) {
                                                const inquiryToSave: Inquiry = {
                                                    id: formData.id || crypto.randomUUID(),
                                                    createdAt: formData.createdAt || new Date().toISOString(),
                                                    takenByUserId: formData.takenByUserId || currentUser.id,
                                                    ...formData,
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
                                        setFormData(p => ({ ...p, logs: updatedLogs }));

                                        if (formData.fromName && formData.message) {
                                            const inquiryToSave: Inquiry = {
                                                id: formData.id || crypto.randomUUID(),
                                                createdAt: formData.createdAt || new Date().toISOString(),
                                                takenByUserId: formData.takenByUserId || currentUser.id,
                                                ...formData,
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

                    {/* Attachments Section */}
                    {formData.media && formData.media.length > 0 && (
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
                            <label className="block text-sm font-bold text-gray-800 border-b pb-2 mb-3">Attachments ({formData.media.length})</label>
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
                                                    const { getImage } = await import('../utils/imageStore');
                                                    const dataUrl = await getImage(item.id);
                                                    if (dataUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = dataUrl;
                                                        link.download = item.name;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } else {
                                                        alert('Could not retrieve file.');
                                                    }
                                                }} 
                                                className="text-[10px] bg-white px-2 py-1 rounded shadow-sm border font-bold hover:bg-gray-100 transition shrink-0"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export default InquiryFormModal;
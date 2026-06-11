import React, { useState, useEffect } from 'react';
import { Inquiry, User, Customer, Vehicle, Estimate, PurchaseOrder } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../core/state/AppContext';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { Wand2, Loader2, Link as LinkIcon, UserCheck, Car, XCircle, User as UserIcon, FileText, CalendarCheck, Edit, Camera } from 'lucide-react';
import { parseInquiryMessage } from '../core/services/geminiService';
import { useData } from '../core/state/DataContext';

interface InquiryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (inquiry: Inquiry) => void;
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
                    message: '',
                    status: 'New',
                    actionNotes: '',
                    takenByUserId: null,
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
        
        onSave(inquiryToSave);
    };

    const handleAnalyze = async () => {
        if (!formData.message) {
            setAiError('Please enter a message to analyze.');
            return;
        }

        setIsAnalyzing(true);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);

        try {
            const result = await parseInquiryMessage(formData.message);
            
            setFormData(p => ({
                ...p,
                fromName: p.fromName || result.fromName,
                fromContact: p.fromContact || result.fromContact,
                actionNotes: p.actionNotes ? `${p.actionNotes}\nAI Summary: ${result.summary}` : `AI Summary: ${result.summary}`,
            }));

            if (result.fromName) {
                const lowerName = result.fromName.toLowerCase();
                const foundCustomer = customers.find(c => 
                    getCustomerDisplayName(c).toLowerCase().includes(lowerName)
                );
                if (foundCustomer) {
                    setSuggestedCustomer(foundCustomer);
                }
            }

            if (result.vehicleRegistration) {
                const upperReg = result.vehicleRegistration.toUpperCase().replace(/\s/g, '');
                const foundVehicle = vehicles.find(v => 
                    v.registration.toUpperCase().replace(/\s/g, '') === upperReg
                );
                if (foundVehicle) {
                    setSuggestedVehicle(foundVehicle);
                }
            }
        } catch (error: any) {
            setAiError(error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleLinkCustomer = (customer: Customer) => {
        setFormData(p => ({ ...p, linkedCustomerId: customer.id }));
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
            maxWidth="max-w-5xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column - Core Message Details (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From (Name)*</label>
                            <input name="fromName" value={formData.fromName || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact (Phone/Email)</label>
                            <input name="fromContact" value={formData.fromContact || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message*</label>
                        <div className="relative">
                            <textarea name="message" value={formData.message || ''} onChange={handleChange} rows={12} className="w-full p-2 border rounded pr-12 text-sm" required />
                            <button 
                                type="button" 
                                onClick={handleAnalyze} 
                                disabled={isAnalyzing || !formData.message}
                                className="absolute top-2 right-2 p-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Analyze message with AI"
                            >
                                {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16} />}
                            </button>
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Action Notes</label>
                        <textarea name="actionNotes" value={formData.actionNotes || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded" />
                    </div>
                </div>

                {/* Right Column - Actions, Assignments & Attachments (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
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

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Status & Ownership</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                <select name="status" value={formData.status || 'New'} onChange={handleChange} className="w-full p-2 border rounded bg-white text-sm font-medium">
                                    <option>New</option>
                                    <option>Immediate Quote</option>
                                    <option value="Escalated/Urgent">Escalated/Urgent</option>
                                    <option>In Progress</option>
                                    <option value="Quoted or Responded">Quoted or Responded</option>
                                    <option>Approved</option>
                                    <option>Rejected</option>
                                    <option>Closed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned To</label>
                                <SearchableSelect
                                    options={users.map(u => ({ id: u.id, label: u.name, value: u.id }))}
                                    defaultValue={formData.takenByUserId || null}
                                    onSelect={(value) => setFormData(p => ({ ...p, takenByUserId: value }))}
                                    placeholder="Assign to staff member..."
                                />
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
                                        onSelect={(value) => setFormData(p => ({ ...p, linkedCustomerId: value }))}
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
                                        onSelect={(value) => setFormData(p => ({ ...p, linkedVehicleId: value }))}
                                        placeholder="Link to an existing vehicle..."
                                    />
                                )}
                            </div>
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
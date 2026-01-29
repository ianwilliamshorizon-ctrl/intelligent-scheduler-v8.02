import React, { useState, useEffect } from 'react';
import { Inquiry, User, Customer, Vehicle, Estimate, PurchaseOrder } from '../types';
import FormModal from './FormModal';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../core/state/AppContext';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { Wand2, Loader2, Link as LinkIcon, UserCheck, Car, XCircle, User as UserIcon, FileText, CalendarCheck, Edit } from 'lucide-react';
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
}

const InquiryFormModal: React.FC<InquiryFormModalProps> = ({ isOpen, onClose, onSave, inquiry, users, customers, vehicles, estimates, onViewEstimate, onScheduleEstimate, onEditEstimate }) => {
    const { currentUser, selectedEntityId } = useApp();
    const { purchaseOrders } = useData();
    const [formData, setFormData] = useState<Partial<Inquiry>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState('');
    const [suggestedCustomer, setSuggestedCustomer] = useState<Customer | null>(null);
    const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(inquiry ? { ...inquiry } : {
                entityId: selectedEntityId,
                fromName: '',
                fromContact: '',
                message: '',
                status: 'Open',
                actionNotes: '',
                assignedToUserId: null,
                linkedCustomerId: null,
                linkedVehicleId: null,
                linkedEstimateId: null,
            });
            setIsAnalyzing(false);
            setAiError('');
            setSuggestedCustomer(null);
            setSuggestedVehicle(null);
        }
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
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                {linkedEstimate && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-bold text-indigo-800 flex items-center gap-2"><FileText size={16}/> Linked Supplementary Estimate</p>
                                <p className="text-sm text-indigo-600">#{linkedEstimate.estimateNumber} - {linkedEstimate.status}</p>
                            </div>
                            <div className="flex gap-2">
                                {onViewEstimate && (
                                    <button 
                                        onClick={() => onViewEstimate(linkedEstimate)}
                                        className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 font-semibold rounded-lg hover:bg-indigo-50 text-xs"
                                    >
                                        Review Estimate
                                    </button>
                                )}
                                {onEditEstimate && linkedEstimate.status === 'Draft' && (
                                    <button
                                        type="button"
                                        onClick={() => onEditEstimate(linkedEstimate)}
                                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
                                    >
                                        <Edit size={14}/> Edit Estimate
                                    </button>
                                )}
                                {linkedEstimate.status === 'Approved' && !linkedEstimate.jobId && onScheduleEstimate && (
                                     <button 
                                        onClick={() => onScheduleEstimate(linkedEstimate, formData.id)}
                                        className="px-3 py-1.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md flex items-center gap-1 text-xs"
                                    >
                                        <CalendarCheck size={14}/> Schedule Job
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
                        <textarea name="message" value={formData.message || ''} onChange={handleChange} rows={4} className="w-full p-2 border rounded pr-12" required />
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


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                        <SearchableSelect
                            options={users.map(u => ({ id: u.id, label: u.name }))}
                            value={formData.assignedToUserId || null}
                            onChange={(value) => setFormData(p => ({ ...p, assignedToUserId: value }))}
                            placeholder="Assign to staff member..."
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select name="status" value={formData.status || 'Open'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option>Open</option>
                            <option>In Progress</option>
                            <option>Sent</option>
                            <option>Closed</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action Notes</label>
                    <textarea name="actionNotes" value={formData.actionNotes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded" />
                </div>
                <div className="pt-4 border-t">
                     <label className="block text-sm font-medium text-gray-700 mb-2">Links</label>
                     <div className="space-y-2">
                        <div>
                            {linkedCustomer ? (
                                <div className="p-2 bg-green-100 border border-green-200 rounded-lg flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={16} className="text-green-700"/>
                                        <p>Linked to Customer: <span className="font-semibold">{getCustomerDisplayName(linkedCustomer)}</span></p>
                                    </div>
                                    <button type="button" onClick={handleUnlinkCustomer} title="Unlink Customer">
                                        <XCircle size={16} className="text-red-500"/>
                                    </button>
                                </div>
                            ) : (
                                <SearchableSelect
                                    options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c) }))}
                                    value={formData.linkedCustomerId || null}
                                    onChange={(value) => setFormData(p => ({ ...p, linkedCustomerId: value }))}
                                    placeholder="Link to an existing customer..."
                                />
                            )}
                        </div>
                        <div>
                            {linkedVehicle ? (
                                 <div className="p-2 bg-green-100 border border-green-200 rounded-lg flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <Car size={16} className="text-green-700"/>
                                        <p>Linked to Vehicle: <span className="font-semibold">{linkedVehicle.registration}</span></p>
                                    </div>
                                    <button type="button" onClick={handleUnlinkVehicle} title="Unlink Vehicle">
                                        <XCircle size={16} className="text-red-500"/>
                                    </button>
                                </div>
                            ) : (
                                <SearchableSelect
                                    options={vehicles.map(v => ({ id: v.id, label: `${v.registration} - ${v.make} ${v.model}` }))}
                                    value={formData.linkedVehicleId || null}
                                    onChange={(value) => setFormData(p => ({ ...p, linkedVehicleId: value }))}
                                    placeholder="Link to an existing vehicle..."
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default InquiryFormModal;
import React, { useState, useMemo } from 'react';
import { Mail, MessageSquare, Send, Trash2, Edit3, X, Check, ExternalLink, Calendar, Copy, Eye, Clock, Phone, AlertCircle, Shield, Wrench, ChevronRight, Car, CheckCircle2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Reminder, Customer, Vehicle, BusinessEntity } from '../../types';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import { generateReminderMessage } from '../../core/utils/templateUtils';
import NotificationsHubCard, { generateNotificationsHubEmailHtml, formatDisplayDate } from './NotificationsHubCard';
import { sendOutboundEmail } from '../../core/services/emailService';
import { logOutboundCorrespondence } from '../../core/services/commsCorrespondenceService';
import { saveDocument, deleteDocument } from '../../core/db';
import { toast } from 'react-toastify';

interface MessageVisualiserModalProps {
    isOpen: boolean;
    onClose: () => void;
    reminder: Reminder;
    customer: Customer;
    vehicle: Vehicle | null;
    entity?: BusinessEntity | null;
    onUpdated?: (updated: Reminder) => void;
    onDeleted?: (reminderId: string) => void;
}

export const MessageVisualiserModal: React.FC<MessageVisualiserModalProps> = ({
    isOpen,
    onClose,
    reminder,
    customer,
    vehicle,
    entity,
    onUpdated,
    onDeleted
}) => {
    const [activeChannel, setActiveChannel] = useState<'Email' | 'SMS' | 'WhatsApp'>('Email');
    const [isEditingReminder, setIsEditingReminder] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Graphic / visual presentation modes
    const [emailMode, setEmailMode] = useState<'card' | 'text'>('card');
    const [smsMode, setSmsMode] = useState<'mms' | 'sms'>('mms');
    const [waMode, setWaMode] = useState<'graphic' | 'text'>('graphic');

    // Editable reminder metadata
    const [editDueDate, setEditDueDate] = useState(reminder.dueDate || '');
    const [editType, setEditType] = useState(reminder.type);
    const [editStatus, setEditStatus] = useState(reminder.status);

    const origin = typeof window !== 'undefined' && window.location?.origin 
        ? window.location.origin 
        : 'https://intelligent-scheduling-v801.web.app';

    const interactiveBookingUrl = useMemo(() => {
        const reg = vehicle?.registration || '';
        return `${origin}/?view=mot&vrm=${encodeURIComponent(reg)}&vehicleId=${vehicle?.id || ''}&customerId=${customer?.id || ''}`;
    }, [origin, vehicle, customer]);

    // Generate channel message templates
    const emailData = useMemo(() => generateReminderMessage(reminder, customer, vehicle, 'Email', entity), [reminder, customer, vehicle, entity]);
    const smsData = useMemo(() => generateReminderMessage(reminder, customer, vehicle, 'SMS', entity), [reminder, customer, vehicle, entity]);
    const waData = useMemo(() => generateReminderMessage(reminder, customer, vehicle, 'WhatsApp', entity), [reminder, customer, vehicle, entity]);

    const [emailSubject, setEmailSubject] = useState(emailData.subject);
    const [emailBody, setEmailBody] = useState(emailData.body);
    const [smsBody, setSmsBody] = useState(smsData.body);
    const [waBody, setWaBody] = useState(waData.body);

    React.useEffect(() => {
        setEmailSubject(emailData.subject);
        setEmailBody(emailData.body);
        setSmsBody(smsData.body);
        setWaBody(waData.body);
        setEditDueDate(reminder.dueDate || '');
        setEditType(reminder.type);
        setEditStatus(reminder.status);
    }, [reminder, emailData, smsData, waData]);

    if (!isOpen) return null;

    const recipientTarget = activeChannel === 'Email' 
        ? (customer.email || '') 
        : (customer.mobile || customer.phone || '');

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        toast.success('Message copied to clipboard!');
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleSaveMetadata = async () => {
        const updated: Reminder = {
            ...reminder,
            dueDate: editDueDate,
            type: editType,
            status: editStatus
        };
        try {
            await saveDocument('brooks_reminders', updated);
            toast.success('Reminder updated successfully!');
            setIsEditingReminder(false);
            if (onUpdated) onUpdated(updated);
        } catch (err: any) {
            console.error('Failed to save reminder:', err);
            toast.error('Failed to update reminder.');
        }
    };

    const handleDeleteReminder = async () => {
        if (!window.confirm('Are you sure you want to permanently delete this message reminder?')) {
            return;
        }
        try {
            await deleteDocument('brooks_reminders', reminder.id);
            toast.success('Reminder message deleted.');
            if (onDeleted) onDeleted(reminder.id);
            onClose();
        } catch (err: any) {
            console.error('Failed to delete reminder:', err);
            toast.error('Failed to delete reminder.');
        }
    };

    const handleSendCurrentMessage = async () => {
        setIsSending(true);
        const method = activeChannel;
        const nowIso = new Date().toISOString();

        try {
            let messageContent = '';

            if (method === 'Email') {
                if (!customer.email) {
                    toast.error('Customer has no email address on file.');
                    setIsSending(false);
                    return;
                }

                const htmlBody = emailMode === 'card' && vehicle
                    ? generateNotificationsHubEmailHtml(vehicle, customer, 60, interactiveBookingUrl)
                    : emailBody.replace(/\n/g, '<br/>') + (reminder.type === 'MOT' ? `<br/><br/><a href="${interactiveBookingUrl}" style="display:inline-block;padding:12px 24px;background-color:#0066FF;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Request MOT Date Online</a>` : '');

                messageContent = emailMode === 'card' ? `[Notifications Hub Card Email Sent]\nSubject: ${emailSubject}` : emailBody;

                // Send strictly from info@brookspeed.com
                await sendOutboundEmail({
                    to: customer.email,
                    fromName: 'Brookspeed',
                    fromEmail: 'info@brookspeed.com',
                    subject: emailSubject,
                    body: htmlBody
                });
                toast.success(`Email sent from info@brookspeed.com to ${customer.email}!`);
            } else if (method === 'WhatsApp') {
                messageContent = waBody;
                const cleanPhone = (customer.mobile || customer.phone || '').replace(/[^\d+]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waBody)}`;
                window.open(waUrl, '_blank');
                toast.success('Opened WhatsApp with prepared message!');
            } else {
                messageContent = smsBody;
                toast.success(`SMS reminder queued/dispatched to ${customer.mobile || customer.phone}!`);
            }

            // Add as formal correspondence to client account in brooks_inquiries
            await logOutboundCorrespondence(
                customer,
                vehicle,
                emailSubject || `${reminder.type} Reminder - ${vehicle?.registration || 'Vehicle'}`,
                messageContent,
                method,
                entity,
                recipientTarget
            );

            // Update reminder status
            const updatedReminder: Reminder = {
                ...reminder,
                status: 'Sent',
                actionedAt: nowIso
            };
            await saveDocument('brooks_reminders', updatedReminder);
            if (onUpdated) onUpdated(updatedReminder);

            toast.info('Logged as outbound correspondence on client account.');
            onClose();
        } catch (err: any) {
            console.error('Failed to dispatch message:', err);
            toast.error(`Dispatch error: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-xs z-[85] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in-up border border-gray-200">
                {/* Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
                            <Eye size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black tracking-tight">
                                    Message Visualiser & Preview
                                </h2>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                    reminder.type === 'MOT' ? 'bg-blue-500 text-white' : reminder.type === 'Tax' ? 'bg-amber-500 text-black' : 'bg-indigo-500 text-white'
                                }`}>
                                    {reminder.type}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    reminder.status === 'Sent' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200'
                                }`}>
                                    {reminder.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium">
                                Recipient: <strong className="text-white">{customer.forename} {customer.surname}</strong> • {recipientTarget || 'No contact on file'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsEditingReminder(!isEditingReminder)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-bold flex items-center gap-1"
                            title="Edit message metadata"
                        >
                            <Edit3 size={14} />
                            <span>{isEditingReminder ? 'Close Edit' : 'Edit'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteReminder}
                            className="p-1.5 rounded-lg bg-red-950 hover:bg-red-800 text-red-300 hover:text-white transition text-xs font-bold flex items-center gap-1"
                            title="Permanently delete this reminder"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Edit Metadata Drawer (if open) */}
                {isEditingReminder && (
                    <div className="p-4 bg-amber-50/80 border-b border-amber-200 flex flex-wrap items-center gap-3 text-xs">
                        <div>
                            <label className="block font-bold text-amber-900 mb-1">Due Date</label>
                            <input
                                type="date"
                                value={editDueDate}
                                onChange={e => setEditDueDate(e.target.value)}
                                className="p-1.5 border border-amber-300 rounded bg-white font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-amber-900 mb-1">Type</label>
                            <select
                                value={editType}
                                onChange={e => setEditType(e.target.value as any)}
                                className="p-1.5 border border-amber-300 rounded bg-white font-semibold"
                            >
                                <option value="MOT">MOT</option>
                                <option value="Tax">Tax</option>
                                <option value="Service">Service</option>
                                <option value="Winter Check">Winter Check</option>
                                <option value="Marketing">Marketing</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-bold text-amber-900 mb-1">Status</label>
                            <select
                                value={editStatus}
                                onChange={e => setEditStatus(e.target.value as any)}
                                className="p-1.5 border border-amber-300 rounded bg-white font-semibold"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Sent">Sent</option>
                                <option value="Dismissed">Dismissed</option>
                            </select>
                        </div>

                        <div className="flex items-end gap-2 mt-4 sm:mt-0">
                            <button
                                type="button"
                                onClick={handleSaveMetadata}
                                className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-xs transition"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}

                {/* Vehicle Pill Banner */}
                {vehicle && (
                    <div className="px-6 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                            <div className="flex items-stretch bg-[#FACC15] border border-yellow-500 rounded shadow-2xs overflow-hidden">
                                <div className="bg-[#003399] text-white px-1 py-0.2 flex flex-col items-center justify-center text-[7px] font-black">
                                    <span>🇬🇧</span>
                                </div>
                                <div className="px-2 py-0.5 font-mono font-black text-black uppercase">
                                    {vehicle.registration}
                                </div>
                            </div>
                            <span className="font-extrabold text-slate-800">
                                {vehicle.make} {vehicle.model}
                            </span>
                            <span className="text-slate-500">
                                Expiry: <strong className="text-blue-700">{reminder.dueDate || 'N/A'}</strong>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => window.open(interactiveBookingUrl, '_blank')}
                            className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold hover:underline"
                        >
                            <span>Test Customer Link</span>
                            <ExternalLink size={12} />
                        </button>
                    </div>
                )}

                {/* Visualiser Channel Selector Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveChannel('Email')}
                        className={`py-2 px-4 rounded-t-xl text-xs font-black transition flex items-center gap-2 border-t border-x ${
                            activeChannel === 'Email'
                                ? 'bg-white text-blue-600 border-gray-200 shadow-xs'
                                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
                        }`}
                    >
                        <Mail size={14} />
                        <span>Email Visualiser</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveChannel('SMS')}
                        className={`py-2 px-4 rounded-t-xl text-xs font-black transition flex items-center gap-2 border-t border-x ${
                            activeChannel === 'SMS'
                                ? 'bg-white text-indigo-600 border-gray-200 shadow-xs'
                                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
                        }`}
                    >
                        <MessageSquare size={14} />
                        <span>SMS / MMS Visualiser</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveChannel('WhatsApp')}
                        className={`py-2 px-4 rounded-t-xl text-xs font-black transition flex items-center gap-2 border-t border-x ${
                            activeChannel === 'WhatsApp'
                                ? 'bg-white text-emerald-600 border-gray-200 shadow-xs'
                                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
                        }`}
                    >
                        <span>💬</span>
                        <span>WhatsApp Visualiser</span>
                    </button>
                </div>

                {/* Main Visualiser Content */}
                <div className="p-6 overflow-y-auto flex-grow bg-slate-50/50">
                    {/* 1. EMAIL VISUALISER */}
                    {activeChannel === 'Email' && (
                        <div className="space-y-4">
                            {/* Email Meta Bar */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-xs space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">From:</span>
                                    <span className="font-black text-blue-700">Brookspeed &lt;info@brookspeed.com&gt;</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">To:</span>
                                    <span className="font-semibold text-gray-800">{customer.email || 'No email registered'}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Subject:</span>
                                    <input
                                        type="text"
                                        value={emailSubject}
                                        onChange={e => setEmailSubject(e.target.value)}
                                        className="font-bold text-gray-900 flex-grow text-right ml-2 outline-none border-b border-transparent focus:border-blue-400"
                                    />
                                </div>
                            </div>

                            {/* Mode toggle */}
                            <div className="flex gap-2 p-1 bg-gray-200 rounded-lg max-w-sm">
                                <button
                                    type="button"
                                    onClick={() => setEmailMode('card')}
                                    className={`flex-1 py-1 px-2.5 rounded-md text-xs font-bold transition ${
                                        emailMode === 'card' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-700 hover:text-black'
                                    }`}
                                >
                                    🔔 Electric Blue Card View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEmailMode('text')}
                                    className={`flex-1 py-1 px-2.5 rounded-md text-xs font-bold transition ${
                                        emailMode === 'text' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-700 hover:text-black'
                                    }`}
                                >
                                    📝 Text Template
                                </button>
                            </div>

                            {/* Visual Display */}
                            {emailMode === 'card' && vehicle ? (
                                <div className="border border-gray-300 rounded-2xl overflow-hidden bg-white shadow-md p-4">
                                    <NotificationsHubCard
                                        vehicle={vehicle}
                                        customer={customer}
                                        leadDays={60}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Editable Email Text Body</label>
                                    <textarea
                                        rows={6}
                                        value={emailBody}
                                        onChange={e => setEmailBody(e.target.value)}
                                        className="w-full p-3 font-mono text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs flex items-center justify-between">
                                        <span className="font-bold text-blue-900">Interactive link included:</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(interactiveBookingUrl)}
                                            className="font-bold text-blue-700 underline flex items-center gap-1"
                                        >
                                            <Copy size={12} /> Copy Link
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. SMS / MMS VISUALISER */}
                    {activeChannel === 'SMS' && (
                        <div className="space-y-4">
                            {/* SMS / MMS Mode Toggle */}
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                <div className="text-xs">
                                    <span className="font-bold text-gray-700">Recipient: </span>
                                    <span className="font-semibold text-indigo-700">{customer.mobile || customer.phone || '07123 456789'}</span>
                                    <span className="text-gray-400 ml-2">({getCustomerDisplayName(customer)})</span>
                                </div>
                                <div className="flex gap-1.5 p-1 bg-gray-200 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setSmsMode('mms')}
                                        className={`py-1 px-3 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                                            smsMode === 'mms' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-700 hover:text-black'
                                        }`}
                                    >
                                        <ImageIcon size={13} />
                                        <span>Rich Graphic MMS Card</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSmsMode('sms')}
                                        className={`py-1 px-3 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                                            smsMode === 'sms' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-700 hover:text-black'
                                        }`}
                                    >
                                        <MessageSquare size={13} />
                                        <span>Standard SMS Text</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="w-full max-w-md bg-slate-900 rounded-[36px] p-3 shadow-2xl border-4 border-slate-700">
                                    {/* Smartphone Status Bar */}
                                    <div className="px-6 pt-2 pb-1 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                                        <span>9:41</span>
                                        <div className="flex items-center gap-1.5">
                                            <span>5G</span>
                                            <span>100%</span>
                                        </div>
                                    </div>

                                    {/* iOS / Android Contact Bar */}
                                    <div className="bg-slate-800/90 text-white rounded-t-[24px] px-4 py-3 flex items-center justify-between text-xs border-b border-slate-700">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-xs">
                                                BS
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-white text-xs">Brookspeed Automotive</p>
                                                <p className="text-[10px] text-slate-400">Verified Service Dispatch</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Phone size={14} className="hover:text-white cursor-pointer" />
                                        </div>
                                    </div>

                                    {/* Phone Screen Thread */}
                                    <div className="bg-[#EFEFF4] p-3.5 min-h-[420px] flex flex-col justify-end rounded-b-[24px] space-y-3">
                                        <div className="text-center">
                                            <span className="text-[10px] bg-black/10 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                                                Today 9:41 AM
                                            </span>
                                        </div>

                                        {/* Graphic MMS Card */}
                                        {smsMode === 'mms' && (
                                            <div className="rounded-2xl overflow-hidden shadow-lg border border-blue-200 bg-white animate-fade-in">
                                                {/* Vivid Electric Blue Graphic Banner */}
                                                <div className="bg-gradient-to-br from-[#0055FF] via-[#0066FF] to-[#003D99] p-4 text-white relative overflow-hidden">
                                                    <div className="absolute right-[-20px] top-[-20px] w-28 h-28 rounded-full bg-white/10 pointer-events-none blur-xl"></div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Shield size={14} className="text-yellow-300 fill-yellow-300" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-100">Official Service Notice</span>
                                                        </div>
                                                        <span className="text-[10px] bg-white/20 backdrop-blur-xs font-bold px-2 py-0.5 rounded-full text-white">
                                                            Brookspeed
                                                        </span>
                                                    </div>

                                                    {/* UK Number Plate & Vehicle */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex items-stretch bg-[#FACC15] border border-yellow-500 rounded shadow-xs overflow-hidden">
                                                            <div className="bg-[#003399] text-white px-1.5 py-0.5 flex flex-col items-center justify-center text-[7px] font-black">
                                                                <span>🇬🇧</span>
                                                            </div>
                                                            <div className="px-2.5 py-0.5 font-mono font-black text-black text-xs uppercase tracking-wider">
                                                                {vehicle?.registration || 'VEHICLE'}
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-extrabold text-white drop-shadow-xs">
                                                            {vehicle?.make} {vehicle?.model}
                                                        </span>
                                                    </div>

                                                    {/* Expiry Badge */}
                                                    <div className="mt-3 p-2 bg-black/25 backdrop-blur-xs rounded-xl border border-white/20 flex items-center justify-between">
                                                        <span className="text-xs font-bold flex items-center gap-1 text-white">
                                                            <Calendar size={13} className="text-yellow-300" />
                                                            {reminder.type} Expiry:
                                                        </span>
                                                        <span className="text-xs font-black text-yellow-300">
                                                            {reminder.dueDate || 'Soon'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Quick Action Pills on MMS Card */}
                                                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                                                    {reminder.type === 'MOT' && (
                                                        <a
                                                            href={interactiveBookingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full py-2 px-3 bg-[#0066FF] hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition"
                                                        >
                                                            <Calendar size={13} /> Request Preferred Date Online
                                                        </a>
                                                    )}
                                                    <a
                                                        href="tel:02380641672"
                                                        className="w-full py-1.5 px-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition"
                                                    >
                                                        <Phone size={12} className="text-gray-600" /> Direct Garage: 02380 641672
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* Rich Link Preview Card (if interactive link included) */}
                                        {interactiveBookingUrl && (
                                            <div 
                                                onClick={() => window.open(interactiveBookingUrl, '_blank')}
                                                className="bg-white rounded-2xl overflow-hidden border border-gray-300 shadow-sm cursor-pointer hover:border-blue-400 transition"
                                            >
                                                <div className="h-16 bg-gradient-to-r from-blue-700 to-indigo-700 flex items-center justify-center text-white gap-2">
                                                    <Car size={20} />
                                                    <span className="font-extrabold text-xs">Brookspeed MOT Portal</span>
                                                </div>
                                                <div className="p-2.5">
                                                    <p className="text-[10px] text-gray-400 font-semibold uppercase">brookspeed.com</p>
                                                    <p className="font-bold text-xs text-gray-900 line-clamp-1">Select your preferred MOT date & time</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">Instant booking request for {vehicle?.registration || 'your vehicle'}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* SMS Message Bubble */}
                                        <div className="bg-[#007AFF] text-white p-3.5 rounded-2xl rounded-tr-xs text-xs shadow-md leading-relaxed space-y-2">
                                            <p className="whitespace-pre-wrap">{smsBody}</p>
                                        </div>
                                        <span className="text-[10px] text-gray-500 text-right mt-0.5 font-medium">Delivered</span>
                                    </div>

                                    {/* Editable text area */}
                                    <div className="p-3 pt-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Edit SMS Content</label>
                                        <textarea
                                            rows={3}
                                            value={smsBody}
                                            onChange={e => setSmsBody(e.target.value)}
                                            className="w-full p-2 bg-slate-800 text-white rounded-lg text-xs font-mono border border-slate-700 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. WHATSAPP VISUALISER */}
                    {activeChannel === 'WhatsApp' && (
                        <div className="space-y-4">
                            {/* WhatsApp Mode Toggle */}
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                <div className="text-xs">
                                    <span className="font-bold text-gray-700">Recipient: </span>
                                    <span className="font-semibold text-emerald-700">{customer.mobile || customer.phone || '07123 456789'}</span>
                                    <span className="text-gray-400 ml-2">({getCustomerDisplayName(customer)})</span>
                                </div>
                                <div className="flex gap-1.5 p-1 bg-gray-200 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setWaMode('graphic')}
                                        className={`py-1 px-3 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                                            waMode === 'graphic' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-700 hover:text-black'
                                        }`}
                                    >
                                        <Sparkles size={13} />
                                        <span>Rich Interactive Template</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWaMode('text')}
                                        className={`py-1 px-3 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                                            waMode === 'text' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-700 hover:text-black'
                                        }`}
                                    >
                                        <MessageSquare size={13} />
                                        <span>Plain WhatsApp Text</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="w-full max-w-md bg-[#075E54] rounded-[32px] p-2.5 shadow-2xl border-4 border-[#128C7E]">
                                    {/* WhatsApp Top App Bar */}
                                    <div className="px-3.5 py-2.5 text-white flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-full bg-white text-emerald-900 font-black flex items-center justify-center text-xs shadow-xs">
                                                BS
                                            </div>
                                            <div>
                                                <p className="font-bold text-white leading-none flex items-center gap-1">
                                                    <span>Brookspeed Automotive</span>
                                                    <span className="text-[11px] bg-white text-emerald-600 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center font-extrabold">✓</span>
                                                </p>
                                                <p className="text-[10px] text-emerald-100 mt-0.5">Official Business Account</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-emerald-100">
                                            <Phone size={15} className="hover:text-white cursor-pointer" />
                                        </div>
                                    </div>

                                    {/* WhatsApp Chat Area */}
                                    <div className="bg-[#EFEAE2] p-4 min-h-[420px] flex flex-col justify-end rounded-2xl space-y-3">
                                        <div className="text-center">
                                            <span className="text-[10px] bg-white/80 shadow-2xs text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
                                                TODAY
                                            </span>
                                        </div>

                                        {waMode === 'graphic' ? (
                                            /* WhatsApp Rich Interactive Template Card */
                                            <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-emerald-100 max-w-sm ml-auto animate-fade-in">
                                                {/* Header Graphic Flyer */}
                                                <div className="bg-gradient-to-r from-[#0055FF] to-[#0070FF] p-3 text-white">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[9px] uppercase tracking-widest font-black text-blue-200">
                                                            BROOKSPEED GARAGE
                                                        </span>
                                                        <span className="text-[9px] bg-white/20 font-bold px-1.5 py-0.5 rounded text-white">
                                                            Inspection Due
                                                        </span>
                                                    </div>

                                                    {/* UK Reg Plate */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-stretch bg-[#FACC15] border border-yellow-500 rounded shadow-xs overflow-hidden">
                                                            <div className="bg-[#003399] text-white px-1.5 py-0.5 flex flex-col items-center justify-center text-[7px] font-black">
                                                                <span>🇬🇧</span>
                                                            </div>
                                                            <div className="px-2 py-0.5 font-mono font-black text-black text-xs uppercase tracking-wider">
                                                                {vehicle?.registration || 'REGISTRATION'}
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black text-white drop-shadow-xs">
                                                            {vehicle?.make} {vehicle?.model}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Message Body Content */}
                                                <div className="p-3.5 text-xs text-gray-800 space-y-2.5">
                                                    <p className="font-black text-sm text-gray-900">
                                                        Official Expiry & Service Notice
                                                    </p>

                                                    <div className="p-2.5 bg-gray-50 rounded-xl space-y-1.5 border border-gray-200 text-[11px]">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-500 font-semibold">Service Type:</span>
                                                            <span className="font-extrabold text-blue-700">{reminder.type} Inspection</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-500 font-semibold">Due Date:</span>
                                                            <span className="font-extrabold text-red-600">{reminder.dueDate || 'Soon'}</span>
                                                        </div>
                                                        {vehicle?.taxDueDate && (
                                                            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                                                                <span className="text-gray-500 font-semibold">Road Tax Expiry:</span>
                                                                <span className="font-bold text-gray-800">{formatDisplayDate(vehicle.taxDueDate)}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed">
                                                        {waBody}
                                                    </p>

                                                    <div className="text-[9px] text-gray-400 text-right font-semibold">
                                                        10:42 AM <span className="text-blue-500 font-bold">✓✓</span>
                                                    </div>
                                                </div>

                                                {/* WhatsApp Interactive Button Stack */}
                                                <div className="border-t border-gray-200 divide-y divide-gray-200 text-xs font-bold text-center">
                                                    {reminder.type === 'MOT' && (
                                                        <a
                                                            href={interactiveBookingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 flex items-center justify-center gap-1.5 transition"
                                                        >
                                                            <Calendar size={13} /> Request Preferred MOT Date
                                                        </a>
                                                    )}
                                                    <a
                                                        href="tel:02380641672"
                                                        className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 flex items-center justify-center gap-1.5 transition"
                                                    >
                                                        <Phone size={13} /> Call Workshop (02380 641672)
                                                    </a>
                                                    <div className="py-2 px-3 bg-gray-50 text-gray-500 text-[10px] font-medium">
                                                        Reply with your preferred booking time
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Plain text WhatsApp Bubble */
                                            <div className="bg-[#D9FDD3] text-gray-900 p-3.5 rounded-xl rounded-tr-xs text-xs shadow-sm space-y-2 border border-[#C5EDB7] max-w-sm ml-auto">
                                                <p className="whitespace-pre-wrap leading-relaxed">{waBody}</p>
                                                <div className="text-[9px] text-gray-500 text-right font-semibold">
                                                    10:42 AM <span className="text-blue-500 font-bold">✓✓</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Editable Text Area */}
                                    <div className="p-3 pt-2">
                                        <label className="block text-[10px] font-bold text-emerald-200 uppercase mb-1">Edit WhatsApp Text</label>
                                        <textarea
                                            rows={4}
                                            value={waBody}
                                            onChange={e => setWaBody(e.target.value)}
                                            className="w-full p-2 bg-[#054C44] text-white rounded-lg text-xs font-mono border border-emerald-700 outline-none focus:border-emerald-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                        Sender: <strong className="text-gray-800">info@brookspeed.com</strong> • Auto-logs to Client Account
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                        >
                            Close
                        </button>

                        <button
                            type="button"
                            onClick={handleSendCurrentMessage}
                            disabled={isSending}
                            className={`flex items-center gap-2 py-2.5 px-6 font-black rounded-xl shadow-md text-white text-xs transition active:scale-[0.98] ${
                                activeChannel === 'Email'
                                    ? 'bg-[#0066FF] hover:bg-blue-600'
                                    : activeChannel === 'WhatsApp'
                                    ? 'bg-[#25D366] hover:bg-emerald-600'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            <Send size={14} />
                            {isSending ? 'Sending...' : `Send ${activeChannel} (info@brookspeed.com)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageVisualiserModal;

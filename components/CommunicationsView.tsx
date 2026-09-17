
import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Reminder, ReminderStatus, Customer, Vehicle, BusinessEntity, ReminderType } from '../types';
import { Search, History, Bell, Check, X as XIcon, Mail, MessageSquare, Send, Trash2, PlusCircle, Wand2, Filter, Clock, ExternalLink, Sparkles, Calendar, Edit, Edit3, Eye, Zap } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import SendReminderModal from './SendReminderModal';
import CreateMarketingReminderModal from './CreateMarketingReminderModal';
import GenerateRemindersModal from './GenerateRemindersModal';
import RollingCommsModal from './RollingCommsModal';
import NotificationsHubCard, { generateNotificationsHubEmailHtml } from './comms/NotificationsHubCard';
import SendMotRequestModal from './comms/SendMotRequestModal';
import MessageVisualiserModal from './comms/MessageVisualiserModal';
import { saveDocument, deleteDocument } from '../core/db';
import { sendOutboundEmail } from '../core/services/emailService';
import { logOutboundCorrespondence } from '../core/services/commsCorrespondenceService';
import { generateReminderMessage } from '../core/utils/templateUtils';
import { toast } from 'react-toastify';

const CommunicationsView: React.FC = () => {
    const { users, setConfirmation } = useApp();
    const { reminders, setReminders, customers, vehicles, jobs, businessEntities } = useData();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReminderIds, setSelectedReminderIds] = useState(new Set<string>());
    const [typeFilter, setTypeFilter] = useState<ReminderType[]>([]);
    const [campaignFilter, setCampaignFilter] = useState<string>('all');
    const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isRollingCommsModalOpen, setIsRollingCommsModalOpen] = useState(false);
    const [hubPreviewData, setHubPreviewData] = useState<{ vehicle: Vehicle; customer: Customer } | null>(null);
    const [motModalData, setMotModalData] = useState<{
        isOpen: boolean;
        vehicle: Vehicle | null;
        customer: Customer | null;
        reminder: Reminder | null;
    }>({ isOpen: false, vehicle: null, customer: null, reminder: null });

    const [visualiserData, setVisualiserData] = useState<{
        isOpen: boolean;
        reminder: Reminder | null;
        customer: Customer | null;
        vehicle: Vehicle | null;
    }>({ isOpen: false, reminder: null, customer: null, vehicle: null });

    const [autoSendQueued, setAutoSendQueued] = useState<boolean>(() => {
        return localStorage.getItem('brookspeed_auto_send_queued') === 'true';
    });
    const [isAutoSending, setIsAutoSending] = useState(false);

    const [sendModalData, setSendModalData] = useState<{
        isOpen: boolean;
        reminder: Reminder | null;
        customer: Customer | null;
        vehicle: Vehicle | null;
        method: 'Email' | 'SMS' | 'WhatsApp' | null;
        entity: BusinessEntity | null;
    }>({ isOpen: false, reminder: null, customer: null, vehicle: null, method: null, entity: null });

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

    const handleTypeToggle = (type: ReminderType) => {
        setTypeFilter(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const reminderTypes: ReminderType[] = ['MOT', 'Tax', 'Service', 'Winter Check', 'Marketing'];

    // Get unique campaign names (eventNames) from reminders
    const campaigns = useMemo(() => {
        const names = new Set(reminders.map(r => r.eventName).filter(Boolean));
        return Array.from(names);
    }, [reminders]);

    const filteredReminders = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return reminders.filter(reminder => {
            const customer = customerMap.get(reminder.customerId);
            const vehicle = reminder.vehicleId ? vehicleMap.get(reminder.vehicleId) : null;

            const matchesSearch = searchTerm === '' ||
                (customer && getCustomerDisplayName(customer).toLowerCase().includes(lowerSearch)) ||
                (vehicle && vehicle.registration.toLowerCase().includes(lowerSearch)) ||
                reminder.type.toLowerCase().includes(lowerSearch) ||
                (reminder.eventName && reminder.eventName.toLowerCase().includes(lowerSearch));

            const matchesType = typeFilter.length === 0 || typeFilter.includes(reminder.type);
            const matchesCampaign = campaignFilter === 'all' || reminder.eventName === campaignFilter;

            return matchesSearch && matchesType && matchesCampaign;
        });
    }, [reminders, searchTerm, typeFilter, campaignFilter, customerMap, vehicleMap]);

    const pendingReminders = useMemo(() => 
        filteredReminders.filter(r => r.status === 'Pending').sort((a,b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    , [filteredReminders]);

    const historyReminders = useMemo(() => 
        filteredReminders.filter(r => r.status !== 'Pending').sort((a,b) => (b.actionedAt || '').localeCompare(a.actionedAt || ''))
    , [filteredReminders]);

    const handleAction = async (id: string, status: 'Sent' | 'Dismissed') => {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
            const updated = { ...reminder, status, actionedAt: new Date().toISOString() };
            setReminders(prev => prev.map(r => r.id === id ? updated : r));
            try {
                await saveDocument('brooks_reminders', updated);
            } catch (error) {
                console.error("Failed to update reminder in Firestore:", error);
            }
        }
    };

    const openSendModal = (reminder: Reminder, customer: Customer, vehicle: Vehicle | null, method: 'Email' | 'SMS' | 'WhatsApp') => {
        const lastJob = vehicle ? jobs
            .filter(j => j.vehicleId === vehicle.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : undefined;

        const entity = businessEntities.find(e => e.id === lastJob?.entityId) || businessEntities[0];
        
        setSendModalData({ isOpen: true, reminder, customer, vehicle, method, entity: entity || null });
    };

    const handleSend = () => {
        if (sendModalData.reminder) {
            handleAction(sendModalData.reminder.id, 'Sent');
        }
        setSendModalData({ isOpen: false, reminder: null, customer: null, vehicle: null, method: null, entity: null });
    };
    
    const handleCreateMarketingReminders = async (eventName: string, eventDate: string) => {
        const consentingCustomers = customers.filter(c => c.marketingConsent);
        const newReminders: Reminder[] = consentingCustomers.map(customer => ({
            id: crypto.randomUUID(),
            customerId: customer.id,
            type: 'Marketing',
            dueDate: eventDate,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            eventName: eventName,
        }));

        setReminders(prev => [...prev, ...newReminders]);
        setConfirmation({
            isOpen: true,
            title: 'Marketing Campaign Created',
            message: `${newReminders.length} marketing reminders have been generated and added to the 'Pending' list.`,
            type: 'success',
            onConfirm: () => setConfirmation({ isOpen: false, title: '', message: '' }),
            confirmText: 'OK',
        });

        try {
            await Promise.all(newReminders.map(r => saveDocument('brooks_reminders', r)));
        } catch (error) {
            console.error("Failed to save marketing reminders to Firestore:", error);
        }
    };

    const handleGeneratedReminders = async (newReminders: Reminder[]) => {
        setReminders(prev => [...prev, ...newReminders]);
        setConfirmation({
            isOpen: true,
            title: 'Campaign Created',
            message: `${newReminders.length} reminders have been created and added to the 'Pending' list.`,
            type: 'success',
        });

        try {
            await Promise.all(newReminders.map(r => saveDocument('brooks_reminders', r)));
        } catch (error) {
            console.error("Failed to save generated reminders to Firestore:", error);
        }
    };

    const handleSelect = (id: string) => {
        setSelectedReminderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        if (selectedReminderIds.size === pendingReminders.length) {
            setSelectedReminderIds(new Set());
        } else {
            setSelectedReminderIds(new Set(pendingReminders.map(r => r.id)));
        }
    };

    const handleBulkDismiss = async () => {
        const updatedList: Reminder[] = [];
        const nowStr = new Date().toISOString();

        setReminders(prev => prev.map(r => {
            if (selectedReminderIds.has(r.id)) {
                const updated = { ...r, status: 'Dismissed' as const, actionedAt: nowStr };
                updatedList.push(updated);
                return updated;
            }
            return r;
        }));
        setSelectedReminderIds(new Set());

        try {
            await Promise.all(updatedList.map(r => saveDocument('brooks_reminders', r)));
        } catch (error) {
            console.error("Failed to bulk dismiss reminders in Firestore:", error);
        }
    };

    const handleDeleteSingleReminder = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Are you sure you want to permanently delete this reminder message?")) {
            return;
        }
        setReminders(prev => prev.filter(r => r.id !== id));
        setSelectedReminderIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        try {
            await deleteDocument('brooks_reminders', id);
            toast.success("Reminder deleted.");
        } catch (error) {
            console.error("Failed to delete reminder from Firestore:", error);
            toast.error("Failed to delete reminder.");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedReminderIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to permanently delete ${selectedReminderIds.size} selected reminder(s)?`)) {
            return;
        }
        const idsToDelete = Array.from(selectedReminderIds);
        setReminders(prev => prev.filter(r => !selectedReminderIds.has(r.id)));
        setSelectedReminderIds(new Set());
        try {
            await Promise.all(idsToDelete.map(id => deleteDocument('brooks_reminders', id)));
            toast.success(`${idsToDelete.length} reminder(s) deleted permanently.`);
        } catch (error) {
            console.error("Failed to bulk delete reminders:", error);
            toast.error("Failed to delete all selected reminders.");
        }
    };

    const handleToggleAutoSend = () => {
        const next = !autoSendQueued;
        setAutoSendQueued(next);
        localStorage.setItem('brookspeed_auto_send_queued', String(next));
        toast.info(next ? 'Auto-send queued messages enabled' : 'Auto-send queued messages disabled');
    };

    const handleAutoSendAllQueued = async () => {
        if (pendingReminders.length === 0) {
            toast.info("No pending reminders to auto-send.");
            return;
        }
        if (!window.confirm(`Auto-send all ${pendingReminders.length} queued reminder(s) from info@brookspeed.com according to customer preferences?`)) {
            return;
        }

        setIsAutoSending(true);
        let sentCount = 0;
        let skippedCount = 0;
        const updatedList: Reminder[] = [];
        const nowIso = new Date().toISOString();

        for (const reminder of pendingReminders) {
            const customer = customerMap.get(reminder.customerId);
            const vehicle = reminder.vehicleId ? vehicleMap.get(reminder.vehicleId) : null;
            if (!customer) {
                skippedCount++;
                continue;
            }

            const pref = customer.communicationPreference || (customer.email ? 'Email' : 'SMS');
            const entity = businessEntities[0] || null;

            try {
                if (pref === 'Email' && customer.email) {
                    const origin = typeof window !== 'undefined' && window.location?.origin 
                        ? window.location.origin 
                        : 'https://intelligent-scheduling-v801.web.app';
                    const bookingUrl = `${origin}/?view=mot&vrm=${encodeURIComponent(vehicle?.registration || '')}&vehicleId=${vehicle?.id || ''}&customerId=${customer.id}`;
                    
                    const html = vehicle 
                        ? generateNotificationsHubEmailHtml(vehicle, customer, 60, bookingUrl)
                        : `<p>Reminder: ${reminder.type} is due on ${reminder.dueDate || 'soon'}.</p>`;

                    await sendOutboundEmail({
                        to: customer.email,
                        fromName: 'Brookspeed',
                        fromEmail: 'info@brookspeed.com',
                        subject: `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                        body: html
                    });

                    await logOutboundCorrespondence(
                        customer,
                        vehicle || null,
                        `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                        `[Auto-Send] Outbound Email reminder sent from info@brookspeed.com for ${reminder.type}.`,
                        'Email',
                        entity,
                        customer.email
                    );
                    sentCount++;
                } else if ((pref === 'SMS' || pref === 'WhatsApp') && (customer.mobile || customer.phone)) {
                    await logOutboundCorrespondence(
                        customer,
                        vehicle || null,
                        `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                        `[Auto-Send] Outbound ${pref} reminder queued for ${reminder.type}.`,
                        pref as 'SMS' | 'WhatsApp',
                        entity,
                        customer.mobile || customer.phone
                    );
                    sentCount++;
                } else {
                    skippedCount++;
                    continue;
                }

                const updated: Reminder = {
                    ...reminder,
                    status: 'Sent',
                    actionedAt: nowIso
                };
                updatedList.push(updated);
            } catch (err) {
                console.error(`Error auto-sending reminder ${reminder.id}:`, err);
                skippedCount++;
            }
        }

        if (updatedList.length > 0) {
            const updatedMap = new Map(updatedList.map(r => [r.id, r]));
            setReminders(prev => prev.map(r => updatedMap.get(r.id) || r));
            try {
                await Promise.all(updatedList.map(r => saveDocument('brooks_reminders', r)));
            } catch (err) {
                console.error("Failed to update sent reminders in DB:", err);
            }
        }

        setIsAutoSending(false);
        toast.success(`Auto-send completed: ${sentCount} sent, ${skippedCount} skipped.`);
    };

    const handleBulkSend = async () => {
        let sentCount = { email: 0, sms: 0 };
        let skippedCount = 0;
        const remindersToUpdate = new Set(selectedReminderIds);
        const updatedList: Reminder[] = [];
        const nowIso = new Date().toISOString();

        for (const reminder of reminders) {
            if (!remindersToUpdate.has(reminder.id)) continue;
            const customer = customerMap.get(reminder.customerId);
            const vehicle = reminder.vehicleId ? vehicleMap.get(reminder.vehicleId) : null;
            if (!customer) {
                skippedCount++;
                continue;
            }
            const entity = businessEntities[0] || null;
            const preference = customer.communicationPreference || (customer.email ? 'Email' : 'SMS');

            if (preference === 'Email' && customer.email) {
                try {
                    const origin = typeof window !== 'undefined' && window.location?.origin 
                        ? window.location.origin 
                        : 'https://intelligent-scheduling-v801.web.app';
                    const bookingUrl = `${origin}/?view=mot&vrm=${encodeURIComponent(vehicle?.registration || '')}&vehicleId=${vehicle?.id || ''}&customerId=${customer.id}`;
                    const html = vehicle 
                        ? generateNotificationsHubEmailHtml(vehicle, customer, 60, bookingUrl)
                        : `<p>Reminder for ${vehicle?.registration || 'your vehicle'}: ${reminder.type} is due on ${reminder.dueDate}.</p>`;

                    await sendOutboundEmail({
                        to: customer.email,
                        fromName: 'Brookspeed',
                        fromEmail: 'info@brookspeed.com',
                        subject: `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                        body: html
                    });

                    await logOutboundCorrespondence(
                        customer,
                        vehicle,
                        `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                        `[Bulk Send] Sent outbound email from info@brookspeed.com for ${reminder.type}`,
                        'Email',
                        entity,
                        customer.email
                    );
                    sentCount.email++;
                    const updated = { ...reminder, status: 'Sent' as ReminderStatus, actionedAt: nowIso };
                    updatedList.push(updated);
                } catch (err) {
                    console.error("Bulk email error:", err);
                    skippedCount++;
                }
            } else if ((preference === 'SMS' || preference === 'WhatsApp') && (customer.mobile || customer.phone)) {
                await logOutboundCorrespondence(
                    customer,
                    vehicle,
                    `${reminder.type} Reminder - ${vehicle?.registration || 'Brookspeed'}`,
                    `[Bulk Send] Outbound ${preference} queued for ${reminder.type}`,
                    preference as 'SMS' | 'WhatsApp',
                    entity,
                    customer.mobile || customer.phone
                );
                sentCount.sms++;
                const updated = { ...reminder, status: 'Sent' as ReminderStatus, actionedAt: nowIso };
                updatedList.push(updated);
            } else {
                skippedCount++;
            }
        }

        const updatedMap = new Map(updatedList.map(u => [u.id, u]));
        setReminders(prev => prev.map(r => updatedMap.get(r.id) || r));
        setSelectedReminderIds(new Set());

        let messageParts: string[] = [];
        messageParts.push(`Sent ${sentCount.email + sentCount.sms} reminders from info@brookspeed.com.`);
        if (sentCount.email > 0) messageParts.push(`- ${sentCount.email} via Email`);
        if (sentCount.sms > 0) messageParts.push(`- ${sentCount.sms} via SMS`);
        if (skippedCount > 0) {
            messageParts.push(`${skippedCount} reminders were skipped due to missing contact info.`);
        }
    
        setConfirmation({
            isOpen: true,
            title: 'Bulk Send Complete',
            message: <div className="text-sm text-gray-600 space-y-1">{messageParts.map((part, i) => <p key={i}>{part}</p>)}</div>,
            type: 'success',
            onConfirm: () => setConfirmation({ isOpen: false, title: '', message: '' }),
            confirmText: 'OK',
        });

        try {
            await Promise.all(updatedList.map(r => saveDocument('brooks_reminders', r)));
        } catch (error) {
            console.error("Failed to bulk send reminders in Firestore:", error);
        }
    };

    const renderBulkActionHeader = () => {
        if (selectedReminderIds.size === 0) return null;

        return (
            <div className="p-3 mb-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center animate-fade-in">
                <span className="font-semibold text-indigo-800">{selectedReminderIds.size} reminder(s) selected</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-xs transition"
                        title="Permanently delete selected reminders"
                    >
                        <Trash2 size={14} /> Delete Selected
                    </button>
                    <button
                        onClick={handleBulkDismiss}
                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
                    >
                        <XIcon size={14} /> Dismiss Selected
                    </button>
                    <button
                        onClick={handleBulkSend}
                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-xs transition"
                    >
                        <Send size={14} /> Send Selected (from info@brookspeed.com)
                    </button>
                </div>
            </div>
        );
    };

    const renderReminderList = (list: Reminder[], isHistory = false) => {
        if (list.length === 0) {
            return <div className="text-center p-8 text-gray-500 bg-white rounded-lg">No reminders found matching your filters.</div>;
        }

        if (isHistory) {
             return (
                <div className="space-y-3">
                    {list.map(reminder => {
                        const customer = customerMap.get(reminder.customerId);
                        const vehicle = reminder.vehicleId ? vehicleMap.get(reminder.vehicleId) : null;
                        if (!customer) return null;

                        return (
                            <div key={reminder.id} className="p-4 bg-white rounded-lg shadow-sm border flex justify-between items-center hover:border-indigo-300 transition-colors">
                                <div 
                                    className="cursor-pointer flex-grow pr-4"
                                    onClick={() => setVisualiserData({ isOpen: true, reminder, customer, vehicle })}
                                    title="Click to visualise message in all formats"
                                >
                                    <p className="font-bold text-gray-800 hover:text-indigo-600 transition">{getCustomerDisplayName(customer)}</p>
                                    <p className="text-sm text-gray-600">
                                        {reminder.eventName ? <span className="font-semibold text-indigo-600">[{reminder.eventName}] </span> : ''}
                                        {reminder.type === 'Marketing' 
                                            ? `${reminder.eventName} (Event on ${reminder.dueDate})`
                                            : `${vehicle?.registration} - ${reminder.type} due on ${reminder.dueDate}`
                                        }
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setVisualiserData({ isOpen: true, reminder, customer, vehicle })}
                                        className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 transition text-xs shadow-xs"
                                        title="Visualise message types (Email card, SMS, WhatsApp)"
                                    >
                                        <Eye size={13} className="text-blue-600" /> Visualise
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteSingleReminder(reminder.id, e)}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                        title="Delete reminder history record"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            reminder.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                        }`}>{reminder.status}</span>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {reminder.actionedAt ? `on ${new Date(reminder.actionedAt).toLocaleDateString()}` : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        const isAllSelected = pendingReminders.length > 0 && selectedReminderIds.size === pendingReminders.length;
        const isSomeSelected = selectedReminderIds.size > 0 && selectedReminderIds.size < pendingReminders.length;

        return (
            <div>
                {renderBulkActionHeader()}
                <div className="space-y-3">
                    <div className="p-2 bg-white rounded-lg border flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                ref={el => { if (el) { el.indeterminate = isSomeSelected; } }}
                                onChange={handleSelectAll}
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4 cursor-pointer"
                                aria-label="Select all pending reminders"
                            />
                            <label className="font-semibold text-sm cursor-pointer" onClick={handleSelectAll}>
                                {isAllSelected ? 'Deselect All' : 'Select All'}
                            </label>
                        </div>
                        <div className="text-xs text-gray-500">
                            Showing {list.length} reminders
                        </div>
                    </div>
                    {list.map(reminder => {
                        const customer = customerMap.get(reminder.customerId);
                        const vehicle = reminder.vehicleId ? vehicleMap.get(reminder.vehicleId) : null;
                        if (!customer) return null;
                        
                        const hasEmail = !!customer.email;
                        const hasSms = !!(customer.mobile || customer.phone);
                        const isSelected = selectedReminderIds.has(reminder.id);

                        return (
                            <div key={reminder.id} className={`p-4 bg-white rounded-lg shadow-sm border flex items-center transition-colors hover:border-indigo-300 ${isSelected ? 'bg-indigo-50 border-indigo-300' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSelect(reminder.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4 flex-shrink-0 cursor-pointer"
                                    aria-label={`Select reminder for ${getCustomerDisplayName(customer)}`}
                                />
                                <div 
                                    className="flex-grow cursor-pointer" 
                                    onClick={() => setVisualiserData({ isOpen: true, reminder, customer, vehicle })}
                                    title="Click to visualise message types and edit"
                                >
                                    <p className="font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
                                        <span>{getCustomerDisplayName(customer)}</span>
                                        <span className="text-[11px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Click to visualise</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {reminder.eventName ? <span className="font-semibold text-indigo-600">[{reminder.eventName}] </span> : ''}
                                        {reminder.type === 'Marketing'
                                            ? `${reminder.eventName} (Event on ${reminder.dueDate})`
                                            : `${vehicle?.registration} - ${reminder.type} due on ${reminder.dueDate}`
                                        }
                                    </p>
                                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                                        Preferred Contact: {customer.communicationPreference || 'Not set'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Message Visualiser Button */}
                                    <button
                                        type="button"
                                        onClick={() => setVisualiserData({ isOpen: true, reminder, customer, vehicle })}
                                        className="flex items-center gap-1.5 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
                                        title="Visualise message across Email card, SMS, and WhatsApp mockups"
                                    >
                                        <Eye size={13} /> Visualise
                                    </button>

                                    {/* Edit Reminder */}
                                    <button
                                        type="button"
                                        onClick={() => setVisualiserData({ isOpen: true, reminder, customer, vehicle })}
                                        className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                                        title="Edit reminder text, date, and status"
                                    >
                                        <Edit3 size={15} />
                                    </button>

                                    {/* Delete Reminder */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteSingleReminder(reminder.id, e)}
                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                        title="Permanently delete reminder"
                                    >
                                        <Trash2 size={15} />
                                    </button>

                                    {reminder.type === 'MOT' && vehicle && (
                                        <button
                                            type="button"
                                            onClick={() => setMotModalData({ isOpen: true, vehicle, customer, reminder })}
                                            className="flex items-center gap-1.5 py-2 px-3 bg-[#0066FF] hover:bg-blue-600 text-white font-bold rounded-lg transition text-xs shadow-xs"
                                            title="Send interactive MOT booking request to customer"
                                        >
                                            <Calendar size={13} /> Send MOT Request
                                        </button>
                                    )}
                                    {(reminder.type === 'MOT' || reminder.type === 'Tax') && vehicle && (
                                        <button
                                            type="button"
                                            onClick={() => setHubPreviewData({ vehicle, customer })}
                                            className="flex items-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg border border-blue-200 transition text-xs"
                                            title="Preview Notifications Hub Card"
                                        >
                                            <Bell size={14} className="text-blue-600" /> Hub Card
                                        </button>
                                    )}
                                    {reminder.type === 'Tax' && (
                                        <a
                                            href="https://www.gov.uk/vehicle-tax"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 py-2 px-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-black text-xs transition"
                                            title="Open official UK Govt Tax / SORN website"
                                        >
                                            <span>Gov Tax</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleAction(reminder.id, 'Dismissed')}
                                        className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
                                        title="Dismiss"
                                    >
                                        <XIcon size={16} />
                                    </button>
                                    <button
                                        onClick={() => openSendModal(reminder, customer, vehicle, 'SMS')}
                                        disabled={!hasSms}
                                        className="flex items-center gap-1.5 py-2 px-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition"
                                        title={hasSms ? 'Send SMS' : 'No mobile/phone number available'}
                                    >
                                        <MessageSquare size={14} /> SMS
                                    </button>
                                    <button
                                        onClick={() => openSendModal(reminder, customer, vehicle, 'WhatsApp')}
                                        disabled={!hasSms}
                                        className="flex items-center gap-1.5 py-2 px-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition shadow-xs"
                                        title={hasSms ? 'Send WhatsApp' : 'No mobile/phone number available'}
                                    >
                                        <span>💬</span> WhatsApp
                                    </button>
                                    <button
                                        onClick={() => openSendModal(reminder, customer, vehicle, 'Email')}
                                        disabled={!hasEmail}
                                        className="flex items-center gap-1.5 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={hasEmail ? 'Send Email from info@brookspeed.com' : 'No email address available'}
                                    >
                                        <Mail size={16} /> Email
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span>Reminders & Communications</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Outbound notifications delivered via info@brookspeed.com & registered to customer correspondence</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Auto-Send Queued Switch */}
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-xs">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Zap size={14} className={autoSendQueued ? 'text-amber-500 fill-amber-400' : 'text-gray-400'} />
                            Auto-Send Queued
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSendQueued}
                                onChange={handleToggleAutoSend}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        {autoSendQueued && pendingReminders.length > 0 && (
                            <button
                                type="button"
                                onClick={handleAutoSendAllQueued}
                                disabled={isAutoSending}
                                className="ml-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1 disabled:opacity-50 transition cursor-pointer"
                                title="Dispatch all queued reminders now via info@brookspeed.com"
                            >
                                <Send size={12} className={isAutoSending ? 'animate-spin' : ''} />
                                {isAutoSending ? 'Sending...' : `Send Queued (${pendingReminders.length})`}
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={() => setIsRollingCommsModalOpen(true)}
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition"
                        title="Configure automated rolling programme for MOT & Road Tax"
                    >
                        <Clock size={16}/> Rolling Comms Programme
                    </button>
                    <button 
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"
                    >
                        <Wand2 size={16}/> Create Reminder Campaign
                    </button>
                    <button 
                        onClick={() => setIsMarketingModalOpen(true)}
                        className="flex items-center gap-2 py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700"
                    >
                        <PlusCircle size={16}/> Create Marketing Campaign
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by customer, vehicle, or type..."
                            className="w-72 p-2 pl-9 border rounded-lg"
                        />
                    </div>
                </div>
            </header>
            
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div className="flex gap-1 p-1 bg-gray-200 rounded-lg self-start flex-shrink-0">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'pending' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}
                    >
                        <Bell size={16} /> Pending ({pendingReminders.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'history' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}
                    >
                        <History size={16} /> History
                    </button>
                </div>
                 <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-500" />
                        <select 
                            value={campaignFilter} 
                            onChange={(e) => setCampaignFilter(e.target.value)} 
                            className="p-1.5 border rounded-lg text-sm bg-white max-w-[200px]"
                        >
                            <option value="all">All Campaigns</option>
                            {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        {reminderTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => handleTypeToggle(type)}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                    typeFilter.includes(type)
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    {(typeFilter.length > 0 || campaignFilter !== 'all') && (
                        <button onClick={() => { setTypeFilter([]); setCampaignFilter('all'); }} className="text-xs text-indigo-600 hover:underline">
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            <main className="flex-grow overflow-y-auto">
                {activeTab === 'pending' ? renderReminderList(pendingReminders) : renderReminderList(historyReminders, true)}
            </main>

            {sendModalData.isOpen && sendModalData.reminder && sendModalData.customer && sendModalData.method && (
                <SendReminderModal
                    isOpen={sendModalData.isOpen}
                    onClose={() => setSendModalData({ isOpen: false, reminder: null, customer: null, vehicle: null, method: null, entity: null })}
                    onSend={handleSend}
                    reminder={sendModalData.reminder}
                    customer={sendModalData.customer}
                    vehicle={sendModalData.vehicle}
                    method={sendModalData.method}
                    entity={sendModalData.entity}
                />
            )}
            
            {isMarketingModalOpen && (
                <CreateMarketingReminderModal
                    isOpen={isMarketingModalOpen}
                    onClose={() => setIsMarketingModalOpen(false)}
                    onCreate={handleCreateMarketingReminders}
                />
            )}

            {isGenerateModalOpen && (
                <GenerateRemindersModal 
                    isOpen={isGenerateModalOpen}
                    onClose={() => setIsGenerateModalOpen(false)}
                    onGenerate={handleGeneratedReminders}
                    vehicles={vehicles}
                    customers={customers}
                />
            )}

            {isRollingCommsModalOpen && (
                <RollingCommsModal
                    isOpen={isRollingCommsModalOpen}
                    onClose={() => setIsRollingCommsModalOpen(false)}
                    vehicles={vehicles}
                    customers={customers}
                    existingReminders={reminders}
                    onGenerated={handleGeneratedReminders}
                />
            )}

            {hubPreviewData && (
                <div className="fixed inset-0 bg-gray-900/75 z-[80] flex justify-center items-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-lg w-full max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b">
                            <span className="font-extrabold text-sm text-gray-900">Notifications Hub Preview</span>
                            <button
                                type="button"
                                onClick={() => setHubPreviewData(null)}
                                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <NotificationsHubCard
                            vehicle={hubPreviewData.vehicle}
                            customer={hubPreviewData.customer}
                            onBack={() => setHubPreviewData(null)}
                            onOpenSettings={() => {
                                setHubPreviewData(null);
                                setIsRollingCommsModalOpen(true);
                            }}
                        />
                    </div>
                </div>
            )}

            {motModalData.isOpen && motModalData.vehicle && (
                <SendMotRequestModal
                    isOpen={motModalData.isOpen}
                    onClose={() => setMotModalData({ isOpen: false, vehicle: null, customer: null, reminder: null })}
                    vehicle={motModalData.vehicle}
                    customer={motModalData.customer}
                    reminder={motModalData.reminder}
                    entity={businessEntities[0] || null}
                    onSent={() => {
                        if (motModalData.reminder) {
                            handleAction(motModalData.reminder.id, 'Sent');
                        }
                    }}
                />
            )}

            {/* Live Message Visualiser Modal for any selected reminder */}
            {visualiserData.isOpen && visualiserData.reminder && visualiserData.customer && (
                <MessageVisualiserModal
                    isOpen={visualiserData.isOpen}
                    onClose={() => setVisualiserData({ isOpen: false, reminder: null, customer: null, vehicle: null })}
                    reminder={visualiserData.reminder}
                    customer={visualiserData.customer}
                    vehicle={visualiserData.vehicle}
                    entity={businessEntities[0] || null}
                    onUpdated={(updated) => {
                        setReminders(prev => prev.map(r => r.id === updated.id ? updated : r));
                    }}
                    onDeleted={(deletedId) => {
                        setReminders(prev => prev.filter(r => r.id !== deletedId));
                        setSelectedReminderIds(prev => {
                            const next = new Set(prev);
                            next.delete(deletedId);
                            return next;
                        });
                    }}
                />
            )}
        </div>
    );
};

export default CommunicationsView;


import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Reminder, ReminderStatus, Customer, Vehicle, BusinessEntity, ReminderType } from '../types';
import { Search, History, Bell, Check, X as XIcon, Mail, MessageSquare, Send, Trash2, PlusCircle, Wand2, Filter } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import SendReminderModal from './SendReminderModal';
import CreateMarketingReminderModal from './CreateMarketingReminderModal';
import GenerateRemindersModal from './GenerateRemindersModal';

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

    const [sendModalData, setSendModalData] = useState<{
        isOpen: boolean;
        reminder: Reminder | null;
        customer: Customer | null;
        vehicle: Vehicle | null;
        method: 'Email' | 'SMS' | null;
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

    const reminderTypes: ReminderType[] = ['MOT', 'Service', 'Winter Check', 'Marketing'];

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

    const handleAction = (id: string, status: 'Sent' | 'Dismissed') => {
        setReminders(prev => prev.map(r => 
            r.id === id ? { ...r, status, actionedAt: new Date().toISOString() } : r
        ));
    };

    const openSendModal = (reminder: Reminder, customer: Customer, vehicle: Vehicle | null, method: 'Email' | 'SMS') => {
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
    
    const handleCreateMarketingReminders = (eventName: string, eventDate: string) => {
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
    };

    const handleGeneratedReminders = (newReminders: Reminder[]) => {
        setReminders(prev => [...prev, ...newReminders]);
        setConfirmation({
            isOpen: true,
            title: 'Campaign Created',
            message: `${newReminders.length} reminders have been created and added to the 'Pending' list.`,
            type: 'success',
        });
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

    const handleBulkDismiss = () => {
        setReminders(prev => prev.map(r => 
            selectedReminderIds.has(r.id) 
            ? { ...r, status: 'Dismissed', actionedAt: new Date().toISOString() } 
            : r
        ));
        setSelectedReminderIds(new Set());
    };

    const handleBulkSend = () => {
        let sentCount = { email: 0, sms: 0 };
        let skippedCount = 0;
        const remindersToUpdate = new Set(selectedReminderIds);

        const updatedReminders = reminders.map(r => {
            if (remindersToUpdate.has(r.id)) {
                const customer = customerMap.get(r.customerId);
                if (customer) {
                    const preference = customer.communicationPreference;
                    if (preference === 'Email' && customer.email) {
                        sentCount.email++;
                        return { ...r, status: 'Sent' as ReminderStatus, actionedAt: new Date().toISOString() };
                    }
                    if (preference === 'SMS' && (customer.mobile || customer.phone)) {
                        sentCount.sms++;
                        return { ...r, status: 'Sent' as ReminderStatus, actionedAt: new Date().toISOString() };
                    }
                }
                skippedCount++;
            }
            return r;
        });

        setReminders(updatedReminders);
        setSelectedReminderIds(new Set());

        let messageParts: string[] = [];
        messageParts.push(`Sent ${sentCount.email + sentCount.sms} reminders.`);
        if (sentCount.email > 0) messageParts.push(`- ${sentCount.email} via Email`);
        if (sentCount.sms > 0) messageParts.push(`- ${sentCount.sms} via SMS`);
        if (skippedCount > 0) {
            messageParts.push(`${skippedCount} reminders were skipped due to missing contact info or preference.`);
        }
    
        setConfirmation({
            isOpen: true,
            title: 'Bulk Send Complete',
            message: <div className="text-sm text-gray-600 space-y-1">{messageParts.map((part, i) => <p key={i}>{part}</p>)}</div>,
            type: 'success',
            onConfirm: () => setConfirmation({ isOpen: false, title: '', message: '' }),
            confirmText: 'OK',
        });
    };

    const renderBulkActionHeader = () => {
        if (selectedReminderIds.size === 0) return null;

        return (
            <div className="p-3 mb-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center animate-fade-in">
                <span className="font-semibold text-indigo-800">{selectedReminderIds.size} reminder(s) selected</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleBulkDismiss}
                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200"
                    >
                        <Trash2 size={14} /> Dismiss Selected
                    </button>
                    <button
                        onClick={handleBulkSend}
                        className="flex items-center gap-1.5 text-sm py-1.5 px-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                    >
                        <Send size={14} /> Send Selected (by preference)
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
                            <div key={reminder.id} className="p-4 bg-white rounded-lg shadow-sm border flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-800">{getCustomerDisplayName(customer)}</p>
                                    <p className="text-sm text-gray-600">
                                        {reminder.eventName ? <span className="font-semibold text-indigo-600">[{reminder.eventName}] </span> : ''}
                                        {reminder.type === 'Marketing' 
                                            ? `${reminder.eventName} (Event on ${reminder.dueDate})`
                                            : `${vehicle?.registration} - ${reminder.type} due on ${reminder.dueDate}`
                                        }
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        reminder.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                    }`}>{reminder.status}</span>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {reminder.actionedAt ? `on ${new Date(reminder.actionedAt).toLocaleDateString()}` : ''}
                                    </p>
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
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4"
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
                            <div key={reminder.id} className={`p-4 bg-white rounded-lg shadow-sm border flex items-center transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-300' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSelect(reminder.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4 flex-shrink-0"
                                    aria-label={`Select reminder for ${getCustomerDisplayName(customer)}`}
                                />
                                <div className="flex-grow">
                                    <p className="font-bold text-gray-800">{getCustomerDisplayName(customer)}</p>
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
                                        className="flex items-center gap-1.5 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={hasSms ? 'Send SMS' : 'No mobile/phone number available'}
                                    >
                                        <MessageSquare size={16} /> SMS
                                    </button>
                                    <button
                                        onClick={() => openSendModal(reminder, customer, vehicle, 'Email')}
                                        disabled={!hasEmail}
                                        className="flex items-center gap-1.5 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={hasEmail ? 'Send Email' : 'No email address available'}
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
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Reminders & Communications</h2>
                <div className="flex items-center gap-4">
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
        </div>
    );
};

export default CommunicationsView;

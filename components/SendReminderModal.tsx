import React, { useState, useEffect } from 'react';
import { Reminder, Customer, Vehicle, BusinessEntity } from '../types';
import { generateReminderMessage } from '../utils/templateUtils';
import { X, Send, Mail, MessageSquare, ExternalLink } from 'lucide-react';
import NotificationsHubCard, { generateNotificationsHubEmailHtml } from './comms/NotificationsHubCard';
import { sendOutboundEmail } from '../core/services/emailService';
import { logOutboundCorrespondence } from '../core/services/commsCorrespondenceService';

interface SendReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: () => void;
    reminder: Reminder;
    customer: Customer;
    vehicle: Vehicle;
    method: 'Email' | 'SMS' | 'WhatsApp';
    entity: BusinessEntity | null;
}

const SendReminderModal: React.FC<SendReminderModalProps> = ({
    isOpen,
    onClose,
    onSend,
    reminder,
    customer,
    vehicle,
    method,
    entity
}) => {
    const [currentMethod, setCurrentMethod] = useState<'Email' | 'SMS' | 'WhatsApp'>(method);
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [viewMode, setViewMode] = useState<'text' | 'card'>('card');

    useEffect(() => {
        if (isOpen) {
            setCurrentMethod(method);
        }
    }, [isOpen, method]);

    useEffect(() => {
        if (isOpen) {
            const message = generateReminderMessage(reminder, customer, vehicle, currentMethod, entity);
            setRecipient(message.recipient);
            setSubject(message.subject);
            setBody(message.body);
            if (currentMethod === 'Email' && (reminder.type === 'MOT' || reminder.type === 'Tax') && vehicle) {
                setViewMode('card');
            } else {
                setViewMode('text');
            }
        }
    }, [isOpen, reminder, customer, vehicle, currentMethod, entity]);
    
    if (!isOpen) return null;

    const handleSend = async () => {
        try {
            if (currentMethod === 'Email' && recipient) {
                const htmlBody = viewMode === 'card' && vehicle
                    ? generateNotificationsHubEmailHtml(vehicle, customer, 60)
                    : body.replace(/\n/g, '<br/>');

                await sendOutboundEmail({
                    to: recipient,
                    fromName: 'Brookspeed',
                    fromEmail: 'info@brookspeed.com',
                    subject: subject,
                    body: htmlBody
                });
            } else if (currentMethod === 'WhatsApp') {
                const cleanPhone = recipient.replace(/[^\d+]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
                window.open(waUrl, '_blank');
            }

            await logOutboundCorrespondence(
                customer,
                vehicle,
                subject || `${reminder.type} Reminder - ${vehicle?.registration || 'Vehicle'}`,
                viewMode === 'card' && currentMethod === 'Email' ? `[Notifications Hub Card Email Sent]\nSubject: ${subject}` : body,
                currentMethod,
                entity,
                recipient
            );
        } catch (err) {
            console.error('Error in handleSend:', err);
        }
        onSend();
    };

    const isMotOrTaxEmail = currentMethod === 'Email' && (reminder.type === 'MOT' || reminder.type === 'Tax') && !!vehicle;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Send size={20} className="mr-2 text-blue-600"/>
                        Send Reminder ({currentMethod})
                    </h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                {/* Channel Switcher */}
                <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl mb-4">
                    <button
                        type="button"
                        onClick={() => setCurrentMethod('Email')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            currentMethod === 'Email'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <Mail size={14} /> Email
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMethod('SMS')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            currentMethod === 'SMS'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <MessageSquare size={14} /> SMS / MMS
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMethod('WhatsApp')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            currentMethod === 'WhatsApp'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <span>💬</span> WhatsApp Text
                    </button>
                </div>

                <div className="space-y-4 text-sm">
                    {isMotOrTaxEmail && (
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200 mb-2">
                            <button
                                type="button"
                                onClick={() => setViewMode('card')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition ${
                                    viewMode === 'card'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                🔔 Notifications Hub Card View (Email Template)
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('text')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition ${
                                    viewMode === 'text'
                                        ? 'bg-white text-gray-900 shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                📝 Plain Text Message
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="font-semibold text-gray-600">
                            {currentMethod === 'Email' ? 'To (Email Address):' : 'To (Mobile / Phone Number):'}
                        </label>
                        <input 
                            type="text" 
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            placeholder={currentMethod === 'Email' ? 'customer@example.com' : '07123456789 or +447123456789'}
                            className="w-full p-2 bg-gray-100 rounded-md mt-1 font-mono text-xs"
                        />
                    </div>

                    {currentMethod === 'Email' && (
                         <div>
                            <label className="font-semibold text-gray-600">Subject:</label>
                            <input 
                                type="text" 
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full p-2 bg-gray-100 rounded-md mt-1"
                            />
                        </div>
                    )}

                    {viewMode === 'card' && isMotOrTaxEmail && vehicle ? (
                        <div className="mt-2 pt-2 border-t">
                            <div className="max-h-[480px] overflow-y-auto p-2 bg-gray-100 rounded-xl">
                                <NotificationsHubCard
                                    vehicle={vehicle}
                                    customer={customer}
                                    leadDays={60}
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="font-semibold text-gray-600">
                                    {currentMethod === 'WhatsApp' ? 'WhatsApp Message Content (Supports *bold*, emojis, links):' : 'Message Body:'}
                                </label>
                                {currentMethod === 'SMS' && (
                                    <span className="text-[11px] text-gray-500 font-mono">
                                        {body.length} chars (~{Math.ceil(body.length / 160)} SMS)
                                    </span>
                                )}
                            </div>
                            <textarea 
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={currentMethod === 'Email' ? 8 : 6}
                                className={`w-full p-2.5 border rounded-md font-mono text-xs leading-relaxed ${
                                    currentMethod === 'WhatsApp' ? 'bg-emerald-50/40 border-emerald-300' : 'bg-white'
                                }`}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                    <button 
                        onClick={handleSend} 
                        className={`flex items-center py-2 px-5 text-white font-bold rounded-lg shadow-md transition ${
                            currentMethod === 'WhatsApp'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : currentMethod === 'SMS'
                                ? 'bg-indigo-600 hover:bg-indigo-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {currentMethod === 'WhatsApp' ? (
                            <>
                                <ExternalLink size={16} className="mr-2"/> Send via WhatsApp & Mark as Sent
                            </>
                        ) : (
                            <>
                                <Send size={16} className="mr-2"/> Send {currentMethod} & Mark as Sent
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendReminderModal;
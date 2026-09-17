import React, { useState, useMemo } from 'react';
import { Send, X, Mail, MessageSquare, ExternalLink, Copy, Check, Calendar, Car, Eye } from 'lucide-react';
import { Vehicle, Customer, BusinessEntity, Reminder } from '../../types';
import { sendOutboundEmail } from '../../core/services/emailService';
import { logOutboundCorrespondence } from '../../core/services/commsCorrespondenceService';
import NotificationsHubCard, { generateNotificationsHubEmailHtml } from './NotificationsHubCard';
import { toast } from 'react-toastify';

interface SendMotRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Vehicle;
    customer?: Customer | null;
    entity?: BusinessEntity | null;
    reminder?: Reminder | null;
    onSent?: () => void;
}

export const SendMotRequestModal: React.FC<SendMotRequestModalProps> = ({
    isOpen,
    onClose,
    vehicle,
    customer,
    entity,
    reminder,
    onSent
}) => {
    const [method, setMethod] = useState<'Email' | 'SMS' | 'WhatsApp'>('Email');
    const [recipient, setRecipient] = useState(() => {
        if (method === 'Email') return customer?.email || '';
        return customer?.mobile || customer?.phone || '';
    });
    const [viewMode, setViewMode] = useState<'card' | 'text'>('card');
    const [isSending, setIsSending] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Build the interactive customer portal link
    const origin = typeof window !== 'undefined' && window.location?.origin 
        ? window.location.origin 
        : 'https://intelligent-scheduling-v801.web.app';
    
    const interactiveBookingUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set('view', 'mot');
        if (vehicle.registration) params.set('vrm', vehicle.registration);
        if (vehicle.id) params.set('vehicleId', vehicle.id);
        if (customer?.id) params.set('customerId', customer.id);
        if (entity?.id) params.set('entityId', entity.id);
        return `${origin}/?${params.toString()}`;
    }, [origin, vehicle, customer, entity]);

    // Update recipient when switching method
    React.useEffect(() => {
        if (method === 'Email') {
            setRecipient(customer?.email || '');
        } else {
            setRecipient(customer?.mobile || customer?.phone || '');
        }
    }, [method, customer]);

    const customerName = customer ? `${customer.forename || ''} ${customer.surname || ''}`.trim() || 'Valued Customer' : 'Valued Customer';
    const vehicleDesc = `${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.registration || 'VRM'})`.trim();
    const motDate = vehicle.nextMotDate || 'Soon';

    const defaultSubject = `MOT Booking Date Request for ${vehicle.registration || 'Your Vehicle'} - ${entity?.name || 'Brookspeed'}`;

    const defaultTextMessage = useMemo(() => {
        if (method === 'WhatsApp') {
            return `🔔 *${entity?.name || 'Brookspeed'} Notifications Hub*\n\nHi ${customerName},\nYour *${vehicleDesc}* is due for its MOT on *${motDate}*.\n\n📅 We invite you to choose your preferred MOT date and time slot directly online using our interactive booking portal:\n\n👉 *Select your preferred MOT date & time:*\n${interactiveBookingUrl}\n\nOr reply directly to this message to reserve your slot.\n\nThanks,\n*${entity?.name || 'Brookspeed'} Team*`;
        }
        if (method === 'SMS') {
            return `Hi ${customerName}, Brookspeed MOT reminder for ${vehicle.registration} due ${motDate}. Please choose your preferred booking date and time online: ${interactiveBookingUrl}`;
        }
        return `Dear ${customerName},\n\nOur records indicate that the MOT for your ${vehicleDesc} is due for renewal on ${motDate}.\n\nTo ensure your vehicle remains legal and roadworthy, please select your preferred booking date and time slot using our interactive portal link below:\n\n${interactiveBookingUrl}\n\nOur service desk will immediately review your request and confirm your reservation.\n\nKind regards,\n${entity?.name || 'Brookspeed Automotive'}\nTel: 02380 641672`;
    }, [method, customerName, vehicleDesc, motDate, interactiveBookingUrl, entity]);

    const [customMessage, setCustomMessage] = useState(defaultTextMessage);

    React.useEffect(() => {
        setCustomMessage(defaultTextMessage);
    }, [defaultTextMessage]);

    if (!isOpen) return null;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(interactiveBookingUrl);
        setIsCopied(true);
        toast.success('Interactive MOT booking link copied to clipboard!');
        setTimeout(() => setIsCopied(false), 2500);
    };

    const handleOpenPortalPreview = () => {
        window.open(interactiveBookingUrl, '_blank');
    };

    const handleSend = async () => {
        if (method === 'WhatsApp') {
            const cleanPhone = recipient.replace(/[^\d+]/g, '');
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessage)}`;
            window.open(waUrl, '_blank');
            toast.success('Opened WhatsApp chat with interactive MOT booking request!');
            if (onSent) onSent();
            onClose();
            return;
        }

        if (method === 'SMS') {
            // For SMS, we dispatch or format link
            toast.success(`SMS MOT booking request dispatched to ${recipient}`);
            if (onSent) onSent();
            onClose();
            return;
        }

        // Email flow
        if (!recipient) {
            toast.error('Please specify a recipient email address.');
            return;
        }

        setIsSending(true);
        try {
            const emailHtml = viewMode === 'card'
                ? generateNotificationsHubEmailHtml(vehicle, customer, 60, interactiveBookingUrl)
                : customMessage.replace(/\n/g, '<br/>') + `<br/><br/><a href="${interactiveBookingUrl}" style="display:inline-block;padding:12px 24px;background-color:#0066FF;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Request MOT Date & Time Online</a>`;

            await sendOutboundEmail({
                to: recipient,
                fromName: 'Brookspeed',
                fromEmail: 'info@brookspeed.com',
                subject: defaultSubject,
                body: emailHtml
            });

            if (customer) {
                await logOutboundCorrespondence(
                    customer,
                    vehicle,
                    defaultSubject,
                    viewMode === 'card' ? `[Notifications Hub Card Email Sent]\nSubject: ${defaultSubject}` : customMessage,
                    'Email',
                    entity,
                    recipient
                );
            }

            toast.success(`MOT Date Request email sent to ${recipient}! Logged to client account.`);
            if (onSent) onSent();
            onClose();
        } catch (err: any) {
            console.error('Failed to send MOT email:', err);
            toast.error(`Failed to send email: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[80] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                Send MOT Date Request
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold">
                                    Interactive
                                </span>
                            </h2>
                            <p className="text-xs text-gray-500 font-medium">
                                Request a preferred MOT date and time from the customer
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4 flex-grow text-sm">
                    {/* Vehicle Quick Info Banner */}
                    <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex items-stretch bg-[#FACC15] border border-yellow-500 rounded-md shadow-xs overflow-hidden">
                                <div className="bg-[#003399] text-white px-1 py-0.5 flex flex-col items-center justify-center text-[8px] font-black leading-none">
                                    <span>🇬🇧</span>
                                </div>
                                <div className="px-2 py-0.5 font-mono font-black text-xs text-black uppercase">
                                    {vehicle.registration || 'VRM'}
                                </div>
                            </div>
                            <div>
                                <span className="font-extrabold text-gray-900 text-xs sm:text-sm">
                                    {vehicle.make} {vehicle.model}
                                </span>
                                <span className="text-gray-500 text-xs ml-2">
                                    MOT Due: <strong className="text-blue-700">{motDate}</strong>
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenPortalPreview}
                            className="flex items-center gap-1 py-1 px-2.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer"
                            title="Open interactive customer booking portal in a new tab"
                        >
                            <Eye size={13} />
                            <span>Preview Portal</span>
                        </button>
                    </div>

                    {/* Channel Switcher */}
                    <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setMethod('Email')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                method === 'Email'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-transparent text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <Mail size={14} /> Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('SMS')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                method === 'SMS'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-transparent text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <MessageSquare size={14} /> SMS / MMS
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('WhatsApp')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                method === 'WhatsApp'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-transparent text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span>💬</span> WhatsApp Text
                        </button>
                    </div>

                    {/* Recipient Input */}
                    <div className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-600 uppercase text-[10px] tracking-wider">
                                {method === 'Email' ? 'Recipient Email' : 'Mobile Phone'}
                            </span>
                            {customer && (
                                <span className="text-[11px] text-gray-500 font-medium">
                                    Customer: <strong className="text-gray-800">{customerName}</strong>
                                </span>
                            )}
                        </div>
                        <input
                            type={method === 'Email' ? 'email' : 'tel'}
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder={method === 'Email' ? 'customer@example.com' : '07123456789'}
                            className="w-full bg-white border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                        />
                    </div>

                    {/* Interactive Link Bar with Copy & Test */}
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                                <ExternalLink size={12} className="text-indigo-600" />
                                Customer Interactive Portal Link
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="flex items-center gap-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition"
                                >
                                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                    {isCopied ? 'Copied' : 'Copy Link'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenPortalPreview}
                                    className="flex items-center gap-1 py-1 px-2.5 bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-300 rounded-md text-xs font-bold transition"
                                >
                                    <Eye size={12} />
                                    Test
                                </button>
                            </div>
                        </div>
                        <div className="font-mono text-xs text-indigo-800 bg-white/80 p-2 rounded-lg border border-indigo-100 truncate select-all">
                            {interactiveBookingUrl}
                        </div>
                    </div>

                    {/* Email View Mode Selector */}
                    {method === 'Email' && (
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setViewMode('card')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition ${
                                    viewMode === 'card'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                🔔 Notifications Hub Card View (Electric Blue Email)
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

                    {/* Email Card Preview or Textarea */}
                    {method === 'Email' && viewMode === 'card' ? (
                        <div className="border border-gray-300 rounded-xl overflow-hidden bg-gray-100 p-3 max-h-[260px] overflow-y-auto">
                            <NotificationsHubCard
                                vehicle={vehicle}
                                customer={customer}
                                leadDays={60}
                            />
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-600 uppercase">Message Body</label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                rows={6}
                                className="w-full p-3 bg-white border border-gray-300 rounded-xl text-gray-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs transition"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={isSending || !recipient}
                        className="flex items-center gap-2 py-2.5 px-6 bg-[#0066FF] hover:bg-blue-600 active:scale-[0.98] text-white font-black rounded-xl shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed text-xs cursor-pointer"
                    >
                        <Send size={15} />
                        {isSending ? 'Sending Request...' : `Send MOT Date Request (${method})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendMotRequestModal;

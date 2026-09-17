import React, { useState } from 'react';
import { CheckCircle2, Calendar, Clock, Car, Phone, Mail, User, AlertCircle, ExternalLink, ShieldCheck, ChevronRight } from 'lucide-react';
import { Vehicle, Customer, BusinessEntity, Inquiry } from '../../types';
import { calculateDaysRemaining } from '../../core/services/rollingCommsService';
import { formatDisplayDate } from './NotificationsHubCard';
import { saveDocument } from '../../core/db';

interface CustomerMotBookingViewProps {
    vehicle: Vehicle;
    customer?: Customer | null;
    entity?: BusinessEntity | null;
    onClose?: () => void;
}

export const CustomerMotBookingView: React.FC<CustomerMotBookingViewProps> = ({
    vehicle,
    customer,
    entity,
    onClose
}) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Form state
    const [preferredDate, setPreferredDate] = useState<string>(() => {
        // Default to either vehicle nextMotDate or 7 days from now
        if (vehicle.nextMotDate && vehicle.nextMotDate >= todayStr) {
            return vehicle.nextMotDate;
        }
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    });

    const [timeSlot, setTimeSlot] = useState<'morning' | 'afternoon' | 'all-day'>('morning');
    const [combineWithService, setCombineWithService] = useState(false);
    const [whileYouWait, setWhileYouWait] = useState(false);
    const [customerNotes, setCustomerNotes] = useState('');

    // Contact details (pre-filled from customer record)
    const [contactName, setContactName] = useState(() => {
        if (customer) {
            return `${customer.forename || ''} ${customer.surname || ''}`.trim() || customer.companyName || '';
        }
        return '';
    });
    const [contactPhone, setContactPhone] = useState(customer?.mobile || customer?.phone || '');
    const [contactEmail, setContactEmail] = useState(customer?.email || '');

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionRef, setSubmissionRef] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const daysRemaining = vehicle.nextMotDate ? calculateDaysRemaining(vehicle.nextMotDate) : undefined;
    const taxDays = vehicle.taxDueDate ? calculateDaysRemaining(vehicle.taxDueDate) : undefined;

    // Quick date shortcut helper
    const setQuickDate = (daysAhead: number) => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        setPreferredDate(d.toISOString().split('T')[0]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!preferredDate) {
            setErrorMessage('Please select your preferred date.');
            return;
        }

        if (!contactName.trim()) {
            setErrorMessage('Please provide your name.');
            return;
        }

        if (!contactPhone.trim() && !contactEmail.trim()) {
            setErrorMessage('Please provide at least a phone number or email so we can confirm your booking.');
            return;
        }

        setIsSubmitting(true);

        const slotLabel = timeSlot === 'morning' 
            ? 'Morning (08:30 – 12:30)' 
            : timeSlot === 'afternoon' 
            ? 'Afternoon (12:30 – 17:30)' 
            : 'All Day / Any Time';

        const inquiryId = crypto.randomUUID();
        const refCode = `MOT-${vehicle.registration?.replace(/\s+/g, '') || 'REQ'}-${Date.now().toString().slice(-4)}`;

        const optionsSelected: string[] = [];
        if (combineWithService) optionsSelected.push('Combine with Annual/Major Service');
        if (whileYouWait) optionsSelected.push('While you wait appointment');

        const fullMessage = `ONLINE MOT BOOKING REQUEST (${refCode})\n\n` +
            `Vehicle: ${vehicle.registration || 'Unknown'} (${vehicle.make || ''} ${vehicle.model || ''})\n` +
            `Preferred Date: ${formatDisplayDate(preferredDate)}\n` +
            `Preferred Slot: ${slotLabel}\n` +
            `Options: ${optionsSelected.length > 0 ? optionsSelected.join(', ') : 'None'}\n` +
            `Customer Notes: ${customerNotes.trim() || 'None'}\n\n` +
            `Contact Details:\n` +
            `Name: ${contactName}\n` +
            `Phone: ${contactPhone || 'N/A'}\n` +
            `Email: ${contactEmail || 'N/A'}`;

        const inquiryToSave: Inquiry = {
            id: inquiryId,
            inquiryNumber: refCode,
            entityId: entity?.id || (vehicle as any).entityId,
            createdAt: new Date().toISOString(),
            fromName: contactName,
            fromContact: contactPhone || contactEmail || 'Online Booking Portal',
            fromPhone: contactPhone || undefined,
            fromEmail: contactEmail || undefined,
            subject: `Online MOT Booking Request - ${vehicle.registration || 'Vehicle'} (${formatDisplayDate(preferredDate)})`,
            message: fullMessage,
            takenByUserId: 'system',
            status: 'New Requests',
            linkedCustomerId: customer?.id || vehicle.customerId,
            linkedVehicleId: vehicle.id,
            vehicleRegistration: vehicle.registration,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vehicleYear: vehicle.year ? String(vehicle.year) : undefined,
            vehicleMotExpiry: vehicle.nextMotDate,
            actionNotes: `Online MOT date requested for ${formatDisplayDate(preferredDate)} (${slotLabel}).`,
            hasNewReply: true,
            logs: [
                {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    userId: 'system',
                    actionType: 'Online MOT Booking Request',
                    notes: `Customer requested MOT slot on ${formatDisplayDate(preferredDate)} (${slotLabel}).`
                }
            ]
        };

        try {
            await saveDocument('brooks_inquiries', inquiryToSave);
            setSubmissionRef(refCode);
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Failed to save MOT booking inquiry:', err);
            setErrorMessage('Unable to submit booking request right now. Please call us on 02380 641672.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 py-8 px-4 sm:px-6 flex justify-center items-center">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                {/* Top Branding Header */}
                <div className="bg-[#0066FF] px-6 py-5 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-xl shadow-xs">
                            🚗
                        </div>
                        <div>
                            <h1 className="font-black text-lg tracking-tight uppercase">
                                {entity?.name || 'Brookspeed Automotive'}
                            </h1>
                            <p className="text-xs text-blue-100 font-medium">
                                Interactive MOT Booking & Date Reservation Portal
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Main Content */}
                {isSubmitted ? (
                    /* Confirmation Screen */
                    <div className="p-8 sm:p-10 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                            <CheckCircle2 size={48} className="animate-bounce" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
                            MOT Booking Request Received!
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base max-w-md mx-auto mb-6">
                            Thank you, <strong className="text-slate-900">{contactName}</strong>. We have received your preferred date request and our service desk will confirm your reserved ramp slot shortly.
                        </p>

                        {/* Booking Summary Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left max-w-md mx-auto mb-6 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reference</span>
                                <span className="font-mono font-black text-blue-600 text-sm">{submissionRef}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Vehicle:</span>
                                    <span className="font-bold text-slate-900">{vehicle.registration} ({vehicle.make} {vehicle.model})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Requested Date:</span>
                                    <span className="font-bold text-blue-700">{formatDisplayDate(preferredDate)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Preferred Slot:</span>
                                    <span className="font-bold text-slate-900">
                                        {timeSlot === 'morning' ? 'Morning (08:30 – 12:30)' : timeSlot === 'afternoon' ? 'Afternoon (12:30 – 17:30)' : 'All Day'}
                                    </span>
                                </div>
                                {combineWithService && (
                                    <div className="flex justify-between text-blue-600 font-bold">
                                        <span>Service Package:</span>
                                        <span>Combine with Service</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Road Tax reminder notice if tax also due */}
                        {vehicle.taxDueDate && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto mb-6 text-left flex items-start gap-3">
                                <span className="text-xl">🏛️</span>
                                <div className="flex-grow text-xs">
                                    <p className="font-bold text-amber-900">
                                        Road Tax also due on {formatDisplayDate(vehicle.taxDueDate)}
                                    </p>
                                    <p className="text-amber-700 mt-0.5">
                                        Remember to renew your vehicle tax online directly via the official UK Government portal.
                                    </p>
                                    <a
                                        href="https://www.gov.uk/vehicle-tax"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-black text-amber-900 underline mt-1 hover:text-black"
                                    >
                                        Renew Road Tax on Gov.uk <ExternalLink size={12} />
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 max-w-md mx-auto">
                            <p className="text-xs text-slate-500">
                                Need to make urgent changes? Call our workshop directly on <strong className="text-slate-800">02380 641672</strong> or email <strong className="text-slate-800">info@brookspeed.com</strong>.
                            </p>
                            <button
                                onClick={() => {
                                    if (onClose) onClose();
                                    else window.location.href = window.location.origin;
                                }}
                                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition shadow-md text-sm"
                            >
                                Return to Homepage
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Interactive Form */
                    <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                        {/* Vehicle Card Banner */}
                        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 rounded-2xl text-white shadow-md flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {/* UK Number Plate Badge */}
                                <div className="flex items-stretch bg-[#FACC15] border-2 border-yellow-500 rounded-lg shadow-md overflow-hidden flex-shrink-0">
                                    <div className="bg-[#003399] text-white px-1.5 py-1 flex flex-col items-center justify-center text-[9px] font-black leading-none select-none">
                                        <span>🇬🇧</span>
                                        <span className="mt-0.5 tracking-tighter">UK</span>
                                    </div>
                                    <div className="px-3 py-1 font-mono font-black text-lg text-black uppercase tracking-wider flex items-center select-none">
                                        {vehicle.registration || 'VRM'}
                                    </div>
                                </div>

                                <div>
                                    <h2 className="font-black text-base sm:text-lg leading-tight uppercase text-white">
                                        {vehicle.make} {vehicle.model}
                                    </h2>
                                    {vehicle.year && (
                                        <p className="text-xs font-semibold text-blue-200">Year: {vehicle.year}</p>
                                    )}
                                </div>
                            </div>

                            {/* MOT Expiry Countdown */}
                            <div className="text-right">
                                <div className="inline-block px-3 py-1 rounded-xl bg-blue-500/30 border border-blue-400/40 text-xs font-black text-blue-100">
                                    {daysRemaining !== undefined ? (
                                        daysRemaining >= 0 ? `MOT due in ${daysRemaining} days` : 'MOT Overdue'
                                    ) : 'MOT Due Soon'}
                                </div>
                                <p className="text-xs text-blue-200 mt-1 font-medium">
                                    Expiry: {formatDisplayDate(vehicle.nextMotDate || 'Soon')}
                                </p>
                            </div>
                        </div>

                        {/* Preferred Date Selection */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-black text-slate-800 flex items-center gap-1.5">
                                    <Calendar size={16} className="text-blue-600" />
                                    Select Preferred MOT Date *
                                </label>
                                <span className="text-xs text-slate-500 font-medium">Choose any business day</span>
                            </div>

                            <input
                                type="date"
                                min={todayStr}
                                value={preferredDate}
                                onChange={(e) => setPreferredDate(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-base focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition shadow-xs"
                                required
                            />

                            {/* Quick Shortcuts */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setQuickDate(1)}
                                    className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                                >
                                    Tomorrow
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQuickDate(3)}
                                    className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                                >
                                    In 3 Days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQuickDate(7)}
                                    className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                                >
                                    In 1 Week
                                </button>
                                {vehicle.nextMotDate && vehicle.nextMotDate >= todayStr && (
                                    <button
                                        type="button"
                                        onClick={() => setPreferredDate(vehicle.nextMotDate!)}
                                        className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition"
                                    >
                                        On Expiry Date ({formatDisplayDate(vehicle.nextMotDate)})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Time Slot Selection */}
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <Clock size={16} className="text-blue-600" />
                                Preferred Time Window *
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTimeSlot('morning')}
                                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                        timeSlot === 'morning'
                                            ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-base font-black">☀️ Morning</span>
                                        {timeSlot === 'morning' && <CheckCircle2 size={16} className="text-blue-600" />}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">08:30 – 12:30</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTimeSlot('afternoon')}
                                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                        timeSlot === 'afternoon'
                                            ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-base font-black">🌤️ Afternoon</span>
                                        {timeSlot === 'afternoon' && <CheckCircle2 size={16} className="text-blue-600" />}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">12:30 – 17:30</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTimeSlot('all-day')}
                                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                        timeSlot === 'all-day'
                                            ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-base font-black">⏱️ All Day</span>
                                        {timeSlot === 'all-day' && <CheckCircle2 size={16} className="text-blue-600" />}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">Drop off anytime</span>
                                </button>
                            </div>
                        </div>

                        {/* Additional Options */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Booking Options & Requirements
                            </h4>

                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={combineWithService}
                                    onChange={(e) => setCombineWithService(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-slate-800">
                                    🔧 Combine MOT with Annual / Scheduled Service
                                </span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={whileYouWait}
                                    onChange={(e) => setWhileYouWait(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-slate-800">
                                    ☕ While-you-wait appointment (approx. 45 - 60 mins)
                                </span>
                            </label>
                        </div>

                        {/* Customer Notes */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-black text-slate-800">
                                Additional Notes or Specific Concerns (Optional)
                            </label>
                            <textarea
                                value={customerNotes}
                                onChange={(e) => setCustomerNotes(e.target.value)}
                                rows={3}
                                placeholder="e.g. Please check brake squeal, front wipers, or tyre pressures..."
                                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition shadow-xs"
                            />
                        </div>

                        {/* Contact Details */}
                        <div className="border-t border-slate-200 pt-5 space-y-3">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Your Contact Details
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Your Name *</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="text"
                                            value={contactName}
                                            onChange={(e) => setContactName(e.target.value)}
                                            placeholder="John Smith"
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Phone *</label>
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            placeholder="07123 456789"
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
                                    <div className="relative">
                                        <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="email"
                                            value={contactEmail}
                                            onChange={(e) => setContactEmail(e.target.value)}
                                            placeholder="john@example.com"
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                                <AlertCircle size={16} />
                                {errorMessage}
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 px-6 bg-[#0066FF] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Calendar size={18} />
                                {isSubmitting ? 'Submitting MOT Request...' : 'Confirm & Request MOT Booking'}
                            </button>
                            <p className="text-center text-[11px] text-slate-500 font-medium mt-2">
                                🔒 Your request is sent directly to Brookspeed's master workshop scheduling system.
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CustomerMotBookingView;

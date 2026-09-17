import React, { useState } from 'react';
import { Vehicle, Customer, Inquiry } from '../../types';
import FormModal from '../FormModal';
import { Calendar, CheckCircle2, Car, Clock, ShieldCheck } from 'lucide-react';
import { formatDate, addDays, dateStringToDate } from '../../core/utils/dateUtils';
import { saveDocument } from '../../core/db';
import { useData } from '../../core/state/DataContext';
import { useApp } from '../../core/state/AppContext';

interface RequestMotDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Vehicle;
    customer?: Customer | null;
    onSuccess?: () => void;
}

const RequestMotDateModal: React.FC<RequestMotDateModalProps> = ({
    isOpen,
    onClose,
    vehicle,
    customer,
    onSuccess
}) => {
    const { setConfirmation } = useApp();
    const { setInquiries } = useData();

    // Default requested date to 3 days before expiry or 3 days from now
    const defaultDate = vehicle.nextMotDate
        ? formatDate(addDays(dateStringToDate(vehicle.nextMotDate), -3))
        : formatDate(addDays(new Date(), 3));

    const [requestedDate, setRequestedDate] = useState(defaultDate);
    const [timeSlot, setTimeSlot] = useState<'Morning (08:30 - 12:00)' | 'Afternoon (12:00 - 17:00)' | 'All Day / Flexible'>('Morning (08:30 - 12:00)');
    const [needsCourtesyCar, setNeedsCourtesyCar] = useState(false);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!requestedDate) {
            alert('Please select a preferred MOT date.');
            return;
        }

        setIsSubmitting(true);
        try {
            const customerName = customer ? `${customer.forename} ${customer.surname}`.trim() : 'Customer';
            const customerPhone = customer?.phone || customer?.mobile || '';
            const customerEmail = customer?.email || '';

            const newInquiry: Inquiry = {
                id: crypto.randomUUID(),
                fromName: customerName,
                fromContact: customerPhone || customerEmail || 'Customer',
                fromEmail: customerEmail || undefined,
                fromPhone: customerPhone || undefined,
                subject: `MOT Booking Request for ${vehicle.registration}`,
                message: `[MOT Booking Request]\nPreferred Date: ${requestedDate}\nTime Window: ${timeSlot}\nCourtesy Car: ${needsCourtesyCar ? 'YES' : 'NO'}\nCurrent MOT Expiry: ${vehicle.nextMotDate || 'Unknown'}\n${additionalNotes ? `Notes: ${additionalNotes}` : ''}`,
                takenByUserId: 'system',
                status: 'New Requests',
                vehicleRegistration: vehicle.registration,
                vehicleMake: vehicle.make,
                vehicleModel: vehicle.model,
                vehicleMotExpiry: vehicle.nextMotDate,
                linkedVehicleId: vehicle.id,
                linkedCustomerId: customer?.id,
                createdAt: new Date().toISOString(),
            };

            // Save to Firestore & local state
            await saveDocument('brooks_inquiries', newInquiry);
            setInquiries(prev => [newInquiry, ...(prev || [])]);

            setConfirmation({
                isOpen: true,
                title: 'MOT Booking Request Submitted',
                message: (
                    <div className="space-y-2 text-sm text-gray-700">
                        <p>Thank you! An MOT booking request for <strong>{vehicle.registration}</strong> has been logged for <strong>{requestedDate}</strong> ({timeSlot}).</p>
                        <p className="text-xs text-gray-500">Our service reception team will review workshop capacity and confirm your booking slot.</p>
                    </div>
                ),
                type: 'success',
                confirmText: 'Done',
                onConfirm: () => {
                    setConfirmation({ isOpen: false, title: '', message: '' });
                    if (onSuccess) onSuccess();
                    onClose();
                }
            });
        } catch (err) {
            console.error('Failed to submit MOT booking request:', err);
            alert('Failed to submit booking request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            title="Request Suitable MOT Date"
            saveText={isSubmitting ? "Submitting..." : "Confirm MOT Request"}
            saveIcon={CheckCircle2}
            onSave={handleSubmit}
            saveDisabled={isSubmitting}
            maxWidth="max-w-xl"
        >
            <div className="space-y-4">
                {/* Vehicle Banner */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-400 text-black px-2.5 py-1 rounded border border-yellow-500 font-mono font-black text-sm uppercase tracking-wider shadow-xs">
                            {vehicle.registration}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</p>
                            <p className="text-xs text-blue-700 flex items-center gap-1 font-medium">
                                <ShieldCheck size={13} />
                                MOT expires: {vehicle.nextMotDate || 'Not set'}
                            </p>
                        </div>
                    </div>
                    {customer && (
                        <div className="text-right text-xs text-gray-600 hidden sm:block">
                            <p className="font-semibold text-gray-800">{customer.forename} {customer.surname}</p>
                            <p className="text-gray-500">{customer.mobile || customer.email || ''}</p>
                        </div>
                    )}
                </div>

                {/* Preferred Date */}
                <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                        <Calendar size={15} className="text-blue-600" />
                        Select Preferred MOT Date *
                    </label>
                    <input
                        type="date"
                        value={requestedDate}
                        onChange={e => setRequestedDate(e.target.value)}
                        className="w-full p-2.5 border rounded-lg font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                {/* Time Slot Preference */}
                <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                        <Clock size={15} className="text-blue-600" />
                        Preferred Time Slot
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(['Morning (08:30 - 12:00)', 'Afternoon (12:00 - 17:00)', 'All Day / Flexible'] as const).map(slot => (
                            <button
                                key={slot}
                                type="button"
                                onClick={() => setTimeSlot(slot)}
                                className={`p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                                    timeSlot === slot
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {slot}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Courtesy Car */}
                <div className="p-3 bg-gray-50 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Car size={18} className="text-gray-600" />
                        <div>
                            <p className="text-xs font-bold text-gray-800">Courtesy Car Required?</p>
                            <p className="text-[11px] text-gray-500">Subject to availability on the selected date</p>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={needsCourtesyCar}
                        onChange={e => setNeedsCourtesyCar(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </div>

                {/* Additional Notes */}
                <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                        Any specific concerns or items for the MOT tester?
                    </label>
                    <textarea
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. Please check front passenger tyre, windscreen wiper blade replacement needed..."
                        className="w-full p-2 border rounded-lg text-xs"
                    />
                </div>
            </div>
        </FormModal>
    );
};

export default RequestMotDateModal;

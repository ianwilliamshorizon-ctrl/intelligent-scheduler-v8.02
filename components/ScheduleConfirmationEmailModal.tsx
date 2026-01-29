import React, { useState, useEffect } from 'react';
import { Job, Customer, Vehicle } from '../types';
import FormModal from './FormModal';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { formatReadableDate } from '../core/utils/dateUtils';
import { Send } from 'lucide-react';

interface ScheduleConfirmationEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: () => void;
    data: {
        job: Job;
        customer: Customer;
        vehicle: Vehicle;
        isAlternative: boolean;
        originalDate: string;
    } | null;
}

const ScheduleConfirmationEmailModal: React.FC<ScheduleConfirmationEmailModalProps> = ({ isOpen, onClose, onSend, data }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    useEffect(() => {
        if (!data) return;
        const { job, customer, vehicle, isAlternative, originalDate } = data;
        
        const customerName = customer.forename || 'Valued Customer';
        const vehicleDesc = `${vehicle.make} ${vehicle.model} (${vehicle.registration})`;
        const bookedDate = formatReadableDate(job.scheduledDate!);

        if (isAlternative) {
            setSubject(`Booking Update for your ${vehicleDesc}`);
            setBody(
`Dear ${customerName},

Thank you for your request to book your ${vehicleDesc} for ${formatReadableDate(originalDate)}.

Unfortunately, we are fully booked on that day. We have provisionally booked you in for the next available date, which is:

**${bookedDate}**

Please reply to this email to confirm if this new date is suitable for you. If we don't hear from you within 48 hours, we will assume this date is confirmed.

We look forward to seeing you.

Kind regards,
The Brookspeed Team`
            );
        } else {
            setSubject(`Booking Confirmation for your ${vehicleDesc}`);
            setBody(
`Dear ${customerName},

We are pleased to confirm your booking for your ${vehicleDesc} on:

**${bookedDate}**

If you have any questions or need to reschedule, please don't hesitate to contact us.

We look forward to seeing you.

Kind regards,
The Brookspeed Team`
            );
        }
    }, [data]);

    if (!isOpen || !data) return null;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={onSend}
            title="Confirm Booking with Customer"
            saveText="Send Email"
            saveIcon={Send}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="p-3 bg-gray-100 rounded-lg text-sm">
                    <p><strong>To:</strong> {getCustomerDisplayName(data.customer)} &lt;{data.customer.email}&gt;</p>
                </div>
                 <div>
                    <label className="font-semibold text-gray-700">Subject</label>
                    <input 
                        type="text" 
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="w-full p-2 border rounded mt-1"
                    />
                </div>
                <div>
                    <label className="font-semibold text-gray-700">Body</label>
                    <textarea 
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={12}
                        className="w-full p-2 border rounded mt-1 font-mono text-xs leading-relaxed"
                    />
                </div>
                 <div className="flex justify-end">
                    <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2">
                        Skip Email
                    </button>
                </div>
            </div>
        </FormModal>
    );
};

export default ScheduleConfirmationEmailModal;
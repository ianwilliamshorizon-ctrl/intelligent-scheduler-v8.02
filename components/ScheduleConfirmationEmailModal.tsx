import React, { useState, useEffect } from 'react';
import { Job, Customer, Vehicle } from '../types';
import FormModal from './FormModal';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { formatReadableDate } from '../core/utils/dateUtils';
import { Send, Mail } from 'lucide-react';

interface ScheduleConfirmationEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipients: string) => void;
    data: {
        job: Job;
        customer: Customer;
        vehicle: Vehicle;
        isAlternative: boolean;
        originalDate: string;
    } | null;
}

const ScheduleConfirmationEmailModal: React.FC<ScheduleConfirmationEmailModalProps> = ({ isOpen, onClose, onSend, data }) => {
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    useEffect(() => {
        if (!data) return;
        const { job, customer, vehicle, isAlternative, originalDate } = data;
        
        const customerName = customer.forename || 'Valued Customer';
        const vehicleDesc = `${vehicle.make} ${vehicle.model} (${vehicle.registration})`;
        const bookedDate = formatReadableDate(job.scheduledDate!);

        setRecipient(customer.email || '');

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
    }, [data, isOpen]);

    if (!isOpen || !data) return null;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={() => onSend(recipient)}
            title="Confirm Booking with Customer"
            saveText="Send Email"
            saveIcon={Send}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="flex flex-col p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    <div className="flex items-center mb-1">
                        <Mail size={14} className="text-indigo-600 mr-2" />
                        <span className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider">Recipient(s)</span>
                    </div>
                    <input 
                        type="text" 
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        placeholder="customer@example.com"
                        className="w-full bg-white border border-indigo-200 rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800 transition-all shadow-sm text-sm"
                    />
                </div>

                 <div>
                    <label className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block mb-1">Subject</label>
                    <input 
                        type="text" 
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block mb-1">Body</label>
                    <textarea 
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={10}
                        className="w-full p-3 border border-gray-200 rounded-md font-mono text-xs leading-relaxed bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                 <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] italic text-gray-400">Preview: Email content will be sent as plain text.</span>
                    <button type="button" onClick={onClose} className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors">
                        Skip Email
                    </button>
                </div>
            </div>
        </FormModal>
    );
};

export default ScheduleConfirmationEmailModal;
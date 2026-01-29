import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import FormModal from './FormModal';
import { formatDate } from '../core/utils/dateUtils';

interface CreateMarketingReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (eventName: string, eventDate: string) => void;
}

const CreateMarketingReminderModal: React.FC<CreateMarketingReminderModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState(formatDate(new Date()));

    const handleCreate = () => {
        if (!eventName.trim() || !eventDate) {
            alert('Event Name and Date are required.');
            return;
        }
        onCreate(eventName, eventDate);
        onClose();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleCreate}
            title="Create Marketing Campaign Reminders"
            saveText="Create Reminders"
            saveIcon={Send}
            maxWidth="max-w-lg"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600">This will generate a 'Pending' reminder for every customer who has consented to marketing communications.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                    <input
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="e.g., Summer Open Day"
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                    <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>
            </div>
        </FormModal>
    );
};

export default CreateMarketingReminderModal;

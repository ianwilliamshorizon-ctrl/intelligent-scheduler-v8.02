import React, { useState, useEffect } from 'react';
import { Reminder, Customer, Vehicle, BusinessEntity } from '../types';
import { generateReminderMessage } from '../utils/templateUtils';
import { X, Send } from 'lucide-react';

interface SendReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: () => void;
    reminder: Reminder;
    customer: Customer;
    vehicle: Vehicle;
    method: 'Email' | 'SMS';
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
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    useEffect(() => {
        if (isOpen) {
            const message = generateReminderMessage(reminder, customer, vehicle, method, entity);
            setRecipient(message.recipient);
            setSubject(message.subject);
            setBody(message.body);
        }
    }, [isOpen, reminder, customer, vehicle, method, entity]);
    
    if (!isOpen) return null;

    const handleSend = () => {
        // In a real app, this would trigger an API call. Here, we just call the onSend callback.
        onSend();
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center">
                        <Send size={20} className="mr-2"/>
                        Send {method} Reminder
                    </h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                <div className="space-y-4 text-sm">
                    <div>
                        <label className="font-semibold text-gray-600">To:</label>
                        <input 
                            type="text" 
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            className="w-full p-2 bg-gray-100 rounded-md mt-1"
                        />
                    </div>
                    {method === 'Email' && (
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
                     <div>
                        <label className="font-semibold text-gray-600">Message:</label>
                        <textarea 
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={method === 'Email' ? 8 : 4}
                            className="w-full p-2 border rounded-md mt-1"
                        />
                    </div>
                </div>
                <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                    <button onClick={handleSend} className="flex items-center py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
                        <Send size={16} className="mr-2"/> Send & Mark as Sent
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendReminderModal;
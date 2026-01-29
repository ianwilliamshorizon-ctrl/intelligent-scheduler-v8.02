import React, { useState } from 'react';
import { X, Pause } from 'lucide-react';

interface PauseReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const PauseReasonModal: React.FC<PauseReasonModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;

    const handleSubmit = () => {
        if (reason.trim()) {
            onConfirm(reason);
        } else {
            alert('Please provide a reason for pausing the job.');
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center mb-4"><Pause size={20} className="mr-2"/> Pause Job</h2>
                <p className="text-sm text-gray-600 mb-4">Please provide a reason for pausing this work segment.</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Waiting for parts, customer call required..."
                    rows={3}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Cancel</button>
                    <button onClick={handleSubmit} className="py-2 px-4 bg-red-600 text-white rounded-lg font-semibold">Confirm Pause</button>
                </div>
            </div>
        </div>
    );
};

export default PauseReasonModal;
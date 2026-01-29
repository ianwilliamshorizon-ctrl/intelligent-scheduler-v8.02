import React from 'react';
import { AlertTriangle } from 'lucide-react';
import AnimatedCheckmark from './AnimatedCheckmark';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'success' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, onClose, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', type = 'success' }) => {
    if (!isOpen) {
        return null;
    }

    const confirmButtonColor = type === 'warning' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700';
    
    // If onConfirm is not provided, use onClose (acts as a simple alert dismissal)
    const handleConfirm = onConfirm || onClose;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[90] flex justify-center items-center p-4" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-fade-in-up">
                <div className="sm:flex sm:items-start">
                    {type === 'success' ? (
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12">
                            <AnimatedCheckmark />
                        </div>
                    ) : (
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                    )}
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-grow">
                        <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <div className="text-sm text-gray-600">
                                {message}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${confirmButtonColor}`}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                    {cancelText && (
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            {cancelText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
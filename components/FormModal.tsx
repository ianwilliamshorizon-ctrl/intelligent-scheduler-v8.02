import React from 'react';
import { X, Save } from 'lucide-react';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  saveText?: string;
  saveIcon?: React.ElementType;
  maxWidth?: string;
}

const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, title, children, onSave, saveText = "Save", saveIcon: SaveIcon = Save, maxWidth = "max-w-3xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] animate-fade-in-up overflow-y-auto`}>
        <div className="flex justify-between items-center border-b p-4 flex-shrink-0 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-indigo-700">{title}</h2>
          <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
        </div>
        <div className="flex-grow p-6 bg-gray-50">
          {children}
        </div>
        {onSave && (
          <div className="flex justify-end p-4 border-t bg-gray-50 flex-shrink-0 sticky bottom-0 z-10">
            <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition mr-2">Cancel</button>
            <button onClick={onSave} className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
              <SaveIcon size={16} className="mr-2"/> {saveText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormModal;

import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { DiscountCode } from '../../../types';
import { PlusCircle, Edit, Trash2, Tag } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import DiscountCodeFormModal from '../../DiscountCodeFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

export const ManagementDiscountCodesTab = () => {
    const { discountCodes } = useData();
    const { updateItem, deleteItem } = useManagementTable(discountCodes, 'brooks_discountCodes');

    const [selectedCode, setSelectedCode] = useState<DiscountCode | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSave = (code: DiscountCode) => {
        // Ensure ID is set if new
        const codeToSave = { ...code, id: code.id || crypto.randomUUID() };
        updateItem(codeToSave);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this discount code?')) {
            deleteItem(id);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Tag className="text-indigo-600" size={20} />
                    Discount Codes
                </h3>
                <button 
                    onClick={() => { setSelectedCode(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm flex items-center gap-2 text-sm font-medium"
                >
                    <PlusCircle size={16}/> New Code
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-200">
                    {discountCodes.length === 0 ? (
                        <li className="p-6 text-center text-gray-500 italic">No discount codes found. Create one to get started.</li>
                    ) : (
                        discountCodes.map((code) => (
                            <li key={code.id} className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${code.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <Tag size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-indigo-700 text-lg">{code.code}</span>
                                            {!code.isActive && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>}
                                        </div>
                                        <p className="text-sm text-gray-600">{code.description}</p>
                                        <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                {code.type === 'Percentage' ? `${code.value}%` : formatCurrency(code.value)} Off
                                            </span>
                                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                                                Applies to: {code.applicability}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => { setSelectedCode(code); setIsModalOpen(true); }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                        title="Edit"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(code.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {isModalOpen && (
                <DiscountCodeFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    initialData={selectedCode}
                />
            )}
        </div>
    );
};
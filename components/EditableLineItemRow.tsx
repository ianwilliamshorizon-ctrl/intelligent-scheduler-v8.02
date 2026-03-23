import React from 'react';
import * as T from '../types';
import { X } from 'lucide-react';
import { formatCurrency } from '../core/utils/formatUtils';

interface EditableLineItemRowProps {
    item: T.PurchaseOrderLineItem;
    onItemChange: (item: T.PurchaseOrderLineItem) => void;
    onDeleteItem: (itemId: string) => void;
}

const EditableLineItemRow: React.FC<EditableLineItemRowProps> = ({ item, onItemChange, onDeleteItem }) => {
    const handleInputChange = (field: keyof T.PurchaseOrderLineItem, value: any) => {
        onItemChange({ ...item, [field]: value });
    };

    const total = (item.quantity || 0) * (item.unitPrice || 0);

    return (
        <tr className="border-b hover:bg-gray-50">
            <td className="p-2 align-top">
                <input
                    type="text"
                    value={item.partNumber || ''}
                    onChange={(e) => handleInputChange('partNumber', e.target.value)}
                    className="w-full p-1 border rounded"
                />
            </td>
            <td className="p-2 align-top">
                <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full p-1 border rounded"
                />
            </td>
            <td className="p-2 text-right align-top">
                <input
                    type="number"
                    value={item.quantity || 0}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value, 10))}
                    className="w-full p-1 border rounded text-right"
                />
            </td>
            <td className="p-2 text-right align-top">
                <input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value))}
                    className="w-full p-1 border rounded text-right"
                />
            </td>
            <td className="p-2 text-right font-semibold align-top">
                {formatCurrency(total)}
            </td>
            <td className="p-2 align-top text-center">
                <button onClick={() => onDeleteItem(item.id)} className="text-red-500 hover:text-red-700">
                    <X size={18} />
                </button>
            </td>
        </tr>
    );
};

export default EditableLineItemRow;

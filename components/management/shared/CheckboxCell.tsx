
import React from 'react';

export const CheckboxCell = ({ id, selectedIds, onToggle }: { id: string, selectedIds: Set<string>, onToggle: (id: string) => void }) => (
    <td className="p-2 text-center">
        <input 
            type="checkbox" 
            checked={selectedIds.has(id)} 
            onChange={() => onToggle(id)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
    </td>
);

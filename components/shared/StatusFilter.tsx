
import React from 'react';

interface StatusFilterProps<T extends string> {
    statuses: readonly T[];
    selectedStatuses: T[];
    onToggle: (status: T) => void;
}

export const StatusFilter = <T extends string>({ statuses, selectedStatuses, onToggle }: StatusFilterProps<T>) => {
    return (
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
            {statuses.map(status => {
                const isSelected = selectedStatuses.includes(status);
                return (
                    <button
                        key={status}
                        onClick={() => onToggle(status)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                            isSelected
                                ? 'bg-indigo-600 text-white shadow'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {status}
                    </button>
                );
            })}
        </div>
    );
};

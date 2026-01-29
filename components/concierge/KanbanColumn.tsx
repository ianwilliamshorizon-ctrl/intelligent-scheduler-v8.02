
import React from 'react';

export const KanbanColumn: React.FC<{ title: string; count: number; colorClass: string; children: React.ReactNode; }> = ({ title, count, colorClass, children }) => {
    return (
        <div className="flex-1 flex flex-col bg-gray-100 rounded-xl min-w-[160px] h-full max-h-full">
            <div className={`flex items-center justify-between p-1.5 border-b-4 ${colorClass} bg-white rounded-t-xl sticky top-0 z-10 shadow-sm`}>
                <h3 className="flex items-center gap-1.5 font-bold text-gray-700 text-xs">
                    {title} <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full border">{count}</span>
                </h3>
            </div>
            <div className="p-1.5 space-y-2 overflow-y-auto flex-grow custom-scrollbar">
                {children}
            </div>
        </div>
    );
};

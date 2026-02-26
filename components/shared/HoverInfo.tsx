import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface HoverInfoProps {
    title: string;
    data: Record<string, any>;
    children: React.ReactNode;
    position?: 'bottom' | 'top' | 'left' | 'right';
}

export const HoverInfo: React.FC<HoverInfoProps> = ({ title, data, children, position = 'bottom' }) => {
    const [isOpen, setIsOpen] = useState(false);

    const hasData = Object.values(data).some(val => val);

    // If there's no data to show in the popover, just render the children without any hover effects.
    if (!hasData) {
        return <>{children}</>;
    }

    const positionClasses = {
        bottom: 'top-full mt-2',
        top: 'bottom-full mb-2',
        left: 'right-full mr-2',
        right: 'left-full ml-2',
    };

    return (
        <div 
            className="relative inline-block"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <span className="border-b border-dotted border-gray-500 cursor-help">{children}</span>
            {isOpen && (
                <div className={`absolute z-[100] w-72 p-3 bg-white border border-gray-300 rounded-lg shadow-xl animate-fade-in-up-fast ${positionClasses[position]}`}>
                    <p className="font-bold text-sm mb-2 pb-1 border-b flex items-center gap-2"><Info size={14}/> {title}</p>
                    <div className="space-y-1 text-xs">
                        {Object.entries(data).map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-2">
                                <span className="font-semibold text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                <span className="text-gray-800 text-right truncate">{String(value) || 'N/A'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
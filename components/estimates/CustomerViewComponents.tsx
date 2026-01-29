
import React, { useState } from 'react';
import { EstimateLineItem } from '../../types';
import { CheckSquare, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../utils/formatUtils';

export const CustomerServicePackage: React.FC<{
    header: EstimateLineItem;
    childrenItems: EstimateLineItem[];
    isSelected: boolean;
    onToggle: () => void;
    canViewPricing: boolean;
    isInteractive: boolean;
}> = ({ header, childrenItems, isSelected, onToggle, canViewPricing, isInteractive }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className={`rounded-lg mb-3 overflow-hidden shadow-sm transition-all border ${isSelected ? 'border-indigo-500' : 'border-gray-300'}`}>
            <div 
                className={`flex items-center p-3 cursor-pointer select-none text-white ${isSelected ? 'bg-indigo-600' : 'bg-gray-500'}`} 
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div 
                    className="mr-3 flex items-center justify-center h-8 w-8 hover:bg-white/10 rounded-full transition-colors" 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isInteractive) onToggle();
                    }}
                >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center bg-white ${isSelected ? 'border-white text-indigo-600' : 'border-gray-300 text-gray-300'} ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}>
                        {isSelected && <CheckSquare size={18} />}
                    </div>
                </div>
                
                <div className="flex-grow flex items-center gap-3">
                    <Package size={20} className="text-white/90" />
                    <div>
                         <span className="font-bold block text-sm sm:text-base">{header.description}</span>
                         <span className="text-xs text-white/80">{childrenItems.length} items included</span>
                    </div>
                </div>
                
                <div className="text-right mr-4">
                     <span className="font-bold text-lg text-white">
                         {canViewPricing ? formatCurrency(header.unitPrice * header.quantity) : ''}
                     </span>
                </div>
                {isExpanded ? <ChevronUp size={20} className="text-white/80"/> : <ChevronDown size={20} className="text-white/80"/>}
            </div>
            
            {isExpanded && (
                <div className="bg-white p-3 pl-12 space-y-2 border-t border-gray-200">
                    {childrenItems.map(child => (
                        <div key={child.id} className="flex justify-between text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                            <span className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                {child.description} {child.quantity > 1 ? `(x${child.quantity})` : ''}
                            </span>
                            <span className="text-gray-500 text-xs italic font-medium">Included</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const SelectableEstimateItemRow: React.FC<{
    item: EstimateLineItem;
    isSelected: boolean;
    onToggle: () => void;
    canInteract: boolean;
    canViewPricing: boolean;
    isOptional?: boolean;
}> = ({ item, isSelected, onToggle, canInteract, canViewPricing, isOptional = false }) => (
    <div 
        key={item.id}
        className={`grid grid-cols-12 gap-2 items-center p-3 border-b transition-colors ${canInteract ? 'cursor-pointer hover:bg-gray-50' : ''} ${isOptional && isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}
        onClick={() => canInteract && onToggle()}
    >
        <div className="col-span-1 flex justify-center">
            {isOptional && (
                <div
                    onClick={(e) => {
                         e.stopPropagation();
                         if (canInteract) onToggle();
                    }}
                    className={`h-5 w-5 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'} ${canInteract ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                     {isSelected && <CheckSquare size={14} className="text-white" />}
                </div>
            )}
        </div>
        <div className={`col-span-7 ${isOptional && isSelected ? 'font-semibold text-indigo-900' : ''}`}>{item.description}</div>
        <div className="col-span-2 text-right">{item.quantity} {item.isLabor ? 'hr(s)' : ''}</div>
        <div className="col-span-2 text-right font-medium">{canViewPricing ? formatCurrency(item.unitPrice * item.quantity) : ''}</div>
    </div>
);

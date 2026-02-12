import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useData } from '../core/state/DataContext'; 
import { Search, X, User, Car, Package } from 'lucide-react';

interface SearchableSelectProps {
    // Added servicepackages to the allowed types
    collectionName: 'brooks_customers' | 'brooks_vehicles' | 'brooks_servicepackages'; 
    onSelect: (item: any) => void;
    placeholder?: string;
    initialValue?: string;
    disabled?: boolean;
    // Added to allow dynamic field targeting
    searchField?: string; 
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    collectionName,
    onSelect,
    placeholder = "Search...",
    initialValue = "",
    disabled = false,
    searchField = "searchField"
}) => {
    const data = useData();
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const deferredSearch = useDeferredValue(searchTerm);

    useEffect(() => { 
        setSearchTerm(initialValue || ""); 
    }, [initialValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchableItems = useMemo(() => {
        // Map the source to the correct data context key
        let source: any[] = [];
        if (collectionName === 'brooks_customers') source = data.customers;
        else if (collectionName === 'brooks_vehicles') source = data.vehicles;
        else if (collectionName === 'brooks_servicepackages') source = data.servicePackages || [];
        
        return source.map((item: any) => {
            let lowString = '';
            if (collectionName === 'brooks_customers') {
                lowString = `${item.id} ${item.forename || ''} ${item.surname || ''} ${item.companyName || ''} ${item.postcode || ''} ${item.searchField || ''}`;
            } else if (collectionName === 'brooks_vehicles') {
                lowString = `${item.id} ${item.registration || ''} ${item.make || ''} ${item.model || ''} ${item.customerName || ''}`;
            } else if (collectionName === 'brooks_servicepackages') {
                // Search package name and your specific searchField
                lowString = `${item.id} ${item.name || ''} ${item.searchField || ''}`;
            }

            return {
                ...item,
                _low: lowString.toLowerCase()
            };
        });
    }, [collectionName, data.customers, data.vehicles, data.servicePackages]);

    const filteredResults = useMemo(() => {
        if (!deferredSearch || deferredSearch.trim().length < 1) return [];
        const searchWords = deferredSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        
        return searchableItems
            .filter(item => searchWords.every(word => item._low.includes(word)))
            .slice(0, 50);
    }, [searchableItems, deferredSearch]);

    // Helper to determine the label to show in the input after selection
    const getDisplayLabel = (item: any) => {
        if (collectionName === 'brooks_vehicles') return item.registration?.toUpperCase() || '';
        if (collectionName === 'brooks_customers') return `${item.forename || ''} ${item.surname || ''}`.trim();
        return item.name || ''; // Default for Service Packages
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm shadow-sm bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={18} />
                </div>
                {searchTerm && (
                    <button type="button" onClick={() => {setSearchTerm(""); setIsOpen(false);}} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none">
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && searchTerm.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto overflow-x-hidden">
                    {filteredResults.length > 0 ? (
                        <>
                            <div className="sticky top-0 z-10 p-2 border-b bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {collectionName.replace('brooks_', '').replace('service', 'Service ')} Results ({filteredResults.length})
                            </div>
                            {filteredResults.map((item) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => { 
                                        onSelect(item); 
                                        setIsOpen(false); 
                                        setSearchTerm(getDisplayLabel(item));
                                    }} 
                                    className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg text-indigo-600 shrink-0">
                                            {item.registration ? <Car size={18}/> : item.name ? <Package size={18}/> : <User size={18}/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="font-bold text-sm text-gray-900 truncate">
                                                    {getDisplayLabel(item)}
                                                </p>
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">
                                                    {item.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                                {collectionName === 'brooks_vehicles' 
                                                    ? `${item.make || ''} ${item.model || ''} ${item.customerName ? `• ${item.customerName}` : ''}`
                                                    : collectionName === 'brooks_servicepackages'
                                                        ? `£${item.totalPrice || 0} • ${item.entityId?.replace('ent_', '') || ''}`
                                                        : (item.companyName || item.postcode || 'Customer Record')
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="p-6 text-center">
                            <p className="text-sm text-gray-500 italic">No matches found in {collectionName.replace('brooks_', '')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
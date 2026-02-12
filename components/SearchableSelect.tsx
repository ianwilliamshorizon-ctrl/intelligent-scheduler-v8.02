import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useData } from '../core/state/DataContext'; 
import { Search, X, User, Car } from 'lucide-react';

interface SearchableSelectProps {
    collectionName: 'brooks_customers' | 'brooks_vehicles'; 
    onSelect: (item: any) => void;
    placeholder?: string;
    initialValue?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    collectionName,
    onSelect,
    placeholder = "Search...",
    initialValue = "",
    disabled = false
}) => {
    const data = useData();
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // 1. Prioritize UI responsiveness using useDeferredValue
    const deferredSearch = useDeferredValue(searchTerm);

    // 2. Sync initial value when it changes (e.g., when switching between records)
    useEffect(() => { 
        setSearchTerm(initialValue || ""); 
    }, [initialValue]);

    // 3. Close dropdown when clicking outside the component
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 4. PRE-INDEX LOGIC: Create a low-case search string for every item
    const searchableItems = useMemo(() => {
        // Correctly map your specific collection names to the data context keys
        const source = collectionName === 'brooks_customers' ? data.customers : data.vehicles;
        
        return source.map((item: any) => ({
            ...item,
            _low: collectionName === 'brooks_customers' 
                ? `${item.id} ${item.forename || ''} ${item.surname || ''} ${item.companyName || ''} ${item.postcode || ''} ${item.searchField || ''}`.toLowerCase()
                : `${item.id} ${item.registration || ''} ${item.make || ''} ${item.model || ''} ${item.customerName || ''}`.toLowerCase()
        }));
    }, [collectionName, data.customers, data.vehicles]);

    // 5. WORD-BY-WORD FILTERING: Matches if all search words are found in the string
    const filteredResults = useMemo(() => {
        if (!deferredSearch || deferredSearch.trim().length < 1) return [];
        
        const searchWords = deferredSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        
        return searchableItems
            .filter(item => searchWords.every(word => item._low.includes(word)))
            .slice(0, 50); // High limit for accuracy, but prevents browser lag
    }, [searchableItems, deferredSearch]);

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
                
                {/* Search Icon */}
                <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={18} />
                </div>

                {/* Clear Button */}
                {searchTerm && (
                    <button 
                        type="button" 
                        onClick={() => {setSearchTerm(""); setIsOpen(false);}} 
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && searchTerm.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto overflow-x-hidden">
                    {filteredResults.length > 0 ? (
                        <>
                            <div className="sticky top-0 z-10 p-2 border-b bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {collectionName.replace('brooks_', '')} Results ({filteredResults.length})
                            </div>
                            {filteredResults.map((item) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => { 
                                        onSelect(item); 
                                        setIsOpen(false); 
                                        // Update the input to show the selected label
                                        setSearchTerm(item.registration || `${item.forename} ${item.surname}`);
                                    }} 
                                    className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg text-indigo-600 shrink-0">
                                            {item.registration ? <Car size={18}/> : <User size={18}/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="font-bold text-sm text-gray-900 truncate">
                                                    {item.registration 
                                                        ? item.registration.toUpperCase() 
                                                        : `${item.forename} ${item.surname}`
                                                    }
                                                </p>
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">
                                                    {item.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                                {item.registration 
                                                    ? `${item.make || ''} ${item.model || ''} ${item.customerName ? `• ${item.customerName}` : ''}`
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
                            <div className="text-gray-300 mb-2 flex justify-center">
                                <Search size={32} />
                            </div>
                            <p className="text-sm text-gray-500 italic">
                                No matches found in {collectionName.replace('brooks_', '')}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useData } from '../core/state/DataContext'; // Assuming this is where your global state lives
import { Search, Loader2, X, User, Car } from 'lucide-react';

interface SearchableSelectProps {
    collectionName: 'customers' | 'vehicles'; // Maps to your useData() keys
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

    // 1. Match the "Perfect Logic": Use Deferred Value for UI responsiveness
    const deferredSearch = useDeferredValue(searchTerm);

    // 2. Sync initial value
    useEffect(() => { 
        setSearchTerm(initialValue || ""); 
    }, [initialValue]);

    // 3. Handle clicking outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 4. Match the "Perfect Logic": Pre-index for faster filtering
    const searchableItems = useMemo(() => {
        const source = collectionName === 'customers' ? data.customers : data.vehicles;
        return source.map((item: any) => ({
            ...item,
            _low: collectionName === 'customers' 
                ? `${item.id} ${item.forename} ${item.surname} ${item.companyName || ''} ${item.postcode || ''} ${item.searchField || ''}`.toLowerCase()
                : `${item.id} ${item.registration} ${item.make || ''} ${item.model || ''} ${item.customerName || ''}`.toLowerCase()
        }));
    }, [collectionName, data.customers, data.vehicles]);

    // 5. Match the "Perfect Logic": Word-by-word filtering
    const filteredResults = useMemo(() => {
        if (!deferredSearch || deferredSearch.length < 1) return [];
        
        const searchWords = deferredSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        
        return searchableItems
            .filter(item => searchWords.every(word => item._low.includes(word)))
            .slice(0, 50); // Increased limit to 50 to prevent "cutting off"
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
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={18} />
                </div>
                {searchTerm && (
                    <button 
                        type="button" 
                        onClick={() => {setSearchTerm(""); setIsOpen(false);}} 
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && searchTerm.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                    {filteredResults.length > 0 ? (
                        <>
                            <div className="p-2 border-b bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase">
                                {collectionName} Results ({filteredResults.length})
                            </div>
                            {filteredResults.map((item) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => { 
                                        onSelect(item); 
                                        setSearchTerm(collectionName === 'customers' 
                                            ? `${item.forename} ${item.surname}` 
                                            : item.registration
                                        );
                                        setIsOpen(false); 
                                    }} 
                                    className="p-2.5 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-indigo-600">
                                            {collectionName === 'vehicles' ? <Car size={16}/> : <User size={16}/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <p className="font-medium text-sm text-gray-900 truncate">
                                                    {collectionName === 'customers' 
                                                        ? `${item.forename} ${item.surname}` 
                                                        : item.registration
                                                    }
                                                </p>
                                                <span className="text-[10px] font-mono text-gray-400">
                                                    {item.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                {collectionName === 'customers' 
                                                    ? (item.companyName || item.postcode || 'Customer') 
                                                    : `${item.make || ''} ${item.model || ''}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
                            No matching {collectionName} found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
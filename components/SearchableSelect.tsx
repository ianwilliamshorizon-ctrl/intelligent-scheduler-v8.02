import React, { useState, useEffect, useRef } from 'react';
import { db } from '../core/db'; 
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { Search, Loader2, X } from 'lucide-react';

interface SearchableSelectProps {
    collectionName: string;
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
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

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

    const handleSearch = async (value: string) => {
        setSearchTerm(value);
        if (value.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsSearching(true);
        try {
            const lowerVal = value.toLowerCase();
            
            // To allow searching by surname/phone/id, we need a query that isn't just a prefix
            // Since Firestore is limited, we fetch a set of records and perform a more flexible local filter
            const q = query(
                collection(db, collectionName),
                limit(100) // Fetch a slightly larger batch to filter locally
            );

            const querySnapshot = await getDocs(q);
            const allItems = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));

            // FLEXIBLE LOCAL FILTER: Checks if search term appears ANYWHERE in name, phone, or ID
            const filtered = allItems.filter((item: any) => {
                const searchString = [
                    item.forename,
                    item.surname,
                    item.phone,
                    item.id,
                    item.registration,
                    item.name,
                    item.searchField
                ].join(' ').toLowerCase();
                
                return searchString.includes(lowerVal);
            }).slice(0, 15); // Return top 15 matches

            setResults(filtered);
            setIsOpen(true);
        } catch (error) {
            console.error(`Error searching ${collectionName}:`, error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setSearchTerm("");
        onSelect({ id: "" });
        setResults([]);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 text-sm"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                </div>
                {searchTerm && !disabled && (
                    <button type="button" onClick={handleClear} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {results.map((item) => {
                        const displayName = (item.forename || item.surname) 
                            ? `${item.forename || ''} ${item.surname || ''}`.trim()
                            : (item.registration || item.name || "Unknown");

                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    onSelect(item);
                                    setIsOpen(false);
                                }}
                                className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                            >
                                <div className="font-medium text-gray-900 flex justify-between">
                                    <span>
                                        {item.registration && <span className="text-indigo-600 font-bold mr-2">[{item.registration}]</span>}
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono self-center">ID: {item.id.slice(-4)}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex justify-between mt-0.5">
                                    <span>{item.phone || 'No phone'}</span>
                                    {item.email && <span className="italic">{item.email}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {isOpen && searchTerm.length >= 2 && results.length === 0 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-sm text-gray-500 italic">
                    No customers found matching "{searchTerm}"
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
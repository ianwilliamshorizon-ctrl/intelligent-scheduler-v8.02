import React, { useState, useEffect, useRef } from 'react';
import { db } from '../core/db'; 
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { Search, Loader2, X, User, Phone, Car, Database, AlertCircle } from 'lucide-react';

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

    const handleSearch = async (value: string, forceAll = false) => {
        setSearchTerm(value);
        if (!forceAll && value.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        if (!db) return;
        setIsSearching(true);

        try {
            const colRef = collection(db, collectionName);
            const q = query(colRef, limit(500)); 
            const querySnapshot = await getDocs(q);
            
            const allItems: any[] = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));

            const lowerVal = value.toLowerCase().replace(/\s/g, ''); 
            const filtered = allItems.filter((item: any) => {
                const searchableString = [
                    item.registration || '',
                    item.forename || '',
                    item.surname || '',
                    item.make || '',
                    item.model || '',
                    item.customerName || ''
                ].join('').toLowerCase().replace(/\s/g, '');
                return searchableString.includes(lowerVal);
            });

            const sortedResults = filtered.sort((a, b) => {
                const regA = (a.registration || '').toLowerCase().replace(/\s/g, '');
                const regB = (b.registration || '').toLowerCase().replace(/\s/g, '');
                if (regA.includes(lowerVal)) return -1;
                if (regB.includes(lowerVal)) return 1;
                return 0;
            });

            setResults(sortedResults.slice(0, 10));
            setIsOpen(true);
        } catch (error: any) {
            console.error(`❌ [SEARCH ERROR]`, error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => { if(searchTerm.length >= 2) setIsOpen(true); }}
                    placeholder={placeholder}
                    disabled={false} 
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm bg-white text-gray-900"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                </div>
                {searchTerm && (
                    <button type="button" onClick={() => {setSearchTerm(""); setResults([]); setIsOpen(false);}} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                    {results.length > 0 ? (
                        <>
                            <div className="p-2 border-b bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase">
                                Results
                            </div>
                            {results.map((item) => (
                                <div key={item.id} onClick={() => { onSelect(item); setIsOpen(false); }} className="p-2.5 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-indigo-600">
                                            {item.registration ? <Car size={16}/> : <User size={16}/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <p className="font-medium text-sm text-gray-900 truncate">
                                                    {item.forename} {item.surname}
                                                </p>
                                                {item.registration && (
                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase">
                                                        {item.registration}
                                                    </span>
                                                )}
                                            </div>
                                            {(item.make || item.model) && (
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.make} {item.model}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
                            No matching records
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
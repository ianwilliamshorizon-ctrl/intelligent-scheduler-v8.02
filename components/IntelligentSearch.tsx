
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Car, X } from 'lucide-react';
import { Customer, Vehicle } from '../types';
import { parseSearchQuery } from '../services/geminiService';
import { useData } from '../core/state/DataContext';

interface IntelligentSearchProps {
    onResultClick: (type: 'customer' | 'vehicle', id: string) => void;
}

const IntelligentSearch: React.FC<IntelligentSearchProps> = ({ onResultClick }) => {
    const { customers, vehicles } = useData();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<(Customer | Vehicle)[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // AI-based search logic
    const handleAiSearch = async () => {
        if (!query.trim()) {
            setResults([]);
            setIsDropdownOpen(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const { searchTerm, searchType } = await parseSearchQuery(query);
            let searchResults: (Customer | Vehicle)[] = [];
            
            if (searchType === 'customer' || searchType === 'unknown') {
                const lowerTerm = searchTerm.toLowerCase();
                searchResults.push(...customers.filter(c =>
                    `${c.forename} ${c.surname}`.toLowerCase().includes(lowerTerm) ||
                    (c.companyName && c.companyName.toLowerCase().includes(lowerTerm)) ||
                    c.phone?.includes(lowerTerm) ||
                    c.mobile?.includes(lowerTerm) ||
                    c.email?.toLowerCase().includes(lowerTerm)
                ));
            }
            
            if (searchType === 'vehicle' || searchType === 'unknown') {
                const lowerTerm = searchTerm.toLowerCase().replace(/\s/g, '');
                searchResults.push(...vehicles.filter(v =>
                    v.registration.toLowerCase().replace(/\s/g, '').includes(lowerTerm) ||
                    v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.model.toLowerCase().includes(searchTerm.toLowerCase())
                ));
            }

            // Remove duplicates
            const uniqueResults = Array.from(new Map(searchResults.map(item => [item.id, item])).values());
            setResults(uniqueResults.slice(0, 10));

        } catch (err: any) {
            setError(err.message);
            setResults([]);
        } finally {
            setIsLoading(false);
            setIsDropdownOpen(true);
        }
    };
    
    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            handleAiSearch();
        }, 500); // 500ms delay

        return () => {
            clearTimeout(handler);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, customers, vehicles]);
    
    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);
    
    const handleResultClick = (item: Customer | Vehicle) => {
        const type = 'registration' in item ? 'vehicle' : 'customer';
        onResultClick(type, item.id);
        setQuery('');
        setResults([]);
        setIsDropdownOpen(false);
    };

    return (
        <div className="relative w-96" ref={wrapperRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && results.length > 0 && setIsDropdownOpen(true)}
                    placeholder="Intelligent Search (Name, Reg, Phone...)"
                    className="w-full pl-9 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                {isLoading && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={16}/>}
                {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={16}/>
                    </button>
                )}
            </div>
            {isDropdownOpen && (query || error) && (
                <div className="absolute top-full mt-1 w-full bg-white border rounded-lg shadow-lg z-50">
                    {error && <div className="p-3 text-sm text-red-600">{error}</div>}
                    {results.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto">
                            {results.map(item => (
                                <li key={item.id} onClick={() => handleResultClick(item)} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-50">
                                    {'registration' in item ? (
                                        <>
                                            <Car size={18} className="text-indigo-600"/>
                                            <div>
                                                <p className="font-semibold">{(item as Vehicle).registration}</p>
                                                <p className="text-xs text-gray-500">{(item as Vehicle).make} {(item as Vehicle).model}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <User size={18} className="text-indigo-600"/>
                                            <div>
                                                <p className="font-semibold">{(item as Customer).forename} {(item as Customer).surname}</p>
                                                <p className="text-xs text-gray-500">{(item as Customer).phone}</p>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : !isLoading && !error && query && (
                         <div className="p-3 text-sm text-gray-500">No results found for "{query}".</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IntelligentSearch;

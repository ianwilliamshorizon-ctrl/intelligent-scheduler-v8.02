import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useData } from '../core/state/DataContext'; 
import { Search, X, User, Car, Package, Truck } from 'lucide-react';

interface SearchableSelectProps {
    collectionName: 'brooks_customers' | 'brooks_vehicles' | 'brooks_servicepackages' | 'brooks_suppliers'; 
    onSelect: (item: any) => void;
    placeholder?: string;
    initialValue?: string; // This is the ID (e.g., supplierId)
    disabled?: boolean;
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
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const deferredSearch = useDeferredValue(searchTerm);

    // Helper to determine the label to show
    const getDisplayLabel = (item: any) => {
        if (!item) return '';
        if (collectionName === 'brooks_vehicles') return item.registration?.toUpperCase() || '';
        if (collectionName === 'brooks_customers') return `${item.forename || ''} ${item.surname || ''}`.trim() || item.companyName || '';
        if (collectionName === 'brooks_suppliers') return item.name || '';
        return item.name || ''; 
    };

    // SYNC: When initialValue (the ID) changes, find the name to display in the box
    useEffect(() => { 
        if (initialValue) {
            let source: any[] = [];
            if (collectionName === 'brooks_customers') source = data.customers;
            else if (collectionName === 'brooks_vehicles') source = data.vehicles;
            else if (collectionName === 'brooks_servicepackages') source = data.servicePackages || [];
            else if (collectionName === 'brooks_suppliers') source = data.suppliers || [];

            const selectedItem = source.find(i => i.id === initialValue);
            if (selectedItem) {
                setSearchTerm(getDisplayLabel(selectedItem));
            }
        } else {
            setSearchTerm("");
        }
    }, [initialValue, collectionName, data]);

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
        let source: any[] = [];
        if (collectionName === 'brooks_customers') source = data.customers;
        else if (collectionName === 'brooks_vehicles') source = data.vehicles;
        else if (collectionName === 'brooks_servicepackages') source = data.servicePackages || [];
        else if (collectionName === 'brooks_suppliers') source = data.suppliers || [];
        
        return source.map((item: any) => {
            let lowString = '';
            if (collectionName === 'brooks_customers') {
                lowString = `${item.id} ${item.forename || ''} ${item.surname || ''} ${item.companyName || ''} ${item.postcode || ''}`;
            } else if (collectionName === 'brooks_vehicles') {
                lowString = `${item.id} ${item.registration || ''} ${item.make || ''} ${item.model || ''} ${item.customerName || ''}`;
            } else if (collectionName === 'brooks_servicepackages') {
                lowString = `${item.id} ${item.name || ''}`;
            } else if (collectionName === 'brooks_suppliers') {
                lowString = `${item.id} ${item.name || ''} ${item.contactName || ''}`;
            }

            return {
                ...item,
                _low: lowString.toLowerCase()
            };
        });
    }, [collectionName, data]);

    const filteredResults = useMemo(() => {
        // If the search term exactly matches the display label of a selected item, don't show the dropdown
        // This prevents the dropdown from popping back up immediately after clicking an item
        if (!deferredSearch || deferredSearch.trim().length < 1) return [];
        
        const searchWords = deferredSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        
        return searchableItems
            .filter(item => searchWords.every(word => item._low.includes(word)))
            .slice(0, 50);
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
                <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={18} />
                </div>
                {searchTerm && (
                    <button type="button" onClick={() => {setSearchTerm(""); onSelect({id: null}); setIsOpen(false);}} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none">
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && filteredResults.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto overflow-x-hidden">
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
                                    {item.registration ? <Car size={18}/> : collectionName === 'brooks_suppliers' ? <Truck size={18}/> : item.name ? <Package size={18}/> : <User size={18}/>}
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
                                            : collectionName === 'brooks_suppliers'
                                                ? (item.email || item.phone || 'Supplier')
                                                : (item.companyName || item.postcode || 'Record')
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
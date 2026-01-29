import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
    id: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Select...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find(option => option.id === value), [options, value]);

    useEffect(() => {
        // When a value is selected externally or cleared, update the input text
        setSearchTerm(selectedOption ? selectedOption.label : '');
    }, [selectedOption]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm || (selectedOption && searchTerm === selectedOption.label)) {
            return options;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return options.filter(option =>
            option.label.toLowerCase().includes(lowercasedTerm)
        );
    }, [options, searchTerm, selectedOption]);

    const handleSelect = (option: Option) => {
        onChange(option.id);
        setIsOpen(false);
        // If the component is used as a one-shot action button (value is controlled as null),
        // clear the search term after selection. Otherwise, display the selected label.
        if (value === null) {
            setSearchTerm('');
        } else {
            setSearchTerm(option.label);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // If user clicks away without selecting, revert to the selected option's label or clear
                setSearchTerm(selectedOption ? selectedOption.label : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, selectedOption]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                        if(e.target.value === '') {
                           onChange(null); // Clear selection if input is cleared
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full p-2 border rounded bg-white pr-16"
                    disabled={disabled}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    {value && !disabled && (
                         <button type="button" onClick={handleClear} className="p-1 text-gray-400 hover:text-gray-600">
                             <X size={16} />
                         </button>
                    )}
                    <div className="h-full w-px bg-gray-200 mx-1"></div>
                    <button type="button" onClick={() => setIsOpen(!isOpen)} className="p-1 text-gray-400 hover:text-gray-600" disabled={disabled}>
                        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {isOpen && !disabled && (
                <ul className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li
                                key={option.id}
                                onClick={() => handleSelect(option)}
                                className="px-3 py-2 cursor-pointer hover:bg-indigo-50 text-sm"
                            >
                                {option.label}
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-gray-500 text-sm">No results found</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default SearchableSelect;

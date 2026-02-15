import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface Option {
  label: string;
  value: any;
  description?: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    className: string;
  };
}

interface SearchableSelectProps {
  options?: Option[];
  onSelect: (value: any) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  defaultValue?: any;
  disabled?: boolean;
  loading?: boolean;
  collectionName?: string; 
  initialValue?: any;
  dropdownClassName?: string; // New prop for custom width/alignment
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options = [],
  onSelect,
  placeholder = "Select an option...",
  label,
  error,
  className = "",
  defaultValue,
  disabled = false,
  loading = false,
  initialValue,
  dropdownClassName = "w-full left-0", // Default to full width of parent
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const effectiveValue = defaultValue ?? initialValue;

  // memoized selection for performance
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === effectiveValue) || null;
  }, [options, effectiveValue]);

  // Aggressive filtering including labels and descriptions
  const filteredOptions = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase().trim();
    if (!lowerSearch) return options;
    
    return options.filter(opt => 
      opt.label.toLowerCase().includes(lowerSearch) || 
      (opt.description && opt.description.toLowerCase().includes(lowerSearch))
    );
  }, [options, searchTerm]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      setIsOpen(true);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filteredOptions[activeIndex]) {
          handleSelect(filteredOptions[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: Option) => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(-1);
    if (typeof onSelect === 'function') {
      onSelect(option.value);
    }
  };

  // Auto-scroll to active keyboard index
  useEffect(() => {
    if (activeIndex !== -1 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      <div
        className={`
          group relative w-full border rounded-lg shadow-sm px-4 py-2.5 bg-white transition-all duration-200
          ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-blue-400'}
          ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : 'border-gray-300'}
          ${error ? 'border-red-500 ring-red-500/20' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
            <span className={`block truncate ${!selectedOption ? "text-gray-400" : "text-gray-900 font-medium"}`}>
              {loading ? "Loading..." : (selectedOption ? selectedOption.label : placeholder)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {loading && (
              <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <svg 
              className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-[100] mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden ${dropdownClassName}`}>
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Search..."
              autoFocus
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveIndex(0);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  className={`
                    px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between gap-4
                    ${index === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span className="font-semibold whitespace-normal leading-tight">{option.label}</span>
                    </div>
                    {option.description && (
                      <span className={`text-xs mt-1 whitespace-normal leading-relaxed ${index === activeIndex ? 'text-blue-500' : 'text-gray-400'}`}>
                        {option.description}
                      </span>
                    )}
                  </div>
                  {option.badge && (
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase self-start mt-0.5 ${option.badge.className}`}>
                      {option.badge.text}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
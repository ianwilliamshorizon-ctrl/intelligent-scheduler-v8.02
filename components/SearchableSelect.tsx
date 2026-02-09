import React, { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';
import { searchRecords, RecordItem, BrooksCollection } from '../core/services/firebaseServices';

interface Props {
  collectionName: BrooksCollection;
  onSelect: (item: RecordItem) => void;
  placeholder?: string;
}

const SearchableSelect: React.FC<Props> = ({ 
  collectionName, 
  onSelect, 
  placeholder = "Search..." 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Refs for race conditions and click-outside handling
  const requestRef = useRef<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchResults = useCallback(
    debounce(async (searchTerm: string) => {
      // Don't search for empty or very short strings
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      requestRef.current = searchTerm;
      setIsLoading(true);

      try {
        const data = await searchRecords(collectionName, searchTerm, 15);
        
        // Ensure state only updates if the search term matches the current input (Race Condition Guard)
        if (requestRef.current === searchTerm) {
          setResults(data);
        }
      } catch (error) {
        console.error("SearchableSelect Component Error:", error);
      } finally {
        if (requestRef.current === searchTerm) {
          setIsLoading(false);
        }
      }
    }, 300), 
    [collectionName]
  );

  useEffect(() => {
    fetchResults(query);
    return () => fetchResults.cancel();
  }, [query, fetchResults]);

  const handleSelect = (item: RecordItem) => {
    onSelect(item);
    setQuery(item.name);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (query.length >= 2) setIsOpen(true);
        }}
        placeholder={placeholder}
        style={{ 
          width: '100%', 
          padding: '12px', 
          borderRadius: '4px', 
          border: '1px solid #ccc',
          fontSize: '16px',
          boxSizing: 'border-box',
          outline: 'none',
          backgroundColor: '#fff'
        }}
      />

      {/* Dropdown Menu */}
      {isOpen && (query.trim().length >= 2 || isLoading) && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          border: '1px solid #ddd',
          backgroundColor: '#fff',
          listStyle: 'none',
          margin: '4px 0 0 0',
          padding: 0,
          zIndex: 9999, // High z-index to ensure it's not hidden
          maxHeight: '250px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '4px'
        }}>
          {isLoading ? (
            <li style={{ padding: '12px', color: '#888', textAlign: 'center' }}>
              <span className="flex items-center justify-center gap-2">
                Searching...
              </span>
            </li>
          ) : results.length > 0 ? (
            results.map((item) => (
              <li 
                key={item.id} 
                onClick={() => handleSelect(item)}
                style={{ 
                  padding: '12px', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid #f0f0f0',
                  color: '#333',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                <div style={{ fontWeight: '600' }}>{item.name}</div>
                {item.id && <div style={{ fontSize: '10px', color: '#999' }}>{item.id}</div>}
              </li>
            ))
          ) : (
            <li style={{ padding: '12px', color: '#ef4444', textAlign: 'center', fontSize: '14px' }}>
              No results found
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
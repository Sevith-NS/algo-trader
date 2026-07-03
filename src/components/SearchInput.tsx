"use client";
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import styles from './SearchInput.module.css';
import { useRouter } from 'next/navigation';

export default function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.quotes || []);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      router.push(`/screener?q=${encodeURIComponent(query)}`);
    }
  };

  const handleSelect = (symbol: string) => {
    setQuery(symbol);
    setShowDropdown(false);
    router.push(`/screener?q=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className={styles.searchWrapper} ref={dropdownRef}>
      <form className={styles.searchContainer} onSubmit={handleSearch}>
        <Search className={styles.searchIcon} size={20} />
        <input
          type="text"
          className={`glass-panel ${styles.searchInput}`}
          placeholder="Search for symbols, companies..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        />
      </form>
      
      {showDropdown && results.length > 0 && (
        <div className={`glass-panel ${styles.dropdown}`}>
          {results.map((result: any, index: number) => (
            <div 
              key={`${result.symbol}-${index}`} 
              className={styles.dropdownItem}
              onClick={() => handleSelect(result.symbol)}
            >
              <div className={styles.dropdownSymbol}>{result.symbol}</div>
              <div className={styles.dropdownName}>{result.shortname || result.longname}</div>
              <div className={styles.dropdownType}>{result.quoteType}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useRef, useId } from 'react';
import { Search, Loader2 } from 'lucide-react';
import styles from './SearchInput.module.css';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../lib/api';

type SearchResult = {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
};

/**
 * Symbol search — the Terminal's front door.
 *
 * Rebuilt as a real combobox. The previous version rendered its results as
 * `<div onClick>`, so the whole list was unreachable from the keyboard: you
 * could type a query and then had no way to accept a result without a mouse,
 * on the control that starts every task in the product. It also announced
 * nothing to a screen reader — no role, no expanded state, no result count.
 *
 * The pattern here is the WAI-ARIA editable combobox with a listbox popup:
 * ArrowDown/ArrowUp move the active option, Enter accepts it (or submits the
 * raw text when nothing is active), Escape closes without changing the text,
 * and `aria-activedescendant` keeps focus in the input the whole time so
 * typing never breaks.
 */
export default function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  // -1 means "no option is active", which is a real state: it is what lets
  // Enter submit the typed text instead of a highlighted suggestion.
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // useId keeps the option ids unique when more than one SearchInput mounts,
  // and stable between server and client render.
  const listboxId = useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setShowDropdown(false);
      return;
    }
    // Abort superseded requests: without this, a slow response for an older
    // query can land last and show stale results under the current text.
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setResults(data.quotes || []);
        setActiveIndex(-1); // a new result set invalidates the old highlight
        setShowDropdown(true);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error(err);
      } finally {
        // An abort means a newer request is already in flight and owns the
        // spinner — clearing it here would flicker the control on every keystroke.
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (symbol: string) => {
    setQuery(symbol);
    setShowDropdown(false);
    setActiveIndex(-1);
    router.push(`/screener?q=${encodeURIComponent(symbol)}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter with an option highlighted takes that option; otherwise it takes
    // the raw text, which is how a trader types a known ticker and goes.
    if (activeIndex >= 0 && results[activeIndex]) {
      go(results[activeIndex].symbol);
      return;
    }
    if (query.trim()) {
      setShowDropdown(false);
      router.push(`/screener?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = showDropdown && results.length > 0;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Prevent the caret jumping to the start/end of the text while the list
      // is being navigated.
      e.preventDefault();
      if (!open) {
        if (results.length > 0) setShowDropdown(true);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      // Wraps through -1, so arrowing past the last option returns to the
      // typed text rather than trapping the user in the list.
      const next = activeIndex + delta;
      setActiveIndex(next >= results.length ? -1 : next < -1 ? results.length - 1 : next);
      return;
    }

    if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Tab') setShowDropdown(false);
  };

  // Keep the active option in view when arrowing past the scroll edge.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const open = showDropdown && (results.length > 0 || (!loading && query.trim().length > 0));
  const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className={styles.searchWrapper} ref={wrapperRef}>
      <form className={styles.searchContainer} onSubmit={handleSearch} role="search">
        <Search className={styles.searchIcon} size={20} aria-hidden />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label="Search symbols and companies"
          className={`glass-panel ${styles.searchInput}`}
          placeholder="Search for symbols, companies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <Loader2 size={16} className={styles.searchSpinner} aria-hidden />
        )}
        {/* Result count, announced but not drawn — a sighted user sees the
            list, a screen reader user otherwise gets no confirmation that
            typing produced anything. */}
        <span aria-live="polite" className={styles.srOnly}>
          {open && results.length > 0 ? `${results.length} results` : ''}
          {open && results.length === 0 ? 'No matches' : ''}
        </span>
      </form>

      {open && (
        <div className={`glass-panel ${styles.dropdown}`}>
          {results.length === 0 ? (
            // An empty result is a state that should teach, not a blank panel:
            // NSE tickers needing .NS is the single most common miss here.
            <p className={styles.empty}>
              No matches for “{query.trim()}”. NSE tickers need the <code>.NS</code> suffix,
              e.g. <code>RELIANCE.NS</code>.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Search results" ref={listRef} className={styles.list}>
              {results.map((result, index) => (
                <li
                  key={`${result.symbol}-${index}`}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`${styles.dropdownItem} ${index === activeIndex ? styles.dropdownItemActive : ''}`}
                  // mousedown, not click: the input's blur would close the list
                  // before a click landed.
                  onMouseDown={(e) => { e.preventDefault(); go(result.symbol); }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={`ticker ${styles.dropdownSymbol}`}>{result.symbol}</span>
                  <span className={styles.dropdownName}>{result.shortname || result.longname}</span>
                  {result.quoteType && (
                    <span className={styles.dropdownType}>{result.quoteType}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

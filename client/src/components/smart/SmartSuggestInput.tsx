import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { fuzzyRankSuggestions } from '../../utils/fuzzy';

export type SuggestionFilter = (query: string, suggestions: string[]) => string[];

interface SmartSuggestInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onSelect'> {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  filterOptions?: SuggestionFilter;
  onSelect?: (value: string) => void;
  showOnEmpty?: boolean;
  maxSuggestions?: number;
  loading?: boolean;
  containerClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
}

export default function SmartSuggestInput({
  value,
  onChange,
  suggestions,
  filterOptions,
  onSelect,
  showOnEmpty = false,
  maxSuggestions = 8,
  loading = false,
  containerClassName = '',
  dropdownClassName = '',
  optionClassName = '',
  onFocus,
  onBlur,
  onKeyDown,
  className = '',
  ...inputProps
}: SmartSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const listId = useId();

  const filtered = useMemo(() => {
    const unique = Array.from(new Set(suggestions.filter((s) => s && s.trim())));
    const ranked = filterOptions
      ? filterOptions(value, unique)
      : fuzzyRankSuggestions(value, unique);
    return ranked.slice(0, maxSuggestions);
  }, [filterOptions, maxSuggestions, suggestions, value]);

  const canOpen = showOnEmpty || value.trim().length > 0;
  const isOpen = open && canOpen && (filtered.length > 0 || loading);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  function clearBlurTimer() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = undefined;
    }
  }

  function choose(next: string) {
    onChange(next);
    onSelect?.(next);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    clearBlurTimer();
    onFocus?.(event);
    if (showOnEmpty || value.trim().length > 0) setOpen(true);
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    clearBlurTimer();
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 120);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    setActiveIndex(-1);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'ArrowDown') {
      if (!isOpen && canOpen) {
        setOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      }
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowUp') {
      if (isOpen) {
        setActiveIndex((index) => Math.max(index - 1, 0));
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Enter' && isOpen && activeIndex >= 0 && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete={inputProps.autoComplete ?? 'off'}
      />
      {isOpen && (
        <div
          className={`absolute left-0 top-full z-[80] mt-1 max-h-60 w-max min-w-full max-w-[18rem] overflow-y-auto rounded-lg border border-th-border bg-th-surface py-1 text-th-text shadow-2xl ${dropdownClassName}`}
        >
          {loading && filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-th-secondary">Loading suggestions...</p>
          ) : (
            <ul id={listId} role="listbox">
              {filtered.map((suggestion, index) => {
                const active = index === activeIndex;
                return (
                  <li key={suggestion} role="option" aria-selected={active}>
                    <button
                      type="button"
                      id={`${listId}-option-${index}`}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(suggestion)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        active ? 'bg-th-hover text-th-text' : 'text-th-text hover:bg-th-hover'
                      } ${optionClassName}`}
                    >
                      <span className="truncate">{suggestion}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

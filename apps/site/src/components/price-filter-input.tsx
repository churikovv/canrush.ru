'use client';

import { searchMatches } from '@/lib/search-match';
import { useRef, useState } from 'react';

interface FilterOption { value: string; label: string }

export function PriceFilterInput({ id, value, options, allLabel, onChange }: {
  id: string;
  value: string;
  options: FilterOption[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find(option => option.value === value)?.label ?? '';
  const choices = [{ value: '', label: allLabel }, ...options].filter(option => searchMatches(option.label, query));
  function choose(option: FilterOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    setActive(-1);
  }
  function show() { setQuery(''); setActive(-1); setOpen(true); }

  return (
    <div className="price-filter-input" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(''); setActive(-1); }
    }}>
      <input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={`${id}-options`}
        aria-activedescendant={open && active >= 0 && choices[active] ? `${id}-option-${active}` : undefined}
        placeholder={allLabel} value={open ? query : selected}
        onFocus={show} onClick={() => { if (!open) show(); }}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); setActive(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { show(); setActive(event.key === 'ArrowDown' ? 0 : choices.length - 1); }
            else setActive(index => choices.length ? (index < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length) : -1);
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            const option = choices[active] ?? (choices.length === 1 ? choices[0] : undefined);
            if (option) choose(option);
          }
        }} />
      <button className="price-filter-toggle" type="button" aria-label={open ? 'Закрыть подсказки' : 'Открыть подсказки'} aria-controls={`${id}-options`} aria-expanded={open}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { if (open) setOpen(false); else { input.current?.focus(); show(); } }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
      {open && <div className="price-filter-popover">
        <ul id={`${id}-options`} role="listbox" aria-label={allLabel}>
          {choices.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
            className={index === active ? 'is-active' : undefined}
            ref={element => { if (index === active) element?.scrollIntoView({ block: 'nearest' }); }}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
            {option.label}{option.value === value && <span aria-hidden="true">✓</span>}
          </li>)}
        </ul>
        {!choices.length && <p role="status">Ничего не найдено</p>}
      </div>}
    </div>
  );
}

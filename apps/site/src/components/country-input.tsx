'use client';
import { useId, useState } from 'react';
import { countryFlag, countryName, FREQUENT_COUNTRIES, OTHER_COUNTRIES, type Country } from '@/lib/countries';

const fold = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').trim();
const ALL = [...FREQUENT_COUNTRIES, ...OTHER_COUNTRIES];

/**
 * «Страна производства» as a text field with a drop-down: focus shows the frequent countries first and then the rest,
 * typing filters by name, a pick puts the flag in front. The field never keeps free text — leaving it with an unknown
 * name goes back to the last chosen country; × clears it.
 */
export function CountryInput({ value, onChange, disabled, invalid, describedBy }: { value: string; onChange: (code: string) => void; disabled: boolean; invalid?: boolean; describedBy?: string }) {
  const id = useId();
  const selected = countryName(value) ?? '';
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = query === null ? '' : fold(query);
  const matches: Country[] = typed ? ALL.filter(country => fold(country.name).includes(typed))
    .sort((a, b) => Number(!fold(a.name).startsWith(typed)) - Number(!fold(b.name).startsWith(typed)) || a.name.localeCompare(b.name, 'ru')) : ALL;
  const shown = open && !disabled && matches.length > 0;
  const current = Math.min(active, matches.length - 1);

  function pick(country: Country | null) {
    onChange(country?.code ?? '');
    setQuery(null); setOpen(false); setActive(0);
  }
  function leave() {
    // An exact name typed without picking still counts; anything else goes back to the chosen country.
    if (query !== null) pick(ALL.find(country => fold(country.name) === typed) ?? (typed ? ALL.find(country => country.code === value) ?? null : null));
    setOpen(false);
  }

  return <div className="country-input" data-open={shown || undefined}>
    <div className="country-input-field">
      <span className="country-input-flag" aria-hidden="true">{value && query === null ? countryFlag(value) : '🌍'}</span>
      <input id="review-country" type="text" role="combobox" autoComplete="off" disabled={disabled} placeholder="Не указана"
        value={query ?? selected} aria-expanded={shown} aria-controls={`${id}-list`} aria-autocomplete="list" aria-invalid={invalid || undefined}
        aria-describedby={describedBy} aria-activedescendant={shown ? `${id}-option-${current}` : undefined}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={leave}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => (index + 1) % matches.length); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => (index - 1 + matches.length) % matches.length); }
          else if (event.key === 'Enter' && shown) { event.preventDefault(); pick(matches[current] ?? null); }
          else if (event.key === 'Escape' && shown) { event.preventDefault(); setQuery(null); setOpen(false); }
        }} />
      {value && !disabled && <button type="button" className="country-input-clear" aria-label="Убрать страну" onMouseDown={event => event.preventDefault()} onClick={() => pick(null)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>}
    </div>
    {shown && <ul className="country-input-options" id={`${id}-list`} role="listbox" aria-label="Страны">
      {matches.map((country, index) => <li key={country.code} id={`${id}-option-${index}`} role="option" aria-selected={index === current}
        data-group-end={!typed && index === FREQUENT_COUNTRIES.length - 1 ? '' : undefined}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(country)}>
        <span aria-hidden="true">{countryFlag(country.code)}</span>{country.name}
      </li>)}
    </ul>}
  </div>;
}

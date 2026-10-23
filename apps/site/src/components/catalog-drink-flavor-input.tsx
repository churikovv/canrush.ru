'use client';
import { Fragment, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MAX_DRINK_FLAVORS, customFlavorProblem, ownFlavorName } from '@/lib/catalog-drink-fields';

/** A chosen flavour: a key of the catalog list, or the member's own name. */
export type PickedFlavor = { key: string; label: string; own: boolean };
const SUGGESTIONS = 8;
const fold = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').trim();

/**
 * One text field for the flavour: typing opens suggestions from the catalog list and, when nothing fits exactly,
 * «Добавить «…»» as the member's own; the chosen ones sit in the field as chips (×, or Backspace on an empty field).
 * Up to three make a mix. The hidden `flavor`/`customFlavor` inputs carry them to the server.
 */
export function CatalogDrinkFlavorInput({ inputId, flavors, value, onChange, onProblem }: {
  inputId: string; flavors: { key: string; label: string }[]; value: PickedFlavor[]; onChange: (next: PickedFlavor[]) => void; onProblem: (message: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const full = value.length >= MAX_DRINK_FLAVORS;
  // In the order the catalog name will have: «Дыня + Яблоко», as the site writes a mix.
  const ordered = [...value].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const typed = fold(query);
  const taken = new Set(value.map(item => fold(item.label)));
  const matches = typed ? flavors.filter(flavor => !taken.has(fold(flavor.label)) && fold(flavor.label).includes(typed))
    .sort((a, b) => Number(!fold(a.label).startsWith(typed)) - Number(!fold(b.label).startsWith(typed)) || a.label.localeCompare(b.label, 'ru')).slice(0, SUGGESTIONS) : [];
  const exact = flavors.some(flavor => fold(flavor.label) === typed) || taken.has(typed);
  const options: PickedFlavor[] = [...matches.map(flavor => ({ ...flavor, own: false })), ...(typed && !exact ? [{ key: ownFlavorName(query), label: ownFlavorName(query), own: true }] : [])];
  const open = Boolean(typed) && !full && options.length > 0;

  function pick(option: PickedFlavor) {
    if (option.own) { const problem = customFlavorProblem(option.label); if (problem) { onProblem(problem); return; } }
    onChange([...value, option]); setQuery(''); setActive(0); onProblem('');
    input.current?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !query && value.length) { onChange(value.slice(0, -1)); return; }
    if (!open) { if (event.key === 'Enter') event.preventDefault(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % options.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + options.length) % options.length); }
    else if (event.key === 'Enter') { event.preventDefault(); const option = options[Math.min(active, options.length - 1)]; if (option) pick(option); }
    else if (event.key === 'Escape') { event.preventDefault(); setQuery(''); }
  }

  return <div className="catalog-flavor-input">
    {value.map(item => <input key={`${item.own}:${item.key}`} type="hidden" name={item.own ? 'customFlavor' : 'flavor'} value={item.key} />)}
    <div className="catalog-flavor-field" onClick={() => input.current?.focus()}>
      {ordered.map((item, index) => <Fragment key={`${item.own}:${item.key}`}>{index > 0 && <span className="catalog-flavor-plus" aria-hidden="true">+</span>}<span className="catalog-flavor-chip" data-own={item.own || undefined}>
        {item.label}
        <button type="button" aria-label={`Убрать вкус «${item.label}»`} onClick={event => { event.stopPropagation(); onChange(value.filter(other => other !== item)); input.current?.focus(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </span></Fragment>)}
      <input ref={input} id={inputId} type="text" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined} autoComplete="off" maxLength={60}
        value={query} disabled={full} placeholder={full ? `Не больше ${MAX_DRINK_FLAVORS} вкусов` : value.length ? '+ ещё вкус' : 'Например, Дыня + Яблоко'}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} />
    </div>
    {open && <ul className="catalog-flavor-options" id={`${id}-list`} role="listbox" aria-label="Подсказки вкусов">
      {options.map((option, index) => <li key={`${option.own}:${option.key}`} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(option)}>
        {option.own ? <>Добавить свой вкус <b>«{option.label}»</b></> : option.label}
      </li>)}
    </ul>}
  </div>;
}

/**
 * The brand field with the same drop-down as the flavour: catalog brands that match what is typed (first those that
 * start with it); a brand that is not there is simply kept as typed.
 */
export function CatalogDrinkBrandInput({ inputId, brands, value, onChange }: { inputId: string; brands: string[]; value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = fold(value);
  const matches = typed ? brands.filter(brand => fold(brand).includes(typed) && fold(brand) !== typed)
    .sort((a, b) => Number(!fold(a).startsWith(typed)) - Number(!fold(b).startsWith(typed)) || a.localeCompare(b, 'ru')).slice(0, SUGGESTIONS) : [];
  const shown = open && matches.length > 0;
  function pick(brand: string) { onChange(brand); setOpen(false); setActive(0); }
  return <div className="catalog-flavor-input">
    <input id={inputId} name="brand" type="text" role="combobox" aria-expanded={shown} aria-controls={`${inputId}-list`} aria-autocomplete="list"
      aria-activedescendant={shown ? `${inputId}-option-${Math.min(active, matches.length - 1)}` : undefined}
      required maxLength={40} autoComplete="off" value={value} placeholder="Например, Burn или Flash Up"
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (!shown) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % matches.length); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + matches.length) % matches.length); }
        else if (event.key === 'Enter') { event.preventDefault(); const brand = matches[Math.min(active, matches.length - 1)]; if (brand) pick(brand); }
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      }} />
    {shown && <ul className="catalog-flavor-options" id={`${inputId}-list`} role="listbox" aria-label="Бренды из каталога">
      {matches.map((brand, index) => <li key={brand} id={`${inputId}-option-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(brand)}>{brand}</li>)}
    </ul>}
  </div>;
}

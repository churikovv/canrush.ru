'use client';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import type { StoreDrinkOption } from '@/lib/store-catalog';

/** The drink chosen for a record or a comment before it is sent. */
export interface PickedDrink { brand: string; flavor: string; label: string; cover?: string }

/** The drink of a composer: what is chosen, and the fields it adds to the sent form. */
export function useWallDrink() {
  const [drink, setDrink] = useState<PickedDrink | null>(null);
  return {
    drink, pick: setDrink, clear: () => setDrink(null),
    appendTo(form: FormData) { if (drink) { form.set('drinkBrand', drink.brand); form.set('drinkFlavor', drink.flavor); } },
  };
}
export type WallDrinkState = ReturnType<typeof useWallDrink>;

const NOTHING_TAKEN = new Set<string>();
// The catalog list is loaded once per page, when the picker first opens: the feed itself does not carry it.
let loading: Promise<StoreDrinkOption[]> | null = null;
function loadOptions(): Promise<StoreDrinkOption[]> {
  loading ??= fetch('/api/drink-options').then(response => (response.ok ? response.json() as Promise<StoreDrinkOption[]> : Promise.reject(new Error(String(response.status)))));
  loading.catch(() => { loading = null; });
  return loading;
}

/**
 * The «напиток» button of a composer's toolbar: a sheet with a search over the catalog, and the chosen drink goes into
 * `state`. The sheet is portalled out of the composer's form, so nothing in it submits the form.
 */
export function WallDrinkButton({ state, disabled = false }: { state: WallDrinkState; disabled?: boolean }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId(), pickerId = useId();
  const [shown, setShown] = useState(false);
  const [options, setOptions] = useState<StoreDrinkOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  function open() {
    setShown(true);
    window.requestAnimationFrame(() => { sheet.current?.showModal(); document.getElementById(pickerId)?.focus(); });
    if (!options) loadOptions().then(setOptions, () => setFailed(true));
  }
  function close() { sheet.current?.close(); }
  return <>
    <button type="button" className="wall-drink-button" aria-label={state.drink ? `Напиток: ${state.drink.label}. Выбрать другой` : 'Прикрепить напиток из каталога'} title="Напиток из каталога"
      aria-pressed={Boolean(state.drink)} disabled={disabled} onClick={open}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8M7.5 5.5h9l-.6 14a1.5 1.5 0 0 1-1.5 1.5H9.6a1.5 1.5 0 0 1-1.5-1.5Z" /><path d="m12.6 9-2 3.4h2.8l-2 3.4" /></svg>
    </button>
    {shown && createPortal(<BottomSheet ref={sheet} className="wall-drink-sheet" labelledBy={titleId}>
      <BottomSheetHead id={titleId} title="Напиток к записи" onClose={close} />
      <p className="wall-drink-sheet-hint">Найдите энергетик в каталоге — под записью появится его карточка со ссылкой.</p>
      {options ? <StoreDrinkPicker id={pickerId} options={options} taken={NOTHING_TAKEN} allowCustom={false} placeholder="Например, Burn манго"
        onAdd={choice => {
          if (!choice.brand || !choice.flavor) return;
          const option = options.find(item => item.brand === choice.brand && item.flavor === choice.flavor);
          state.pick({ brand: choice.brand, flavor: choice.flavor, label: choice.name, ...(option?.cover ? { cover: option.cover } : {}) });
          close();
        }} />
        : <p className="wall-drink-sheet-status" role="status">{failed ? 'Не удалось загрузить каталог. Закройте окно и попробуйте ещё раз.' : 'Загружаем каталог…'}</p>}
    </BottomSheet>, document.body)}
  </>;
}

/** The chosen drink in a composer, with a cross to take it off. */
export function WallDrinkChip({ state }: { state: WallDrinkState }) {
  if (!state.drink) return null;
  return <div className="wall-drink-chip">
    {state.drink.cover ? <Image src={state.drink.cover} width={36} height={36} alt="" unoptimized={state.drink.cover.startsWith('/')} /> : <span className="wall-drink-bolt" aria-hidden="true">⚡</span>}
    <span><small>Напиток</small>{state.drink.label}</span>
    <button type="button" onClick={state.clear} aria-label={`Убрать напиток ${state.drink.label}`}>×</button>
  </div>;
}

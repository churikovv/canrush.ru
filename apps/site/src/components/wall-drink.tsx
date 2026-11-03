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
 * The catalog search for a composer's drink, as a sheet: `open()` shows it (from the composer's paperclip menu), the
 * chosen drink goes into `state`. The sheet is portalled out of the composer's form, so nothing in it submits the form.
 */
export function useDrinkSheet(state: WallDrinkState) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId(), pickerId = useId();
  const [shown, setShown] = useState(false);
  const [options, setOptions] = useState<StoreDrinkOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  function open() {
    setShown(true);
    setFailed(false);
    window.requestAnimationFrame(() => { sheet.current?.showModal(); document.getElementById(pickerId)?.focus(); });
    if (!options) loadOptions().then(setOptions, () => setFailed(true));
  }
  const close = () => sheet.current?.close();
  const element = shown ? createPortal(<BottomSheet ref={sheet} className="wall-drink-sheet" labelledBy={titleId}>
    <BottomSheetHead id={titleId} title="Энергетик" onClose={close} />
    <p className="wall-drink-sheet-hint">Найдите энергетик в каталоге — появится его карточка со ссылкой.</p>
    {options ? <StoreDrinkPicker id={pickerId} options={options} taken={NOTHING_TAKEN} allowCustom={false} placeholder="Например, Burn манго"
      onAdd={choice => {
        if (!choice.brand || !choice.flavor) return;
        const option = options.find(item => item.brand === choice.brand && item.flavor === choice.flavor);
        state.pick({ brand: choice.brand, flavor: choice.flavor, label: choice.name, ...(option?.cover ? { cover: option.cover } : {}) });
        close();
      }} />
      : <p className="wall-drink-sheet-status" role="status">{failed ? 'Не удалось загрузить каталог. Закройте окно и попробуйте ещё раз.' : 'Загружаем каталог…'}</p>}
  </BottomSheet>, document.body) : null;
  return { open, element };
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

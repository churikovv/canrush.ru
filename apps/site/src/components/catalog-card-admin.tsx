'use client';
import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { FormAlert } from '@/components/form-alert';
import { EditIcon } from '@/components/action-icons';
import { MoreActions } from '@/components/more-actions';
import { searchMergeTargetsAction } from '@/app/catalog/new/actions';
import { dismissCardCheckAction, mergeCatalogCardAction, renameCatalogCardAction, setCardDiscontinuedAction, setCardHiddenAction, setCardNameAction, setCardPhotoAction } from '@/app/admin/drinks/card-actions';
import { CatalogDrinkBrandInput, CatalogDrinkFlavorInput, type PickedFlavor } from '@/components/catalog-drink-flavor-input';
import { DrinkJuiceOption, SUGAR_OPTIONS } from '@/components/catalog-drink-form';
import Link from '@/components/navigation-progress';
import { splitDrinkFlavorKey, type DrinkSugar } from '@/lib/catalog-drink-fields';
import { MAX_CARD_FULL_NAME } from '@/lib/catalog-card-edit-fields';
import type { AdminCatalogCard } from '@/lib/catalog-card-check';
import type { CardActionState } from '@/app/admin/drinks/card-actions';

const subscribeNever = () => () => {};
/** The box of «Снят с производства», as on the drink page and in brand collections. */
function ArchiveIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4" /></svg>;
}
type Dialog = 'photo' | 'name' | 'rename' | 'merge';
type Options = { brands: string[]; flavors: { key: string; label: string }[] };
type MergeTarget = { brand: string; flavor: string; label: string; cover?: string };

/**
 * «⋯» on a parser card in /admin/drinks: change the cover, the full name, mark it «Снят с производства» or back, hide it
 * from the catalog or bring it back, merge it into another card. The dialogs live in a portal so they outlive the menu.
 */
export function CatalogCardAdminMenu({ card, brands, flavors }: { card: AdminCatalogCard } & Options) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState<{ kind: Dialog; round: number } | null>(null);
  const [hiding, startHiding] = useTransition();
  const [error, setError] = useState('');
  const label = `${card.brand} · ${card.name}`;
  const show = (kind: Dialog) => { setOpen(previous => ({ kind, round: (previous?.round ?? 0) + 1 })); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();
  const target = { brand: card.brand, flavor: card.flavor };
  function toggleHidden() {
    const hide = !card.hidden;
    if (hide && !window.confirm(`Скрыть «${label}» из каталога? Карточка пропадёт из списка, поиска и тирлистов, отзывы останутся.`)) return;
    startHiding(async () => { const result = await setCardHiddenAction(target, hide); setError(result.error ?? ''); });
  }
  function toggleDiscontinued() {
    const archive = !card.discontinued;
    if (archive && !window.confirm(`Отметить «${label}» как снятый с производства? На странице напитка появится плашка, а в коллекциях вкусов он станет необязательным. Цены магазинов останутся.`)) return;
    startHiding(async () => { const result = await setCardDiscontinuedAction(target, archive); setError(result.error ?? ''); });
  }
  return <>
    <MoreActions label={`Действия: ${label}`}>
      <button className="more-actions-item" type="button" role="menuitem" onClick={() => show('photo')}><PhotoIcon /><span>Сменить фото</span></button>
      {!card.mergedInto && !card.hidden && <button className="more-actions-item" type="button" role="menuitem" onClick={() => show('rename')}><RenameIcon /><span>Переименовать</span></button>}
      <button className="more-actions-item" type="button" role="menuitem" onClick={() => show('name')}><EditIcon /><span>Полное название</span></button>
      {!card.mergedInto && <button className="more-actions-item" type="button" role="menuitem" onClick={() => show('merge')}><MergeIcon /><span>Склеить с…</span></button>}
      {!card.mergedInto && !card.hidden && <button className="more-actions-item" type="button" role="menuitem" disabled={hiding} onClick={toggleDiscontinued}><ArchiveIcon /><span>{card.discontinued ? 'Вернуть в производство' : 'Снят с производства'}</span></button>}
      <button className={card.hidden ? 'more-actions-item' : 'more-actions-item is-danger'} type="button" role="menuitem" disabled={hiding} onClick={toggleHidden}><HideIcon /><span>{card.hidden ? 'Вернуть в каталог' : 'Скрыть из каталога'}</span></button>
    </MoreActions>
    {error && <p className="field-error admin-drink-card-error" role="alert">{error}</p>}
    {mounted && createPortal(<dialog ref={dialog} className="content-report-dialog admin-drink-dialog" aria-labelledby={titleId} onClose={() => setOpen(null)}>
      {open?.kind === 'photo' && <PhotoForm key={open.round} card={card} titleId={titleId} onDone={close} />}
      {open?.kind === 'name' && <NameForm key={open.round} card={card} titleId={titleId} onDone={close} />}
      {open?.kind === 'rename' && <RenameForm key={open.round} card={card} brands={brands} flavors={flavors} titleId={titleId} onDone={close} />}
      {open?.kind === 'merge' && <MergeForm key={open.round} card={card} titleId={titleId} onDone={close} />}
    </dialog>, document.body)}
  </>;
}

function PhotoForm({ card, titleId, onDone }: { card: AdminCatalogCard; titleId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(setCardPhotoAction.bind(null, { brand: card.brand, flavor: card.flavor }), {});
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (state.saved) onDone(); }, [state.saved, onDone]);
  return <form action={action} className="store-form admin-drink-edit-form">
    <h2 id={titleId}>Фото карточки</h2>
    <p className="field-help">Своё фото заменит фото из магазина в каталоге, на странице напитка и в подборках. Парсер его не перезапишет.</p>
    <fieldset disabled={pending}>
      <div className="admin-drink-edit-photo">
        {preview || card.cover ? <Image src={preview || card.cover!} width={72} height={90} unoptimized alt="" /> : <span className="admin-card-cover-empty" />}
        <label>Новое фото банки<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] ?? null)} /></label>
      </div>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!photo}>{pending ? 'Сохраняем…' : 'Сохранить фото'}</button>
        {card.ownPhoto && <button className="community-button community-button-secondary" type="submit" name="restore" value="1" formNoValidate>Вернуть фото магазина</button>}
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}

function NameForm({ card, titleId, onDone }: { card: AdminCatalogCard; titleId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(setCardNameAction.bind(null, { brand: card.brand, flavor: card.flavor }), {});
  useEffect(() => { if (state.saved) onDone(); }, [state.saved, onDone]);
  return <form action={action} className="store-form admin-drink-edit-form">
    <h2 id={titleId}>Полное название</h2>
    <p className="field-help">Как напиток называют целиком, с линейкой: «Monster Ultra Paradise». Название показывается под вкусом, по нему ищет каталог. Пустое поле убирает название.</p>
    <fieldset disabled={pending}>
      <label>Полное название<input name="fullName" defaultValue={card.fullName ?? ''} maxLength={MAX_CARD_FULL_NAME} placeholder={`${card.brand} ${card.name}`} /></label>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit">{pending ? 'Сохраняем…' : 'Сохранить'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}

/**
 * «Переименовать» — usually after a redesign: the same brand, flavour, sugar and juice inputs as a member drink. A name
 * the catalog already has comes back as a duplicate, and the dialog offers to merge into that card instead.
 */
function RenameForm({ card, brands, flavors, titleId, onDone }: { card: AdminCatalogCard; titleId: string; onDone: () => void } & Options) {
  const self = { brand: card.brand, flavor: card.flavor };
  const [state, action, pending] = useActionState(renameCatalogCardAction.bind(null, self), {});
  const initial = useMemo(() => {
    const { parts, sugar, juice } = splitDrinkFlavorKey(card.flavor);
    const picked = parts.map((part): PickedFlavor => {
      const known = flavors.find(flavor => flavor.key === part);
      return known ? { key: known.key, label: known.label, own: false } : { key: part, label: part, own: true };
    });
    return { picked, sugar, juice };
  }, [card.flavor, flavors]);
  const [brand, setBrand] = useState(card.brand);
  const [picked, setPicked] = useState<PickedFlavor[]>(initial.picked);
  const [sugar, setSugar] = useState<DrinkSugar>(initial.sugar);
  const [juice, setJuice] = useState(initial.juice);
  const [problem, setProblem] = useState('');
  const [merged, setMerged] = useState<CardActionState>({});
  const [merging, startMerge] = useTransition();
  useEffect(() => { if (state.saved || merged.saved) onDone(); }, [state.saved, merged.saved, onDone]);
  const duplicate = !problem ? state.duplicate : undefined;
  function merge() {
    if (!duplicate) return;
    const form = new FormData(); form.set('targetBrand', duplicate.brand); form.set('targetFlavor', duplicate.flavor);
    startMerge(async () => setMerged(await mergeCatalogCardAction(self, {}, form)));
  }
  const id = `admin-card-rename-${card.brand}-${card.flavor}`.replace(/[^\p{L}\p{N}-]+/gu, '-');
  // Sent by hand, not as the form's action: after an action React resets the form, and the sugar radio would show the
  // first option again while a clash is on screen. The sugar and juice go from the dialog's state.
  return <form className="store-form admin-drink-edit-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('sugar', sugar); if (juice) form.set('juice', '1'); else form.delete('juice');
    startTransition(() => action(form));
  }}>
    <h2 id={titleId}>Переименовать карточку</h2>
    <p className="field-help">Например, после редизайна. Отзывы, избранное, коллекции, трекер и данные бренда переедут, старый адрес будет вести на новый. Магазины могут и дальше писать прежнее название — их цены всё равно придут в эту карточку. Если такое название уже есть в каталоге, предложим склеить.</p>
    <fieldset disabled={pending || merging}>
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor={`${id}-brand`}>Бренд</label>
        <CatalogDrinkBrandInput inputId={`${id}-brand`} brands={brands} value={brand} onChange={setBrand} />
      </div>
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor={`${id}-flavor`}>Вкус</label>
        <CatalogDrinkFlavorInput inputId={`${id}-flavor`} flavors={flavors} value={picked} onChange={setPicked} onProblem={setProblem} />
      </div>
      <fieldset className="catalog-drink-sugar">
        <legend className="catalog-flavor-label">Сахар</legend>
        {SUGAR_OPTIONS.map(option => <label key={option.value} className="catalog-drink-sugar-option">
          <input type="radio" name="sugar" value={option.value} checked={sugar === option.value} onChange={() => setSugar(option.value)} />
          <span><b>{option.title}</b><small>{option.hint}</small></span>
        </label>)}
      </fieldset>
      <DrinkJuiceOption checked={juice} onChange={setJuice} />
      {(problem || state.error) && <FormAlert title={duplicate ? 'Такая карточка уже есть' : undefined} actions={duplicate ? <>
        <button type="button" className="community-button" onClick={merge}>{merging ? 'Склеиваем…' : `Склеить с «${duplicate.label}»`}</button>
        <Link className="community-button community-button-secondary" href={duplicate.href} target="_blank">Открыть карточку</Link>
      </> : undefined}>{problem || (duplicate ? `«${duplicate.label}» уже есть в каталоге. Склейте карточки: всё переедет туда, а две одинаковые не появятся.` : state.error)}</FormAlert>}
      {merged.error && <FormAlert>{merged.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!picked.length || brand.trim().length < 2}>{pending ? 'Переименовываем…' : 'Переименовать'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}

/** «Склеить с…»: the same search as a member drink's merge; the merge cannot be undone from here. */
function MergeForm({ card, titleId, onDone }: { card: AdminCatalogCard; titleId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(mergeCatalogCardAction.bind(null, { brand: card.brand, flavor: card.flavor }), {});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MergeTarget[]>([]);
  const [target, setTarget] = useState<MergeTarget | null>(null);
  const [searching, startSearch] = useTransition();
  const listId = useId();
  const shown = query.trim() ? results : [];
  useEffect(() => { if (state.saved) onDone(); }, [state.saved, onDone]);
  useEffect(() => {
    const typed = query.trim();
    if (!typed) return;
    const timer = window.setTimeout(() => startSearch(async () => { setResults(await searchMergeTargetsAction(typed, { brand: card.brand, flavor: card.flavor })); }), 250);
    return () => window.clearTimeout(timer);
  }, [query, card.brand, card.flavor]);
  function confirmMerge(event: FormEvent<HTMLFormElement>) {
    if (!target) { event.preventDefault(); return; }
    if (!window.confirm(`Склеить «${card.brand} · ${card.name}» с «${target.label}»? Это нельзя отменить: отзывы и отметки переедут, а предложения магазинов будут показываться на выбранной карточке.`)) event.preventDefault();
  }
  return <form action={action} onSubmit={confirmMerge} className="store-form admin-drink-edit-form admin-drink-merge">
    <h2 id={titleId}>Склеить с другой карточкой</h2>
    <p className="field-help">«{card.brand} · {card.name}» — дубль? Её предложения магазинов будут показываться на выбранной карточке, отзывы, избранное, тирлисты, трекер и свайпы переедут туда, а старый адрес будет вести на неё. Парсер может и дальше присылать её — склейка останется.</p>
    <fieldset disabled={pending}>
      <label>Карточка каталога<input type="search" value={query} onChange={event => { setQuery(event.target.value); setTarget(null); }} placeholder="Бренд, вкус или название" autoComplete="off" aria-controls={listId} /></label>
      {target && <input type="hidden" name="targetBrand" value={target.brand} />}
      {target && <input type="hidden" name="targetFlavor" value={target.flavor} />}
      <ul className="admin-merge-results" id={listId} aria-busy={searching}>
        {shown.map(option => <li key={`${option.brand}:${option.flavor}`}>
          <button type="button" aria-pressed={target?.brand === option.brand && target.flavor === option.flavor} onClick={() => setTarget(option)}>
            <span className="admin-merge-cover">{option.cover ? <Image src={option.cover} width={40} height={40} unoptimized alt="" /> : null}</span>
            <span>{option.label}</span>
          </button>
        </li>)}
        {query.trim() && !searching && !results.length && <li className="field-help">Ничего не нашлось.</li>}
      </ul>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!target}>{pending ? 'Склеиваем…' : target ? `Склеить с «${target.label}»` : 'Выберите карточку'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}

const icon = (path: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const PhotoIcon = () => icon('M4 7h3l2-3h6l2 3h3v12H4V7Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z');
const MergeIcon = () => icon('M6 4v5a5 5 0 0 0 5 5h7M18 14l-3-3m3 3-3 3M6 20v-3');
const RenameIcon = () => icon('M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4M13 20h7');
const HideIcon = () => icon('M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10.6 10.6 0 0 1-2.4 3.3M6.6 6.6C4.4 8 3 10.5 3 12c0 2 4 7 9 7a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2');

/**
 * The quick answers to the neural network's doubt about a card: merge into the card it named (asking first — a merge
 * cannot be undone) or clear it («Не дубль», «Вкус верный» for an unread flavour). Anything else is in «⋯».
 */
export function CardQueueActions({ card, match, unknown }: { card: { brand: string; flavor: string }; match: { brand: string; flavor: string; label: string } | null; unknown: boolean }) {
  const [state, setState] = useState<CardActionState>({});
  const [pending, start] = useTransition();
  function merge() {
    if (!match || !window.confirm(`Склеить с «${match.label}»? Это нельзя отменить: отзывы и отметки переедут, а предложения магазинов будут показываться на выбранной карточке.`)) return;
    const form = new FormData(); form.set('targetBrand', match.brand); form.set('targetFlavor', match.flavor);
    start(async () => setState(await mergeCatalogCardAction(card, {}, form)));
  }
  return <div className="admin-card-queue-actions">
    {match && <button className="community-button" type="button" disabled={pending} onClick={merge}>{pending ? 'Склеиваем…' : `Склеить с «${match.label}»`}</button>}
    <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => start(async () => setState(await dismissCardCheckAction(card)))}>{unknown ? 'Вкус верный' : 'Не дубль'}</button>
    {state.error && <p className="field-error" role="alert">{state.error}</p>}
  </div>;
}

'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { voteAwardAction, type AwardVoteState } from '@/app/awards/actions';
import { ActionToast } from '@/components/action-toast';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import Link from '@/components/navigation-progress';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { loadDrinkOptions } from '@/components/wall-drink';
import type { AwardBoard, AwardCategoryView, AwardNomineeView } from '@/lib/awards';
import { awardCategory, isSugarFreeDrink, votesLabel, type AwardCategory } from '@/lib/awards-fields';
import { cutoutSrc } from '@/lib/can-cutout-src';
import type { StoreDrinkOption } from '@/lib/store-catalog';

const NOTHING_TAKEN = new Set<string>();
const subscribeNever = () => () => {};
const one = (value: number) => value.toFixed(1);
const reviewsWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'отзыв' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'отзыва' : 'отзывов';

function Check() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.6 8.4 2.8 2.8 6-6.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** A big outline mark per category, in the tile's corner as Steam's award cards have theirs. */
const MARKS: Record<AwardCategory, ReactNode> = {
  design: <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 12a1.3 1.3 0 1 1 0-.01M10 7.5a1.3 1.3 0 1 1 0-.01M15 7.5a1.3 1.3 0 1 1 0-.01" />,
  taste: <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" />,
  drink: <path d="M5 17h14l1-9-4.5 3.5L12 5 8.5 11.5 4 8l1 9Zm0 3h14" />,
  sugarfree: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7" />,
};

/** A can: our cover without its shop background, standing on the tile's glow; another site's photo on a light panel. */
function Can({ cover, size, className }: { cover: string | null; size: number; className: string }) {
  if (!cover) return <span className={`${className} is-empty`} aria-hidden="true">⚡</span>;
  const cut = cutoutSrc(cover);
  // eslint-disable-next-line @next/next/no-img-element -- the cutout route serves a sized WebP
  return cut ? <img className={className} src={cut} alt="" loading="lazy" /> : <Image className={`${className} is-photo`} src={cover} width={size} height={size} alt="" />;
}

/**
 * «Премия за энергию», as the Steam Awards: a grid of category tiles, each with the member's pick (or, with the results,
 * the winner); a tap opens the category as a sheet — its nominees, a tap votes, «Добавить свой напиток» picks any
 * catalog drink. The server revalidates the page on a vote, so the tile and the shares update in place.
 */
export function AwardsBoard({ board, signedIn }: { board: AwardBoard; signedIn: boolean }) {
  const [openKey, setOpenKey] = useState<AwardCategory | null>(null);
  // The sheet goes to `body` (the top layer) once the page is in the browser: the server renders the tiles only.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [sheet, setSheet] = useState<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [state, setState] = useState<AwardVoteState>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const open = board.phase === 'open';
  const category = board.categories.find(item => item.key === openKey) ?? null;

  function show(key: AwardCategory) {
    setOpenKey(key);
    setView('list');
    setState({});
    window.requestAnimationFrame(() => sheet?.showModal());
  }
  const close = () => sheet?.close();
  function vote(key: AwardCategory, brand: string, flavor: string) {
    setBusy(`${brand}\u0000${flavor}`);
    start(async () => {
      const result: AwardVoteState = await voteAwardAction(key, brand, flavor).catch(() => ({ error: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' }));
      setState(result);
      setBusy(null);
      if (result.done) setView('list');
    });
  }

  return <>
    <ul className="award-grid">{board.categories.map(item => {
      const mine = item.nominees.find(nominee => nominee.mine);
      const winner = !open && (item.nominees[0]?.votes ?? 0) > 0 ? item.nominees[0]! : null;
      const shown = winner ?? mine ?? null;
      return <li key={item.key}>
        <button type="button" className="award-tile" data-category={item.key} data-chosen={shown ? '' : undefined} onClick={() => show(item.key)}
          aria-label={`${item.title}: ${shown ? `${winner ? 'победитель' : 'ваш голос'} — ${shown.brand} · ${shown.name}` : open ? 'выбрать номинанта' : 'итоги'}`}>
          <svg className="award-tile-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MARKS[item.key]}</svg>
          <strong className="award-tile-title">{item.title}</strong>
          <span className="award-tile-stage">
            {shown
              ? <Can cover={shown.cover} size={160} className="award-tile-can" />
              : item.nominees.length
                ? <span className="award-tile-fan" aria-hidden="true">{item.nominees.slice(0, 3).map(nominee => <Can key={`${nominee.brand}:${nominee.flavor}`} cover={nominee.cover} size={96} className="award-tile-can" />)}</span>
                : <span className="award-tile-can is-empty" aria-hidden="true">+</span>}
          </span>
          <span className="award-tile-foot">
            {shown
              ? <><small>{winner ? 'Победитель' : <><Check />Ваш голос</>}</small><b>{shown.brand} · {shown.name}</b></>
              : <><small>{item.nominees.length ? `${item.nominees.length} ${item.nominees.length === 1 ? 'номинант' : item.nominees.length < 5 ? 'номинанта' : 'номинантов'}` : 'Пока без номинантов'}</small><b>{open ? 'Выбрать' : 'Итоги'}</b></>}
          </span>
        </button>
      </li>;
    })}</ul>

    {mounted && createPortal(<BottomSheet ref={setSheet} className="award-sheet" labelledBy={titleId} onClose={() => setOpenKey(null)}>
      {category && (view === 'list'
        ? <>
            <BottomSheetHead id={titleId} title={category.title} onClose={close} />
            <p className="award-sheet-hint">{category.hint}{category.revealed && category.total !== null ? ` · ${votesLabel(category.total)}` : ''}</p>
            {open && !signedIn && <p className="award-sheet-note">Чтобы голосовать, <Link href="/sign-in">войдите</Link>: голос — один в номинации, его можно поменять.</p>}
            {open && signedIn && board.block && <p className="award-sheet-note" role="status">{board.block}</p>}
            {category.nominees.length ? <ol className="award-picks">{category.nominees.map((nominee, index) =>
              <Nominee key={`${nominee.brand}:${nominee.flavor}`} nominee={nominee} category={category} winner={!open && index === 0 && (nominee.votes ?? 0) > 0}
                votable={open && signedIn && !board.block} busy={pending && busy === `${nominee.brand}\u0000${nominee.flavor}`} disabled={pending}
                onVote={() => vote(category.key, nominee.brand, nominee.flavor)} />)}</ol>
              : <p className="award-sheet-hint">Номинантов пока нет — добавьте свой напиток первым.</p>}
            {open && signedIn && !board.block && <button type="button" className="award-add" disabled={pending} onClick={() => setView('add')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Добавить свой напиток
            </button>}
          </>
        : <AddDrink category={category} titleId={titleId} onBack={() => setView('list')} onClose={close} onPick={(brand, flavor) => vote(category.key, brand, flavor)} />)}
      <ActionToast message={state.error ?? (state.done ? 'Голос принят' : undefined)} tone={state.error ? 'error' : 'success'} trigger={state} container={sheet} />
    </BottomSheet>, document.body)}
  </>;
}

/** A nominee in the category's sheet: the whole row votes; the reviews link sits beside it. */
function Nominee({ nominee, category, winner, votable, busy, disabled, onVote }: {
  nominee: AwardNomineeView; category: AwardCategoryView; winner: boolean; votable: boolean; busy: boolean; disabled: boolean; onVote: () => void;
}) {
  const { metric } = awardCategory(category.key);
  const { reviews, taste, design, overall } = nominee.rating;
  const main = !reviews ? 'Отзывов пока нет' : metric === 'design' ? `★ дизайн ${one(design)}` : metric === 'taste' ? `★ вкус ${one(taste)}` : `★ ${one(overall)} из 10`;
  const body = <>
    <Can cover={nominee.cover} size={64} className="award-pick-can" />
    <span className="award-pick-text">
      <small>{winner ? 'Победитель · ' : ''}{nominee.brand}{!nominee.seeded && ' · добавлен участниками'}</small>
      <strong>{nominee.name}</strong>
      <span className="award-pick-rating">{main}{reviews > 0 && metric !== 'overall' && <> · {one(overall)} из 10</>}</span>
      {nominee.share !== null && <span className="award-pick-share"><span className="award-pick-bar"><span style={{ width: `${nominee.share}%` }} /></span><span><b>{nominee.share}%</b> · {votesLabel(nominee.votes ?? 0)}</span></span>}
    </span>
    <span className="award-pick-mark" aria-hidden="true">{nominee.mine ? <Check /> : busy ? '…' : null}</span>
  </>;
  return <li className="award-pick" data-mine={nominee.mine || undefined} data-winner={winner || undefined}>
    {votable
      ? <button type="button" className="award-pick-main" disabled={disabled || nominee.mine} aria-pressed={nominee.mine} onClick={onVote}
          aria-label={`${nominee.mine ? 'Ваш голос' : 'Голосовать'}: ${nominee.brand} · ${nominee.name}`}>{body}</button>
      : <div className="award-pick-main">{body}</div>}
    {reviews > 0 && <Link className="award-pick-reviews" href={`/catalog/${nominee.slug}?tab=reviews`}>{reviews} {reviewsWord(reviews)}</Link>}
  </li>;
}

/** «Добавить свой напиток», a second screen of the sheet: the catalog search; the chosen drink becomes the vote. */
function AddDrink({ category, titleId, onBack, onClose, onPick }: { category: AwardCategoryView; titleId: string; onBack: () => void; onClose: () => void; onPick: (brand: string, flavor: string) => void }) {
  const pickerId = useId();
  const [options, setOptions] = useState<StoreDrinkOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { sugarFree } = awardCategory(category.key);
  // The catalog list loads once per page (`loadDrinkOptions` keeps the promise), when this screen first opens.
  useEffect(() => { loadDrinkOptions().then(setOptions, () => setFailed(true)); }, []);
  const allowed = useMemo(() => options && (sugarFree ? options.filter(option => isSugarFreeDrink(option.flavor, `${option.label} ${option.fullName ?? ''}`)) : options), [options, sugarFree]);
  return <>
    <BottomSheetHead id={titleId} title="Свой напиток" onBack={onBack} onClose={onClose} />
    <p className="award-sheet-hint">{sugarFree ? 'Найдите энергетик без сахара в каталоге' : 'Найдите энергетик в каталоге'} — он станет вашим голосом в номинации «{category.title}» и появится в списке.</p>
    {allowed ? <StoreDrinkPicker id={pickerId} options={allowed} taken={NOTHING_TAKEN} allowCustom={false} placeholder="Например, Burn манго"
      onAdd={choice => { if (choice.brand && choice.flavor) onPick(choice.brand, choice.flavor); }} />
      : <p className="award-sheet-hint" role="status">{failed ? 'Не удалось загрузить каталог. Вернитесь назад и попробуйте ещё раз.' : 'Загружаем каталог…'}</p>}
  </>;
}

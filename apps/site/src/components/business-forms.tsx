'use client';
import { useActionState, useRef, useState, useTransition } from 'react';
import { answerBusinessInviteAction, deleteReviewReplyAction, inviteBusinessMemberAction, replyReviewAction, leaveBusinessAction, removeBusinessLogoAction, removeBusinessMemberAction, saveBusinessNotificationsAction, uploadBusinessLogoAction, moderateBusinessAction, moderateBusinessDrinkAction, removeBusinessDrinkAction, requestBusinessDrinkAction, saveBusinessAction } from '@/app/business/cabinet/actions';
import { saveThemeSettings } from '@/app/profile/settings/theme-actions';
import { ActionToast } from '@/components/action-toast';
import { FormAlert } from '@/components/form-alert';
import Link from '@/components/navigation-progress';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { BUSINESS_KINDS, MAX_BUSINESS_REPLY, type BusinessKind } from '@/lib/business-fields';
import type { SiteTheme } from '@/lib/site-theme';
import type { StoreDrinkOption } from '@/lib/store-catalog';

export interface BusinessFormValues { name: string; kind: BusinessKind; website: string | null; telegram: string | null; contactEmail: string | null; about: string | null }

/** The company: on the first save it is the application to the team, afterwards the settings. */
export function BusinessForm({ initial, apply }: { initial?: BusinessFormValues; apply: boolean }) {
  const [state, action, pending] = useActionState(saveBusinessAction, {});
  const [kind, setKind] = useState<BusinessKind>(initial?.kind ?? 'brand');
  return <form action={action} className="bc-form">
    <fieldset className="bc-kinds">
      <legend>Кто вы</legend>
      {BUSINESS_KINDS.map(item => <label key={item.value} className="bc-kind" data-checked={kind === item.value || undefined}>
        <input type="radio" name="kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} />
        <strong>{item.label}</strong><small>{item.hint}</small>
      </label>)}
    </fieldset>
    <label className="bc-field"><span>Название компании</span><input name="name" required minLength={2} maxLength={80} defaultValue={initial?.name ?? ''} placeholder="Например, Energy Lab" /></label>
    <div className="bc-field-row">
      <label className="bc-field"><span>Сайт</span><input name="website" inputMode="url" maxLength={200} defaultValue={initial?.website ?? ''} placeholder="example.ru" /></label>
      <label className="bc-field"><span>Telegram</span><input name="telegram" maxLength={60} defaultValue={initial?.telegram ? `@${initial.telegram}` : ''} placeholder="@company" /></label>
    </div>
    <label className="bc-field"><span>Почта для связи</span><input name="contactEmail" type="email" maxLength={254} defaultValue={initial?.contactEmail ?? ''} placeholder="brand@example.ru" /></label>
    <label className="bc-field"><span>О компании</span><textarea name="about" rows={4} maxLength={500} defaultValue={initial?.about ?? ''} placeholder="Какие напитки выпускаете или продаёте, в каких городах" /></label>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <button className="bc-button" disabled={pending}>{pending ? 'Сохраняем…' : apply ? 'Отправить на проверку' : 'Сохранить'}</button>
    <ActionToast message={state.done ? (apply ? 'Заявка отправлена' : 'Сохранено') : undefined} trigger={state} />
  </form>;
}

/** «Прикрепить напиток»: a catalog drink goes to the team's queue; a drink not in the catalog is added as a new one. */
export function BusinessDrinkRequest({ options, taken }: { options: StoreDrinkOption[]; taken: string[] }) {
  const [state, action, pending] = useActionState(requestBusinessDrinkAction, {});
  const [picked, setPicked] = useState<StoreDrinkOption | null>(null);
  const [missing, setMissing] = useState('');
  const takenSet = new Set(taken);
  return <form action={action} className="bc-attach" onSubmit={() => setPicked(null)}>
    <div className="bc-attach-row">
      <StoreDrinkPicker id="business-drink" options={options} taken={takenSet} disabled={pending} placeholder="Найдите напиток в каталоге"
        onAdd={drink => {
          const option = drink.brand ? options.find(item => item.brand === drink.brand && item.flavor === drink.flavor) : undefined;
          setPicked(option ?? null); setMissing(option ? '' : drink.name);
        }} />
    </div>
    {picked && <div className="bc-attach-picked">
      <input type="hidden" name="brand" value={picked.brand} /><input type="hidden" name="flavor" value={picked.flavor} />
      <span>{picked.label}</span>
      <button className="bc-button" disabled={pending}>{pending ? 'Отправляем…' : 'Прикрепить'}</button>
      <button type="button" className="bc-button is-ghost" onClick={() => setPicked(null)}>Отмена</button>
    </div>}
    {missing && !picked && <FormAlert tone="warning" title="Такого напитка нет в каталоге" actions={<Link className="bc-button is-ghost" href="/business/cabinet?section=new-drink">Добавить новый напиток</Link>}>
      «{missing}» можно добавить как новый: после модерации он появится в каталоге, и его можно будет прикрепить.
    </FormAlert>}
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <ActionToast message={state.done ? 'Отправили на проверку' : undefined} trigger={state} />
  </form>;
}

export function BusinessDrinkRemove({ brand, flavor }: { brand: string; flavor: string }) {
  const [pending, start] = useTransition();
  return <button type="button" className="bc-icon-button" aria-label="Открепить напиток" title="Открепить" disabled={pending} onClick={() => {
    if (!window.confirm('Открепить напиток от компании? Его аналитика пропадёт из кабинета.')) return;
    start(async () => { const result = await removeBusinessDrinkAction(brand, flavor); if (result.error) window.alert(result.error); });
  }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
  </button>;
}

/** The team: approve a company, or return it with a reason. */
export function BusinessModeration({ id }: { id: string }) {
  const [state, action, pending] = useActionState(moderateBusinessAction.bind(null, id), {});
  if (state.done) return <FormAlert tone="success">Решение сохранено.</FormAlert>;
  return <form action={action} className="bc-moderation">
    <input name="note" maxLength={500} placeholder="Причина отказа (для отказа обязательна)" disabled={pending} />
    <div><button className="bc-button" name="status" value="approved" disabled={pending}>Подтвердить</button>
      <button className="bc-button is-ghost" name="status" value="rejected" disabled={pending}>Отклонить</button></div>
    {state.error && <FormAlert>{state.error}</FormAlert>}
  </form>;
}

export function BusinessDrinkModeration({ businessId, brand, flavor }: { businessId: string; brand: string; flavor: string }) {
  const [state, action, pending] = useActionState(moderateBusinessDrinkAction.bind(null, businessId, brand, flavor), {});
  if (state.done) return <span className="bc-pill" data-status="approved">Готово</span>;
  return <form action={action} className="bc-moderation is-inline">
    <input name="note" maxLength={500} placeholder="Причина отказа" disabled={pending} />
    <div><button className="bc-button" name="status" value="approved" disabled={pending}>Подтвердить</button>
      <button className="bc-button is-ghost" name="status" value="rejected" disabled={pending}>Отклонить</button></div>
    {state.error && <FormAlert>{state.error}</FormAlert>}
  </form>;
}

/** «Прикрепить» next to the company's own published drink: the same request as the picker, in one click. */
export function BusinessDrinkAttach({ brand, flavor }: { brand: string; flavor: string }) {
  const [state, action, pending] = useActionState(requestBusinessDrinkAction, {});
  if (state.done) return <span className="bc-pill" data-tone="mid">На проверке</span>;
  return <form action={action} className="bc-inline-form">
    <input type="hidden" name="brand" value={brand} /><input type="hidden" name="flavor" value={flavor} />
    <button className="bc-button is-outline" disabled={pending}>{pending ? 'Отправляем…' : 'Прикрепить'}</button>
    {state.error && <small className="bc-note">{state.error}</small>}
  </form>;
}

/** The company logo: the current one (or initials), «Загрузить» picks a file and uploads at once, «Убрать» drops it. */
export function BusinessLogoForm({ name, logoId, editable }: { name: string; logoId: string | null; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const run = (task: () => Promise<{ error?: string }>) => start(async () => { setError(''); const result = await task().catch(() => ({ error: 'Нет связи с сервером.' })); if (result.error) setError(result.error); });
  return <div className="bc-logo-form">
    <span className="bc-logo-preview">
      {/* eslint-disable-next-line @next/next/no-img-element -- the logo is served from the database */}
      {logoId ? <img src={`/api/business-logos/${logoId}`} alt="" width={72} height={72} /> : <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>}
    </span>
    <div className="bc-logo-copy">
      <strong>Логотип компании</strong>
      <span className="bc-muted">Квадрат JPG, PNG или WebP до 5 МБ — виден в кабинете и команде.</span>
      {editable && <div className="bc-logo-actions">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (file) { const form = new FormData(); form.set('logo', file); run(() => uploadBusinessLogoAction(form)); }
        }} />
        <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => input.current?.click()}>{pending ? 'Загружаем…' : logoId ? 'Заменить' : 'Загрузить'}</button>
        {logoId && <button type="button" className="bc-button is-ghost" disabled={pending} onClick={() => run(removeBusinessLogoAction)}>Убрать</button>}
      </div>}
      {error && <small className="bc-note" role="alert">{error}</small>}
    </div>
  </div>;
}

/** «Пригласить»: a work email (the main way — a letter goes out) or a CanRush nickname; the answer never says whether the address has an account. */
export function BusinessInviteForm() {
  const [state, action, pending] = useActionState(inviteBusinessMemberAction, {});
  const [mode, setMode] = useState<'email' | 'username'>('email');
  return <form action={action} className="bc-invite-form">
    <div className="bc-invite-mode" role="radiogroup" aria-label="Как пригласить">
      <button type="button" role="radio" aria-checked={mode === 'email'} onClick={() => setMode('email')}>По почте</button>
      <button type="button" role="radio" aria-checked={mode === 'username'} onClick={() => setMode('username')}>По нику</button>
    </div>
    {mode === 'email'
      ? <label className="bc-field"><span>Почта сотрудника</span><input name="target" type="email" required maxLength={254} placeholder="name@company.ru" autoComplete="off" inputMode="email" /></label>
      : <label className="bc-field"><span>Ник на CanRush</span><input name="target" required maxLength={60} placeholder="@energy_fan" autoComplete="off" /></label>}
    <button className="bc-button" disabled={pending}>{pending ? 'Отправляем…' : 'Пригласить'}</button>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <ActionToast message={state.done ? (state.via === 'email' ? 'Приглашение отправлено на почту' : 'Приглашение отправлено') : undefined} trigger={state} />
  </form>;
}

export function BusinessMemberRemove({ memberKey, pending: invited }: { memberKey: string; pending: boolean }) {
  const [busy, start] = useTransition();
  return <button type="button" className="bc-button is-ghost" disabled={busy} onClick={() => {
    if (!window.confirm(invited ? 'Отозвать приглашение?' : 'Убрать участника из команды? Он потеряет доступ к кабинету.')) return;
    start(async () => { const result = await removeBusinessMemberAction(memberKey); if (result.error) window.alert(result.error); });
  }}>{invited ? 'Отозвать' : 'Убрать'}</button>;
}

/** An invitation to someone else's cabinet: accept or decline. */
export function BusinessInviteAnswer({ businessId }: { businessId: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState('');
  const answer = (accept: boolean) => start(async () => { setError(''); const result = await answerBusinessInviteAction(businessId, accept); if (result.error) setError(result.error); });
  return <div className="bc-inline-form">
    <div className="bc-invite-actions"><button type="button" className="bc-button" disabled={busy} onClick={() => answer(true)}>Принять</button>
      <button type="button" className="bc-button is-outline" disabled={busy} onClick={() => answer(false)}>Отклонить</button></div>
    {error && <small className="bc-note" role="alert">{error}</small>}
  </div>;
}

export function BusinessLeave() {
  const [busy, start] = useTransition();
  return <button type="button" className="bc-button is-outline" disabled={busy} onClick={() => {
    if (!window.confirm('Выйти из команды компании? Доступ к кабинету пропадёт.')) return;
    start(async () => { const result = await leaveBusinessAction(); if (result.error) window.alert(result.error); });
  }}>Выйти из команды</button>;
}

/**
 * Notifications of the cabinet: new reviews of the company's drinks (site, Telegram bot and app push alike). The switch
 * saves at once — a form action would reset the checkbox to its first state after saving.
 */
export function BusinessNotificationsForm({ reviews }: { reviews: boolean }) {
  const [on, setOn] = useState(reviews);
  const [state, setState] = useState<{ done?: boolean; error?: string }>({});
  const [pending, start] = useTransition();
  return <div className="bc-form">
    <label className="bc-switch-row">
      <span><strong>Новые отзывы на напитки компании</strong><small className="bc-muted">Уведомление на сайте, в Telegram-боте и в приложении, когда участник оценил ваш подтверждённый напиток.</small></span>
      <input type="checkbox" className="bc-switch" checked={on} disabled={pending} onChange={event => {
        const next = event.target.checked; setOn(next);
        start(async () => {
          const form = new FormData(); if (next) form.set('reviews', 'on');
          const result = await saveBusinessNotificationsAction({}, form).catch(() => ({ error: 'Нет связи с сервером.' }) as { error?: string; done?: boolean });
          if (result.error) setOn(!next);
          setState(result);
        });
      }} />
    </label>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <ActionToast message={state.done ? (on ? 'Уведомления включены' : 'Уведомления выключены') : undefined} trigger={state} />
  </div>;
}

const THEMES = [{ key: 'light', label: 'Светлая' }, { key: 'graphite', label: 'Тёмная' }, { key: 'system', label: 'Системная' }] as const;

/** Light, dark or system theme — the site's own setting (a cookie in this browser), so the cabinet and the site match. */
export function BusinessThemeForm({ theme }: { theme: SiteTheme }) {
  const [state, action, pending] = useActionState(saveThemeSettings, {});
  return <form action={action} className="bc-form">
    <div className="bc-theme-options">{THEMES.map(item => <button key={item.key} type="submit" name="theme" value={item.key} disabled={pending} aria-pressed={theme === item.key} className="bc-theme-choice">
      <span className="site-theme-sample" data-sample-theme={item.key} aria-hidden="true"><i /><span><b /><b /><b /></span></span>
      <span className="bc-theme-label">{item.label}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span>
    </button>)}</div>
    <p role={state.error ? 'alert' : 'status'} className={state.error ? 'bc-note' : 'bc-muted'}>{pending ? 'Применяем тему…' : state.error ?? (state.success ? 'Тема сохранена в этом браузере.' : 'Системная следует настройкам устройства. Выбор сохраняется в этом браузере и действует на всём сайте.')}</p>
  </form>;
}

/**
 * «Ответить» / «Изменить ответ» on a review in the cabinet: a dialog with the reply text, saved as the company's public
 * reply under the review on the drink page; «Удалить ответ» takes it down.
 */
export function BusinessReplyButton({ reviewId, author, reply }: { reviewId: string; author: string; reply: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(reply ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (task: () => Promise<{ error?: string }>) => start(async () => {
    setError('');
    const result = await task().catch(() => ({ error: 'Нет связи с сервером.' }));
    if (result.error) setError(result.error); else dialog.current?.close();
  });
  return <>
    <button type="button" className={`bc-button ${reply ? 'is-outline' : ''} bc-reply-button`} onClick={() => { setText(reply ?? ''); setError(''); dialog.current?.showModal(); }}>
      {reply ? 'Изменить ответ' : 'Ответить'}
    </button>
    <dialog ref={dialog} className="bc-reply-dialog" aria-labelledby={`reply-${reviewId}`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <form method="dialog" onSubmit={event => { event.preventDefault(); run(() => replyReviewAction(reviewId, text)); }}>
        <h2 id={`reply-${reviewId}`}>Ответ компании</h2>
        <p className="bc-muted">Его увидят все под отзывом {author} с отметкой «Компания». Автор получит уведомление.</p>
        <textarea value={text} onChange={event => setText(event.target.value)} maxLength={MAX_BUSINESS_REPLY} rows={6} placeholder="Спасибо за отзыв! …" autoFocus aria-label="Текст ответа" />
        <small className="bc-muted bc-reply-count">{text.length} / {MAX_BUSINESS_REPLY}</small>
        {error && <FormAlert>{error}</FormAlert>}
        <div className="bc-reply-actions">
          <button type="submit" className="bc-button" disabled={pending || !text.trim()}>{pending ? 'Сохраняем…' : reply ? 'Сохранить' : 'Опубликовать ответ'}</button>
          <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => dialog.current?.close()}>Отмена</button>
          {reply && <button type="button" className="bc-button is-danger" disabled={pending} onClick={() => { if (window.confirm('Удалить ответ компании?')) run(() => deleteReviewReplyAction(reviewId)); }}>Удалить ответ</button>}
        </div>
      </form>
    </dialog>
  </>;
}

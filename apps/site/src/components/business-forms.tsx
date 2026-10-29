'use client';
import { startTransition, useActionState, useEffect, useEffectEvent, useRef, useState, useTransition, type ReactNode } from 'react';
import { answerBusinessInviteAction, deleteReviewReplyAction, inviteBusinessMemberAction, replyReviewAction, leaveBusinessAction, removeBusinessLogoAction, removeBusinessMemberAction, saveBusinessNotificationsAction, uploadBusinessLogoAction, moderateBusinessAction, moderateBusinessDrinkAction, removeBusinessDrinkAction, requestBusinessDrinkAction, saveBusinessAction, addCompetitorAction, removeCompetitorAction, saveWeeklyReportAction, saveReplyTemplateAction, deleteReplyTemplateAction, setMemberRoleAction, requestDrinkEditAction, moderateDrinkEditAction, requestPromoAction, setPromoStatusAction, addDrinkStoreAction, removeDrinkStoreAction, setDrinkPriceAction, removeDrinkPriceAction } from '@/app/business/cabinet/actions';
import { saveThemeSettings } from '@/app/profile/settings/theme-actions';
import { ActionToast } from '@/components/action-toast';
import { FormAlert } from '@/components/form-alert';
import Link from '@/components/navigation-progress';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { PriceFilterInput } from '@/components/price-filter-input';
import { BUSINESS_KINDS, BUSINESS_ROLES, type BusinessMemberRole, MAX_BUSINESS_REPLY, MAX_REPLY_TEMPLATES, MAX_REPLY_TEMPLATE_TITLE, REPLY_TEMPLATE_FIELDS, fillReplyTemplate, replyTemplateTitle, type BusinessKind } from '@/lib/business-fields';
import type { ReplyTemplate } from '@/lib/business';
import { DRINK_EDIT_LIMITS } from '@/lib/brand-drink-edit-fields';
import { DRINK_STORE_LIMITS, type DrinkStoreKind } from '@/lib/brand-drink-store-fields';
import type { StoreOption } from '@/lib/brand-drink-stores';
import { PROMO_PLACEMENTS, type PromoPlacement } from '@/lib/business-plans';
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
    {apply && <label className="bc-terms-consent"><input type="checkbox" name="terms" required />
      <span>Я представляю эту компанию и принимаю <a className="bc-link" href="/business/terms" target="_blank" rel="noopener">Условия для бизнеса</a> и <a className="bc-link" href="/privacy#business" target="_blank" rel="noopener">Политику обработки данных</a></span></label>}
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

/** The team's decision on a card edit (approve, or reject with a reason the company sees). */
export function DrinkEditModeration({ id }: { id: string }) {
  const [state, action, pending] = useActionState(moderateDrinkEditAction.bind(null, id), {});
  if (state.done) return <span className="bc-pill" data-tone="good">Готово</span>;
  return <form action={action} className="bc-moderation is-inline">
    <input name="note" maxLength={500} placeholder="Причина отказа" disabled={pending} />
    <div><button className="bc-button" name="status" value="approved" disabled={pending}>Опубликовать</button>
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
/** The logo's line in «Внешний вид» of the profile settings: no preview of its own — the profile head preview shows it. */
export function BusinessLogoForm({ logoId, editable }: { logoId: string | null; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const run = (task: () => Promise<{ error?: string }>) => start(async () => { setError(''); const result = await task().catch(() => ({ error: 'Нет связи с сервером.' })); if (result.error) setError(result.error); });
  const actions = editable && <div className="bc-logo-actions">
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) { const form = new FormData(); form.set('logo', file); run(() => uploadBusinessLogoAction(form)); }
    }} />
    <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => input.current?.click()}>{pending ? 'Загружаем…' : logoId ? 'Заменить' : 'Загрузить'}</button>
    {logoId && <button type="button" className="bc-button is-ghost" disabled={pending} onClick={() => run(removeBusinessLogoAction)}>Убрать</button>}
  </div>;
  return <div className="bc-look-row"><span><strong>Логотип</strong><small className="bc-muted">Квадрат · JPG, PNG или WebP до 5 МБ — аватар профиля, ответов и объявлений</small>{error && <small className="bc-note" role="alert">{error}</small>}</span>{actions}</div>;
}

/** «Пригласить»: a work email (the main way — a letter goes out) or a CanRush nickname; the answer never says whether the address has an account. */
export function BusinessInviteForm() {
  const [state, action, pending] = useActionState(inviteBusinessMemberAction, {});
  const [mode, setMode] = useState<'email' | 'username'>('email');
  const [role, setRole] = useState<BusinessMemberRole>('manager');
  return <form action={action} className="bc-invite-form" onSubmit={event => {
    // React resets the form after the action; the role goes from state, like the review form's scores.
    const data = new FormData(event.currentTarget); data.set('role', role); event.preventDefault(); startTransition(() => action(data));
  }}>
    <div className="bc-invite-mode" role="radiogroup" aria-label="Как пригласить">
      <button type="button" role="radio" aria-checked={mode === 'email'} onClick={() => setMode('email')}>По почте</button>
      <button type="button" role="radio" aria-checked={mode === 'username'} onClick={() => setMode('username')}>По нику</button>
    </div>
    {mode === 'email'
      ? <label className="bc-field"><span>Почта сотрудника</span><input name="target" type="email" required maxLength={254} placeholder="name@company.ru" autoComplete="off" inputMode="email" /></label>
      : <label className="bc-field"><span>Ник на CanRush</span><input name="target" required maxLength={60} placeholder="@energy_fan" autoComplete="off" /></label>}
    <fieldset className="bc-role-pick"><legend>Роль</legend>
      {BUSINESS_ROLES.map(item => <label key={item.value} className="bc-kind" data-checked={role === item.value || undefined}>
        <input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} />
        <strong>{item.label}</strong><small>{item.hint}</small>
      </label>)}
    </fieldset>
    <button className="bc-button" disabled={pending}>{pending ? 'Отправляем…' : 'Пригласить'}</button>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <ActionToast message={state.done ? (state.via === 'email' ? 'Приглашение отправлено на почту' : 'Приглашение отправлено') : undefined} trigger={state} />
  </form>;
}

/** The owner's role switch on a team row: saved at once. */
export function BusinessMemberRole({ memberKey, role }: { memberKey: string; role: BusinessMemberRole }) {
  const [value, setValue] = useState(role);
  const [busy, start] = useTransition();
  return <select className="bc-role-select" aria-label="Роль в команде" value={value} disabled={busy} onChange={event => {
    const next = event.target.value as BusinessMemberRole; const previous = value; setValue(next);
    start(async () => { const result = await setMemberRoleAction(memberKey, next).catch(() => ({ error: 'Нет связи с сервером.' })); if (result.error) { setValue(previous); window.alert(result.error); } });
  }}>{BUSINESS_ROLES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
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
/**
 * Answer a review as the company. Saved templates sit above the field: a tap puts one in with `{автор}` and
 * `{напиток}` filled for this review (asking first when it would replace typed text), × deletes it. «Сохранить как
 * шаблон» under the field keeps the current text for the whole team — this review's author name and drink become the
 * placeholders again, so the template fits the next one.
 */
/** Opens the reply dialog of another row: «Опубликовать и к следующему» names the next review without an answer. */
const OPEN_REPLY = 'bc-open-reply';

export function BusinessReplyButton({ reviewId, author, drink, reply, templates: initialTemplates, next = null }: { reviewId: string; author: string; drink: string; reply: string | null; templates: ReplyTemplate[]; next?: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(reply ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  // Templates saved or deleted here show at once; a fresh list from the server (after the refresh) replaces them.
  const [templates, setTemplates] = useState(initialTemplates);
  const [seen, setSeen] = useState(initialTemplates);
  if (seen !== initialTemplates) { setSeen(initialTemplates); setTemplates(initialTemplates); }
  const [naming, setNaming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message?: string }>({});
  const run = (task: () => Promise<{ error?: string }>, then?: string | null) => start(async () => {
    setError('');
    const result = await task().catch(() => ({ error: 'Нет связи с сервером.' }));
    if (result.error) { setError(result.error); return; }
    dialog.current?.close();
    if (then) window.dispatchEvent(new CustomEvent(OPEN_REPLY, { detail: then }));
  });
  function open() { setText(reply ?? ''); setError(''); setNaming(null); dialog.current?.showModal(); }
  // The previous row asks for this one after its reply («Опубликовать и к следующему»).
  const openFromEvent = useEffectEvent(() => { dialog.current?.closest('tr')?.scrollIntoView({ block: 'center' }); open(); });
  useEffect(() => {
    const listen = (event: Event) => { if ((event as CustomEvent<string>).detail === reviewId) openFromEvent(); };
    window.addEventListener(OPEN_REPLY, listen);
    return () => window.removeEventListener(OPEN_REPLY, listen);
  }, [reviewId]);
  function pick(template: ReplyTemplate) {
    const next = fillReplyTemplate(template.text, { author, drink });
    if (text.trim() && text.trim() !== (reply ?? '').trim() && text !== next && !window.confirm('Заменить написанный текст шаблоном?')) return;
    setText(next.slice(0, MAX_BUSINESS_REPLY)); setError('');
    requestAnimationFrame(() => field.current?.focus());
  }
  function save(title: string) {
    // The names of this review go back to placeholders, so the template fits the next review too.
    const general = text.split(author).join('{автор}').split(drink).join('{напиток}');
    start(async () => {
      const result = await saveReplyTemplateAction(title, general).catch(() => ({ error: 'Нет связи с сервером.' }) as { error?: string; template?: ReplyTemplate });
      if (result.error) { setError(result.error); return; }
      if (result.template) setTemplates(current => [...current, result.template!]);
      setNaming(null); setError(''); setToast({ message: 'Шаблон сохранён' });
    });
  }
  function remove(template: ReplyTemplate) {
    if (!window.confirm(`Удалить шаблон «${template.title}» для всей команды?`)) return;
    start(async () => {
      const result = await deleteReplyTemplateAction(template.id).catch(() => ({ error: 'Нет связи с сервером.' }) as { error?: string });
      if (result.error) { setError(result.error); return; }
      setTemplates(current => current.filter(item => item.id !== template.id));
    });
  }
  return <>
    <button type="button" className={`bc-button ${reply ? 'is-outline' : ''} bc-reply-button`} onClick={open}>
      {reply ? 'Изменить ответ' : 'Ответить'}
    </button>
    <dialog ref={dialog} className="bc-reply-dialog" aria-labelledby={`reply-${reviewId}`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <form method="dialog" onSubmit={event => { event.preventDefault(); if (naming === null) run(() => replyReviewAction(reviewId, text)); }}>
        <h2 id={`reply-${reviewId}`}>Ответ компании</h2>
        <p className="bc-muted">Его увидят все под отзывом {author} с отметкой «Компания». Автор получит уведомление.</p>
        <div className="bc-templates" role="group" aria-label="Шаблоны ответов">
          <span className="bc-templates-label">Шаблоны</span>
          {templates.length ? templates.map(template => <span key={template.id} className="bc-template-chip">
            <button type="button" disabled={pending} title={fillReplyTemplate(template.text, { author, drink })} onClick={() => pick(template)}>{template.title}</button>
            <button type="button" className="bc-template-remove" disabled={pending} aria-label={`Удалить шаблон «${template.title}»`} onClick={() => remove(template)}>×</button>
          </span>) : <span className="bc-muted bc-templates-empty">Пока нет — напишите ответ и сохраните его шаблоном.</span>}
        </div>
        <textarea ref={field} value={text} onChange={event => setText(event.target.value)} maxLength={MAX_BUSINESS_REPLY} rows={6} placeholder="Спасибо за отзыв! …" autoFocus aria-label="Текст ответа" />
        <div className="bc-reply-meta">
          {naming === null
            ? <button type="button" className="bc-link-button" disabled={pending || !text.trim() || templates.length >= MAX_REPLY_TEMPLATES} onClick={() => setNaming(replyTemplateTitle(text))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></svg>
              {templates.length >= MAX_REPLY_TEMPLATES ? `Шаблонов уже ${MAX_REPLY_TEMPLATES}` : 'Сохранить как шаблон'}</button>
            : <span />}
          <small className="bc-muted bc-reply-count">{text.length} / {MAX_BUSINESS_REPLY}</small>
        </div>
        {naming !== null && <div className="bc-template-save">
          <label className="bc-field"><span>Название шаблона</span>
            <input value={naming} maxLength={MAX_REPLY_TEMPLATE_TITLE} autoFocus onChange={event => setNaming(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(naming); } if (event.key === 'Escape') { event.preventDefault(); setNaming(null); } }} /></label>
          <small className="bc-muted">Шаблон увидит вся команда. Имя автора и напиток этого отзыва станут {REPLY_TEMPLATE_FIELDS.map(item => item.key).join(' и ')} — их подставим в следующий ответ.</small>
          <div className="bc-template-save-actions">
            <button type="button" className="bc-button" disabled={pending || !naming.trim()} onClick={() => save(naming)}>{pending ? 'Сохраняем…' : 'Сохранить шаблон'}</button>
            <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => setNaming(null)}>Отмена</button>
          </div>
        </div>}
        {error && <FormAlert>{error}</FormAlert>}
        <div className="bc-reply-actions">
          <button type="submit" className="bc-button" disabled={pending || !text.trim() || naming !== null}>{pending ? 'Сохраняем…' : reply ? 'Сохранить' : 'Опубликовать ответ'}</button>
          {next && !reply && <button type="button" className="bc-button is-outline" disabled={pending || !text.trim() || naming !== null} onClick={() => run(() => replyReviewAction(reviewId, text), next)}>Опубликовать и к следующему</button>}
          <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => dialog.current?.close()}>Отмена</button>
          {reply && <button type="button" className="bc-button is-danger" disabled={pending} onClick={() => { if (window.confirm('Удалить ответ компании?')) run(() => deleteReviewReplyAction(reviewId)); }}>Удалить ответ</button>}
        </div>
        <ActionToast message={toast.message} trigger={toast} />
      </form>
    </dialog>
  </>;
}

/**
 * «Конкуренты»: the picked brands as chips with ×, a brand field over the catalog's brands and quick chips for the most
 * reviewed ones; up to `max`. Any teammate edits the list.
 */
export function CompetitorPicker({ picked, options, suggested, max }: { picked: string[]; options: string[]; suggested: string[]; max: number }) {
  const [state, action, pending] = useActionState(addCompetitorAction, {});
  const [brand, setBrand] = useState('');
  const [removing, start] = useTransition();
  const [removeError, setRemoveError] = useState('');
  const full = picked.length >= max;
  const add = (value: string) => { const form = new FormData(); form.set('brand', value); start(() => action(form)); setBrand(''); };
  return <div className="bc-competitor-picker">
    <div className="bc-competitor-chips" aria-label="Бренды в сравнении">
      {picked.map(item => <span key={item} className="bc-competitor-chip">{item}
        <button type="button" aria-label={`Убрать ${item} из сравнения`} disabled={removing} onClick={() => start(async () => {
          const result = await removeCompetitorAction(item).catch(() => ({ error: 'Нет связи с сервером.' }) as { error?: string });
          setRemoveError(result.error ?? '');
        })}>×</button>
      </span>)}
      {!picked.length && <span className="bc-muted">Пока никого — добавьте до {max} брендов.</span>}
    </div>
    {!full && <form className="bc-competitor-add" onSubmit={event => { event.preventDefault(); if (brand) add(brand); }}>
      <div className="bc-competitor-field"><label className="sr-only" htmlFor="competitor-brand">Бренд конкурента</label>
        <PriceFilterInput id="competitor-brand" value={brand} options={options.filter(item => !picked.includes(item)).map(value => ({ value, label: value }))} allLabel="Найдите бренд" onChange={setBrand} /></div>
      <button className="bc-button" disabled={!brand || pending || removing}>{pending ? 'Добавляем…' : 'Сравнить'}</button>
    </form>}
    {!full && suggested.length > 0 && <div className="bc-competitor-suggest"><span className="bc-muted">Часто сравнивают:</span>
      {suggested.map(item => <button key={item} type="button" className="bc-competitor-suggest-chip" disabled={pending || removing} onClick={() => add(item)}>+ {item}</button>)}
    </div>}
    {(state.error || removeError) && <FormAlert>{state.error || removeError}</FormAlert>}
  </div>;
}

/** The weekly email report switch: saved at once, like the review notifications. */
export function WeeklyReportSwitch({ enabled, email }: { enabled: boolean; email: string | null }) {
  const [on, setOn] = useState(enabled);
  const [state, setState] = useState<{ done?: boolean; error?: string }>({});
  const [pending, start] = useTransition();
  return <div className="bc-form">
    <label className="bc-switch-row">
      <span><strong>Еженедельный отчёт на почту</strong><small className="bc-muted">По понедельникам утром: отзывы и оценки за неделю, поиски, просмотры карточек и переходы в магазины, сравнение с конкурентами.{email ? ` Придёт на ${email}.` : ' У аккаунта нет почты — отчёт не придёт.'}</small></span>
      <input type="checkbox" className="bc-switch" checked={on} disabled={pending} onChange={event => {
        const next = event.target.checked; setOn(next);
        start(async () => {
          const result = await saveWeeklyReportAction(next).catch(() => ({ error: 'Нет связи с сервером.' }) as { error?: string; done?: boolean });
          if (result.error) setOn(!next);
          setState(result);
        });
      }} />
    </label>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <ActionToast message={state.done ? (on ? 'Отчёт включён' : 'Отчёт выключен') : undefined} trigger={state} />
  </div>;
}

/**
 * A proposed correction of a drink card. The fields start with what the card shows now; only changed ones are sent,
 * plus an optional new photo of the can. The team checks it, and once approved the card shows the brand's data with
 * «Данные подтверждены брендом».
 */
export function DrinkEditForm({ brand, flavor, current }: { brand: string; flavor: string; current: { fullName: string; ingredients: string; description: string; cover: string | null } }) {
  const [fields, setFields] = useState({ fullName: current.fullName, ingredients: current.ingredients, description: current.description, note: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<{ error?: string; done?: boolean }>({});
  const [pending, start] = useTransition();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) => setFields(value => ({ ...value, [key]: event.target.value }));
  const changed = (key: 'fullName' | 'ingredients' | 'description') => fields[key].trim() !== current[key].trim() && fields[key].trim() !== '';
  const anything = photo || changed('fullName') || changed('ingredients') || changed('description');
  if (state.done) return <div className="bc-empty"><strong>Правка отправлена</strong><span>Команда CanRush сверит её с банкой и опубликует. Статус — в разделе «Напитки».</span>
    <Link className="bc-button" href="/business/cabinet?section=drinks">К напиткам</Link></div>;
  return <form className="bc-form bc-drink-edit" onSubmit={event => {
    event.preventDefault();
    const data = new FormData();
    data.set('brand', brand); data.set('flavor', flavor);
    for (const key of ['fullName', 'ingredients', 'description'] as const) if (changed(key)) data.set(key, fields[key]);
    if (fields.note.trim()) data.set('note', fields.note);
    if (photo) data.append('photos', photo);
    start(async () => setState(await requestDrinkEditAction(data).catch(() => ({ error: 'Нет связи с сервером.' }))));
  }}>
    <div className="bc-drink-edit-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or the current cover */}
      <span className="bc-drink-edit-cover">{preview || current.cover ? <img src={preview ?? current.cover!} alt="" /> : '⚡'}</span>
      <div>
        <strong>Фото банки</strong>
        <small className="bc-muted">Чёткое фото на светлом фоне, JPG, PNG или WebP до 5 МБ. Станет обложкой в каталоге.</small>
        <label className="bc-button is-outline bc-file-button">{photo ? 'Заменить фото' : 'Загрузить фото'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
            const file = event.target.files?.[0] ?? null; setPhoto(file); setPreview(file ? URL.createObjectURL(file) : null);
          }} /></label>
      </div>
    </div>
    <label className="bc-field"><span>Полное название с банки</span><input value={fields.fullName} onChange={set('fullName')} maxLength={DRINK_EDIT_LIMITS.fullName} placeholder="Например, Burn Mango Energy Zero" /></label>
    <label className="bc-field"><span>Состав с этикетки</span><textarea value={fields.ingredients} onChange={set('ingredients')} rows={5} maxLength={DRINK_EDIT_LIMITS.ingredients} placeholder="Вода, сахар, регулятор кислотности…" /></label>
    <label className="bc-field"><span>Описание от бренда</span><textarea value={fields.description} onChange={set('description')} rows={4} maxLength={DRINK_EDIT_LIMITS.description} placeholder="Пара фраз о вкусе и истории напитка — без рекламных обещаний" /></label>
    <label className="bc-field"><span>Комментарий для проверки (необязательно)</span><input value={fields.note} onChange={set('note')} maxLength={DRINK_EDIT_LIMITS.note} placeholder="Например, новый дизайн банки с марта" /></label>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <button className="bc-button" disabled={pending || !anything}>{pending ? 'Отправляем…' : 'Отправить на проверку'}</button>
  </form>;
}

const ADDON_ICONS: Record<PromoPlacement, ReactNode> = {
  picks: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />,
  dating: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  catalog: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  stories: <><circle cx="12" cy="12" r="8" strokeDasharray="4 2.2" /><circle cx="12" cy="12" r="4.5" /></>,
};

/**
 * «Дополнительные услуги» in the manner of linear.app: the placements as columns split by hairlines — a line icon, the
 * name, what it does and «Заказать». Picking one opens the request under the columns (budget and a note); it goes to
 * the team, which agrees the placement and registers it in ОРД. Without `canOrder` the columns only describe.
 */
export function PromoAddons({ canOrder }: { canOrder: boolean }) {
  const [state, action, pending] = useActionState(requestPromoAction, {});
  const [placement, setPlacement] = useState<PromoPlacement | null>(null);
  const [sent, setSent] = useState<object | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const picked = PROMO_PLACEMENTS.find(item => item.value === placement);
  // A new request after one went through: the alert stays until another placement is picked.
  if (state.done && sent !== state) { setSent(state); setPlacement(null); }
  const pick = (value: PromoPlacement) => {
    setPlacement(value);
    requestAnimationFrame(() => form.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  return <>
    <ul className="bc-addons">{PROMO_PLACEMENTS.map(item => <li key={item.value} className="bc-addon" data-picked={placement === item.value || undefined}>
      <span className="bc-addon-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ADDON_ICONS[item.value]}</svg></span>
      <h3>{item.label}</h3>
      <p>{item.hint}</p>
      <p className="bc-addon-price"><b>от 1 000 ₽</b><small>бюджет · по заявке</small></p>
      {canOrder && <button type="button" className="biz-plan-cta" aria-pressed={placement === item.value} onClick={() => pick(item.value)}>{placement === item.value ? 'Выбрано' : 'Заказать'}</button>}
    </li>)}</ul>
    {state.done && !placement && <FormAlert tone="success" title="Заявка отправлена">Свяжемся с вами, согласуем размещение и зарегистрируем его в ОРД — реклама выйдет с пометкой «Реклама».</FormAlert>}
    {picked && <form ref={form} className="bc-form bc-addon-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget); data.set('placement', picked.value);
      startTransition(() => action(data));
    }}>
      <div className="bc-addon-form-head"><span className="bc-addon-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ADDON_ICONS[picked.value]}</svg></span>
        <div><h3>Заявка: {picked.label}</h3><p className="bc-muted">{picked.hint}</p></div></div>
      <label className="bc-field"><span>Бюджет, ₽</span><input name="budget" required inputMode="numeric" maxLength={11} placeholder="30 000" /></label>
      <label className="bc-field"><span>Что продвигаем (необязательно)</span><textarea name="comment" rows={3} maxLength={1000} placeholder="Новинка, сроки, города" /></label>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="bc-addon-form-actions">
        <button className="bc-button" disabled={pending}>{pending ? 'Отправляем…' : 'Отправить заявку'}</button>
        <button type="button" className="bc-button is-ghost" onClick={() => setPlacement(null)} disabled={pending}>Отмена</button>
      </div>
    </form>}
  </>;
}

const STORE_KINDS: { value: DrinkStoreKind; label: string }[] = [{ value: 'retailer', label: 'Сеть' }, { value: 'store', label: 'Магазин на карте' }, { value: 'custom', label: 'Свой магазин' }];
const matches = (value: string, query: string) => value.toLowerCase().replaceAll('ё', 'е').includes(query.toLowerCase().replaceAll('ё', 'е').trim());

/**
 * «Где купить» for one drink: a chain from the catalog, a store from the CanRush map (filter, then pick — each match is a
 * submit button carrying its id), or the company's own store with a link and/or an address. The list under it is the
 * server's, so it refreshes after each change.
 */
export function DrinkStoreForm({ brand, flavor, stores, retailers, taken }: { brand: string; flavor: string; stores: StoreOption[]; retailers: string[]; taken: string[] }) {
  const [state, action, pending] = useActionState(addDrinkStoreAction.bind(null, brand, flavor), {});
  const [kind, setKind] = useState<DrinkStoreKind>('retailer');
  const [query, setQuery] = useState('');
  const [sent, setSent] = useState<object | null>(null);
  const [round, setRound] = useState(0);
  // A place went in: clear the filter, and remount the own-store form so its fields are empty for the next one.
  if (state.done && sent !== state) { setSent(state); setQuery(''); setRound(value => value + 1); }
  const used = new Set(taken.map(item => item.toLowerCase()));
  const found = kind === 'store'
    ? stores.filter(item => !used.has(item.id) && (!query.trim() || matches(`${item.name} ${item.address} ${item.city}`, query))).slice(0, 8)
    : retailers.filter(item => !used.has(item.toLowerCase()) && (!query.trim() || matches(item, query))).slice(0, 12);
  return <div className="bc-store-form">
    <div className="bc-segments" role="tablist" aria-label="Что добавить">{STORE_KINDS.map(item => <button key={item.value} type="button" role="tab" aria-selected={kind === item.value} onClick={() => { setKind(item.value); setQuery(''); }}>{item.label}</button>)}</div>
    {kind === 'custom'
      ? <form key={round} action={action} className="bc-form">
        <input type="hidden" name="kind" value="custom" />
        <label className="bc-field"><span>Название</span><input name="name" required maxLength={DRINK_STORE_LIMITS.name} placeholder="Фирменный магазин" /></label>
        <label className="bc-field"><span>Ссылка на магазин или товар</span><input name="url" inputMode="url" maxLength={DRINK_STORE_LIMITS.url} placeholder="shop.example.ru/energy" /></label>
        <div className="bc-store-form-row">
          <label className="bc-field"><span>Адрес</span><input name="address" maxLength={DRINK_STORE_LIMITS.address} placeholder="ул. Тверская, 1" /></label>
          <label className="bc-field"><span>Город</span><input name="city" maxLength={DRINK_STORE_LIMITS.city} placeholder="Москва" /></label>
        </div>
        <p className="bc-muted">Нужна ссылка или адрес — можно и то и другое. Адрес откроется на карте.</p>
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <button className="bc-button" disabled={pending}>{pending ? 'Добавляем…' : 'Добавить магазин'}</button>
      </form>
      : <form action={action} className="bc-form">
        <input type="hidden" name="kind" value={kind} />
        <label className="bc-field"><span>{kind === 'store' ? 'Найти магазин на карте CanRush' : 'Найти сеть'}</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={kind === 'store' ? 'Название, адрес или город' : 'Пятёрочка, Магнит…'} /></label>
        {found.length ? <ul className="bc-store-options">{found.map(item => typeof item === 'string'
          ? <li key={item}><button name="retailer" value={item} disabled={pending}><b>{item}</b><span>Добавить</span></button></li>
          : <li key={item.id}><button name="storeId" value={item.id} disabled={pending}><b>{item.name}</b><small>{[item.city, item.address].filter(Boolean).join(', ')}</small><span>Добавить</span></button></li>)}</ul>
          : <p className="bc-muted">{kind === 'store' ? 'Такого магазина на карте нет — добавьте его как свой магазин.' : 'Такой сети нет в каталоге — добавьте её как свой магазин.'}</p>}
        {state.error && <FormAlert>{state.error}</FormAlert>}
      </form>}
  </div>;
}

export function DrinkStoreRemove({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return <button type="button" className="bc-icon-button" aria-label={`Убрать «${name}»`} title="Убрать" disabled={pending} onClick={() => start(async () => {
    const result = await removeDrinkStoreAction(id); if (result.error) window.alert(result.error);
  })}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
  </button>;
}

/**
 * The brand's price ceiling: a volume (the drink's own cans as chips, or any 100–2000 ml) and «до N ₽». Saving the
 * same volume again replaces its ceiling.
 */
export function DrinkPriceForm({ brand, flavor, volumes }: { brand: string; flavor: string; volumes: number[] }) {
  const [state, action, pending] = useActionState(setDrinkPriceAction.bind(null, brand, flavor), {});
  const [volume, setVolume] = useState(volumes[0] ? String(volumes[0]) : '');
  const [sent, setSent] = useState<object | null>(null);
  const [round, setRound] = useState(0);
  if (state.done && sent !== state) { setSent(state); setRound(value => value + 1); }
  return <form key={round} action={action} className="bc-form">
    {volumes.length > 0 && <div className="bc-chips" role="group" aria-label="Объём банки">{volumes.map(item => <button key={item} type="button" className="bc-chip" aria-pressed={volume === String(item)} onClick={() => setVolume(String(item))}>{item} мл</button>)}</div>}
    <div className="bc-store-form-row">
      <label className="bc-field"><span>Объём, мл</span><input name="volume" inputMode="numeric" required value={volume} onChange={event => setVolume(event.target.value.replace(/\D/g, ''))} maxLength={4} placeholder="450" /></label>
      <label className="bc-field"><span>Цена в магазине до, ₽</span><input name="price" inputMode="decimal" required maxLength={9} placeholder="119,90" /></label>
    </div>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    {state.done && <FormAlert tone="success" title="Цена сохранена">Покажем её на странице напитка рядом с ценами магазинов.</FormAlert>}
    <button className="bc-button" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить цену'}</button>
  </form>;
}

export function DrinkPriceRemove({ id, volume }: { id: string; volume: number }) {
  const [pending, start] = useTransition();
  return <button type="button" className="bc-icon-button" aria-label={`Убрать цену для ${volume} мл`} title="Убрать" disabled={pending} onClick={() => start(async () => {
    const result = await removeDrinkPriceAction(id); if (result.error) window.alert(result.error);
  })}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
  </button>;
}

/** Admin: a promotion request's progress and its ОРД token. */
export function PromoModeration({ id, erid }: { id: string; erid: string | null }) {
  const [state, action, pending] = useActionState(setPromoStatusAction.bind(null, id), {});
  if (state.done) return <span className="bc-pill" data-tone="good">Сохранено</span>;
  return <form action={action} className="bc-moderation is-inline">
    <input name="erid" maxLength={100} defaultValue={erid ?? ''} placeholder="erid из ОРД" disabled={pending} />
    <div>
      <button className="bc-button is-outline" name="status" value="contacted" disabled={pending}>Связались</button>
      <button className="bc-button" name="status" value="running" disabled={pending}>Запущено</button>
      <button className="bc-button is-ghost" name="status" value="done" disabled={pending}>Завершено</button>
      <button className="bc-button is-ghost" name="status" value="declined" disabled={pending}>Отказ</button>
    </div>
    {state.error && <FormAlert>{state.error}</FormAlert>}
  </form>;
}

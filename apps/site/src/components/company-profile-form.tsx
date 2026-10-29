'use client';
import { startTransition, useActionState, useRef, useState, type ReactNode } from 'react';
import { companyBannerAction, saveCompanyProfileAllAction, type CompanyActionState } from '@/app/company/actions';
import { FormAlert } from '@/components/form-alert';
import { MAX_BIO, MAX_STORY, PROFILE_SECTIONS, type CompanyInfo, type ProfileSection } from '@/lib/business-profile-fields';
import type { CompanyStore } from '@/lib/business-profile';

/**
 * The profile banner (owner only): a wide picture over the logo, cropped to 3:1 on the server. Sent by hand like the
 * profile form; the preview shows the saved banner, or the picked file before it is saved.
 */
export function CompanyBannerForm({ bannerId, editable, logo, logoActions }: { bannerId: string | null; editable: boolean; logo?: ReactNode; logoActions?: ReactNode }) {
  const [state, action, pending] = useActionState<CompanyActionState, FormData>(companyBannerAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = preview ?? (bannerId ? `/api/business-banners/${bannerId}` : null);
  function send(remove: boolean) {
    const form = new FormData();
    if (remove) form.set('remove', '1');
    else if (input.current?.files?.[0]) form.set('banner', input.current.files[0]);
    else return;
    startTransition(() => action(form));
  }
  return <div className="bc-form">
    {/* The profile's head as visitors see it: the banner, the round logo over its edge. */}
    <div className="bc-head-preview">
      <div className="bc-banner-preview" data-empty={shown ? undefined : ''}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the saved banner or a local preview */}
        {shown && <img src={shown} alt="Баннер профиля" />}
      </div>
      {logo && <span className="bc-head-preview-logo">{logo}</span>}
    </div>
    <div className="bc-look-rows">
    <div className="bc-look-row"><span><strong>Баннер</strong><small className="bc-muted">Широкая картинка 3:1, например 1500×500 · JPG, PNG или WebP до 5 МБ</small></span>
    {editable ? <div className="bc-logo-actions">
      <label className="bc-button is-outline">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending} onChange={event => {
          const file = event.target.files?.[0];
          if (preview) URL.revokeObjectURL(preview);
          setPreview(file ? URL.createObjectURL(file) : null);
        }} />
        {shown ? 'Выбрать другой' : 'Выбрать картинку'}
      </label>
      {preview && <button type="button" className="bc-button" disabled={pending} onClick={() => send(false)}>{pending ? 'Сохраняем…' : 'Сохранить баннер'}</button>}
      {bannerId && !preview && <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => send(true)}>Убрать</button>}
    </div> : null}</div>
    {logoActions}
    </div>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    {state.saved && !pending && <FormAlert tone="success">Баннер сохранён.</FormAlert>}
  </div>;
}

/**
 * The whole profile in one form with one «Сохранить профиль»: «О бренде» (a short line, a long story), «Контакты»,
 * «Магазин» and «Что показывать». Nothing in it is required. Controlled fields sent by hand: after an action React
 * resets a form's own fields, and the switches and the select would show their first values.
 */
export function CompanyProfileSettingsForm({ info, stores, storeId, hidden, editable }: { info: CompanyInfo; stores: CompanyStore[]; storeId: string | null; hidden: ProfileSection[]; editable: boolean }) {
  const [state, action, pending] = useActionState<CompanyActionState, FormData>(saveCompanyProfileAllAction, {});
  const [values, setValues] = useState({ bio: info.bio ?? '', story: info.story ?? '', publicEmail: info.publicEmail ?? '', phone: info.phone ?? '', address: info.address ?? '' });
  const [store, setStore] = useState(storeId ?? '');
  const [shown, setShown] = useState(() => new Set(PROFILE_SECTIONS.map(section => section.key).filter(key => !hidden.includes(key))));
  const set = (name: keyof typeof values) => (event: { target: { value: string } }) => setValues(current => ({ ...current, [name]: event.target.value }));
  return <form className="bc-form bc-profile-settings" onSubmit={event => {
    event.preventDefault();
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    form.set('storeId', store);
    for (const key of shown) form.set(`show-${key}`, 'on');
    startTransition(() => action(form));
  }}>
    <fieldset disabled={!editable || pending}>
      <Group title="О бренде" hint="Что увидят под названием и во вкладке «О бренде».">
        <label className="bc-field">Коротко<input value={values.bio} onChange={set('bio')} maxLength={MAX_BIO} placeholder="Энергия. Люди. Культура." />
          <small className="bc-muted">Одна строка под названием · {values.bio.length} / {MAX_BIO}</small></label>
        <label className="bc-field">Подробно<textarea value={values.story} onChange={set('story')} maxLength={MAX_STORY} rows={6} placeholder="История, линейки, чем вы отличаетесь…" />
          <small className="bc-muted">Абзацы сохраняются · {values.story.length} / {MAX_STORY}</small></label>
      </Group>
      <Group title="Контакты" hint="Покупатели свяжутся с вами напрямую. Сайт и Telegram берутся из заявки.">
        <div className="bc-field-row">
          <label className="bc-field">Почта<input type="email" value={values.publicEmail} onChange={set('publicEmail')} placeholder="hello@brand.ru" autoComplete="off" /></label>
          <label className="bc-field">Телефон<input type="tel" value={values.phone} onChange={set('phone')} placeholder="+7 495 123-45-67" autoComplete="off" /></label>
        </div>
        <label className="bc-field">Адрес<input value={values.address} onChange={set('address')} maxLength={200} placeholder="Москва, ул. Тверская, 7" autoComplete="off" /></label>
      </Group>
      <Group title="Магазин" hint={stores.length ? 'Кнопка «Перейти в магазин» на профиле.' : 'Добавьте свой магазин на карту CanRush — после проверки его можно будет выбрать здесь.'}>
        <label className="bc-field"><span className="sr-only">Магазин компании</span>
          <select className="bc-select-native" value={store} onChange={event => setStore(event.target.value)} disabled={!stores.length}>
            <option value="">Без магазина</option>
            {stores.map(item => <option key={item.id} value={item.id}>{item.name} — {item.city}, {item.address}</option>)}
          </select>
        </label>
      </Group>
      <Group title="Что показывать" hint="Всё включено. Выключите то, чего на профиле быть не должно.">
        {PROFILE_SECTIONS.map(section => <label key={section.key} className="bc-switch-row">
          <span><strong>{section.label}</strong><small className="bc-muted">{section.hint}</small></span>
          <input type="checkbox" className="bc-switch" checked={shown.has(section.key)} onChange={event => setShown(current => {
            const next = new Set(current);
            if (event.target.checked) next.add(section.key); else next.delete(section.key);
            return next;
          })} />
        </label>)}
      </Group>
    </fieldset>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    {state.saved && !pending && <FormAlert tone="success">Профиль сохранён — изменения уже на странице компании.</FormAlert>}
    {editable ? <button className="bc-button" type="submit" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить профиль'}</button>
      : <p className="bc-muted">Профиль настраивает владелец кабинета.</p>}
  </form>;
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return <section className="bc-profile-group"><div className="bc-profile-group-head"><h3>{title}</h3><p className="bc-muted">{hint}</p></div><div className="bc-profile-group-body">{children}</div></section>;
}

'use client';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { ProfileAppearanceEditor } from '@/components/profile-appearance-editor';
import { DEFAULT_PROFILE_APPEARANCE, PROFILE_FRAMES, PROFILE_THEMES, profileThemeAttributes } from '@/lib/profile-appearance';
import { ProfileLayoutEditor } from '@/components/profile-layout-editor';
import { ProfileBackButton } from '@/components/profile-back-button';

import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { usePathname, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteAccountAction, updateProfileAction, type ProfileFormState } from '@/app/profile/actions';
import { ProfileImageCrop, type Crop, type CropSource } from '@/components/profile-image-crop';
import { ProfileHeader } from '@/components/profile-header';
import { PROFILE_BIO_MAX } from '@/lib/profile-fields';
import { DEFAULT_PROFILE_LAYOUT, PROFILE_BLOCKS, type ProfileBlockKey } from '@/lib/profile-layout';
import type { ProfileData } from '@/lib/profile';

type ImageKind = 'avatar' | 'banner';
type ProfileCropSource = CropSource & { kind: ImageKind };
type ImageSelection = { file?: File; preview?: string; remove?: boolean; crop?: Crop; source?: ProfileCropSource };

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="community-button profile-save-button" type="submit" disabled={pending || disabled}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>;
}
function DeleteButton() {
  const { pending } = useFormStatus();
  return <button className="profile-delete-button" type="submit" disabled={pending}>{pending ? 'Удаляем…' : 'Удалить аккаунт'}<Image src="/brand/icons/trash.svg" width={20} height={20} alt="" /></button>;
}
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

function TelegramIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.7 3.3a1.6 1.6 0 0 0-1.7-.2L2.9 9.6c-1.2.5-1.1 2.2.1 2.6l3.9 1.2 1.5 4.8c.3.9 1.4 1.2 2.1.5l2.2-2.1 4.1 3c.9.7 2.2.2 2.4-.9l2.6-13.9c.1-.6-.1-1.2-.6-1.5ZM10 14.2l-.6 3.2-1.1-3.6 9.4-7.5-7.7 7.9Z"/></svg>;
}
type Section = 'details' | 'telegram' | 'tags' | 'appearance' | 'images' | 'blocks' | 'account';
const SECTIONS: readonly Section[] = ['details', 'telegram', 'tags', 'appearance', 'images', 'blocks', 'account'];
const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const SECTION_ICONS: Record<Section, ReactNode> = {
  details: <svg {...ICON}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  telegram: <TelegramIcon />,
  images: <svg {...ICON}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>,
  account: <svg {...ICON}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>,
  appearance: <svg {...ICON}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.9l-.3-.9c-.4-1.2.5-2.2 1.7-2.2H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7" r="1.2" /><circle cx="15.5" cy="8" r="1.2" /></svg>,
  tags: <svg {...ICON}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  blocks: <svg {...ICON}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
};
const Chevron = () => <svg {...ICON} width={20} height={20} className="profile-hub-chevron"><path d="m9 6 6 6-6 6" /></svg>;
const BackIcon = () => <svg {...ICON}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
const PencilIcon = () => <svg {...ICON} width={16} height={16}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
const UploadIcon = () => <svg {...ICON} width={22} height={22}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>;
const hasFiles = (event: DragEvent | ReactDragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

function PrefixedInput({ prefix, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix: string }) {
  return <span className="profile-input-prefix"><span aria-hidden="true">{prefix}</span><input {...props} /></span>;
}
/** Text fields accept a full t.me link or @name; the field shows only the name after the prefix. */
const bareTelegram = (value: string) => value.trim().replace(/^https?:\/\//i, '').replace(/^(?:www\.)?(?:t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/\/$/, '');

export function ProfileEditForm({ profile, layoutPreviews, level = 1, xp, tags }: { level?: number; xp?: number; profile: ProfileData; layoutPreviews?: Partial<Record<ProfileBlockKey, ReactNode>>; tags?: { picker: ReactNode; earned: number; total: number; selected?: string } }) {
  const initialName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;
  // The open section lives in ?section= (native history, synced with useSearchParams), so the phone's back gesture
  // returns to the list of sections instead of leaving the editor.
  const pathname = usePathname();
  const requested = useSearchParams().get('section');
  const tab: Section | null = SECTIONS.find(key => key === requested && (key !== 'tags' || tags)) ?? null;
  const pushed = useRef(false);
  const sectionsRef = useRef<HTMLDivElement>(null);
  function openSection(key: Section | null, replace = false) {
    if (key === null && pushed.current && !replace) { pushed.current = false; window.history.back(); return; }
    const url = key ? `${pathname}?section=${key}` : pathname;
    if (replace) window.history.replaceState(null, '', url); else { window.history.pushState(null, '', url); pushed.current = true; }
    requestAnimationFrame(() => {
      const top = sectionsRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight / 2) sectionsRef.current?.scrollIntoView({ block: 'start' });
    });
  }
  // Whichever way the section changed (a row, «Все разделы» or the browser's back), focus follows it.
  const shownSection = useRef(tab);
  useEffect(() => {
    const previous = shownSection.current;
    shownSection.current = tab;
    if (previous === tab) return;
    if (tab === null) pushed.current = false;
    (tab ? document.getElementById(`profile-panel-${tab}`) : document.getElementById(`profile-section-row-${previous}`))?.focus({ preventScroll: tab !== null });
  }, [tab]);
  const setTab = (key: Section) => openSection(key, true);
  const [appearance, setAppearance] = useState(profile.profileAppearance ?? DEFAULT_PROFILE_APPEARANCE);
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(profile.username);
  const [channel, setChannel] = useState(profile.telegramChannel ?? '');
  const [telegram, setTelegram] = useState(profile.telegramUsername ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [images, setImages] = useState<Partial<Record<ImageKind, ImageSelection>>>({});
  const [cropSource, setCropSource] = useState<ProfileCropSource | null>(null);
  const [dragging, setDragging] = useState<ImageKind | null>(null);
  // A file dragged anywhere over the page lights up both drop targets in the header.
  const [fileDrag, setFileDrag] = useState(false);
  const [imageError, setImageError] = useState('');
  const [decoding, setDecoding] = useState({ avatar: false, banner: false });
  const previews = useRef(new Set<string>());
  const imageRequests = useRef({ avatar: 0, banner: 0 });
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(async (previous, form) => {
    for (const kind of ['avatar', 'banner'] as const) {
      const selected = images[kind];
      if (selected?.file) form.set(kind, selected.file);
      if (selected?.crop) form.set(`crop-${kind}`, JSON.stringify(selected.crop));
      if (selected?.remove) form.set(`remove-${kind}`, 'true');
    }
    form.set('profileAppearance', JSON.stringify(appearance));
    const result = await updateProfileAction(previous, form);
    if (result.fieldErrors) setTab(Object.keys(result.fieldErrors).every(key => key.startsWith('telegram')) ? 'telegram' : 'details');
    return result;
  }, {});
  useEffect(() => { if (state.message) errorSummaryRef.current?.focus(); }, [state]);
  useEffect(() => {
    let depth = 0;
    const enter = (event: DragEvent) => { if (!hasFiles(event)) return; depth++; setFileDrag(true); };
    const leave = (event: DragEvent) => { if (!hasFiles(event)) return; depth = Math.max(0, depth - 1); if (!depth) { setFileDrag(false); setDragging(null); } };
    const end = () => { depth = 0; setFileDrag(false); setDragging(null); };
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave);
    window.addEventListener('drop', end); window.addEventListener('dragend', end);
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', end); window.removeEventListener('dragend', end); };
  }, []);
  useEffect(() => {
    const urls = previews.current;
    const requests = imageRequests.current;
    return () => { requests.avatar++; requests.banner++; urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  async function selectImage(kind: ImageKind, file: File | undefined) {
    if (!file) return;
    const request = ++imageRequests.current[kind];
    setDecoding(current => ({ ...current, [kind]: false }));
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Выберите JPG, PNG или WebP не больше 5 МБ.'); return;
    }
    setDecoding(current => ({ ...current, [kind]: true }));
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    const image = new window.Image();
    image.src = preview;
    try {
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Too many pixels');
      if (request !== imageRequests.current[kind]) { URL.revokeObjectURL(preview); previews.current.delete(preview); return; }
      setCropSource({ kind, file, src: preview, width: image.naturalWidth, height: image.naturalHeight });
      setImageError('');
    } catch {
      URL.revokeObjectURL(preview); previews.current.delete(preview);
      if (request === imageRequests.current[kind]) setImageError('Не удалось открыть изображение. Используйте JPG, PNG или WebP до 40 мегапикселей.');
    } finally { if (request === imageRequests.current[kind]) setDecoding(current => ({ ...current, [kind]: false })); }
  }
  async function editCrop(kind: ImageKind) {
    const selected = images[kind];
    if (selected?.source) { setCropSource(selected.source); return; }
    const src = imageSource(kind);
    if (!src) return;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      await selectImage(kind, new File([blob], `${kind}.webp`, { type: blob.type }));
    } catch { setImageError('Не удалось загрузить фото для кадрирования. Попробуйте ещё раз.'); }
  }
  function imageSource(kind: ImageKind) {
    if (images[kind]?.remove) return null;
    return images[kind]?.preview ?? (profile[`${kind}Id`] ? `/api/profile-images/${profile[`${kind}Id`]}` : null);
  }

  function imageControl(kind: ImageKind) {
    const label = kind === 'avatar' ? 'Изменить аватар' : 'Изменить баннер';
    return <label className={`profile-drop-target profile-drop-target-${kind}${fileDrag && !pending ? ' is-drop-ready' : ''}${dragging === kind ? ' is-dragging' : ''}`} title={`${label} — нажмите или перетащите фото`}
      onDragOver={event => { if (!hasFiles(event)) return; event.preventDefault(); if (!pending) setDragging(kind); }} onDragLeave={() => setDragging(current => current === kind ? null : current)} onDrop={event => { event.preventDefault(); setDragging(null); setFileDrag(false); if (!pending) void selectImage(kind, event.dataTransfer.files[0]); }}>
      <span className="profile-drop-zone" aria-hidden="true"><UploadIcon />{kind === 'banner' && <span>{dragging === kind ? 'Отпустите, чтобы загрузить' : 'Перетащите фото сюда'}</span>}</span>
      <span className="profile-edit-badge" aria-hidden="true"><PencilIcon /></span>
      <input type="file" disabled={pending} accept="image/jpeg,image/png,image/webp" aria-label={label} onChange={event => { void selectImage(kind, event.target.files?.[0]); event.target.value = ''; }} />
    </label>;
  }
  const visibleBlocks = (() => { const layout = profile.profileLayout ?? DEFAULT_PROFILE_LAYOUT; return layout.order.length - layout.hidden.length; })();
  const imageState = (kind: ImageKind, label: string) => images[kind]?.remove ? `${label}: удалится` : images[kind] ? `${label}: новое` : imageSource(kind) ? `${label} есть` : `Без ${kind === 'avatar' ? 'аватара' : 'баннера'}`;
  const sectionGroups: { key: string; title: string; rows: { key: Section; title: string; value?: string; tone?: string }[] }[] = [
    { key: 'profile', title: 'Профиль', rows: [
      { key: 'details', title: 'Имя, ник и описание', value: `${name.trim() || initialName} · @${username.replace(/^@+/, '') || profile.username}` },
      { key: 'telegram', title: 'Telegram', value: [telegram && `t.me/${telegram}`, channel && `канал t.me/${channel}`].filter(Boolean).join(' · ') || 'Не указан', tone: 'telegram' },
      ...(tags ? [{ key: 'tags' as const, title: 'Тег в профиле', value: `${tags.selected ?? 'Не выбран'} · получено ${tags.earned} из ${tags.total}` }] : []),
    ] },
    { key: 'look', title: 'Внешний вид', rows: [
      { key: 'appearance', title: 'Оформление', value: `${PROFILE_THEMES.find(item => item.key === appearance.theme)?.label ?? ''} · ${PROFILE_FRAMES.find(item => item.key === appearance.frame)?.label ?? ''}` },
      { key: 'images', title: 'Аватар и баннер', value: `${imageState('avatar', 'Аватар')} · ${imageState('banner', 'баннер').replace(/^Без/, 'без')}` },
      { key: 'blocks', title: 'Блоки профиля', value: `Показано ${visibleBlocks} из ${PROFILE_BLOCKS.length}` },
    ] },
    { key: 'account', title: 'Аккаунт', rows: [{ key: 'account', title: 'Удаление аккаунта', value: 'Без возможности восстановления', tone: 'danger' }] },
  ];
  return <div className="community-profile profile-editor ym-hide-content">
    <ProfileBackButton />
    <form className="profile-customization-form" action={formAction} noValidate onSubmit={event => {
      if (!event.currentTarget.checkValidity()) {
        event.preventDefault();
        const form = event.currentTarget;
        const invalid = form.querySelector<HTMLInputElement>(':invalid:not(fieldset)');
        setTab(invalid?.id.startsWith('telegram') ? 'telegram' : 'details');
        requestAnimationFrame(() => form.reportValidity());
      }
    }}>
      <div className="profile-editor-preview" {...profileThemeAttributes(appearance.theme)}>
      <ProfileHeader frame={appearance.frame} name={name.trim() || initialName} username={username.replace(/^@+/, '') || profile.username} bio={bio.trim()} createdAt={profile.createdAt}
        avatarSrc={imageSource('avatar')} bannerSrc={imageSource('banner')} avatarControl={imageControl('avatar')} bannerControl={imageControl('banner')}
        actions={<div className="profile-editor-actions"><Link className="community-button community-button-secondary" href="/profile">Отмена</Link><ApplyButton disabled={decoding.avatar || decoding.banner || Boolean(cropSource)} /></div>} />
      </div>
      {state.message && <div className="profile-form-error" ref={errorSummaryRef} role="alert" tabIndex={-1}><h2>Не удалось сохранить профиль</h2><p>{state.message}</p></div>}
      <div className="profile-sections" ref={sectionsRef}>{tab === null ? <nav className="profile-hub" aria-label="Разделы профиля">
        {sectionGroups.map(group => <section key={group.title} className="profile-hub-island" aria-labelledby={`profile-hub-${group.key}`}>
          <h2 id={`profile-hub-${group.key}`}>{group.title}</h2>
          <ul>{group.rows.map(row => <li key={row.key}>
            <button id={`profile-section-row-${row.key}`} type="button" className="profile-hub-row" data-tone={row.tone} onClick={() => openSection(row.key)}>
              <span className="profile-hub-icon" aria-hidden="true">{SECTION_ICONS[row.key]}</span>
              <span className="profile-hub-text"><strong>{row.title}</strong>{row.value && <small>{row.value}</small>}</span>
              <Chevron />
            </button>
          </li>)}</ul>
        </section>)}
      </nav> : <button type="button" className="profile-section-back" onClick={() => openSection(null)}><BackIcon />Все разделы</button>}</div>
      <div id="profile-panel-details" tabIndex={-1} aria-label="Основное" hidden={tab !== 'details'} className="profile-editor-panel">
        <section className="community-panel profile-editor-group" aria-labelledby="profile-fields-title">
          <div className="profile-editor-group-heading"><h2 id="profile-fields-title"><span className="profile-editor-group-icon profile-editor-group-icon-main">{SECTION_ICONS.details}</span>Основное</h2><p>Как вас видят в профиле, отзывах и тирлистах.</p></div>
          <fieldset className="profile-editor-fields" disabled={pending}>
            <div className="profile-edit-field"><label htmlFor="name">Имя</label>
              <input id="name" name="name" type="text" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={40} aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={state.fieldErrors?.name ? 'name-error' : 'name-help'} required />
              <p className="field-help" id="name-help">До 40 символов.</p><FieldError id="name-error" message={state.fieldErrors?.name} />
            </div>
            <div className="profile-edit-field"><label htmlFor="username">Юзернейм</label>
              <PrefixedInput prefix="@" id="username" name="username" type="text" value={username} onChange={event => setUsername(event.target.value.replace(/^@+/, ''))} autoComplete="username" minLength={3} maxLength={25} pattern="@?[A-Za-z0-9_]{3,24}" title="От 3 до 24 латинских букв, цифр или символов подчёркивания" aria-invalid={Boolean(state.fieldErrors?.username)} aria-describedby={state.fieldErrors?.username ? 'username-error' : 'username-help'} required />
              <p className="field-help" id="username-help">Адрес профиля: canrush.ru/profile/{username.replace(/^@+/, '') || profile.username}</p><FieldError id="username-error" message={state.fieldErrors?.username} />
            </div>
            <div className="profile-edit-field profile-edit-field-wide"><label htmlFor="bio">Описание</label>
              <textarea id="bio" name="bio" rows={2} value={bio} onChange={event => setBio(event.target.value)} maxLength={PROFILE_BIO_MAX} placeholder="Пара слов о себе: любимый бренд, сколько банок в неделю…" aria-invalid={Boolean(state.fieldErrors?.bio)} aria-describedby={state.fieldErrors?.bio ? 'bio-error' : 'bio-help'} />
              <p className="field-help" id="bio-help">Показывается под именем в профиле и в поиске участников. {bio.length}/{PROFILE_BIO_MAX}</p><FieldError id="bio-error" message={state.fieldErrors?.bio} />
            </div>
          </fieldset>
        </section>
      </div>
      <div id="profile-panel-telegram" tabIndex={-1} aria-label="Telegram" hidden={tab !== 'telegram'} className="profile-editor-panel">
        <section className="community-panel profile-editor-group" aria-labelledby="profile-telegram-title">
          <div className="profile-editor-group-heading"><h2 id="profile-telegram-title"><span className="profile-editor-group-icon"><TelegramIcon /></span>Telegram</h2><p>Необязательно. Ссылки появятся в блоке «О профиле» и будут видны всем.</p></div>
          <fieldset className="profile-editor-fields" disabled={pending}>
            <div className="profile-edit-field"><label htmlFor="telegramUsername">Личный профиль</label>
              <PrefixedInput prefix="t.me/" id="telegramUsername" name="telegramUsername" type="text" value={telegram} onChange={event => setTelegram(bareTelegram(event.target.value))} placeholder="username" autoComplete="off" spellCheck={false} maxLength={64} aria-invalid={Boolean(state.fieldErrors?.telegramUsername)} aria-describedby={state.fieldErrors?.telegramUsername ? 'telegram-user-error' : 'telegram-user-help'} />
              <p className="field-help" id="telegram-user-help">Чтобы вам могли написать напрямую. Можно вставить ссылку или @юзернейм.</p><FieldError id="telegram-user-error" message={state.fieldErrors?.telegramUsername} />
            </div>
            <div className="profile-edit-field"><label htmlFor="telegramChannel">Канал</label>
              <PrefixedInput prefix="t.me/" id="telegramChannel" name="telegramChannel" type="text" value={channel} onChange={event => setChannel(bareTelegram(event.target.value))} placeholder="energyhub" autoComplete="off" spellCheck={false} maxLength={64} aria-invalid={Boolean(state.fieldErrors?.telegramChannel)} aria-describedby={state.fieldErrors?.telegramChannel ? 'telegram-error' : 'telegram-help'} />
              <p className="field-help" id="telegram-help">Подписывается на ваших скриншотах тирлистов.</p><FieldError id="telegram-error" message={state.fieldErrors?.telegramChannel} />
            </div>
          </fieldset>
        </section>
      </div>
      <div id="profile-panel-appearance" tabIndex={-1} aria-label="Оформление" hidden={tab !== 'appearance'} className="profile-editor-panel">
        <ProfileAppearanceEditor level={level} xp={xp} current={profile.profileAppearance ?? DEFAULT_PROFILE_APPEARANCE} value={appearance} onChange={setAppearance} disabled={pending} />
      </div>
      <div id="profile-panel-images" tabIndex={-1} aria-label="Аватар и баннер" hidden={tab !== 'images'} className="profile-editor-panel">
        <section className="community-panel profile-editor-images" aria-labelledby="profile-images-title">
          <div className="community-section-heading"><h2 id="profile-images-title">Изображения</h2></div>
          <p className="community-section-note">JPG, PNG или WebP, до 5 МБ. Предпросмотр сверху.</p>
          <fieldset className="profile-image-fields" disabled={pending}>
            {(['avatar', 'banner'] as const).map(kind => <div className="profile-image-field" key={kind}>
              <h3>{kind === 'avatar' ? 'Аватар' : 'Баннер'}</h3>
              <p>{kind === 'avatar' ? 'Выберите квадратную миниатюру.' : 'Выберите область баннера 4:1.'}</p>
              {imageSource(kind) && <div className={`profile-upload-preview profile-upload-preview-${kind}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- existing or local upload preview */}
                <img src={imageSource(kind) ?? undefined} alt={kind === 'avatar' ? 'Превью аватара' : 'Превью баннера'} />
                <button className="photo-delete-overlay" title="Удалить фотографию" aria-label={kind === 'avatar' ? 'Удалить аватар' : 'Удалить баннер'} type="button" onClick={() => { imageRequests.current[kind]++; setDecoding(current => ({ ...current, [kind]: false })); setImages(current => ({ ...current, [kind]: { remove: true } })); setImageError(''); }}><PhotoDeleteIcon /></button>
              </div>}
              <div className="profile-image-actions"><label className="community-button community-button-secondary profile-file-picker"><span>{imageSource(kind) ? 'Заменить' : 'Загрузить'}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={kind === 'avatar' ? 'Загрузить аватар' : 'Загрузить баннер'} onChange={event => { void selectImage(kind, event.target.files?.[0]); event.target.value = ''; }} /></label>
                {imageSource(kind) && <button className="community-button community-button-secondary" type="button" onClick={() => { void editCrop(kind); }}>Изменить кадр</button>}
                {images[kind] && <button className="community-button community-button-text" type="button" onClick={() => { imageRequests.current[kind]++; setDecoding(current => ({ ...current, [kind]: false })); setImages(current => ({ ...current, [kind]: undefined })); setImageError(''); }}>Отменить изменение</button>}
              </div>
              {images[kind]?.file && <p className="profile-selected-file">{images[kind]?.file?.name}</p>}
              {images[kind]?.remove && <p className="community-muted">Будет удалён после сохранения.</p>}
            </div>)}
          </fieldset>
          {imageError && <p className="field-error" role="alert">{imageError}</p>}
        </section>
      </div>
      <div id="profile-panel-blocks" tabIndex={-1} aria-label="Блоки профиля" hidden={tab !== 'blocks'} className="profile-editor-panel">
        <div {...profileThemeAttributes(appearance.theme)} className="profile-blocks-preview"><ProfileLayoutEditor initial={profile.profileLayout} disabled={pending} previews={layoutPreviews} /></div>
      </div>
      <div className="profile-editor-savebar" hidden={tab === null || tab === 'tags' || tab === 'account'}><p>{tab === 'blocks' ? 'Порядок и видимость блоков сохранятся вместе с профилем.' : 'Изменения применятся после сохранения.'}</p><Link className="community-button community-button-secondary" href="/profile">Отмена</Link><ApplyButton disabled={decoding.avatar || decoding.banner || Boolean(cropSource)} /></div>
    </form>
    {tags && <div id="profile-panel-tags" tabIndex={-1} aria-label="Тег в профиле" hidden={tab !== 'tags'} className="profile-editor-panel">
      <section className="community-panel profile-editor-group" id="achievements" aria-labelledby="achievements-title">
        <div className="profile-editor-group-heading"><h2 id="achievements-title">Тег в профиле <span className="profile-editor-count">{tags.earned} / {tags.total}</span></h2><p>Выберите один из полученных тегов. Он появится рядом с именем в профиле, отзывах и тирлистах. Тег сохраняется отдельно от остальных данных.</p></div>
        {tags.picker}
        <Link className="community-button-text profile-editor-link" href={`/profile/${profile.username}/achievements`}>Все достижения и условия ↗</Link>
      </section>
    </div>}
    {cropSource && <ProfileImageCrop key={cropSource.src} source={cropSource} initial={images[cropSource.kind]?.source?.src === cropSource.src ? images[cropSource.kind]?.crop : undefined} onCancel={() => setCropSource(null)} onConfirm={(crop, preview) => { setImages(current => ({ ...current, [cropSource.kind]: { file: cropSource.file, crop, preview, source: cropSource } })); setCropSource(null); }} />}
    <section id="profile-panel-account" tabIndex={-1} hidden={tab !== 'account'} className="community-panel profile-editor-danger" aria-labelledby="danger-zone-title"><div><h2 id="danger-zone-title">Удаление аккаунта</h2><p>Профиль и его данные будут удалены без возможности восстановления.</p></div>
      <form action={deleteAccountAction} onSubmit={event => { if (!window.confirm('Удалить аккаунт и все персональные данные? Это действие нельзя отменить.')) event.preventDefault(); }}><input type="hidden" name="confirmation" value="delete-account" /><DeleteButton /></form>
    </section>
  </div>;
}

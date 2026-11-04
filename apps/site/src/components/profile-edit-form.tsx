'use client';
import { ProfileImageMenu, ProfileLookStrip, type LookTileKey } from '@/components/profile-look-strip';
import type { BrandFrameProgress } from '@/lib/brand-frame-fields';
import { DEFAULT_PROFILE_APPEARANCE, profileThemeAttributes } from '@/lib/profile-appearance';
import { profileTagLabel } from '@/lib/profile-achievements';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { ProfileLayoutEditor } from '@/components/profile-layout-editor';

import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { usePathname, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteAccountAction, updateProfileAction, type ProfileFormState } from '@/app/profile/actions';
import { ProfileImageCrop, type Crop, type CropSource } from '@/components/profile-image-crop';
import { ProfileHeader } from '@/components/profile-header';
import { useSignOut } from '@/components/sign-out-button';
import { PROFILE_BIO_MAX } from '@/lib/profile-fields';
import { DEFAULT_PROFILE_LAYOUT, PROFILE_BLOCKS, type ProfileBlockKey } from '@/lib/profile-layout';
import { MARKET_OPEN } from '@/lib/market-open';
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
type ProfileSection = 'details' | 'telegram' | 'blocks' | 'account';
const SECTIONS: readonly ProfileSection[] = ['details', 'telegram', 'blocks', 'account'];
/** The look has no sections any more (it is picked on the preview): old links open the matching tile's list; `images` just shows the preview. */
const LOOK_SECTIONS: Record<string, LookTileKey> = { appearance: 'frame', tags: 'tag' };
/** Site settings shown in the same hub: each row opens its own panel with its own forms (outside the profile form). */
/** A settings row opens its panel in place, or with `href` leads to another page (the admin panel). */
export type SettingsRow = { key: string; title: string; value?: string; tone?: string; icon: ReactNode } & ({ panel: ReactNode; href?: never } | { href: string; panel?: never });
export type SettingsGroup = { key: string; title: string; rows: SettingsRow[] };
type Section = ProfileSection | (string & {});
const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const SECTION_ICONS: Record<ProfileSection, ReactNode> = {
  details: <svg {...ICON}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  telegram: <TelegramIcon />,
  account: <svg {...ICON}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>,
  blocks: <svg {...ICON}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
};
const SignOutIcon = () => <svg {...ICON}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>;
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

/** `tags`: the member's earned tags and the one worn now; it is picked on the preview and saved with the profile. */
export function ProfileEditForm({ profile, layoutPreviews, level = 1, xp, ownedFrames = [], brandFrames = [], tags, settings = [], accountRows = [] }: { level?: number; xp?: number; ownedFrames?: readonly string[]; brandFrames?: readonly BrandFrameProgress[]; profile: ProfileData; layoutPreviews?: Partial<Record<ProfileBlockKey, ReactNode>>; tags?: { earned: readonly string[]; selected: string }; settings?: SettingsGroup[]; accountRows?: SettingsRow[] }) {
  const initialName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;
  // The open section lives in ?section= (native history, synced with useSearchParams), so the phone's back gesture
  // returns to the list of sections instead of leaving the editor.
  const pathname = usePathname();
  const { signOut, pending: signingOut, error: signOutError } = useSignOut();
  const requested = useSearchParams().get('section');
  const settingsRows = [...settings.flatMap(group => group.rows), ...accountRows].filter(row => !row.href);
  const tab: Section | null = SECTIONS.find(key => key === requested) ?? settingsRows.find(row => row.key === requested)?.key ?? null;
  const lookTile = requested ? LOOK_SECTIONS[requested] ?? null : null;
  const settingsOpen = settingsRows.some(row => row.key === tab);
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
  const savedAppearance = profile.profileAppearance ?? DEFAULT_PROFILE_APPEARANCE;
  const [appearance, setAppearance] = useState(savedAppearance);
  const [tag, setTag] = useState(tags?.selected ?? '');
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
    // The tag has its own action; it goes first, because a saved profile leaves the page.
    if (tags && tag !== tags.selected) {
      const tagForm = new FormData();
      tagForm.set('operation', 'tags');
      if (tag) tagForm.set('tags', tag);
      const saved = await updateCommunityAction({}, tagForm);
      if (saved.error) return { message: saved.error };
    }
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
    // A GIF (and an animated WebP) may weigh more: the server keeps it as a light animated WebP.
    const animatable = file.type === 'image/gif' || file.type === 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > (animatable ? 10 : 5) * 1024 * 1024) {
      setImageError('Выберите JPG, PNG или WebP до 5 МБ или GIF до 10 МБ.'); return;
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
      if (request === imageRequests.current[kind]) setImageError('Не удалось открыть изображение. Используйте JPG, PNG, WebP или GIF до 40 мегапикселей.');
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

  // What the editor shows for each picture now, worked out once per render (the pencil and its list read it).
  const pictures = Object.fromEntries((['avatar', 'banner'] as const).map(kind => [kind, { src: imageSource(kind), changed: Boolean(images[kind]), removed: Boolean(images[kind]?.remove) }])) as Record<ImageKind, { src: string | null; changed: boolean; removed: boolean }>;
  // The whole avatar or banner takes a photo (tap or drop). Once there is a picture, the pencil is its own button with
  // a list: another photo, recrop, remove, undo.
  function imageControl(kind: ImageKind) {
    const label = kind === 'avatar' ? 'Изменить аватар' : 'Изменить баннер';
    const image = pictures[kind];
    const menu = Boolean(image.src || image.changed);
    return <><label className={`profile-drop-target profile-drop-target-${kind}${fileDrag && !pending ? ' is-drop-ready' : ''}${dragging === kind ? ' is-dragging' : ''}`} title={`${label} — нажмите или перетащите фото`}
      onDragOver={event => { if (!hasFiles(event)) return; event.preventDefault(); if (!pending) setDragging(kind); }} onDragLeave={() => setDragging(current => current === kind ? null : current)} onDrop={event => { event.preventDefault(); setDragging(null); setFileDrag(false); if (!pending) void selectImage(kind, event.dataTransfer.files[0]); }}>
      <span className="profile-drop-zone" aria-hidden="true"><UploadIcon />{kind === 'banner' && <span>{dragging === kind ? 'Отпустите, чтобы загрузить' : 'Перетащите фото сюда'}</span>}</span>
      {!menu && <span className="profile-edit-badge" aria-hidden="true"><PencilIcon /></span>}
      <input type="file" disabled={pending} accept="image/jpeg,image/png,image/webp,image/gif" aria-label={menu ? `${kind === 'avatar' ? 'Загрузить другой аватар' : 'Загрузить другой баннер'}` : label} onChange={event => { void selectImage(kind, event.target.files?.[0]); event.target.value = ''; }} />
    </label>
    {menu && <ProfileImageMenu kind={kind} image={image} disabled={pending} onPick={pickImage} onCrop={cropImage} onRemove={removeImage} onUndo={undoImage} />}
    </>;
  }
  function forgetImage(kind: ImageKind, next: ImageSelection | undefined) {
    imageRequests.current[kind]++;
    setDecoding(current => ({ ...current, [kind]: false }));
    setImages(current => ({ ...current, [kind]: next }));
    setImageError('');
  }
  const pickImage = (kind: ImageKind, file: File) => { void selectImage(kind, file); };
  const cropImage = (kind: ImageKind) => { void editCrop(kind); };
  const removeImage = (kind: ImageKind) => forgetImage(kind, { remove: true });
  const undoImage = (kind: ImageKind) => forgetImage(kind, undefined);
  const marketOut = (key: string) => !MARKET_OPEN && key === 'listings';
  const visibleBlocks = (() => { const layout = profile.profileLayout ?? DEFAULT_PROFILE_LAYOUT; return layout.order.filter(key => !layout.hidden.includes(key) && !marketOut(key)).length; })();
  const sectionGroups: { key: string; title: string; rows: { key: Section; title: string; value?: string; tone?: string; icon?: ReactNode; href?: string; onSelect?: () => void }[] }[] = [
    { key: 'profile', title: 'Профиль', rows: [
      { key: 'details', title: 'Имя, ник и описание', value: `${name.trim() || initialName} · @${username.replace(/^@+/, '') || profile.username}` },
      { key: 'telegram', title: 'Telegram', value: [telegram && `t.me/${telegram}`, channel && `канал t.me/${channel}`].filter(Boolean).join(' · ') || 'Не указан', tone: 'telegram' },
    ] },
    ...settings,
    { key: 'account', title: 'Аккаунт', rows: [...accountRows,
      { key: 'sign-out', title: signingOut ? 'Выходим…' : 'Выйти из аккаунта', value: 'На этом устройстве', icon: <SignOutIcon />, onSelect: () => { if (!signingOut) void signOut(); } },
      { key: 'account', title: 'Удаление аккаунта', value: 'Без возможности восстановления', tone: 'danger' }] },
  ];
  return <div className="community-profile profile-editor ym-hide-content">
    <form className="profile-customization-form" action={formAction} noValidate onSubmit={event => {
      if (!event.currentTarget.checkValidity()) {
        event.preventDefault();
        const form = event.currentTarget;
        const invalid = form.querySelector<HTMLInputElement>(':invalid:not(fieldset)');
        setTab(invalid?.id.startsWith('telegram') ? 'telegram' : 'details');
        requestAnimationFrame(() => form.reportValidity());
      }
    }}>
      <div className="profile-editor-preview" hidden={settingsOpen} {...profileThemeAttributes(appearance.theme)}>
      <ProfileHeader frame={appearance.frame} name={name.trim() || initialName} username={username.replace(/^@+/, '') || profile.username} bio={bio.trim()} createdAt={profile.createdAt}
        avatarSrc={imageSource('avatar')} bannerSrc={imageSource('banner')} avatarControl={imageControl('avatar')} bannerControl={imageControl('banner')}
        tags={tag ? <div className="profile-tags"><span className="profile-tag" data-tag={tag}>{profileTagLabel(tag)}</span></div> : undefined}
        actions={<div className="profile-editor-actions"><Link className="community-button community-button-secondary" href="/profile">Отмена</Link><ApplyButton disabled={decoding.avatar || decoding.banner || Boolean(cropSource)} /></div>} />
      <ProfileLookStrip appearance={appearance} saved={savedAppearance} onAppearance={setAppearance} level={level} xp={xp ?? 0} owned={ownedFrames} brandFrames={brandFrames}
        avatarSrc={imageSource('avatar')} disabled={pending} autoOpen={lookTile}
        tag={tags && { value: tag, saved: tags.selected, earned: tags.earned, onChange: setTag, href: `/profile/${profile.username}/achievements` }}
        blocks={{ shown: visibleBlocks, total: PROFILE_BLOCKS.filter(block => !marketOut(block.key)).length, open: () => openSection('blocks') }} />
      {imageError && <p className="field-error look-error" role="alert">{imageError}</p>}
      </div>
      {state.message && <div className="profile-form-error" ref={errorSummaryRef} role="alert" tabIndex={-1}><h2>Не удалось сохранить профиль</h2><p>{state.message}</p></div>}
      <div className="profile-sections" ref={sectionsRef}>{tab === null ? <nav className="profile-hub" aria-label="Профиль и настройки">
        {sectionGroups.map(group => <section key={group.title} className="profile-hub-island" aria-labelledby={`profile-hub-${group.key}`}>
          <h2 id={`profile-hub-${group.key}`}>{group.title}</h2>
          <ul>{group.rows.map(row => {
            const content = <>
              <span className="profile-hub-icon" aria-hidden="true">{row.icon ?? SECTION_ICONS[row.key as ProfileSection]}</span>
              <span className="profile-hub-text"><strong>{row.title}</strong>{row.value && <small>{row.value}</small>}</span>
              <Chevron />
            </>;
            return <li key={row.key}>{row.href
              ? <Link id={`profile-section-row-${row.key}`} className="profile-hub-row" data-tone={row.tone} href={row.href}>{content}</Link>
              : <button id={`profile-section-row-${row.key}`} type="button" className="profile-hub-row" data-tone={row.tone} aria-busy={row.key === 'sign-out' ? signingOut : undefined} onClick={row.onSelect ?? (() => openSection(row.key))}>{content}</button>}
              {row.key === 'sign-out' && signOutError && <p className="field-error profile-hub-error" role="alert">{signOutError}</p>}
            </li>;
          })}</ul>
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
      <div id="profile-panel-blocks" tabIndex={-1} aria-label="Блоки профиля" hidden={tab !== 'blocks'} className="profile-editor-panel">
        <div {...profileThemeAttributes(appearance.theme)} className="profile-blocks-preview"><ProfileLayoutEditor initial={profile.profileLayout} disabled={pending} previews={layoutPreviews} /></div>
      </div>
      <div className="profile-editor-savebar" hidden={tab === null || tab === 'account' || settingsOpen}><p>{tab === 'blocks' ? 'Порядок и видимость блоков сохранятся вместе с профилем.' : 'Изменения применятся после сохранения.'}</p><Link className="community-button community-button-secondary" href="/profile">Отмена</Link><ApplyButton disabled={decoding.avatar || decoding.banner || Boolean(cropSource)} /></div>
    </form>
    {settingsRows.map(row => <div key={row.key} id={`profile-panel-${row.key}`} tabIndex={-1} aria-label={row.title} hidden={tab !== row.key} className="profile-editor-panel profile-settings-panel">{row.panel}</div>)}
    {cropSource && <ProfileImageCrop key={cropSource.src} source={cropSource} initial={images[cropSource.kind]?.source?.src === cropSource.src ? images[cropSource.kind]?.crop : undefined} onCancel={() => setCropSource(null)} onConfirm={(crop, preview) => { setImages(current => ({ ...current, [cropSource.kind]: { file: cropSource.file, crop, preview, source: cropSource } })); setCropSource(null); }} />}
    <section id="profile-panel-account" tabIndex={-1} hidden={tab !== 'account'} className="community-panel profile-editor-danger" aria-labelledby="danger-zone-title"><div><h2 id="danger-zone-title">Удаление аккаунта</h2><p>Профиль и его данные будут удалены без возможности восстановления.</p></div>
      <form action={deleteAccountAction} onSubmit={event => { if (!window.confirm('Удалить аккаунт и все персональные данные? Это действие нельзя отменить.')) event.preventDefault(); }}><input type="hidden" name="confirmation" value="delete-account" /><DeleteButton /></form>
    </section>
  </div>;
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteAccountAction, updateProfileAction, type ProfileFormState } from '@/app/profile/actions';
import { ProfileImageCrop, type Crop, type CropSource } from '@/components/profile-image-crop';
import { ProfileHeader } from '@/components/profile-header';
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

export function ProfileEditForm({ profile }: { profile: ProfileData }) {
  const initialName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(profile.username);
  const [channel, setChannel] = useState(profile.telegramChannel ? `t.me/${profile.telegramChannel}` : '');
  const [images, setImages] = useState<Partial<Record<ImageKind, ImageSelection>>>({});
  const [cropSource, setCropSource] = useState<ProfileCropSource | null>(null);
  const [dragging, setDragging] = useState<ImageKind | null>(null);
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
    return updateProfileAction(previous, form);
  }, {});
  useEffect(() => { if (state.message) errorSummaryRef.current?.focus(); }, [state]);
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
    return <label className={`profile-drop-target${dragging === kind ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!pending) setDragging(kind); }} onDragLeave={() => setDragging(null)} onDrop={event => { event.preventDefault(); setDragging(null); if (!pending) void selectImage(kind, event.dataTransfer.files[0]); }}>
      <span>{kind === 'avatar' ? 'Изменить' : 'Изменить баннер · перетащите фото'}</span>
      <input type="file" disabled={pending} accept="image/jpeg,image/png,image/webp" aria-label={kind === 'avatar' ? 'Изменить аватар' : 'Изменить баннер'} onChange={event => { void selectImage(kind, event.target.files?.[0]); event.target.value = ''; }} />
    </label>;
  }
  return <div className="community-profile profile-editor ym-hide-content">
    <form className="profile-customization-form" action={formAction}>
      <ProfileHeader name={name.trim() || initialName} username={username.replace(/^@+/, '') || profile.username} createdAt={profile.createdAt}
        avatarSrc={imageSource('avatar')} bannerSrc={imageSource('banner')} avatarControl={imageControl('avatar')} bannerControl={imageControl('banner')}
        actions={<div className="profile-editor-actions"><Link className="community-button community-button-secondary" href="/profile">Отмена</Link><ApplyButton disabled={decoding.avatar || decoding.banner || Boolean(cropSource)} /></div>} />
      {state.message && <div className="profile-form-error" ref={errorSummaryRef} role="alert" tabIndex={-1}><h2>Не удалось сохранить профиль</h2><p>{state.message}</p></div>}
      <div className="profile-editor-grid">
        <section className="community-panel" aria-labelledby="profile-fields-title">
          <div className="community-section-heading"><h2 id="profile-fields-title">Данные профиля</h2></div>
          <fieldset className="profile-editor-fields" disabled={pending}>
            <div className="profile-edit-field"><label htmlFor="username">Юзернейм</label>
              <input id="username" name="username" type="text" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={25} pattern="@?[A-Za-z0-9_]{3,24}" title="От 3 до 24 латинских букв, цифр или символов подчёркивания" aria-invalid={Boolean(state.fieldErrors?.username)} aria-describedby={state.fieldErrors?.username ? 'username-error' : 'username-help'} required />
              <p className="field-help" id="username-help">Латинские буквы, цифры и подчёркивание.</p><FieldError id="username-error" message={state.fieldErrors?.username} />
            </div>
            <div className="profile-edit-field"><label htmlFor="name">Имя</label>
              <input id="name" name="name" type="text" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={40} aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined} required /><FieldError id="name-error" message={state.fieldErrors?.name} />
            </div>
            <div className="profile-edit-field"><label htmlFor="email">Почта</label><input id="email" type="email" value={profile.email} readOnly aria-readonly="true" /><p className="field-help">Для смены почты нужно повторное подтверждение.</p></div>
            <div className="profile-edit-field"><label htmlFor="telegramChannel">Телеграм-канал</label>
              <input id="telegramChannel" name="telegramChannel" type="text" value={channel} onChange={event => setChannel(event.target.value)} placeholder="t.me/energyhub" autoComplete="url" maxLength={64} aria-invalid={Boolean(state.fieldErrors?.telegramChannel)} aria-describedby={state.fieldErrors?.telegramChannel ? 'telegram-error' : undefined} /><FieldError id="telegram-error" message={state.fieldErrors?.telegramChannel} />
            </div>
          </fieldset>
        </section>
        <section className="community-panel" aria-labelledby="profile-images-title">
          <div className="community-section-heading"><h2 id="profile-images-title">Изображения</h2></div>
          <p className="community-section-note">JPG, PNG или WebP, до 5 МБ. Предпросмотр сверху.</p>
          <fieldset className="profile-image-fields" disabled={pending}>
            {(['avatar', 'banner'] as const).map(kind => <div className="profile-image-field" key={kind}>
              <h3>{kind === 'avatar' ? 'Аватар' : 'Баннер'}</h3>
              <p>{kind === 'avatar' ? 'Выберите квадратную миниатюру.' : 'Выберите область баннера 4:1.'}</p>
              <div className="profile-image-actions"><label className="community-button community-button-secondary profile-file-picker"><span>{imageSource(kind) ? 'Заменить' : 'Загрузить'}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={kind === 'avatar' ? 'Загрузить аватар' : 'Загрузить баннер'} onChange={event => { void selectImage(kind, event.target.files?.[0]); event.target.value = ''; }} /></label>
                {imageSource(kind) && <button className="community-button community-button-secondary" type="button" onClick={() => { void editCrop(kind); }}>Изменить кадр</button>}
                {imageSource(kind) && <button className="community-button community-button-text" type="button" onClick={() => { imageRequests.current[kind]++; setDecoding(current => ({ ...current, [kind]: false })); setImages(current => ({ ...current, [kind]: { remove: true } })); setImageError(''); }}>Удалить {kind === 'avatar' ? 'аватар' : 'баннер'}</button>}
                {images[kind] && <button className="community-button community-button-text" type="button" onClick={() => { imageRequests.current[kind]++; setDecoding(current => ({ ...current, [kind]: false })); setImages(current => ({ ...current, [kind]: undefined })); setImageError(''); }}>Отменить изменение</button>}
              </div>
              {images[kind]?.file && <p className="profile-selected-file">{images[kind]?.file?.name}</p>}
              {images[kind]?.remove && <p className="community-muted">Будет удалён после сохранения.</p>}
            </div>)}
          </fieldset>
          {imageError && <p className="field-error" role="alert">{imageError}</p>}
        </section>
      </div>
    </form>
    {cropSource && <ProfileImageCrop key={cropSource.src} source={cropSource} initial={images[cropSource.kind]?.source?.src === cropSource.src ? images[cropSource.kind]?.crop : undefined} onCancel={() => setCropSource(null)} onConfirm={(crop, preview) => { setImages(current => ({ ...current, [cropSource.kind]: { file: cropSource.file, crop, preview, source: cropSource } })); setCropSource(null); }} />}
    <section className="profile-editor-danger" aria-labelledby="danger-zone-title"><div><h2 id="danger-zone-title">Удаление аккаунта</h2><p>Профиль и его данные будут удалены без возможности восстановления.</p></div>
      <form action={deleteAccountAction} onSubmit={event => { if (!window.confirm('Удалить аккаунт и все персональные данные? Это действие нельзя отменить.')) event.preventDefault(); }}><input type="hidden" name="confirmation" value="delete-account" /><DeleteButton /></form>
    </section>
  </div>;
}

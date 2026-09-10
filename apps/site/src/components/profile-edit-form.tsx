'use client';

import Image from 'next/image';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteAccountAction,
  updateProfileAction,
  type ProfileFormState,
} from '@/app/profile/actions';
import type { ProfileData } from '@/lib/profile';

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button className="primary-button profile-apply-button" type="submit" disabled={pending}>
      {pending ? 'Сохраняем…' : 'Применить'}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button className="profile-delete-button" type="submit" disabled={pending}>
      {pending ? 'Удаляем…' : 'Удалить аккаунт'}
      <Image src="/brand/icons/trash.svg" width={24} height={24} alt="" />
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="field-error" id={id}>
      {message}
    </p>
  ) : null;
}

export function ProfileEditForm({ profile }: { profile: ProfileData }) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) errorSummaryRef.current?.focus();
  }, [state]);

  return (
    <div className="profile-edit-panel">
      <form className="profile-edit-form" action={formAction}>
        <ApplyButton />

        {state.message ? (
          <div className="profile-form-error" ref={errorSummaryRef} role="alert" tabIndex={-1}>
            <h2>Не удалось применить изменения</h2>
            <p>{state.message}</p>
          </div>
        ) : null}

        <div className="profile-edit-field">
          <label htmlFor="username">Юзернейм</label>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue={`@${profile.username}`}
            autoComplete="username"
            minLength={3}
            maxLength={25}
            pattern="@?[A-Za-z0-9_]{3,24}"
            title="От 3 до 24 латинских букв, цифр или символов подчёркивания"
            aria-invalid={Boolean(state.fieldErrors?.username)}
            aria-describedby={state.fieldErrors?.username ? 'username-error' : 'username-help'}
            required
          />
          <p className="field-help" id="username-help">
            Латинские буквы, цифры и подчёркивание.
          </p>
          <FieldError id="username-error" message={state.fieldErrors?.username} />
        </div>

        <div className="profile-edit-field">
          <label htmlFor="name">Имя</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username}
            autoComplete="name"
            maxLength={40}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
            required
          />
          <FieldError id="name-error" message={state.fieldErrors?.name} />
        </div>

        <div className="profile-edit-field">
          <label htmlFor="email">Почта</label>
          <input id="email" type="email" value={profile.email} readOnly aria-readonly="true" />
          <p className="field-help">Почту нельзя изменить без повторного подтверждения.</p>
        </div>

        <div className="profile-edit-field">
          <label htmlFor="telegramChannel">Телеграм канал</label>
          <input
            id="telegramChannel"
            name="telegramChannel"
            type="text"
            defaultValue={profile.telegramChannel ? `t.me/${profile.telegramChannel}` : ''}
            placeholder="t.me/energyhub"
            autoComplete="url"
            maxLength={64}
            aria-invalid={Boolean(state.fieldErrors?.telegramChannel)}
            aria-describedby={state.fieldErrors?.telegramChannel ? 'telegram-error' : undefined}
          />
          <FieldError id="telegram-error" message={state.fieldErrors?.telegramChannel} />
        </div>
      </form>

      <section className="profile-danger-zone" aria-labelledby="danger-zone-title">
        <h2 id="danger-zone-title">Опасная зона</h2>
        <form
          action={deleteAccountAction}
          onSubmit={(event) => {
            if (!window.confirm('Удалить аккаунт и все персональные данные? Это действие нельзя отменить.')) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="confirmation" value="delete-account" />
          <DeleteButton />
        </form>
      </section>
    </div>
  );
}

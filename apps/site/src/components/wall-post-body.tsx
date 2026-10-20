'use client';

import { MentionText } from '@/components/mention-text';
import { MentionTextarea } from '@/components/mention-textarea';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { editWallPostAction } from '@/app/profile/community-actions';
import { EditIcon } from '@/components/action-icons';
import { DeleteWallComment } from '@/components/profile-community-controls';

interface WallPostBodyProps {
  id: string;
  text: string;
  heading: ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  children?: ReactNode;
}

/** Heading actions and text of a wall record; the author switches the text into an inline editor. */
export function WallPostBody({ id, text: initial, heading, canEdit, canDelete, children }: WallPostBodyProps) {
  const router = useRouter();
  const fieldId = useId();
  const [text, setText] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  function save() {
    setError('');
    startTransition(async () => {
      try {
        const result = await editWallPostAction(id, draft);
        if (result.error || result.text === undefined) { setError(result.error ?? 'Не удалось сохранить запись.'); return; }
        setText(result.text); setEditing(false);
        router.refresh();
      } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    });
  }
  return <>
    <header className="wall-comment-heading">
      {heading}
      {(canEdit || canDelete) && <div className="wall-post-actions">
        {canEdit && !editing && <button className="wall-action-button" type="button" aria-label="Редактировать запись" title="Редактировать запись" onClick={() => { setDraft(text); setError(''); setEditing(true); }}><EditIcon /></button>}
        {canDelete && <DeleteWallComment id={id} />}
      </div>}
    </header>
    {editing ? <form className="wall-post-edit" onSubmit={event => { event.preventDefault(); save(); }}>
      <label htmlFor={fieldId} className="sr-only">Текст записи</label>
      <MentionTextarea id={fieldId} value={draft} onValueChange={setDraft} maxLength={1000} rows={3} required autoFocus disabled={pending}
        onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }} />
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="community-form-footer"><span className="community-muted">{draft.length} / 1000</span><span className="wall-post-edit-buttons">
        <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => setEditing(false)}>Отмена</button>
        <button className="community-button" type="submit" disabled={pending || !draft.trim() || draft.trim() === text}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
      </span></div>
    </form> : text ? <p><MentionText text={text} /></p> : null}
    {children}
  </>;
}

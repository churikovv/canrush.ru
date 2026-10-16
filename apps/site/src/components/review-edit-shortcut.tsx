'use client';
import { createContext, useContext } from 'react';
import { EditIcon, TrashIcon } from '@/components/action-icons';

/** Window events the catalog review form listens to; fired from the author's own published card. */
export const REVIEW_EDIT_EVENT = 'canrush:edit-review';
export const REVIEW_DELETE_EVENT = 'canrush:delete-review';

/** Set by the profile reviews editor: the card's edit icon opens that review's own form instead. */
export const ReviewEditContext = createContext<(() => void) | null>(null);

export function ReviewEditShortcut() {
  const edit = useContext(ReviewEditContext);
  if (edit) return <button className="wall-action-button" type="button" aria-label="Редактировать свой отзыв" title="Редактировать отзыв" onClick={edit}><EditIcon /></button>;
  return <>
    <button className="wall-action-button" type="button" aria-label="Редактировать свой отзыв" title="Редактировать отзыв"
      onClick={() => window.dispatchEvent(new Event(REVIEW_EDIT_EVENT))}><EditIcon /></button>
    <button className="wall-action-button wall-delete-button" type="button" aria-label="Удалить свой отзыв" title="Удалить отзыв"
      onClick={() => window.dispatchEvent(new Event(REVIEW_DELETE_EVENT))}><TrashIcon /></button>
  </>;
}

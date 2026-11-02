'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useHistorySheet } from '@/components/history-sheet';
import { answersWord, questionsWord } from '@/lib/drink-question-fields';

/** The newest question as the card previews it; the date comes formatted, so the server and the browser agree. */
export interface LatestQuestion { author: string; avatarId: string | null; date: string; text: string; answers: number }

const QUESTION_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /><path d="M9.8 8.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.2M12 15.5h.01" /></svg>;

/**
 * «Вопросы и ответы» on the drink page: a card under the rating card (how many questions and the newest one) that opens
 * them in the same history-bound sheet as the reviews; `?tab=questions` (a notification, a feed link,
 * `#question-<id>`) opens it on arrival. The questions themselves are server-rendered children.
 */
export function CatalogQuestionsSheet({ count, title, initiallyOpen, latest, children }: { count: number; title: string; initiallyOpen: boolean; latest?: LatestQuestion | null; children: ReactNode }) {
  const { dialog, open, dismiss, cancel, backdrop } = useHistorySheet('questions', 'canrushQuestionsSheet', initiallyOpen);
  return <>
    <div className="catalog-rating-card catalog-questions-card">
      <a href="?tab=questions" className="catalog-rating-card-head" aria-haspopup="dialog" onClick={open}>
        <span className="catalog-questions-title"><span className="catalog-questions-icon">{QUESTION_ICON}</span><strong>Вопросы и ответы</strong></span>
        <span className="catalog-rating-card-count">{count > 0 ? `${count} ${questionsWord(count)}` : 'Спросите о вкусе, объёме или составе'}</span>
        <svg className="catalog-rating-card-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </a>
      {latest && <div className="catalog-rating-latest">
        <span className="catalog-rating-latest-head">
          <span className="catalog-rating-latest-avatar">{latest.avatarId ? <Image src={`/api/profile-images/${latest.avatarId}`} width={32} height={32} unoptimized alt="" /> : <span aria-hidden="true">{latest.author[0]?.toUpperCase()}</span>}</span>
          <b>{latest.author}</b>
          <small>{latest.date}</small>
        </span>
        <p>{latest.text}</p>
        <span className="catalog-questions-answers">{latest.answers > 0 ? `${latest.answers} ${answersWord(latest.answers)}` : 'Пока без ответа'}</span>
      </div>}
    </div>

    <dialog ref={dialog} className="catalog-reviews-sheet catalog-questions-sheet" aria-labelledby="catalog-questions-title" onCancel={cancel} onClick={backdrop}>
      <header className="catalog-reviews-sheet-head">
        <button type="button" className="catalog-reviews-sheet-back" aria-label="Назад к напитку" onClick={dismiss}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <h2 id="catalog-questions-title">Вопросы{count > 0 ? ` · ${count}` : ''}</h2>
          <p>{title}</p>
        </div>
      </header>
      <div className="catalog-reviews-sheet-body">{children}</div>
    </dialog>
  </>;
}

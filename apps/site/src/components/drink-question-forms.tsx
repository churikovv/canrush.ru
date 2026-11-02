'use client';
import { useActionState, useState, useTransition, type FormEvent } from 'react';
import { answerQuestionAction, askQuestionAction, deleteQuestionAction, type QuestionState } from '@/app/catalog/question-actions';
import { TrashIcon } from '@/components/action-icons';
import { ActionToast } from '@/components/action-toast';
import { ContentReportButton } from '@/components/content-report-button';
import { MoreActions } from '@/components/more-actions';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import { ANSWER_MAX, QUESTION_MAX, QUESTION_MIN } from '@/lib/drink-question-fields';
import { surviveNetworkError } from '@/lib/network-safe-action';

/** The sheet is a modal dialog in the top layer: a toast in `body` would sit under it, so it is drawn inside. */
const sheetOf = (node: HTMLElement | null) => node?.closest('dialog') ?? null;

/**
 * The composer of a question or an answer, on the comment composer's look. Sent by hand, not by the form's `action`:
 * React resets a form after an action, and a server error would wipe the text.
 */
function useComposer(action: (state: QuestionState, form: FormData) => Promise<QuestionState>, onSent?: () => void) {
  const [state, run, pending] = useActionState<QuestionState, FormData>(surviveNetworkError(action), {});
  const [, startSend] = useTransition();
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(state);
  // A new success empties the field (and closes an answer); an error keeps what was written.
  if (seen !== state) {
    setSeen(state);
    if (state.sent) { setText(''); onSent?.(); }
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData();
    form.set('text', text);
    startSend(() => run(form));
  }
  return { state, pending, text, setText, send };
}

/** «Задать вопрос» at the top of the sheet. */
export function QuestionForm({ brand, flavor }: { brand: string; flavor: string }) {
  const { state, pending, text, setText, send } = useComposer(askQuestionAction.bind(null, brand, flavor));
  const [node, setNode] = useState<HTMLFormElement | null>(null);
  const sheet = sheetOf(node);
  return <form ref={setNode} className="review-comment-composer drink-qa-composer" onSubmit={send}>
    <label htmlFor="drink-question-text">Ваш вопрос</label>
    <div className="review-text-composer">
      <textarea id="drink-question-text" value={text} onChange={event => setText(event.target.value)} maxLength={QUESTION_MAX} rows={2} disabled={pending}
        placeholder="Например: бывает ли в банке 0,25? Сильно сладкий?" />
      <div className="review-composer-toolbar"><span /><span className="review-composer-count">{text.length} / {QUESTION_MAX}</span></div>
    </div>
    <button className="community-button review-composer-submit" type="submit" disabled={pending || text.trim().length < QUESTION_MIN}>{pending ? 'Отправляем…' : 'Задать вопрос'}</button>
    <ActionToast message={state.sent ? 'Вопрос опубликован' : undefined} trigger={state} container={sheet} />
    <ActionToast tone="error" message={state.error} trigger={state} container={sheet} />
  </form>;
}

/** «Ответить» under a question: the composer opens in place and closes after the answer is published. */
export function AnswerForm({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, text, setText, send } = useComposer(answerQuestionAction.bind(null, questionId), () => setOpen(false));
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const sheet = sheetOf(node);
  return <div ref={setNode} className="drink-qa-answer-box">
    {open ? <form className="review-comment-composer drink-qa-composer" onSubmit={send}>
      <label htmlFor={`answer-${questionId}`}>Ваш ответ</label>
      <div className="review-text-composer">
        {/* Opened by a tap on «Ответить»: the field is what comes next. */}
        <textarea id={`answer-${questionId}`} value={text} onChange={event => setText(event.target.value)} maxLength={ANSWER_MAX} rows={2} disabled={pending} autoFocus placeholder="Поделитесь тем, что знаете" />
        <div className="review-composer-toolbar"><span /><span className="review-composer-count">{text.length} / {ANSWER_MAX}</span></div>
      </div>
      <div className="drink-qa-composer-actions">
        <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => setOpen(false)}>Отмена</button>
        <button className="community-button review-composer-submit" type="submit" disabled={pending || !text.trim()}>{pending ? 'Отправляем…' : 'Ответить'}</button>
      </div>
    </form> : <button type="button" className="drink-qa-reply" onClick={() => setOpen(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v5" /></svg>Ответить
    </button>}
    <ActionToast message={state.sent ? 'Ответ опубликован' : undefined} trigger={state} container={sheet} />
    <ActionToast tone="error" message={state.error} trigger={state} container={sheet} />
  </div>;
}

/** «⋯» of a question or an answer: the author deletes it, others report it, staff delete it in place. */
export function QuestionMenu({ kind, id, own, staff }: { kind: 'question' | 'answer'; id: string; own: boolean; staff: boolean }) {
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm(kind === 'question' ? 'Удалить вопрос вместе с ответами?' : 'Удалить ответ?')) return;
    startTransition(async () => {
      const result = await deleteQuestionAction(kind, id);
      if (result.error) window.alert(result.error);
    });
  }
  return <MoreActions label={kind === 'question' ? 'Действия с вопросом' : 'Действия с ответом'}>
    {own ? <button className="more-actions-item is-danger" type="button" role="menuitem" disabled={pending} onClick={remove}><TrashIcon /><span>Удалить</span></button>
      : <>
        <ContentReportButton kind={kind === 'question' ? 'drink-question' : 'drink-answer'} id={id} variant="menuitem" />
        {staff && <StaffDeleteMenuItem kind={kind === 'question' ? 'drink-question' : 'drink-answer'} id={id} />}
      </>}
  </MoreActions>;
}

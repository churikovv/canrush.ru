import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AnswerForm, QuestionForm, QuestionMenu } from '@/components/drink-question-forms';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { VerifiedMark } from '@/components/verified-mark';
import { displayName } from '@/components/wall-post';
import { QUESTIONS_SHOWN } from '@/lib/drink-question-fields';
import type { DrinkQuestion, QuestionAuthor } from '@/lib/drink-questions';
import { profileTagKey, profileTagLabel } from '@/lib/profile-achievements';
import { ProfileTag } from '@/components/profile-tag';

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

/** Avatar, name, tag and date of a question or an answer; an answer of the drink's company carries its name. */
function AuthorRow({ author, at, company }: { author: QuestionAuthor; at: Date; company?: string | null }) {
  const href = `/profile/${author.username}`;
  const name = displayName(author);
  const tag = profileTagKey(author.tag);
  return <div className="drink-qa-author">
    <Link className="drink-qa-avatar" href={href} tabIndex={-1} aria-hidden="true">
      {author.avatarId ? <Image src={`/api/profile-images/${author.avatarId}`} width={32} height={32} unoptimized alt="" /> : name.slice(0, 1).toLocaleUpperCase('ru-RU')}
    </Link>
    <span className="drink-qa-who">
      <span className="drink-qa-name"><Link href={href}>{name}</Link>{author.verified && <VerifiedMark />}{tag && <ProfileTag tag={tag}>{profileTagLabel(tag)}</ProfileTag>}</span>
      <span className="drink-qa-meta">{company && <b className="drink-qa-company">Компания «{company}»</b>}<time dateTime={at.toISOString()}>{DATE.format(at)}</time></span>
    </span>
  </div>;
}

/**
 * The questions sheet's body: «Задать вопрос» (a sign-in prompt for guests), then the newest questions, each with its
 * answers and «Ответить». `#question-<id>` from a notification or the feed scrolls to its question.
 */
export function CatalogProductQuestions({ brand, flavor, questions, total, viewerId, staff }: { brand: string; flavor: string; questions: DrinkQuestion[]; total: number; viewerId: string | null; staff: boolean }) {
  return <div className="drink-qa">
    {viewerId ? <QuestionForm brand={brand} flavor={flavor} /> : <SignInPrompt title="Задайте вопрос о напитке" text="Войдите, чтобы спросить участников и бренд, и отвечать другим." />}
    {questions.length ? <ol className="drink-qa-list">{questions.map(question => <li key={question.id} id={`question-${question.id}`} className="drink-qa-question">
      <div className="drink-qa-head"><AuthorRow author={question} at={question.createdAt} />{viewerId && <QuestionMenu kind="question" id={question.id} own={viewerId === question.userId} staff={staff} />}</div>
      <p className="drink-qa-text">{question.text}</p>
      {question.answers.length > 0 && <ul className="drink-qa-answers" aria-label="Ответы">{question.answers.map(answer => <li key={answer.id} id={`answer-${answer.id}`} data-company={answer.company ? '' : undefined}>
        <div className="drink-qa-head"><AuthorRow author={answer} at={answer.createdAt} company={answer.company} />{viewerId && <QuestionMenu kind="answer" id={answer.id} own={viewerId === answer.userId} staff={staff} />}</div>
        <p className="drink-qa-text">{answer.text}</p>
      </li>)}</ul>}
      {viewerId && <AnswerForm questionId={question.id} />}
    </li>)}</ol>
      : <div className="review-thread-empty" role="status">
        <span className="review-thread-empty-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /><path d="M9.8 8.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.2M12 15.5h.01" /></svg></span>
        <strong>Вопросов пока нет</strong>
        <span>Спросите первым: отвечают участники, а команда бренда — с пометкой компании.</span>
      </div>}
    {total > QUESTIONS_SHOWN && <p className="drink-qa-more">Показаны последние {QUESTIONS_SHOWN} из {total}.</p>}
  </div>;
}

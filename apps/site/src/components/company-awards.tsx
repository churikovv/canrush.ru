'use client';
import { useActionState, useEffect, useRef, useState, useTransition, type DragEvent, type FormEvent } from 'react';
import { createCompanyAwardAction, deleteCompanyAwardAction, type CompanyActionState } from '@/app/company/actions';
import { TrashIcon } from '@/components/action-icons';
import { ContentReportButton } from '@/components/content-report-button';
import { FormAlert } from '@/components/form-alert';
import { MoreActions } from '@/components/more-actions';
import { PdfPages } from '@/components/pdf-pages';
import { PhotoViewer } from '@/components/review-photo-gallery';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import type { CompanyAward } from '@/lib/business-profile';
import { fileSizeLabel, MAX_AWARD_ISSUER, MAX_AWARD_TITLE, MAX_PDF_BYTES } from '@/lib/business-profile-fields';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';

const MEDAL = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8" /></svg>;
const PDF_ICON = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;

const isPdfFile = (file: File) => file.type === 'application/pdf' || /\.pdf$/iu.test(file.name);
const isPicture = (file: File) => REVIEW_PHOTO_TYPES.includes(file.type);

/** What is wrong with a picked file, before it uploads; the server checks the content again. */
function fileProblem(file: File): string | null {
  if (isPdfFile(file)) return file.size > MAX_PDF_BYTES ? 'PDF — до 20 МБ.' : null;
  if (!isPicture(file)) return 'Нужен PDF или картинка JPG, PNG, WebP.';
  return file.size > MAX_REVIEW_PHOTO_BYTES ? 'Картинка — до 5 МБ.' : null;
}

/**
 * «Награды» grid: a picture opens in the same full-screen viewer as photos, a PDF opens whole above the grid (a phone
 * and the apps show no PDF in a frame, so pdf.js draws its pages here).
 */
export function CompanyAwards({ businessId, awards, editor, signedIn, staff }: { businessId: string; awards: CompanyAward[]; editor: boolean; signedIn: boolean; staff: boolean }) {
  const pictures = awards.filter(award => award.kind === 'image').map(award => award.id);
  const [photo, setPhoto] = useState<number | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const reader = useRef<HTMLDivElement>(null);
  const pdf = awards.find(award => award.id === pdfId && award.kind === 'pdf');
  useEffect(() => { if (pdfId) reader.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [pdfId]);
  return <>
    {pdf && <div ref={reader} className="company-award-reader">
      <div className="company-section-head"><h3>{pdf.title}</h3><button type="button" className="company-award-close" onClick={() => setPdfId(null)}>Закрыть</button></div>
      <PdfPages key={pdf.id} src={`/api/business-awards/${pdf.id}`} title={pdf.fileName ?? pdf.title} />
      <a className="company-file" href={`/api/business-awards/${pdf.id}`} target="_blank" rel="noopener">
        <span className="company-file-icon">{PDF_ICON}</span>
        <span className="company-file-text"><strong>{pdf.fileName}</strong><small>PDF · {fileSizeLabel(pdf.fileSize)}</small></span>
        <span className="company-file-open">Открыть</span>
      </a>
    </div>}
    <ul className="company-awards">{awards.map(award => <li key={award.id} className="company-award">
      <button type="button" className="company-award-open" aria-label={`Открыть награду «${award.title}»`}
        onClick={() => award.kind === 'pdf' ? setPdfId(award.id) : setPhoto(pictures.indexOf(award.id))}>
        <span className="company-award-media" data-kind={award.kind}>
          {award.kind === 'image'
            // eslint-disable-next-line @next/next/no-img-element -- served from the database
            ? <img src={`/api/business-awards/${award.id}?thumb`} alt="" loading="lazy" />
            : <span className="company-award-sheet">{PDF_ICON}<b>PDF</b></span>}
          <span className="company-award-medal">{MEDAL}</span>
        </span>
        <strong>{award.title}</strong>
        {(award.issuer || award.year) && <small>{[award.issuer, award.year].filter(Boolean).join(' · ')}</small>}
      </button>
      <span className="company-award-menu"><CompanyAwardMenu businessId={businessId} awardId={award.id} editor={editor} signedIn={signedIn} staff={staff} /></span>
    </li>)}</ul>
    {photo !== null && <PhotoViewer photos={pictures} initialIndex={photo} source="business-awards" label="Награда компании" onClose={() => setPhoto(null)} />}
  </>;
}

/** An award's «⋯»: the team deletes it, others report it, staff delete it as moderators. */
function CompanyAwardMenu({ businessId, awardId, editor, signedIn, staff }: { businessId: string; awardId: string; editor: boolean; signedIn: boolean; staff: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!editor && !signedIn) return null;
  function remove() {
    if (!window.confirm('Удалить награду из профиля компании?')) return;
    startTransition(async () => {
      const result = await deleteCompanyAwardAction(businessId, awardId);
      if (result.error) window.alert(result.error);
    });
  }
  return <MoreActions label="Действия с наградой">
    {editor ? <button className="more-actions-item is-danger" type="button" role="menuitem" disabled={pending} onClick={remove}><TrashIcon /><span>Удалить</span></button>
      : <>
        <ContentReportButton kind="business-award" id={awardId} variant="menuitem" />
        {staff && <StaffDeleteMenuItem kind="business-award" id={awardId} />}
      </>}
  </MoreActions>;
}

/**
 * The team's upload: the same drop zone as presentations, for a PDF or a picture, then the award's name, who gave it
 * and the year. The form is sent by hand: after an action React clears a file input, and a server error would leave
 * the card showing a file that is no longer there.
 */
export function CompanyAwardForm({ businessId, hasAwards }: { businessId: string; hasAwards: boolean }) {
  const [state, action, pending] = useActionState<CompanyActionState, FormData>(createCompanyAwardAction.bind(null, businessId), {});
  const [, startSend] = useTransition();
  const [open, setOpen] = useState(!hasAwards);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // dragenter and dragleave fire for every child the file passes over: count them, so the zone does not flicker.
  const depth = useRef(0);

  function pick(next: File | null) {
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (input.current) input.current.value = '';
    const problem = next && fileProblem(next);
    if (problem) setError(problem);
    setFile(problem ? null : next);
    if (next && !problem && isPicture(next)) setPreview(URL.createObjectURL(next));
  }
  useEffect(() => {
    if (!state.saved) return;
    const timer = window.setTimeout(() => { pick(null); setTitle(''); setIssuer(''); setYear(''); setOpen(false); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new answer from the server clears the form
  }, [state]);
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    if (!pending) pick(event.dataTransfer.files[0] ?? null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('title', title);
    form.set('issuer', issuer);
    form.set('year', year);
    startSend(() => action(form));
  }

  if (!open) return <button type="button" className="community-button community-button-secondary company-deck-upload" onClick={() => setOpen(true)}>{MEDAL}Добавить награду</button>;
  return <form className="company-composer" onSubmit={submit}>
    <input ref={input} id="company-award-file" type="file" accept={`application/pdf,.pdf,${REVIEW_PHOTO_TYPES.join(',')}`} className="sr-only" disabled={pending} onChange={event => pick(event.target.files?.[0] ?? null)} />
    {file ? <div className="company-drop is-ready" aria-live="polite">
      {preview
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        ? <img className="company-award-preview" src={preview} alt="" />
        : <span className="company-drop-done" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>}
      <span className="company-drop-file"><strong>{file.name}</strong><small>{isPdfFile(file) ? 'PDF' : 'Картинка'} · {fileSizeLabel(file.size)}</small></span>
      <span className="company-drop-actions">
        <label className="company-drop-link" htmlFor="company-award-file">Заменить</label>
        <button type="button" className="company-drop-link is-danger" onClick={() => pick(null)} disabled={pending}>Убрать</button>
      </span>
    </div>
      : <label className="company-drop" htmlFor="company-award-file" data-over={over || undefined}
        onDragEnter={event => { event.preventDefault(); depth.current += 1; setOver(true); }}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
        onDrop={drop}>
        <span className="company-drop-art" aria-hidden="true">
          <span className="company-drop-sheet is-award">{MEDAL}</span>
          <span className="company-drop-arrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg></span>
        </span>
        <strong className="company-drop-title"><span className="is-pointer">{over ? 'Отпускайте — загрузим' : 'Перетащите диплом или сертификат сюда'}</span><span className="is-touch">Нажмите, чтобы выбрать диплом или сертификат</span></strong>
        <span className="company-drop-hint"><span className="is-pointer">или нажмите, чтобы выбрать файл · </span>PDF до 20 МБ · JPG, PNG, WebP до 5 МБ</span>
      </label>}
    {file && <div className="company-award-fields">
      <label>Название награды
        <input value={title} onChange={event => setTitle(event.target.value)} maxLength={MAX_AWARD_TITLE} required disabled={pending} placeholder="Лучший продукт года" />
      </label>
      <label>Кто вручил <small>необязательно</small>
        <input value={issuer} onChange={event => setIssuer(event.target.value)} maxLength={MAX_AWARD_ISSUER} disabled={pending} placeholder="Продэкспо" />
      </label>
      <label>Год <small>необязательно</small>
        <input value={year} onChange={event => setYear(event.target.value.replace(/\D/gu, ''))} inputMode="numeric" maxLength={4} disabled={pending} placeholder="2026" />
      </label>
    </div>}
    {(error || state.error) && <FormAlert>{error || state.error}</FormAlert>}
    {file && <button className="community-button company-publish" type="submit" disabled={pending || !title.trim()}>{pending ? 'Загружаем…' : 'Добавить награду'}</button>}
  </form>;
}

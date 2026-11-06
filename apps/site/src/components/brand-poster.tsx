import Image from 'next/image';
import { cutoutSrc } from '@/lib/can-cutout-src';
import { MARK_PATHS, MARK_VIEWBOX } from '@/lib/canrush-mark';
import { BADGE_MIN_REVIEWS, LABELS_PER_SHEET, printedAddress, targetReviewLink, type MaterialTarget, type PosterFormat } from '@/lib/brand-materials-fields';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { qrCode, qrPath } from '@/lib/qr-code';
import { badgeScore } from '@/lib/rating-badge';

/** The code itself: black on white whatever the theme, crisp edges — a printer and a phone camera both like it. */
export function QrCodeImage({ value, label, className }: { value: string; label: string; className?: string }) {
  const { d, side } = qrPath(qrCode(value));
  return <svg className={className} viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
    <rect width={side} height={side} fill="#fff" /><path d={d} fill="#000" />
  </svg>;
}

function Mark({ className }: { className: string }) {
  return <svg className={className} viewBox={MARK_VIEWBOX} aria-hidden="true">{MARK_PATHS.map(d => <path key={d.slice(0, 24)} d={d} />)}</svg>;
}

/** A can without its shop background when the cover is ours; another site's photo stays as it is. */
function Can({ cover }: { cover: string }) {
  const cut = cutoutSrc(cover);
  return cut
    // eslint-disable-next-line @next/next/no-img-element -- the cutout route already serves a sized WebP
    ? <img className="poster-can" src={cut} alt="" />
    : <Image className="poster-can is-photo" src={cover} alt="" width={320} height={320} />;
}

export interface PosterProps {
  target: MaterialTarget;
  covers: string[];
  rating: { reviews: number; score: number };
  format: PosterFormat;
}

/**
 * The printed QR poster of «QR и значок»: an A4 sheet for a shelf or a till, or eight labels to cut out. All sizes are in
 * `cqw` of the sheet, so the preview on a phone and the print on paper are the same picture. The code leads to the
 * drink's reviews with the form open (`targetReviewLink`).
 */
export function BrandPoster({ target, covers, rating, format }: PosterProps) {
  const link = targetReviewLink(target);
  const name = target.kind === 'drink' ? target.name : target.brand;
  const qrLabel = `QR-код: ${name} на CanRush`;
  if (format === 'labels') {
    return <article className="poster-sheet is-labels" aria-label={`Наклейки «${name}»`}>
      {Array.from({ length: LABELS_PER_SHEET }, (_, index) => <div key={index} className="poster-label">
        <QrCodeImage className="poster-label-qr" value={link} label={qrLabel} />
        <div className="poster-label-text">
          <span className="poster-label-brand"><Mark className="poster-mark" />CanRush</span>
          <strong>Оцените {target.kind === 'drink' ? 'этот вкус' : name}</strong>
          <span>{target.kind === 'drink' ? target.name : 'Все вкусы бренда'}</span>
          <small>Наведите камеру на код</small>
        </div>
      </div>)}
    </article>;
  }
  const rated = rating.reviews >= BADGE_MIN_REVIEWS;
  return <article className="poster-sheet is-a4" aria-label={`Плакат «${name}»`}>
    <header className="poster-head">
      <span className="poster-logo"><Mark className="poster-mark" /><span className="poster-wordmark" role="img" aria-label="CanRush" /></span>
      <span className="poster-age" title="Сайт для тех, кому есть 18">18+</span>
    </header>
    <div className="poster-cans" data-count={covers.length}>{covers.map(cover => <Can key={cover} cover={cover} />)}</div>
    <h1 className="poster-title">{target.kind === 'drink' ? 'Как вам этот вкус?' : `Как вам ${target.brand}?`}</h1>
    <p className="poster-name">{target.kind === 'drink' ? target.name : 'Оцените любимые вкусы бренда'}</p>
    <div className="poster-qr">
      <QrCodeImage className="poster-qr-code" value={link} label={qrLabel} />
      <p><b>Наведите камеру телефона</b>и оцените вкус и дизайн банки — отзыв поможет другим выбрать.</p>
    </div>
    <p className="poster-url">{printedAddress(target)}</p>
    <footer className="poster-foot">{rated
      ? <>Оценка участников CanRush <b>{badgeScore(rating.score)}</b> из 10 · {new Intl.NumberFormat('ru-RU').format(rating.reviews)} {pluralRu(rating.reviews, 'отзыв', 'отзыва', 'отзывов')}</>
      : 'Станьте первым, кто оценит, — на CanRush'}</footer>
  </article>;
}

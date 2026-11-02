const LABEL = 'Ведёт сообщество. Проверено CanRush';

/** Галочка у имени участника, который ведёт сообщество: такая же, как у компаний. Цвет задан прямо: в темах профиля `--color-brand` бывает почти белым. */
export function VerifiedMark() {
  return <span className="verified-mark" role="img" title={LABEL} aria-label={LABEL}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg>
  </span>;
}

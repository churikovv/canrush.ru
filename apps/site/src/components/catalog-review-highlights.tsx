/** What reviews praise and complain about (the drink's review summary), without its source. */
export interface ReviewHighlights { praise: string[]; complaints: string[] }

const THUMB = 'M7 10.5v9.5H4v-9.5zM7 10.5l3.6-6.6c1.5 0 2.5 1.2 2.2 2.6l-.6 3.5h6.1a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.1 20H7';
const HIGHLIGHTS = [
  { key: 'praise', title: 'Хвалят', tone: 'good', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={THUMB} /></svg> },
  { key: 'complaints', title: 'Жалуются', tone: 'bad', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d={THUMB} /></svg> },
] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «Что говорят» on the drink page: its own card, the entrance to the reviews stays above it. */
export function CatalogReviewHighlights({ highlights }: { highlights: ReviewHighlights }) {
  if (!highlights.praise.length && !highlights.complaints.length) return null;
  return <section className="catalog-highlights-card" aria-labelledby="catalog-highlights-title">
    <h2 id="catalog-highlights-title">Что говорят</h2>
    <div className="catalog-rating-highlights">
      {HIGHLIGHTS.map(({ key, title, tone, icon }) => highlights[key].length > 0 && <section key={key} data-tone={tone}>
        <h3><span aria-hidden="true">{icon}</span>{title}</h3>
        <ul>{highlights[key].map(item => <li key={item}>{capitalize(item)}</li>)}</ul>
      </section>)}
    </div>
  </section>;
}

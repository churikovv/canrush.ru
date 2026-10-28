/** The cabinet's KPI card, shared by the cabinet and the landing's preview of it (`HeroCabinet`). */
const number = new Intl.NumberFormat('ru-RU');

export const KPI_ICONS = {
  reviews: <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />,
  taste: <path d="M12 3c3 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 3-6 6-10Z" />,
  design: <path d="M8 2h8l-1 4H9L8 2Zm1 4h6l1 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-3Z" />,
  heart: <path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 9-2 4.6 4.6 0 0 1 9 2c-2 4.6-9 9-9 9Z" />,
  skip: <path d="M18 6 6 18M6 6l12 12" />,
  catalog: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  box: <path d="M3 7 12 3l9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10" />,
  bag: <path d="M3 9h18l-1.5 11h-15L3 9Zm5 0V7a4 4 0 0 1 8 0v2" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  name: <path d="M4 7V5h16v2M9 19h6M12 5v14" />,
  miss: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  tap: <path d="M9 11V5a2 2 0 0 1 4 0v5l4.4 1a2 2 0 0 1 1.6 2.3l-.9 5A2 2 0 0 1 16.1 20H11a2 2 0 0 1-1.6-.8L5.6 14a1.6 1.6 0 0 1 2.4-2.1L9 13" />,
  ratio: <path d="M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
};

/** A KPI card like the reference: an icon in a raised square, the number with its change in colour, the label below. */
export function Kpi({ icon, value, label, delta, deltaLabel }: { icon: keyof typeof KPI_ICONS; value: string; label: string; delta?: number | null; deltaLabel?: string }) {
  return <div className="bc-kpi">
    <span className="bc-kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{KPI_ICONS[icon]}</svg></span>
    <div className="bc-kpi-value"><strong>{value}</strong>{delta !== undefined && delta !== null && <b data-trend={delta > 0 ? 'up' : delta < 0 ? 'down' : undefined}>{delta > 0 ? '+' : ''}{number.format(delta)}{deltaLabel}</b>}</div>
    <span className="bc-kpi-label">{label}</span>
  </div>;
}

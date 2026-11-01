/** Ценник — валюта охоты за магазинами: золотой ярлык с дыркой, как на полке, и молния CanRush. Цвета заданы здесь, без CSS. */
export function TagIcon({ size = 20 }: { size?: number }) {
  return <svg className="hunt-tag-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#ffc94d" stroke="#7a4d08" strokeWidth="1.2" strokeLinejoin="round" d="M3 6.5A2.5 2.5 0 0 1 5.5 4H15l6 8-6 8H5.5A2.5 2.5 0 0 1 3 17.5Z" />
    <circle cx="16" cy="12" r="1.7" fill="#7a4d08" />
    <path fill="#7a4d08" d="M10.6 7 6.8 12.6h2.6l-.7 4.4 3.9-5.8H10Z" />
  </svg>;
}

export function ShirtIcon({ size = 44 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 3 3 6.5l2 3.6 2-1V21h10V9.1l2 1 2-3.6L15.5 3a3.6 3.6 0 0 1-7 0Z" /></svg>;
}

export function MugIcon({ size = 44 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h12v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" /><path d="M16 9h2.2A2.8 2.8 0 0 1 21 11.8v.4a2.8 2.8 0 0 1-2.8 2.8H16" /></svg>;
}

export function CardIcon({ size = 44 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></svg>;
}

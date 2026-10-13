'use client';
import { Children, useId, useState, type ReactNode } from 'react';

export function CatalogVolumeTabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const [active, setActive] = useState(0);
  const id = useId();
  return <div className="catalog-volume-card">
    <div className="catalog-volume-tabs" role="tablist" aria-label="Объём напитка">
      {labels.map((label, index) => <button key={label} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % labels.length : event.key === 'ArrowLeft' ? (index + labels.length - 1) % labels.length : event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1 : null;
        if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
      }}>{label}</button>)}
    </div>
    {Children.toArray(children).map((child, index) => <div key={index} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active !== index}>{child}</div>)}
  </div>;
}

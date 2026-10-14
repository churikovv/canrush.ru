/** Numbered step header for multi-section forms (store and market listing editors); styles `.form-card`/`.form-step` in globals.css. */
export function FormStep({ n, id, title, hint, optional }: { n: number; id: string; title: string; hint: string; optional?: boolean }) {
  return <header className="form-step"><span className="form-step-number" aria-hidden="true">{n}</span><div><h2 id={id}>{title}{optional && <FormOptional />}</h2><p>{hint}</p></div></header>;
}

export function FormOptional() {
  return <span className="form-optional">необязательно</span>;
}

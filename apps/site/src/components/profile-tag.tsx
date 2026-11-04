import type { ReactNode } from 'react';

/**
 * A member's tag that glows from inside in its own colours, AI-assistant style: soft light drifts slowly round the inner
 * edge of the chip and fades towards the middle, so nothing covers the text or the content around (`.tag-glow` — two
 * conic gradients turning opposite ways under a soft edge mask). The chip keeps its own look (`.profile-tag[data-tag=…]`
 * in globals.css, ::before and ::after for its effects) and gets an outline in the same colours (`.tag-edge`). Every
 * tag on the site renders through here.
 */
export function ProfileTag({ tag, href, title, children }: { tag: string | null | undefined; href?: string; title?: string; children: ReactNode }) {
  const key = tag ?? undefined;
  // The glow, then the tag's outline over it: a thin gradient in the same colours along the chip's own edge.
  const glow = <><span className="tag-glow" aria-hidden="true"><i /><i /></span><span className="tag-edge" aria-hidden="true" /></>;
  return <span className="tag-wave" data-tag={key}>
    {href
      ? <a className="profile-tag" data-tag={key} href={href} title={title}>{glow}{children}</a>
      : <span className="profile-tag" data-tag={key} title={title}>{glow}{children}</span>}
  </span>;
}

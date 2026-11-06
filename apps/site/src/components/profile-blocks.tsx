import { Children, type ReactElement, type ReactNode } from 'react';
import { marketOpenFor } from '@/lib/market-open';
import { DEFAULT_PROFILE_LAYOUT, isRequiredProfileBlock, type ProfileLayout, type ProfileBlockKey } from '@/lib/profile-layout';
export function ProfileBlock({ children }: { block: ProfileBlockKey; children: ReactNode }) { return children; }
export function ProfileBlocks({ children, layout = DEFAULT_PROFILE_LAYOUT }: { children: ReactNode; layout?: ProfileLayout }) {
  const blocks = Children.toArray(children) as ReactElement<{ block: ProfileBlockKey }>[];
  // The listings block is the member's personal listings: not drawn while they don't sell personally (market closed,
  // or only companies sell), whatever the layout says (the layout keeps it).
  return blocks.filter(child => marketOpenFor('member') || child.props.block !== 'listings').filter(child => isRequiredProfileBlock(child.props.block) || !layout.hidden.includes(child.props.block)).sort((a, b) => layout.order.indexOf(a.props.block) - layout.order.indexOf(b.props.block));
}

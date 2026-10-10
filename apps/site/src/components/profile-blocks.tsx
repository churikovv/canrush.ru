import { Children, type ReactElement, type ReactNode } from 'react';
import { DEFAULT_PROFILE_LAYOUT, type ProfileLayout, type ProfileBlockKey } from '@/lib/profile-layout';
export function ProfileBlock({ children }: { block: ProfileBlockKey; children: ReactNode }) { return children; }
export function ProfileBlocks({ children, layout = DEFAULT_PROFILE_LAYOUT }: { children: ReactNode; layout?: ProfileLayout }) {
  const blocks = Children.toArray(children) as ReactElement<{ block: ProfileBlockKey }>[];
  return blocks.filter(child => !layout.hidden.includes(child.props.block)).sort((a, b) => layout.order.indexOf(a.props.block) - layout.order.indexOf(b.props.block));
}

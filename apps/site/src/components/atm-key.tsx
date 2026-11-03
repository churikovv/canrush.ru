import type { ReactNode } from 'react';
import { CapIcon } from '@/components/gacha-icons';

/**
 * The key of «Банкомат», its own look rather than the shared `.game-btn` (battles, giveaways) or `.can-btn` (hunt, pass):
 * a machine key in a chrome bezel with a coin slot on the left, where a cap — the machine's currency — drops every few
 * seconds (three at once for ×10). The element itself carries `atm-key` and `data-tone` (a link, a button, or a
 * decorative span inside a link); this is what goes inside it. Server-safe: no client code.
 */
export function AtmKeyFace({ label, price, coins = 1 }: { label: ReactNode; price?: ReactNode; coins?: 1 | 3 }) {
  return <span className="atm-key-face">
    <span className="atm-key-slot" aria-hidden="true">
      <span className="atm-key-coin" data-coins={coins}>{Array.from({ length: coins }, (_, index) => <CapIcon key={index} size={22} />)}</span>
    </span>
    <span className="atm-key-text"><span className="atm-key-label">{label}</span>{price && <span className="atm-key-price">{price}</span>}</span>
  </span>;
}

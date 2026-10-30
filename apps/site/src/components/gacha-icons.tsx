/** The Банкомат currencies: shared by the machine (client) and the home banner (server). */
/** Крышка — валюта Банкомата. */
export function CapIcon({ size = 18 }: { size?: number }) {
  return <svg className="gacha-cap-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2.5 14 4l2.4-.5 1 2.2 2.3.9-.3 2.4L21 11l-1.6 1.8.3 2.4-2.3.9-1 2.2L14 18l-2 1.5L10 18l-2.4.3-1-2.2-2.3-.9.3-2.4L3 11l1.6-2-.3-2.4 2.3-.9 1-2.2L10 4Z" />
    <circle cx="12" cy="11" r="4.2" fill="var(--gacha-cap-core, #fff)" />
  </svg>;
}

/** Осколок — валюта крафта: собирается из дублей. */
export function ShardIcon({ size = 16 }: { size?: number }) {
  return <svg className="gacha-shard-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2 20 9 12 22 4 9Z" /><path fill="#fff" opacity=".45" d="M12 2 15 9H9Z" />
  </svg>;
}

/** Подарочная крутка из раздачи в ленте. */
export function SpinIcon({ size = 18 }: { size?: number }) {
  return <svg className="gacha-spin-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V10a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V14a2 2 0 0 0 0-4Z" />
    <path fill="var(--gacha-spin-core, #fff)" d="m12 7.6 1.3 2.8 3 .4-2.2 2.1.6 3-2.7-1.5-2.7 1.5.6-3-2.2-2.1 3-.4Z" />
  </svg>;
}

/** Two speech bubbles: the community chat's button and the panel's header. */
export function ChatBubblesIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 4h9A1.5 1.5 0 0 1 15 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.2 2.6V13H4.5A1.5 1.5 0 0 1 3 11.5v-6A1.5 1.5 0 0 1 4.5 4Z" />
    <path d="M15 9h4.5A1.5 1.5 0 0 1 21 10.5v6a1.5 1.5 0 0 1-1.5 1.5H18v2.6L14.8 18H10.5A1.5 1.5 0 0 1 9 16.5V15" />
  </svg>;
}

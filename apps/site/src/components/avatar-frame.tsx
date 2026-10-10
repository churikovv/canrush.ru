import type { ProfileAppearance } from '@/lib/profile-appearance';

// Stable preset keys preserve previously saved selections.
export function AvatarFrame({ frame }: { frame: ProfileAppearance['frame'] }) {
  if (frame === 'none') return null;
  return <svg className={`avatar-frame avatar-frame-${frame}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    {frame === 'orbit' ? <>
      <path className="frame-accent frame-accent-one" d="m18 9-9 17h8l-3 13 17-21h-10l5-9z" fill="currentColor" />
      <path className="frame-accent frame-accent-two" d="m83 62-13 19h10l-4 13 16-21h-10l7-11z" fill="currentColor" />
    </> : frame === 'pulse' ? <>
      <path className="frame-accent frame-accent-one" d="m19 8 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="currentColor" />
      <path className="frame-accent frame-accent-two" d="m81 71 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" />
      <circle className="frame-accent frame-accent-three" cx="86" cy="25" r="2.5" fill="currentColor" />
    </> : <>
      <g className="frame-accent frame-accent-one" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m6 31 16-6M5 40l13-5M8 49l8-3" /></g>
      <g className="frame-accent frame-accent-two" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m79 65 16-6M83 73l12-5M84 81l8-3" /></g>
    </>}
  </svg>;
}

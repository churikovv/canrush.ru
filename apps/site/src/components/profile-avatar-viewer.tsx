'use client';
import { useState, type ReactNode } from 'react';
import { PhotoViewer } from '@/components/review-photo-gallery';

/** The profile avatar as a button: opens the full-size photo over the page, with pinch, wheel and double-tap zoom. */
export function ProfileAvatarViewer({ avatarId, name, children }: { avatarId: string; name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="community-avatar-open" aria-label={`Открыть аватар ${name}`} onClick={() => setOpen(true)}>{children}</button>
    {open && <PhotoViewer source="profile-images" photos={[avatarId]} initialIndex={0} label={`Аватар ${name}`} onClose={() => setOpen(false)} />}
  </>;
}

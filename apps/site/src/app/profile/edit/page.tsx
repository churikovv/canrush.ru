import { redirect } from 'next/navigation';

/** Profile editing moved into the settings hub (the header's gear); old links keep the open section. */
export default async function ProfileEditPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  redirect(section ? `/profile/settings?section=${encodeURIComponent(section)}` : '/profile/settings');
}

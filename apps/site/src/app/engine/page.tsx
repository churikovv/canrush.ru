import '@/styles/shared.css';
import '@/styles/pass.css';
import '@/styles/engine.css';
import { headers } from 'next/headers';
import { EngineScreen } from '@/components/engine-screen';
import { auth } from '@/lib/auth';
import { BETA_ENGINE_PLACES, getBetaEngine, getEngineCrew } from '@/lib/beta-engine';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({
  title: 'Двигатель беты',
  description: `Первые ${BETA_ENGINE_PLACES} участников CanRush получают тег «Двигатель» и личный номер навсегда.`,
  path: '/engine',
});

/** The whole screen is the engine on its stand, like the season pass: no site header or tab bar, the way out is on the screen. */
export default async function EnginePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const [engine, crew] = await Promise.all([getBetaEngine(session?.user.id ?? null), getEngineCrew()]);
  return <EngineScreen engine={engine} crew={crew} signedIn={Boolean(session)} />;
}

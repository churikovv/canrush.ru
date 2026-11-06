import { badgeTheme } from '@/lib/brand-materials-fields';
import { badgeResponse, brandTarget, catalogBrand } from '@/lib/brand-materials';

export const dynamic = 'force-dynamic';

/** A whole brand's rating badge: `/badge/brand/<brand>.svg`, every review of every drink of the brand. */
export async function GET(request: Request, { params }: { params: Promise<{ brand: string }> }) {
  const { brand: raw } = await params;
  let name = '';
  try { name = decodeURIComponent(raw); } catch { /* a broken address is just unknown */ }
  const brand = name.endsWith('.svg') ? await catalogBrand(name.slice(0, -4)) : null;
  return badgeResponse(brand ? brandTarget(brand) : null, badgeTheme(new URL(request.url).searchParams.get('theme')));
}

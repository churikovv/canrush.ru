import Image from 'next/image';

/** A company's logo on a market listing (`/api/business-logos/<id>`), or its first letter on a brand tile. */
export function MarketCompanyLogo({ name, logoId, size }: { name: string; logoId: string | null; size: number }) {
  return <span className="market-company-logo" style={{ width: size, height: size }} aria-hidden="true">
    {logoId ? <Image src={`/api/business-logos/${logoId}`} width={size} height={size} unoptimized alt="" /> : name.slice(0, 1).toUpperCase()}
  </span>;
}

'use client';
export default function MarketErrorPage({ reset }: { reset: () => void }) {
  return <section className="main-surface market-layout market-empty"><h1>Не удалось загрузить маркет</h1><p>Попробуйте ещё раз.</p><button className="community-button" onClick={reset}>Повторить загрузку</button></section>;
}

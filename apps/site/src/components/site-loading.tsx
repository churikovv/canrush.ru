import type { CSSProperties } from 'react';
import { LOADING_BLOCK_COUNT, LOADING_CYCLE_MS, LOADING_GLYPHS, LOADING_WORD, loadingBlockPosition } from '@/lib/loading-word';

export function SiteLoading() {
  return <main className="site-loading" id="main-content" aria-busy="true" aria-label="Загрузка Canrush">
    <div className="site-loading-top" aria-hidden="true"><span>{LOADING_WORD}</span><span>Загрузка</span></div>
    <div className="site-loading-center">
      <svg className="site-loading-grid" viewBox="0 0 160 224" aria-hidden="true" style={{ '--loading-cycle': `${LOADING_CYCLE_MS}ms` } as CSSProperties}>
        {Array.from({ length: LOADING_BLOCK_COUNT }, (_, index) => {
          const positions = Object.fromEntries(LOADING_GLYPHS.map((_, letter) => {
            const point = loadingBlockPosition(index, letter);
            return [`--letter-${letter}`, `translate(${point.x}px, ${point.y}px)`];
          }));
          return <rect key={index} width="26" height="26" style={{ ...positions, transform: positions['--letter-0'] } as CSSProperties} />;
        })}
      </svg>
      <p className="site-loading-word">{LOADING_WORD}</p>
    </div>
    <p className="site-loading-status" role="status">Загружаем страницу…</p>
  </main>;
}

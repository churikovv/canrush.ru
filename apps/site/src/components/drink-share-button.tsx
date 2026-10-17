'use client';
import { useEffect, useRef, useState } from 'react';
import { ShareTierListButton } from '@/components/share-tier-list-button';
import { ScreenshotPreview } from '@/components/tier-screenshot-button';
import { renderDrinkStory, renderDrinkSummary, type DrinkSummaryShot } from '@/lib/drink-screenshot';

const LABELS = { title: 'Скриншот итога месяца', alt: 'Итог месяца в календаре выпитого', file: 'canrush-drink-calendar' };

/** Month summary actions: the tier-list share button (toast included) and the same screenshot dialog. */
export function DrinkSummaryActions({ shot, title, text, path }: { shot: DrinkSummaryShot; title: string; text: string; path: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  async function capture() {
    setPending(true); setError('');
    try { const blob = await renderDrinkSummary(shot); const url = URL.createObjectURL(blob); previewUrl.current = url; setPreview({ blob, url }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сделать скриншот. Попробуйте ещё раз.'); }
    finally { setPending(false); }
  }
  return <div className="drink-share">
    <ShareTierListButton title={title} text={text} path={path} label="Поделиться итогом" />
    <button type="button" className="tier-secondary-action" disabled={pending} onClick={capture}>{pending ? 'Создаём скриншот…' : 'Сделать скриншот'}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 6 9.4 4.6A2 2 0 0 1 10.8 4h2.4a2 2 0 0 1 1.4.6L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="4" /></svg></button>
    {error && <p className="drink-log-error" role="alert">{error}</p>}
    {preview && <ScreenshotPreview {...preview} labels={LABELS} renderStory={() => renderDrinkStory(shot)}
      onClose={() => { URL.revokeObjectURL(preview.url); previewUrl.current = null; setPreview(null); }} />}
  </div>;
}

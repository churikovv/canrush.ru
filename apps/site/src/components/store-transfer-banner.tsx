'use client';
import { useRef } from 'react';
import { StoreTransferForm } from '@/components/store-transfer-form';

/**
 * «Передать магазин» on /admin/stores: a banner like «Создай свой тирлист», opening the transfer form in a dialog —
 * the form is rarely needed and no longer takes the top of the page.
 */
export function StoreTransferBanner() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="tier-create-banner store-transfer-banner" onClick={() => dialog.current?.showModal()}>
      <span className="tier-create-banner-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg></span>
      <span className="tier-create-banner-copy"><strong>Передать магазин</strong><span>Другому участнику — вместе с правом редактировать. Статус не меняется, действие попадёт в журнал.</span></span>
      <svg className="tier-create-banner-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>
    <dialog ref={dialog} className="content-report-dialog store-transfer-dialog" aria-labelledby="store-transfer-title">
      <div className="store-transfer-dialog-head"><h2 id="store-transfer-title">Передать магазин</h2><button type="button" className="store-transfer-close" aria-label="Закрыть" onClick={() => dialog.current?.close()}>×</button></div>
      <p className="community-muted">Подходит для любого магазина, в том числе опубликованного.</p>
      <StoreTransferForm />
    </dialog>
  </>;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Pages drawn at most: a long document stays a link («Открыть PDF») past them. */
const MAX_PAGES = 60;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let shared: Promise<{ pdfjs: PdfJs; worker: InstanceType<PdfJs['PDFWorker']> }> | null = null;
/**
 * One worker for every viewer on the page, created here and passed to each document: a document closing (React runs
 * effects twice in development, a viewer leaves the page) destroys only a worker pdf.js made for it, so a shared
 * global port would die with the first one and break the next viewer — «Не удалось показать презентацию».
 */
function pdfWorker() {
  shared ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(pdfjs => {
    const port = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
    // The types allow no port, the code takes one: a worker made from our own port is never destroyed by a document.
    return { pdfjs, worker: new pdfjs.PDFWorker({ port: port as unknown as null }) };
  });
  shared.catch(() => { shared = null; });
  return shared;
}

/** The document behind `src`, loaded with pdf.js (library and worker on first use); `failed` when it cannot be read. */
function usePdf(src: string): { doc: PDFDocumentProxy | null; failed: boolean } {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      const { pdfjs, worker } = await pdfWorker();
      if (cancelled) return;
      const loading = pdfjs.getDocument({ url: src, useSystemFonts: true, worker });
      task = loading;
      const loaded = await loading.promise;
      if (!cancelled) setDoc(loaded);
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; void task?.destroy(); };
  }, [src]);
  return { doc, failed };
}

/**
 * A PDF presentation laid open in the company's «Презентация» block: page after page at full width, drawn by pdf.js
 * (the legacy build, for older phones and the apps' web views; browsers' own viewers show nothing for a PDF in a frame
 * on Android and in the apps). A page is
 * drawn when it comes within a screen below the view (a scroll listener, not an observer: those stay silent in a
 * background tab), so a 40-page deck costs what is seen.
 */
export function PdfPages({ src, title }: { src: string; title: string }) {
  const { doc, failed } = usePdf(src);
  const list = useRef<HTMLDivElement>(null);
  // The last page that came within a screen below the view: it and every page above it are drawn.
  const [reach, setReach] = useState(0);
  const pages = doc ? Math.min(doc.numPages, MAX_PAGES) : 0;
  useEffect(() => {
    const element = list.current;
    if (!element || !pages) return;
    const measure = () => {
      const limit = window.innerHeight * 2;
      const items = [...element.children] as HTMLElement[];
      let last = 0;
      items.forEach((item, index) => { if (item.getBoundingClientRect().top < limit) last = index; });
      setReach(current => Math.max(current, last));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [pages]);
  if (failed) return <p className="pdf-slides-note">Не удалось показать презентацию здесь — откройте PDF.</p>;
  return <div className="pdf-pages" ref={list} aria-busy={!doc} role="group" aria-label={`${title}: ${doc ? `${doc.numPages} стр.` : 'загружается'}`}>
    {doc ? Array.from({ length: pages }, (_, index) => <PdfPage key={index} doc={doc} number={index + 1} total={doc.numPages} near={index <= reach} />)
      : <div className="pdf-slide is-loading"><span>Открываем презентацию…</span></div>}
    {doc && doc.numPages > pages && <p className="pdf-slides-note">Показаны первые {pages} страниц из {doc.numPages} — остальные в PDF.</p>}
  </div>;
}

/** One page: drawn at its width and the screen's pixel density once `near` (in view or within a screen below). */
function PdfPage({ doc, number, total, near }: { doc: PDFDocumentProxy; number: number; total: number; near: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  // Once drawn a slide stays: leaving it does not cancel or clear the canvas.
  const drawn = useRef(false);
  useEffect(() => {
    if (!near || drawn.current) return;
    drawn.current = true;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setRatio(base.height / base.width);
      const width = box.current?.clientWidth || 600;
      const viewport = page.getViewport({ scale: (width / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
      const target = canvas.current;
      if (!target) return;
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      const render = page.render({ canvas: target, viewport });
      task = render;
      await render.promise;
    })().catch(() => { drawn.current = false; });
    return () => { if (cancelled) return; cancelled = true; task?.cancel(); drawn.current = false; };
  }, [doc, number, near]);

  return <div className="pdf-slide" ref={box} style={ratio ? { aspectRatio: `${1 / ratio}` } : undefined} aria-label={`Слайд ${number} из ${total}`} role="img">
    <canvas ref={canvas} />
  </div>;
}

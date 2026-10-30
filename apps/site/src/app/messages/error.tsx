'use client';
import { useErrorReport } from '@/lib/client-error-report';
import '@/styles/shared.css';
import '@/styles/market.css';
export default function MessagesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error);
  return <section className="main-surface market-layout market-empty"><h1>Не удалось загрузить сообщения</h1><p>Проверьте соединение и повторите попытку.</p><button className="community-button" onClick={reset}>Повторить загрузку</button></section>;
}

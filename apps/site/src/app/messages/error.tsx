'use client';
export default function MessagesError({ reset }: { reset: () => void }) { return <section className="main-surface market-layout market-empty"><h1>Не удалось загрузить сообщения</h1><p>Проверьте соединение и повторите попытку.</p><button className="community-button" onClick={reset}>Повторить загрузку</button></section>; }

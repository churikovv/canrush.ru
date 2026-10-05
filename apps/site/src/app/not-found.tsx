import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';

export default function NotFound() {
  return <BrandShell headerAction={<ProfileNavigation />}>
    <section className="not-found-page">
      <span className="not-found-code" aria-hidden="true">404</span>
      <h1>Страница не найдена</h1>
      <p>Возможно, ссылка устарела или в адресе есть опечатка. Найдите напиток в каталоге или вернитесь на главную.</p>
      <div className="not-found-actions"><Link className="community-button" href="/catalog">Открыть каталог</Link><Link className="community-button community-button-secondary" href="/">На главную</Link></div>
    </section>
  </BrandShell>;
}

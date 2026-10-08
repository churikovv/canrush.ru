import { ProfileBackButton } from '@/components/profile-back-button';
import Link from '@/components/navigation-progress';
import { TierListCard } from '@/components/tier-list-card';
import type { TierListProduct, TierListSummary } from '@/lib/tier-list-types';

interface ProfileTierListsProps {
  lists: TierListSummary[];
  products: TierListProduct[];
  ownerName: string;
  isOwn: boolean;
  notice?: string;
  profileHref?: string;
}

export function ProfileTierLists({ lists, products, ownerName, isOwn, notice, profileHref }: ProfileTierListsProps) {
  return (
    <div className={`profile-tierlists-layout${isOwn ? ' ym-hide-content' : ''}`}>
      <ProfileBackButton href={profileHref} />
      <header className="profile-tierlists-heading">
        <div>
          <p>{isOwn ? 'Ваши списки' : `Автор: ${ownerName}`}</p>
          <h1>Тирлисты</h1>
        </div>
        {isOwn ? <Link href="/tierlists/new">Создать тирлист</Link> : null}
      </header>

      {notice ? <div className="tierlist-operation-success" role="status">{notice}</div> : null}

      {lists.length > 0 ? (
        <div className="tier-list-cards">
          {lists.map((list) => <TierListCard list={list} products={products} showStatus={isOwn} key={list.id} />)}
        </div>
      ) : (
        <div className="profile-tierlists-empty">
          <strong>{isOwn ? 'У вас ещё нет тирлистов' : 'Пользователь пока не публиковал тирлисты'}</strong>
          <p>{isOwn ? 'Создайте список, сохраните его как черновик или сразу поделитесь с сообществом.' : 'Загляните позже.'}</p>
          {isOwn ? <Link href="/tierlists/new">Создать первый тирлист</Link> : null}
        </div>
      )}
    </div>
  );
}

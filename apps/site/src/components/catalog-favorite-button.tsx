'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { toggleFavoriteAction } from '@/app/catalog/actions';

interface CatalogFavoriteButtonProps {
  brand: string;
  flavor: string;
  favorite: boolean;
  authenticated: boolean;
}

function SubmitButton({ favorite }: { favorite: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="catalog-favorite-button"
      type="submit"
      aria-pressed={favorite}
      disabled={pending}
      aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      <span>{pending ? 'Сохраняем…' : favorite ? 'В избранном' : 'Избранное'}</span>
      <Image src="/brand/icons/catalog-heart.svg" width={24} height={24} alt="" />
    </button>
  );
}

export function CatalogFavoriteButton({ brand, flavor, favorite, authenticated }: CatalogFavoriteButtonProps) {
  if (!authenticated) {
    return (
      <Link className="catalog-favorite-button" href="/sign-in" aria-label="Войти, чтобы добавить в избранное">
        <span>Избранное</span>
        <Image src="/brand/icons/catalog-heart.svg" width={24} height={24} alt="" />
      </Link>
    );
  }

  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="flavor" value={flavor} />
      <SubmitButton favorite={favorite} />
    </form>
  );
}

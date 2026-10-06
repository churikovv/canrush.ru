'use client';

import Link from '@/components/navigation-progress';
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
      <span className="catalog-favorite-icon" aria-hidden="true" />
    </button>
  );
}

export function CatalogFavoriteButton({ brand, flavor, favorite, authenticated }: CatalogFavoriteButtonProps) {
  if (!authenticated) {
    return (
      <Link className="catalog-favorite-button" href="/sign-in" aria-label="Войти, чтобы добавить в избранное">
        <span>Избранное</span>
        <span className="catalog-favorite-icon" aria-hidden="true" />
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

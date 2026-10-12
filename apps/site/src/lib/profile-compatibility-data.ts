import { getPool } from '@/db/pool';
import { profileCompatibility, type Preference, type RatedPreference } from './profile-compatibility';

export async function getProfileCompatibility(viewerId: string, profileId: string) {
  const ids = [viewerId, profileId];
  const [favorites, reviews] = await Promise.all([
    getPool().query<Preference & { userId: string }>('select "userId", brand, flavor from favorite where "userId" = any($1::text[])', [ids]),
    getPool().query<RatedPreference & { userId: string }>('select "userId", brand, flavor, taste, design from review where "userId" = any($1::text[]) order by "updatedAt" desc', [ids]),
  ]);
  const data = (id: string) => ({ favorites: favorites.rows.filter(row => row.userId === id), reviews: reviews.rows.filter(row => row.userId === id) });
  return profileCompatibility(data(viewerId), data(profileId));
}

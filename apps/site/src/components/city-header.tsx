import { selectedCity } from '@/lib/location';
import { CitySelector } from '@/components/city-selector';
export async function CityHeader() { return <CitySelector selected={(await selectedCity()).id} />; }

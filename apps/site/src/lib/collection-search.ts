/** Search folding shared by the server's data-search attributes and the browser filter: case and ё do not matter. */
export function normalizeCollectionSearch(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/\s+/gu, ' ').trim();
}

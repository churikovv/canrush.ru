import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { AskOptions } from '../src/lib/gpt-api';

vi.mock('@/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand: 'Red Bull', flavor: 'original', label: 'Red Bull · Оригинальный' }, { brand: 'Burn', flavor: 'original', label: 'Burn · Оригинальный' }] }));
vi.mock('@/lib/gpt-api', () => ({ getGptApi: () => null }));
const { scanStorePhotos } = await import('../src/lib/store-photo-drinks');

const photo = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#123' } }).jpeg().toBuffer();

function model(answer: (prompt: string, options: AskOptions) => string | Promise<string>) {
  const asked: { prompt: string; image: boolean }[] = [];
  return { asked, client: { ask: async (prompt: string, options: AskOptions = {}) => { asked.push({ prompt, image: Boolean(options.image) }); return answer(prompt, options); } } };
}

describe('drinks on store photos', () => {
  it('is off without the model', async () => {
    await expect(scanStorePhotos([photo], null)).resolves.toBeNull();
  });

  it('reads the photo twice, merges the reads and asks the catalog numbers without the photo', async () => {
    const reads = ['[{"brand":"Red Bull","flavor":"Energy"},{"brand":"Burn","flavor":""},{"brand":"Red Bull","flavor":"Ultra"}]', '[{"brand":"red bull","flavor":"energy"},{"brand":"Незнакомый","flavor":"Киви"},{"brand":"Red Bull","flavor":"Summer Edition Pink"},{"brand":"Red Bull","flavor":"Juiced"}]'];
    const { client, asked } = model(prompt => (prompt.startsWith('На фото') ? reads.shift() ?? '[]' : '[{"can":1,"item":1},{"can":2,"item":0,"name":""},{"can":3,"item":0,"name":"Red Bull Pink Edition"},{"can":4,"item":0,"name":"Red Bull Juiced"}]'));
    const result = await scanStorePhotos([photo], client);
    expect(result).toEqual({ drinks: [{ brand: 'Red Bull', flavor: 'original', label: 'Red Bull · Оригинальный' }], others: ['Незнакомый Киви', 'Red Bull Pink Edition'], unread: ['Burn'] });
    expect(asked.map(question => question.image)).toEqual([true, true, false]);
    expect(asked[2]?.prompt).toContain('1. Red Bull Energy\n2. Red Bull Ultra\n3. Red Bull Summer Edition Pink\n4. Red Bull Juiced\n\nКаталог');
  });

  it('does not call a brand unread when its other cans were found', async () => {
    const { client } = model(prompt => (prompt.startsWith('На фото') ? '[{"brand":"Red Bull","flavor":"Energy"},{"brand":"Red Bull","flavor":""}]' : '[{"can":1,"item":1}]'));
    expect((await scanStorePhotos([photo], client))?.unread).toEqual([]);
  });

  it('keeps what the other reads found when one fails, and looks at three photos at most', async () => {
    let photos = 0;
    const { client, asked } = model(prompt => {
      if (!prompt.startsWith('На фото')) return '[{"can":1,"item":1}]';
      photos += 1;
      if (photos === 1) throw new Error('gpt_api_429');
      return '[{"brand":"Burn","flavor":"Classic"}]';
    });
    const result = await scanStorePhotos([photo, photo, photo, photo], client);
    expect(result?.drinks).toEqual([{ brand: 'Burn', flavor: 'original', label: 'Burn · Оригинальный' }]);
    expect(asked.filter(question => question.image)).toHaveLength(6);
  });

  it('fails when no photo could be read, or the failed one leaves only empty photos', async () => {
    const { client } = model(() => { throw new Error('gpt_api_429'); });
    await expect(scanStorePhotos([photo, photo], client)).rejects.toThrow('429');
    let seen = 0;
    const halfEmpty = model(() => { seen += 1; if (seen <= 2) return '[]'; throw new Error('gpt_api_502'); });
    await expect(scanStorePhotos([photo, photo], halfEmpty.client)).rejects.toThrow('502');
  });
});

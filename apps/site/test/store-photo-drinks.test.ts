import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand: 'Red Bull', flavor: 'original', label: 'Red Bull · Оригинальный' }, { brand: 'Burn', flavor: 'original', label: 'Burn · Оригинальный' }] }));
vi.mock('@/lib/gigachat', () => ({ getGigaChatMax: () => null }));
const { scanStorePhotos } = await import('../src/lib/store-photo-drinks');

const photo = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#123' } }).jpeg().toBuffer();

function model(replies: string[]) {
  const calls = { uploaded: 0, deleted: [] as string[], asked: [] as { attachments?: string[] }[] };
  return { calls, client: {
    uploadImage: async () => { calls.uploaded += 1; return `file-${calls.uploaded}`; },
    deleteFile: async (id: string) => { calls.deleted.push(id); },
    chat: async (messages: { attachments?: string[] }[]) => { calls.asked.push(messages[0]!); return replies.shift() ?? '[]'; },
  } as never };
}

describe('drinks on store photos', () => {
  it('is off without the model', async () => {
    await expect(scanStorePhotos([photo], null)).resolves.toBeNull();
  });

  it('names catalog drinks, keeps strangers as hints and sends the photo only with the first question', async () => {
    const { client, calls } = model(['[{"brand":"Red Bull","flavor":"Energy"},{"brand":"Burn","flavor":""},{"brand":"Незнакомый","flavor":"Киви"}]', '[{"can":1,"item":1}]']);
    const result = await scanStorePhotos([photo], client);
    expect(result).toEqual({ drinks: [{ brand: 'Red Bull', flavor: 'original', label: 'Red Bull · Оригинальный' }], others: ['Незнакомый Киви'], unread: ['Burn'] });
    expect(calls.asked[0]?.attachments).toEqual(['file-1']);
    expect(calls.asked[1]?.attachments).toBeUndefined();
    expect(calls.deleted).toEqual(['file-1']);
  });

  it('removes the file even when the model fails, and looks at three photos at most', async () => {
    const failing = model([]);
    (failing.client as unknown as { chat: () => Promise<string> }).chat = async () => { throw new Error('gigachat_chat_429'); };
    await expect(scanStorePhotos([photo], failing.client)).rejects.toThrow('429');
    expect(failing.calls.deleted).toEqual(['file-1']);
    const many = model(['[]', '[]', '[]', '[]']);
    await scanStorePhotos([photo, photo, photo, photo], many.client);
    expect(many.calls.uploaded).toBe(3);
  });
});

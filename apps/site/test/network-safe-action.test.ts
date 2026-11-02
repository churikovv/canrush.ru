import { describe, expect, it } from 'vitest';
import { NETWORK_ERROR, surviveNetworkError } from '../src/lib/network-safe-action';

const form = new FormData();

describe('surviveNetworkError', () => {
  it('passes the answer of the action through', async () => {
    await expect(surviveNetworkError(async () => ({ saved: true } as { saved?: boolean; error?: string }))({}, form)).resolves.toEqual({ saved: true });
  });

  it('turns a torn request into a form error and keeps the state', async () => {
    const action = surviveNetworkError(async (): Promise<{ draft?: string; error?: string }> => { throw new TypeError('Failed to fetch'); });
    await expect(action({ draft: 'x' }, form)).resolves.toEqual({ draft: 'x', error: NETWORK_ERROR });
  });

  it('leaves real failures to the error screen', async () => {
    const action = surviveNetworkError(async (): Promise<{ error?: string }> => { throw new Error('Server Components render failed'); });
    await expect(action({}, form)).rejects.toThrow('render failed');
  });
});

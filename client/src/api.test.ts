import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCancelableGet, get, post } from './api';
import { getCacheSnapshot } from './hooks/cacheStore';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

describe('client API request deduplication', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares one fetch between concurrent GETs with the same branch and path', async () => {
    localStorage.setItem('currentBranchId', 'branch-a');
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pending);

    const first = get('/api/dedupe-same');
    const second = get('/api/dedupe-same');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    resolveFetch(jsonResponse({ success: true, data: { ok: true } }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { success: true, data: { ok: true } },
      { success: true, data: { ok: true } },
    ]);
  });

  it('does not share a fetch across branches or cache one branch response in another', async () => {
    fetchMock.mockImplementation((_path: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      return Promise.resolve(
        jsonResponse({ success: true, data: { branch: headers['x-branch-id'] } })
      );
    });
    localStorage.setItem('currentBranchId', 'branch-a');
    const first = get<{ branch: string }>('/api/dedupe-branches');
    localStorage.setItem('currentBranchId', 'branch-b');
    const second = get<{ branch: string }>('/api/dedupe-branches');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);

    const firstHeaders = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    const secondHeaders = fetchMock.mock.calls[1]![1].headers as Record<string, string>;
    expect(firstHeaders['x-branch-id']).toBe('branch-a');
    expect(secondHeaders['x-branch-id']).toBe('branch-b');

    await expect(first).resolves.toMatchObject({ data: { branch: 'branch-a' } });
    await expect(second).resolves.toMatchObject({ data: { branch: 'branch-b' } });
    expect(getCacheSnapshot<{ branch: string }>('/api/dedupe-branches').data).toEqual({
      branch: 'branch-b',
    });
    localStorage.setItem('currentBranchId', 'branch-a');
    expect(getCacheSnapshot<{ branch: string }>('/api/dedupe-branches').data).toEqual({
      branch: 'branch-a',
    });
  });

  it('does not deduplicate cancelable GETs', async () => {
    localStorage.setItem('currentBranchId', 'branch-a');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));

    const first = createCancelableGet('/api/dedupe-cancelable');
    const second = createCancelableGet('/api/dedupe-cancelable');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.promise).not.toBe(first.promise);
    const firstSignal = (fetchMock.mock.calls[0]![1] as RequestInit).signal;
    const secondSignal = (fetchMock.mock.calls[1]![1] as RequestInit).signal;
    expect(firstSignal).not.toBe(secondSignal);

    await Promise.all([first.promise, second.promise]);
  });

  it('does not deduplicate writes', async () => {
    localStorage.setItem('currentBranchId', 'branch-a');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));

    const first = post('/api/dedupe-writes', { value: 1 });
    const second = post('/api/dedupe-writes', { value: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    const firstBody = (fetchMock.mock.calls[0]![1] as RequestInit).body;
    const secondBody = (fetchMock.mock.calls[1]![1] as RequestInit).body;
    expect(firstBody).toBe(JSON.stringify({ value: 1 }));
    expect(secondBody).toBe(JSON.stringify({ value: 2 }));

    await Promise.all([first, second]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { api, print } from '../cli/client.js';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cli client', () => {
  it('api sends x-user-id and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ missions: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const data = await api({ as: 'orga-lead-1', api: 'http://x' }, 'GET', '/missions');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/missions',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-user-id': 'orga-lead-1' }) }),
    );
    expect(data).toEqual({ missions: [] });
  });

  it('api throws [CODE] on error envelope, exits without --as', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: { code: 'SELF_APPROVAL', message: 'nope' } }),
      }),
    );
    await expect(api({ as: 'a', api: 'http://x' }, 'POST', '/y', {})).rejects.toThrow(
      '[SELF_APPROVAL] nope',
    );
  });

  it('print --json vs table', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    print({ as: 'a', api: 'x', json: true }, { a: 1 });
    expect(log).toHaveBeenCalled();
    print({ as: 'a', api: 'x' }, { missions: [{ id: 'm1' }] });
    expect(table).toHaveBeenCalled();
  });
});

describe('cli wiring (no server needed)', () => {
  const run = (args: string[]) =>
    execFileSync('npx', ['tsx', 'cli/index.ts', ...args], { encoding: 'utf8' });

  it('--help lists all command groups', () => {
    const out = run(['--help']);
    for (const cmd of ['users', 'missions', 'requirements', 'match', 'assignments', 'crew', 'skills', 'availability']) {
      expect(out).toContain(cmd);
    }
  });

  it('missions --help shows edit + lifecycle actions', () => {
    const out = run(['missions', '--help']);
    for (const cmd of ['edit', 'submit', 'approve', 'activate']) {
      expect(out).toContain(cmd);
    }
  });
});

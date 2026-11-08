// Thin HTTP helper. All auth is x-user-id; tenant/role errors surface as [CODE] msg.
export interface CliOpts {
  as?: string;
  api: string;
  json?: boolean;
}

export async function api(opts: CliOpts, method: string, path: string, body?: unknown): Promise<any> {
  if (!opts.as) {
    console.error('missing --as <user-id> (try --as orga-lead-1; run with a seeded id)');
    process.exit(1);
  }
  const res = await fetch(`${opts.api}${path}`, {
    method,
    headers: {
      'x-user-id': opts.as,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as any)?.error ?? {};
    throw new Error(`[${err.code ?? res.status}] ${err.message ?? res.statusText}`);
  }
  return data;
}

export function print(opts: CliOpts, data: unknown): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data)) {
    console.table(data);
  } else if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    // Single-key envelopes like {missions: [...]} print the inner table.
    if (entries.length === 1 && Array.isArray(entries[0][1])) {
      console.table(entries[0][1] as any[]);
    } else {
      console.dir(data, { depth: null, colors: true });
    }
  } else {
    console.log(data);
  }
}

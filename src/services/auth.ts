import type { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/client.js';

export type Role = 'director' | 'lead' | 'crew';

export interface Actor {
  id: string;
  org_id: string;
  role: Role;
  name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
  }
}

const RANK: Record<Role, number> = { crew: 0, lead: 1, director: 2 };

/** Demo auth: x-user-id IS the token. Loads user row -> {org, role}. */
export async function auth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string' || userId.length === 0) {
    throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'missing x-user-id' };
  }
  const row = getDb()
    .prepare('SELECT id, org_id, role, name FROM users WHERE id = ?')
    .get(userId) as Actor | undefined;
  if (!row) {
    throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'unknown user' };
  }
  req.actor = row;
}

/** Hierarchical role gate: director >= lead >= crew. */
export function requireRole(min: Role) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (RANK[req.actor.role] < RANK[min]) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: `requires ${min}, have ${req.actor.role}`,
      };
    }
  };
}

/**
 * Tenant gate: resource must belong to actor's org.
 * Returns 404 (not 403) so callers can't probe other orgs' IDs.
 */
export function assertSameOrg(actorOrg: string, resourceOrg: string | null | undefined): void {
  if (!resourceOrg || resourceOrg !== actorOrg) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  }
}

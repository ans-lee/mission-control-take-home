import Fastify from 'fastify';
import { getDb } from './db/client.js';
import { auth, assertSameOrg } from './services/auth.js';

export function buildServer() {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err: any, _req, reply) => {
    const status = err.statusCode ?? 500;
    const code = err.code ?? (status === 500 ? 'INTERNAL' : 'ERROR');
    reply.status(status).send({ error: { code, message: err.message ?? 'error' } });
  });

  // All routes require auth. Attaches req.actor.
  app.addHook('onRequest', auth);

  // Scoped user list for CLI --as discovery. Same org only.
  app.get('/users', async (req) => {
    const rows = getDb()
      .prepare('SELECT id, name, role FROM users WHERE org_id = ? ORDER BY id')
      .all(req.actor.org_id);
    return { users: rows };
  });

  // Missions scoped to actor org.
  app.get('/missions', async (req) => {
    const rows = getDb()
      .prepare(
        'SELECT id, title, status, start_date, end_date FROM missions WHERE org_id = ? ORDER BY id',
      )
      .all(req.actor.org_id);
    return { missions: rows };
  });

  app.get('/missions/:id', async (req, _reply) => {
    const { id } = req.params as { id: string };
    const row = getDb()
      .prepare('SELECT id, org_id, title, status, start_date, end_date FROM missions WHERE id = ?')
      .get(id) as any;
    if (!row) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
    assertSameOrg(req.actor.org_id, row.org_id);
    return { mission: row };
  });

  return app;
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).then(() => {
    console.log(`api listening on :${port}`);
  });
}

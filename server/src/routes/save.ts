import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SaveRepository } from '../save/repository.js';
import { parseSave } from '../save/saveData.js';

const SAVE_BODY_LIMIT = 4 * 1024;

/** Çerezdeki oturumdan kullanıcı kimliğini çıkarır; yoksa 401 gönderip null döner. */
async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  try {
    const { sub } = await request.jwtVerify<{ sub: string }>();
    return sub;
  } catch {
    await reply.code(401).send({ code: 'NO_SESSION', error: 'Oturum bulunamadı. Lütfen giriş yap.' });
    return null;
  }
}

export function registerSaveRoutes(app: FastifyInstance, saves: SaveRepository): void {
  app.get('/save', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return reply;
    return { save: await saves.get(userId) };
  });

  app.put('/save', { bodyLimit: SAVE_BODY_LIMIT }, async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return reply;

    const parsed = parseSave(request.body);
    if (!parsed.ok) return reply.code(400).send({ code: 'INVALID', error: parsed.error });

    await saves.put(userId, parsed.save);
    return { ok: true };
  });
}

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { registerAuthRoutes, SESSION_COOKIE } from './routes/auth.js';
import type { UserRepository } from './users/repository.js';

export interface AppDeps {
  config: Config;
  users: UserRepository;
  logger?: boolean;
}

/** Uygulamayı kurar. Veritabanı `users` üzerinden verildiği için testlerde bellek deposu kullanılır. */
export async function buildApp({ config, users, logger = false }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger, trustProxy: true });

  await app.register(cors, { origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST'] });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: '30d' },
  });
  // Yalnızca kimlik rotalarında (config.rateLimit ile) uygulanır
  await app.register(rateLimit, { global: false });

  // İç hata ayrıntıları (dosya yolu, SQL vb.) asla istemciye gitmez; yalnızca günlüğe yazılır.
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(500).send({ code: 'SERVER_ERROR', error: 'Sunucu hatası. Lütfen biraz sonra tekrar dene.' });
    }
    if (status === 429) {
      return reply.code(429).send({ code: 'RATE_LIMITED', error: 'Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.' });
    }
    return reply.code(status).send({ code: 'BAD_REQUEST', error: 'Geçersiz istek.' });
  });

  app.get('/health', async () => ({ status: 'ok', game: 'MagicalBattle' }));
  registerAuthRoutes(app, { config, users });

  return app;
}

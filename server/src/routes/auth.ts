import type { FastifyInstance, FastifyReply } from 'fastify';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  normalizeEmail,
  usernameKey,
  validateEmail,
  validateName,
  validatePassword,
  validateUsername,
} from '../auth/validation.js';
import type { Config } from '../config.js';
import { DuplicateError, type UserRecord, type UserRepository } from '../users/repository.js';

export const SESSION_COOKIE = 'mb_session';
const SESSION_DAYS = 30;

interface Deps {
  config: Config;
  users: UserRepository;
}

/** İstemciye gönderilecek, hassas alanları içermeyen kullanıcı görünümü. */
function publicUser(u: UserRecord) {
  return { id: u.id, username: u.username, isGuest: u.isGuest, firstName: u.firstName };
}

function fail(reply: FastifyReply, status: number, code: string, error: string) {
  return reply.code(status).send({ code, error });
}

// Var olmayan kullanıcıda da aynı sürede cevap verebilmek için (kullanıcı adı sızdırmamak).
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= hashPassword('hic-kullanilmayacak-sifre'));

export function registerAuthRoutes(app: FastifyInstance, { config, users }: Deps): void {
  const limited = { config: { rateLimit: { max: config.authRateLimit, timeWindow: '1 minute' } } };

  async function startSession(reply: FastifyReply, user: UserRecord): Promise<void> {
    const token = await reply.jwtSign({ sub: user.id });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      domain: config.cookieDomain,
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }

  app.post('/auth/register', limited, async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>;
    const problem =
      validateName(b.firstName, 'Ad') ??
      validateName(b.lastName, 'Soyad') ??
      validateEmail(b.email) ??
      validateUsername(b.username) ??
      validatePassword(b.password);
    if (problem) return fail(reply, 400, 'INVALID', problem);

    try {
      const user = await users.create({
        username: b.username as string,
        usernameKey: usernameKey(b.username as string),
        passwordHash: await hashPassword(b.password as string),
        isGuest: false,
        firstName: (b.firstName as string).trim(),
        lastName: (b.lastName as string).trim(),
        email: normalizeEmail(b.email as string),
      });
      await startSession(reply, user);
      return reply.code(201).send({ user: publicUser(user) });
    } catch (err) {
      if (err instanceof DuplicateError) {
        return err.field === 'email'
          ? fail(reply, 409, 'EMAIL_TAKEN', 'Bu e-posta adresiyle zaten bir hesap var.')
          : fail(reply, 409, 'USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
      }
      throw err;
    }
  });

  app.post('/auth/guest', limited, async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>;
    const problem = validateUsername(b.username) ?? validatePassword(b.password);
    if (problem) return fail(reply, 400, 'INVALID', problem);

    try {
      const user = await users.create({
        username: b.username as string,
        usernameKey: usernameKey(b.username as string),
        passwordHash: await hashPassword(b.password as string),
        isGuest: true,
        firstName: null,
        lastName: null,
        email: null,
      });
      await startSession(reply, user);
      return reply.code(201).send({ user: publicUser(user) });
    } catch (err) {
      if (err instanceof DuplicateError) return fail(reply, 409, 'USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
      throw err;
    }
  });

  app.post('/auth/login', limited, async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>;
    if (typeof b.username !== 'string' || typeof b.password !== 'string') {
      return fail(reply, 400, 'INVALID', 'Kullanıcı adı ve şifre gerekli.');
    }
    const user = await users.findByUsernameKey(usernameKey(b.username));
    // Kullanıcı yoksa da hash karşılaştır: cevap süresi hesabın varlığını belli etmesin.
    const ok = await verifyPassword(b.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) return fail(reply, 401, 'BAD_CREDENTIALS', 'Kullanıcı adı veya şifre hatalı.');

    await startSession(reply, user);
    return { user: publicUser(user) };
  });

  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/', domain: config.cookieDomain });
    return { ok: true };
  });

  app.get('/auth/me', async (request, reply) => {
    try {
      const { sub } = await request.jwtVerify<{ sub: string }>();
      const user = await users.findById(sub);
      if (!user) {
        reply.clearCookie(SESSION_COOKIE, { path: '/', domain: config.cookieDomain });
        return fail(reply, 401, 'NO_SESSION', 'Oturum bulunamadı.');
      }
      return { user: publicUser(user) };
    } catch {
      return fail(reply, 401, 'NO_SESSION', 'Oturum bulunamadı.');
    }
  });
}

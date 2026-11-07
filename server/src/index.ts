import Fastify from 'fastify';

// Task 1: sadece iskelet. Hesap, kayıt ve Colyseus sonraki task'larda gelecek.
const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', game: 'MagicalBattle' }));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

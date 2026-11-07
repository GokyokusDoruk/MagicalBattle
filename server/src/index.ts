import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './db.js';
import { PrismaUserRepository } from './users/prismaRepository.js';

const config = loadConfig();
const prisma = createPrisma(config.databaseUrl);
const app = await buildApp({ config, users: new PrismaUserRepository(prisma), logger: true });

const shutdown = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

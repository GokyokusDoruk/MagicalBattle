// Yerelde geliştirmek için Docker'sız PostgreSQL: npm run dev:db
// Veriler server/.devdb klasöründe kalır, sunucu kapanıp açılsa da hesaplar ve kayıtlar silinmez.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(serverDir, '.devdb');
const PORT = 54320;
const DB = 'magicalbattle';
export const DEV_DATABASE_URL = `postgresql://postgres:dev@localhost:${PORT}/${DB}`;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'dev',
  port: PORT,
  persistent: true,
  // Türkçe Windows'ta yerel ayar adı ASCII olmadığı için initdb çöküyor; sabit ayar ver
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});

if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  console.log('İlk kurulum: veritabanı kümesi oluşturuluyor...');
  await pg.initialise();
}
await pg.start();
await pg.createDatabase(DB).catch(() => {}); // zaten varsa sorun değil

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: serverDir,
  env: { ...process.env, DATABASE_URL: DEV_DATABASE_URL },
  stdio: 'inherit',
  shell: true,
});

console.log(`\nPostgreSQL hazır: ${DEV_DATABASE_URL}`);
console.log('Başka bir terminalde: npm run dev:server  ve  npm run dev');
console.log('Durdurmak için Ctrl+C.\n');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // süreci açık tut

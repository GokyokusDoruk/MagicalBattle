import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` veritabanına bağlanmaz, bu yüzden değer yoksa boş bırakılabilir.
    url: process.env.DATABASE_URL ?? '',
    // Yalnızca `migrate dev` / `migrate diff` için (geçici gölge veritabanı); üretimde gerekmez
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});

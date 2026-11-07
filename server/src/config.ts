export interface Config {
  port: number;
  host: string;
  isProduction: boolean;
  databaseUrl: string;
  jwtSecret: string;
  /** İzin verilen frontend adresleri (CORS) */
  corsOrigins: string[];
  /** Üretimde çerezin geçerli olacağı alan, örn. ".dorukplays.com" */
  cookieDomain: string | undefined;
  /** Dakikada, IP başına giriş/kayıt denemesi sınırı */
  authRateLimit: number;
}

const DEV_SECRET = 'gelistirme-icin-gizli-anahtar-uretimde-kullanma';

/** Ortam değişkenlerinden yapılandırmayı okur. Üretimde eksik/zayıf ayar varsa hata verir. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProduction = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET ?? (isProduction ? '' : DEV_SECRET);

  if (isProduction) {
    if (jwtSecret.length < 32) throw new Error('JWT_SECRET en az 32 karakter olmalı (üretimde zorunlu).');
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL tanımlı olmalı (üretimde zorunlu).');
    if (!env.CORS_ORIGINS) throw new Error('CORS_ORIGINS tanımlı olmalı (üretimde zorunlu).');
  }

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    isProduction,
    databaseUrl: env.DATABASE_URL ?? '',
    jwtSecret,
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    authRateLimit: Number(env.AUTH_RATE_LIMIT ?? 10),
  };
}

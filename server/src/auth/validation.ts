/** Doğrulama fonksiyonları hata varsa Türkçe mesaj, yoksa null döndürür. */

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function validateUsername(value: unknown): string | null {
  if (typeof value !== 'string' || !USERNAME_PATTERN.test(value)) {
    return 'Kullanıcı adı 3-20 karakter olmalı; yalnızca harf (a-z), rakam ve alt çizgi içerebilir.';
  }
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  if (value.length > PASSWORD_MAX) return `Şifre en fazla ${PASSWORD_MAX} karakter olabilir.`;
  return null;
}

export function validateEmail(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 254 || !EMAIL_PATTERN.test(value)) {
    return 'Geçerli bir e-posta adresi gir.';
  }
  return null;
}

export function validateName(value: unknown, label: string): string | null {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 50) {
    return `${label} 1-50 karakter olmalı.`;
  }
  return null;
}

/** Benzersizlik anahtarı: kullanıcı adları büyük/küçük harfe duyarsızdır. */
export function usernameKey(username: string): string {
  return username.toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

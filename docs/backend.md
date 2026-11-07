# MagicalBattle - Sunucu (backend)

Node.js + TypeScript + Fastify + Prisma + PostgreSQL. Kod: `server/`.

## Hesap sistemi

- **Kayıt:** ad, soyad, e-posta, kullanıcı adı, şifre.
- **Misafir:** yalnızca kullanıcı adı ve şifre. Misafir hesabının da ilerlemesi (Task 8) kaydedilir.
- Kullanıcı adı: 3-20 karakter, yalnızca `a-z`, `A-Z`, `0-9`, `_`. Büyük/küçük harfe duyarsız benzersiz (`Doruk` ile `doruk` aynı hesap).
- Şifre: 8-72 karakter.
- Oturum, **HttpOnly çerez** (`mb_session`) ile tutulur. Tarayıcıda (localStorage vb.) hiçbir şey saklanmaz.

## Uç noktalar

Tüm istekler `Content-Type: application/json` olmalı. Tarayıcıdan `fetch(..., { credentials: 'include' })` kullanılır.

| Yöntem | Adres | Gövde | Başarılı cevap |
|---|---|---|---|
| POST | `/auth/register` | `firstName, lastName, email, username, password` | `201 { user }` + çerez |
| POST | `/auth/guest` | `username, password` | `201 { user }` + çerez |
| POST | `/auth/login` | `username, password` | `200 { user }` + çerez |
| POST | `/auth/logout` | - | `200 { ok: true }`, çerez silinir |
| GET | `/auth/me` | - | `200 { user }` ya da `401` |
| GET | `/health` | - | `200 { status: "ok" }` |

`user` = `{ id, username, isGuest, firstName }`. Şifre, hash ve e-posta asla geri dönmez.

Hatalar `{ code, error }` biçimindedir (`error` Türkçe, kullanıcıya gösterilebilir):

| Durum | `code` | Ne zaman |
|---|---|---|
| 400 | `INVALID` | Alan kuralı ihlali (mesaj hangisi olduğunu söyler) |
| 400 | `BAD_REQUEST` | Bozuk JSON gibi geçersiz istek |
| 401 | `BAD_CREDENTIALS` | Yanlış şifre **ya da** olmayan kullanıcı (aynı cevap) |
| 401 | `NO_SESSION` | Çerez yok, süresi dolmuş ya da kurcalanmış |
| 409 | `USERNAME_TAKEN` / `EMAIL_TAKEN` | Çakışma |
| 429 | `RATE_LIMITED` | Giriş/kayıt/misafir için dakikada IP başına 10 deneme aşıldı |
| 500 | `SERVER_ERROR` | Beklenmeyen hata (ayrıntı yalnızca sunucu günlüğüne yazılır) |

## Güvenlik notları

- Şifreler **scrypt** ile tuzlanıp hash'lenir (yerel bağımlılık gerektirmez, ARM sunucuda da çalışır).
- Giriş cevabı, hesabın var olup olmadığını belli etmez (mesaj ve süre aynı).
- Çerez: `HttpOnly`, üretimde `Secure`, `SameSite=Lax`, alan `.dorukplays.com`. Oyun (`magicalbattle.dorukplays.com`) ile API (`api.dorukplays.com`) aynı site sayıldığı için çalışır.
- CORS yalnızca `CORS_ORIGINS` listesindeki adreslere çerezli istek izni verir.
- Çapraz site istek sahteciliğine karşı: çerez `SameSite=Lax` ve istekler JSON gövdeli POST (form ile gönderilemez).
- Üretimde `JWT_SECRET` (en az 32 karakter), `DATABASE_URL` ve `CORS_ORIGINS` yoksa sunucu hiç açılmaz.

## Ortam değişkenleri

| Ad | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı adresi |
| `JWT_SECRET` | Oturum imza anahtarı (üretimde en az 32 karakter) |
| `CORS_ORIGINS` | İzinli frontend adresleri, virgülle |
| `COOKIE_DOMAIN` | Çerez alanı, örn. `.dorukplays.com` |
| `AUTH_RATE_LIMIT` | Dakikada IP başına deneme sınırı (varsayılan 10) |
| `PORT` / `HOST` | Dinlenen port (3000) ve adres |

## Yerelde çalıştırma

```bash
npm install
docker compose up -d db          # yalnız PostgreSQL (127.0.0.1:5432)
cd server
export DATABASE_URL=postgresql://magicalbattle:SIFRENIZ@localhost:5432/magicalbattle
npx prisma migrate deploy
npm run dev
```

Docker kullanmak istemezsen birim testleri veritabanı olmadan çalışır; gerçek PostgreSQL testi için aşağıya bak.

## Testler

```bash
npm test              # hızlı birim testleri (veritabanı gerekmez)
npm run test:db       # gerçek PostgreSQL'e karşı testler (Docker gerekmez, gömülü PostgreSQL başlatır)
```

## Veritabanı değişikliği

`server/prisma/schema.prisma` dosyasını düzenle, sonra bir migrasyon oluştur:

```bash
cd server
npx prisma migrate dev --name degisiklik_adi
```

Sunucu konteyneri her açılışta `prisma migrate deploy` çalıştırır, bekleyen migrasyonlar kendiliğinden uygulanır.

# MagicalBattle - Sunucu (backend)

Node.js + TypeScript + Fastify + Prisma + PostgreSQL. Kod: `server/`.

## Hesap sistemi

- **Oyundaki giriş (Faz 1):** yalnızca büyücü adı ve şifre. İstemci önce `/auth/login` dener; hesap yoksa (401) aynı ad ve
  şifreyle `/auth/guest` ile hesap açar. Ad alınmışsa (409) "şifre hatalı" denir. Kayıt formu ve kayıtsız oyun oyundan kaldırıldı.
- **Kayıt:** ad, soyad, e-posta, kullanıcı adı, şifre (uç nokta duruyor, oyun kullanmıyor).
- **Misafir:** yalnızca kullanıcı adı ve şifre. Oyunun açtığı hesaplar bu türdendir; ilerlemesi (Task 8) kaydedilir.
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
| GET | `/save` | - | `200 { save }` (yoksa `save: null`), oturum gerekir |
| PUT | `/save` | kayıt dosyası (aşağıda) | `200 { ok: true }`, oturum gerekir |
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

## Kayıt dosyası

Hesap başına tek kayıt. Oyun, **şehre her girildiğinde** (kayıt noktası) ve yeni oyunun başında yazar. Sürüm 8; eski (v1-v7) kayıtlar okunurken varsayılan alanlarla otomatik yükseltilir.

```json
{
  "version": 8,
  "playerName": "Aylin",
  "completedChapters": [1, 2],
  "savePoint": { "cityId": "ignis", "tileX": 64, "tileY": 64 },
  "wallet": { "kor": 250, "ciy": 40, "tunc": 0, "tuy": 7 },
  "hp": 180,
  "xp": 320,
  "items": { "sifali-ot": 4, "gezgin-cuppesi": 1 },
  "equipped": { "robe": "gezgin-cuppesi" },
  "quests": { "ash-ot-toplama": { "status": "active", "progress": 2 } },
  "collected": ["p-ot-0", "p-kristal-0"],
  "skills": ["fire-power-1", "fire-power-2"],
  "wands": { "wand-fire-attack-3-12": 2 },
  "wandEquipped": "wand-fire-attack-3-12",
  "choices": { "c1-isciler": "good", "c1-nobetci": "bad" }
}
```

Eski (v5) kayıtlarda asalar seviyesizdi (`wand-fire-attack-3`) ve 8 yuvalı `wandsEquipped` vardı; sunucu bunları okurken seviye 1 olarak yükseltir, en nadir kuşanılı asayı seçer ve yeni biçimde yazar.

Sunucu istemciye güvenmez ve her yazmada doğrular:
- `playerName`: 2-20 karakter (harf, rakam, boşluk, `_ . -`)
- `completedChapters`: aralıksız `[1..n]`, en fazla 8 bölüm
- `savePoint`: `null` (yeni oyun) ya da bilinen bir şehir (`ignis`, `abyss`, `stone-heart`, `still-crystal`) ve 0-500 arası tam sayı karo
- `wallet`: dört birim (`kor`, `ciy`, `tunc`, `tuy`), her biri 0-9.999.999 tam sayı; bilinmeyen birim reddedilir. Eski (v1-v7) kayıttaki tek `gold` alanı **Kor**'a çevrilir ([para-birimleri.md](para-birimleri.md)). `xp` 0-1.000.000 (tam sayı)
- `items`: en çok 64 çeşit, kimlik `a-z 0-9 -`, adet 1-999; `equipped`: yalnızca `robe`, `hat`, `pants`, `bag`, `ring`, `boots` (eski `amulet` yuvası da okunur, istemci yüklerken yüzüğe çevirir); `quests`: en çok 64, durum `active`/`completed`, ilerleme 0-9999; `collected`: en çok 200 kimlik (tekrarlar atılır); `skills`: en çok 39 kimlik (36 element + 3 Taşıyıcı), `a-z 0-9 -` (tekrarlar atılır); `wands`: en çok 200 çeşit, kimlik `wand-<element>-<rol>-<nadirlik 1-6>-<seviye 1-30>`, adet 1-999; `wandEquipped`: kuşanılı asa kimliği ya da `null` (sahip olunmuyorsa `null` olur); `choices`: en çok 16 kayıt, değer yalnızca `good` ya da `bad`
- Fazla alanlar atılır, gövde en fazla 16 KB

Geçersiz kayıt `400` ile reddedilir ve eski kayıt bozulmaz. Veritabanındaki kayıt bozuksa oyuncu yeni oyunla başlar. Eşya, görev, yetenek, asa ve seçim kimliklerinin kataloğa uyup uymadığını sunucu bilmez; istemci yüklerken bilinmeyenleri atar ve sayıları sınırlar.

İstemci güvenliği: kayıt **yüklenemezse** o oturumda kaydetme kapatılır, böylece yüklenemeyen gerçek ilerlemenin üzerine yeni oyun yazılmaz.

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

## Yerelde çalıştırma (Docker gerekmez)

Üç ayrı terminalde, depo kökünden:

```bash
npm install
npm run dev:db       # yerel PostgreSQL (veriler server/.devdb içinde kalır) + migrasyonlar
npm run dev:server   # API, http://localhost:3000
npm run dev          # oyun, http://localhost:5173
```

Oyun, `localhost` üzerindeyken API'ye `http://localhost:3000` adresinden bağlanır. Yayında (`*.dorukplays.com`) `https://api.dorukplays.com` kullanır. Başka bir adres için derlemeden önce `VITE_API_URL` ortam değişkenini ayarla.

Docker kullanmak istersen: `docker compose up -d db` ve `DATABASE_URL` ile kendi veritabanını göster.

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

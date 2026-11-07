# MagicalBattle

2D açık dünya (Phaser) ile 3D düello arenasını (Three.js) birleştiren, çizerek büyü yapılan RPG.
Canlı adres: **https://magicalbattle.dorukplays.com** (henüz yayında değil).

## Yapı (monorepo)

| Klasör | İçerik |
|---|---|
| `client/` | Vite + TypeScript + Phaser + Three.js + TailwindCSS (oyun arayüzü) |
| `server/` | Node.js + TypeScript + Fastify (hesap, kayıt, çok oyunculu; sonraki task'larda genişleyecek) |

Gereksinim: Node 20 veya üstü.

## Komutlar (kök klasörden)

```bash
npm install          # tüm paketleri kurar
npm run dev          # client geliştirme sunucusu
npm run dev:server   # server (izleme modunda)
npm run build        # client üretim derlemesi -> client/dist
npm run build:server # server derlemesi -> server/dist
npm run typecheck    # client + server tip kontrolü
```

## Yayın (Cloudflare Pages)

`main`'e birleşen her değişiklik siteyi günceller. Bir kerelik kurulum:

1. Cloudflare → Workers & Pages → *Create* → *Pages* → *Connect to Git* → `GokyokusDoruk/MagicalBattle`, üretim dalı `main`.
2. Derleme ayarları:
   - **Framework preset:** None
   - **Build command:** `npm install && npm run build`
   - **Build output directory:** `client/dist`
   - **Root directory:** (boş, depo kökü)
   - **Ortam değişkeni:** `NODE_VERSION` = `22`
3. Pages projesi → *Custom domains* → `magicalbattle.dorukplays.com`.
4. Yayına girince `dorukplays` deposunda MagicalBattle kartını `<a class="game" href="https://magicalbattle.dorukplays.com">` yap.

Backend (Oracle Cloud, Docker Compose) kurulumu Task 7'de eklenecek.

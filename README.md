# MagicalBattle

2D açık dünya (Phaser) ile 3D düello arenasını (Three.js) birleştiren, çizerek büyü yapılan RPG.
Canlı adres: **https://magicalbattle.dorukplays.com** (henüz yayında değil).

## Yapı (monorepo)

| Klasör | İçerik |
|---|---|
| `client/` | Vite + TypeScript + Phaser + Three.js + TailwindCSS (oyun arayüzü) |
| `server/` | Node.js + TypeScript + Fastify + Prisma + PostgreSQL (hesap sistemi; çok oyunculu sonraki task'larda) |

Gereksinim: Node 20 veya üstü.

## Komutlar (kök klasörden)

```bash
npm install          # tüm paketleri kurar
npm run dev          # client geliştirme sunucusu
npm run dev:db       # yerel PostgreSQL (Docker gerekmez)
npm run dev:server   # server (izleme modunda)
npm run build        # client üretim derlemesi -> client/dist
npm run build:server # server derlemesi -> server/dist
npm run typecheck    # client + server tip kontrolü
npm test             # client + server birim testleri (Vitest)
npm run test:db -w server  # gerçek PostgreSQL'e karşı testler (Docker gerekmez)
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

Büyü seslerini dinlemek için `?lab=sound` ([docs/ses-efektleri.md](docs/ses-efektleri.md)). Botlara karşı savaşmak için `?lab=battle` ([docs/savas-akisi.md](docs/savas-akisi.md)). 3D arenayı denemek için `?lab=arena` ([docs/arena-3d.md](docs/arena-3d.md)). Büyü çizimini denemek için oyun adresine `?lab=draw` ekle ([docs/cizim-sistemi.md](docs/cizim-sistemi.md), hasar hesabı: [docs/hasar-hesabi.md](docs/hasar-hesabi.md)).

Tüccar, ekipman ve yan görevler: [docs/ekonomi-ve-gorevler.md](docs/ekonomi-ve-gorevler.md).
Yetenek ağacı ve büyü sinerjisi: [docs/yetenek-agaci.md](docs/yetenek-agaci.md). Asalar ve birleştirme: [docs/asalar.md](docs/asalar.md). Diyalog, ahlak seçimleri ve Elysia: [docs/diyalog-ve-ahlak.md](docs/diyalog-ve-ahlak.md). Boss savaşları: [docs/boss-savaslari.md](docs/boss-savaslari.md).

Sunucu: API ve hesap sistemi için [docs/backend.md](docs/backend.md), Oracle Cloud kurulumu için [docs/deploy-oracle.md](docs/deploy-oracle.md).

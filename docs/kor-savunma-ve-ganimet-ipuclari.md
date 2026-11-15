# Rakipler körlemesine savunur ve seçimlerde ganimet yazısı (Task 53)

## Rakip savunması

- Bilgisayar rakipler (düşman, boss, Elysia) **senin saldırını görmez**: savunmaları rastgele bir şekildir (tuvalin ortasına yakın, rastgele boyut ve konum).
  Becerili botlar biraz daha geniş ve merkeze yakın çizer (saldırıların çoğunlukla ortaya düştüğünü "sezerler"); beceriksiz botlar daha dağınık ve küçük çizer. Neyi kapatacaklarını bilmedikleri için isabet şansa bağlıdır.
- **Sen rakibin saldırısını görürsün** ve savunmanı ona göre çizersin (değişmedi).
- Denge simülasyonunda oyuncu vekili saldırıyı görmeye devam eder (`drawDefenseSeeing`), botlar görmez.

### Denge ayarı (boss canları)

Botlar savunmada ortalama daha zayıf olduğundan (becerili bosslar eskisi kadar isabetli kapatamıyor) boss canları vekil oyuncuya göre yeniden ayarlandı:

| Bölüm | Eski → yeni can | Kazanma |
|---|---|---|
| 1 | 310 → 250 | %87 |
| 2 | 330 → 462 | %73 |
| 3 | 462/352 → 494/377 | %73 |
| 4 | 561 → 600 | %80 |
| 5 | 609 → 627 | %65 |
| 6 | 784 → 745 | %63 |
| 7 | 784 → 1019 | %63 |
| 8 | 1064/476 → 1224/547 (Karanlık yol 784 → 902) | %53 |


## Seçmeli yerlerde ne kazanacağın

Ahlak ipuçları kaldırıldı. Savaşa girmeden önce açılan panellerde **ganimet** yazar (para ve XP kesin, diğerleri şans; hesap gerçek ganimetle aynı formül):

- **Dünya düşmanı:** "Kazanırsan: 27 Kor, 54 XP · ticari mal %60 · ekipman %14 · asa %7".
- **Maden:** üç zaferin toplam parası ve XP'si, her zaferde ganimet şansları (maden çarpanı ×1.5 dahil).
- **Sandık:** para ve XP, kesin 1 ekipman, 1-3 ticari mal, asa %50.
- Arena henüz ana dala birleşmedi; birleşince aynı yazı arena paneline eklenir.

Şanslar ahlak yolu ve ateş asasının düşme oranı çarpanını içerir. Element seçimi ipuçları (üstün/zayıf) olduğu gibi duruyor.

Kod: `battle/flow/bot.ts`, `boss/simulate.ts`, `boss/bosses.ts`, `enemies/lootPreview.ts`, `ui/worldFight.ts`, `ui/mineUi.ts`, `ui/chestUi.ts`, `game.ts`.

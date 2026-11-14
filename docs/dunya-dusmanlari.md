# Dünya düşmanları ve ganimet (Task 28)

## Düşmanlar

Haritada **32 düşman** durur (tohumla sabit yerler, `enemies/spots.ts`): yürünebilir yerlerde, surlardan, başlangıçtan ve birbirinden uzakta. Yanlarına gelince önce bir panel çıkar: düşman, elementi, seviyesi, canı ve senin canın. **Savaş** ya da **Kaç**.

- **Kaç:** düşman yerinde kalır. Uzaklaşıp dönmedikçe panel yeniden açılmaz.
- **Savaş:** boss savaşıyla aynı ekran. Oyuncu mevcut canıyla girer (kalıcı can, bkz. [han-ve-can.md](han-ve-can.md)), kazanınca kalan can yazılır. Yenilince "Tekrar dene" (girişteki canla) ya da "Pes et" (ölüm: [olum-ve-ekonomi.md](olum-ve-ekonomi.md)).
- **Yenilen düşman 4 dakika** (oyun süresiyle, oturumda) sonra aynı yerde geri gelir.

| Element | Düşman | Malzeme |
|---|---|---|
| Ateş | Köz Cini | Ateş Tozu |
| Su | Dalga Hayaleti | Kristal Parçası |
| Toprak | Taş Bekçi | Şifalı Ot |
| Hava | Fırtına Kurdu | Kurt Postu |

Elementler dönüşümlü dağılır. **Kademe** başlangıçtan uzaklığa göre belirlenir (16 / 28 / 40 karo): 1-4. Kademe 4 düşmanların adı "Kadim ...".

| Kademe | Seviye | Can | Güç |
|---|---|---|---|
| 1 | 2 | 114 | 64 |
| 2 | 5 | 150 | 70 |
| 3 | 9 | 198 | 78 |
| 4 | 14 | 258 | 88 |

Boss'lardan belirgin zayıftır (General Vael: 310 can, 115 güç). Zırh ve beceri seviyeyle artar (`enemyStats`).

## Ganimet paketi

Zaferde her zaman **altın ve XP** (seviyeye bağlı). Ayrıca şansla (temel oranlar `DROP_CHANCE`):

| Parça | Şans |
|---|---|
| Malzeme (1-2 adet) | %70 |
| Can iksiri (kademe 3+ ise Normal) | %20 |
| Ekipman (rastgele yuva, %60 düşmanın elementinden) | %18 |
| Asa (seviye ≤ oyuncu seviyesi + 2) | %8 |

**Nadirlik arttıkça düşme şansı azalır** (ekipman ve asada): Sıradan 60, Gelişmiş 25, Nadir 10, Destansı 3.5, Efsanevi 1.2, Mitik 0.3 ağırlık. Kademe yükseldikçe yüksek nadirliğin payı biraz artar (her kademe +%30 çarpan, nadirlik−1 kuvvetiyle) ama hep daha nadirdir. Destansı ve üstü ekipman toplam ekipman düşmelerinin yüzde on beşinden azıdır.

**Karanlık yol** (`dropRateMultiplier`: 1.1 / 1.2 / 1.3) bütün şansları çarpar (üst sınır %100).

## Çantaya sığmayan ganimet

Eşya ve asa önce çantaya girer. Sığmayanlar savaşın yapıldığı karoda **yere düşer ve 10 dakika kalır** ([envanter-ve-cantalar.md](envanter-ve-cantalar.md)); şehirde satıp boşaltıp dönebilirsin.

## Kod

`enemies/catalog.ts` (düşman sayıları, dövüşçüler), `enemies/loot.ts` (ganimet zarı), `enemies/applyLoot.ts` (çantaya ya da yere), `enemies/spots.ts` (yerleşim, geri gelme), `ui/worldFight.ts` (panel ve savaş), `world/WorldScene.ts` (sprite ve temas), `game.ts` (`fightEnemy`).

## Henüz yok

Bölgeye göre rastgele karşılaşma (Task 29), madenler (Task 30), korumalı sandıklar (Task 31). Savaşın içinde iksir hâlâ içilmez.

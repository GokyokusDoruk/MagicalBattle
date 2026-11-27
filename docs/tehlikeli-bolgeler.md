# Tehlikeli bölgeler (Task 62)

Haritada **5 tehlikeli bölge** vardır: Kızıl Vadi, Kemik Ovası, Kara Çukur, Sis Mezarlığı, Küllerin Çöplüğü. Her biri 9 karo yarıçaplı bir alandır.

## Haritada görünüm

- **Yerde:** kırmızı, nabız gibi atan alan, kırmızı çift halka, ortada büyük ☠ ve "⚠ Bölge adı"; halkanın üzerinde 8 küçük ☠.
- **Küçük haritada (minimap):** kırmızı dolgulu daire, açık kırmızı kenar ve ortasında ☠.
- **Bölgeye girince:** "⚠ Tehlikeli bölge: Kızıl Vadi. Çok sayıda güçlü düşman burada; hazırlıksız girme!"; çıkınca "Tehlikeli bölgeden çıktın."

## İçindeki düşmanlar

- Bölge başına **8-10 düşman** (toplam 47); alan başına yoğunluk normal haritanın yaklaşık **8 katıdır**.
- Hepsi yerin kademesinden daha güçlüdür: **kademe en az 3**, bölgeler uzakta olduğundan çoğu **kademe 4 (Kadim)**. Elementler dönüşümlü.
- Bölgedeki düşmanlar **%30 daha zengin ganimet** verir (düşme şansı çarpanı ×1.3). Her zamanki gibi yenilince 10 dakika sonra geri gelirler.

## Yerleşim

Tohumlu ve sabit: şehirlerden en az 17 (köylerden 12) karo, başlangıçtan en az 26 karo uzakta, birbirinden en az 28 karo ayrı, ulaşılabilir ve içinde yeterince açık zemin olan yerler.
Bölge düşmanları normal düşmanlardan, madenlerden ve sandıklardan en az 3 karo uzaktadır; mevcut düşman, maden ve sandık yerleşimi değişmedi.

Kod: `enemies/dangerZones.ts` (bölgeler, düşmanlar, `dangerZoneAt`, `WORLD_ENEMIES`), `world/WorldScene.ts` (`createDangerZones`), `ui/minimap.ts`, `game.ts` (uyarı ve ganimet çarpanı).

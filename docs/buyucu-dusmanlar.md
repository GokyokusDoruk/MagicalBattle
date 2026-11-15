# Büyücü düşmanlar ve görev bayrağı (Task 60)

## Düşman büyücüler

- Haritadaki yaratıklar artık **cüppeli büyücüler**: sivri şapka, yüz, cüppe ve ucunda elementin küresi olan asa. Cüppe rengi elementi gösterir
  (ateş kırmızı, su mavi, toprak kahverengi, hava beyaz). Kademe yükseldikçe sprite biraz büyür; hafifçe havada süzülür.
- **İsimleri:** "5. seviye Ateş Büyücüsü"; en güçlü kademe "14. seviye Kadim Ateş Büyücüsü" (`enemyTitle`). Haritada isim, **yaklaşınca** (7 karo)
  elementin renginde yazılır; uzaktaki ve yenilen düşmanların ismi gizlidir.
- Savaş içinde, ganimet panelinde ve tüm yazılarda aynı isim kullanılır ("Köz Cini", "Dalga Hayaleti"... yerine).
  Eski isimler: Köz Cini → Ateş Büyücüsü, Dalga Hayaleti → Su Büyücüsü, Taş Bekçi → Toprak Büyücüsü, Fırtına Kurdu → Hava Büyücüsü.

## Ana görev işareti

Eskiden havada sallanan sarı bir "!" yazısıydı. Şimdi **altın bir bayrak**: direk, dalgalı turuncu-sarı bayrak ve tepesinde parlak yuvarlak; altında yerde nabız gibi atan **altın halka**.
Ana görev aktif değilse (kapı kilitli ya da bölüm bitmiş) görünmez; takip oku ve üst ortadaki özet aynen duruyor.

Kod: `world/textures.ts` (`enemyKey` büyücü dokusu, `QUEST_FLAG_KEY`, `QUEST_RING_KEY`), `world/WorldScene.ts` (`createEnemies`, `updateEnemyLabels`, `createMarkerSprites`), `enemies/catalog.ts` (`enemyTitle`).

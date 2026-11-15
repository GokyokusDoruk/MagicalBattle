# Çalılık: geçiş ve karakterin çalıda görünmesi (Task 56)

## Karşılaşma geçişi (çalıdan çıkan savaş)

Sırayla, hepsi yumuşak geçişlerle:

1. Ekran iki kez yanıp söner.
2. Dünya **ekranın tam ortasına** doğru küçülür (ölçek ×0.42, parlaklık kısılır; dönme yok, eskiden hafif döndürüp geri büyütüyordu).
   Dönüşüm merkezi ekranın ortasıdır; doğrulandı: küçülen kutu ekranın tam ortasında kalır.
3. "Bir düşman büyücü ortaya çıktı!" ve düşmanın adı belirir.
4. Yazı söner, ekran yumuşakça kararır ve **savaş ekranı karanlıktan açılır** (450 ms). Dünya eski hâline savaş ekranının arkasında döner;
   geri büyüme görülmez.

Çalılık karşılaşmasında **hiçbir soru sorulmaz** (Task 55: panel yok, Kaç/Rüşvet yok), savaş otomatik başlar.

## Karakter çalıda

Çalılık karolarında karakterin önüne **yaprak katmanı** gelir: oyuncunun bulunduğu karo ve iki yanındaki çalı karoları üstte bir yaprak kümesiyle çizilir,
böylece karakterin başı ve gövdesi görünür, alt kısmı çalının içinde kalır. Kümeler hafifçe sallanır. En çok 3 küme çizilir (havuz yeniden kullanılır).

Kod: `ui/encounterIntro.ts`, `world/WorldScene.ts` (`updateBushes`), `world/textures.ts` (`BUSH_KEY`), `ui/worldFight.ts` (fade-in), `game.ts`.

# Korumalı sandıklar (Task 31)

Haritada **12 kapalı sandık** vardır (tohumla sabit yerler, `enemies/chests.ts`): yürünebilir yerlerde, surlardan, başlangıçtan, madenlerden ve düşmanlardan uzakta. Kademeler (başlangıca uzaklık) eşit dağıtılmıştır: her kademeden en az 2 sandık.

- **Muhafızlar:** sandığa yaklaşınca panel çıkar (muhafız elementi ve seviyesi, canın). **Savaş**ta **2 muhafızla peş peşe** savaşılır; can savaşlar arasında yenilenmez. Yenilgi ölümdür, "Kaç" yarıda bırakır (muhafızlar yenilenir). Muhafızlar normal düşman ganimeti de düşürür.
- **Sandığın içi** (ikisi de yenilince açılır):
  - Altın ve XP: dünya düşmanının 3 katı altın, 2 katı XP.
  - **Kesin 1 ekipman**; nadirlik zarı bir kademe yüksek atılır (Destansı ve üstü olabilir, hâlâ nadirdir).
  - %50 asa (seviye ≤ oyuncu seviyesi + 3), %70 iksir (karanlık yol çarpanı şansları artırır), 1-3 malzeme.
  - Sığmayan eşya yere düşer (10 dk).
- **Bir kez açılır:** açılan sandığın kimliği kayıttaki `collected` listesine yazılır (otlar ve kristallerle aynı yer, sunucu biçimi değişmedi); bir daha çıkmaz ve haritadan kalkar. Kayıt yalnızca şehirlerde yapıldığı için şehre varmadan çıkarsan açılış geri alınır ([backend.md](backend.md)).

Kod: `enemies/chests.ts` (yerleşim, muhafızlar, `rollChestLoot`), `ui/chestUi.ts` (panel), `world/WorldScene.ts` (çizim, temas), `game.ts` (`openChest`).

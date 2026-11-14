# Madenler (Task 30)

Her şehrin çevresinde **dört element madeni** vardır (ateş, hava, toprak, su; toplam 16). Şehrin köşegen yönlerinde, surların dışında, yaklaşık 11 karo uzaktadır; elementine göre renkli bir kaya girişi ve adı görünür (`enemies/mines.ts`).

- **Giriş:** madene yaklaşınca panel çıkar: element, düşman seviyeleri, canın. **Gir** ya da **Vazgeç**.
- **Üç savaş peş peşe:** her savaş öncesi dünya düşmanındaki gibi Savaş/Kaç paneli çıkar. Can savaşlar arasında yenilenmez (kalıcı can, iksir ve han madenin dışındadır). **Kaç** madenden çıkarır; yenilgi (Pes et) ölümdür.
- **Düşmanlar:** madenin elementinden; kademe yerin başlangıca uzaklığıyla belirlenir, **sonuncusu bir kademe güçlüdür** (en çok 4).
- **Ganimet:** her zaferde dünya düşmanıyla aynı karışık paket, ama düşme şansı **1,5 katı** (karanlık yol çarpanıyla birlikte); bkz. [dunya-dusmanlari.md](dunya-dusmanlari.md). Sığmayan eşya yere düşer.
- **Dinlenme:** ilk savaş başlayınca maden **10 dakika** (oyun süresiyle, oturumda) dinlenir; dinlenirken sönük çizilir ve girişte kalan süre söylenir. Yarıda çıkmak da süreyi başlatır.

Kod: `enemies/mines.ts` (yerleşim, düşmanlar, `MineBoard`), `ui/mineUi.ts` (giriş paneli), `world/WorldScene.ts` (çizim, temas), `game.ts` (`enterMine`, `fightSpot`).

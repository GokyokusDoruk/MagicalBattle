# Bitiriş büyüsü (Görev 68)

Savaşı **insan oyuncunun tarafı** kazandıran vuruştan sonra rakip sade bir yığılmayla değil, bir bitiriş büyüsüyle yıkılır.

## Sahne (`ArenaView.finisher`)
1. **Mühür çizilir (1 sn, yavaş çekim ×0.6):** Kazanan asayı kaldırır; son vuruşta çizdiği şekil havada belirir (çizimi kendisi, elementin renginde).
2. **Yükselir (1,1 sn):** Mühür büyür (×0.9 → ×3.1) ve rakibin tepesine çıkar; kamera onu izler.
3. **Toplanır (0,9 sn):** Kamera rakibin dibine iner, gökten parçacıklar yağar, ışık sütunu belirmeye başlar.
4. **Vuruş (1 sn, ×0.25 yavaş çekim):** Sütun gürler, yer şok dalgasıyla yayılır, kamera tam şiddetle sarsılır, "BİTİRİŞ!" yazısı çıkar, rakip yıkılır.
5. **Kapanış (1,2 sn):** Kamera geri çekilip yıkılan rakibi gösterir; zaman normale döner.

Toplam yaklaşık 6 saniye. Işık sütunu ve şok dalgası geçici nesnelerdir, bitince sahneden atılır ve bellekten bırakılır.

## Ne zaman çalışır?
- `report.defeated` ve savaşı kazanan takım, içinde insan bulunan takımsa (`engine.winner`).
- 2v2'de takım arkadaşı yenilince ya da oyuncu kaybedince sade `defeat` kalır.
- Dünya savaşları, boss savaşları ve arena aynı `BattleScreen` üzerinden gittiği için hepsinde çalışır.

Kod: `client/src/battle/arena/arenaView.ts` (`finisher`), çağrı: `client/src/ui/battleScreen.ts`.

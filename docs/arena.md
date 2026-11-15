# Arena (Task 48)

Her şehrin doğusunda (şehir merkezinden ~17 karo) bir arena durur: Ignis, Abyss, Stone Heart ve Still Crystal Arenası. Girişe gelince panel açılır.

## Kurallar

- **5 rakip peş peşe**; can savaşlar arasında yenilenmez. Elementler karışık, kademe yerin kademesinden başlar (1.-2. rakip: yerin kademesi, 3.-4.: +1, 5.: +2; en çok 4).
- **Ödül toplam galibiyet sayısına göre büyür** ve arena bitince bir kerede ödenir. Her galibiyetin para ve XP çarpanı artar: 1.5, 2, 3, 4, 6 (rakibin para/XP'sine göre).
- **İlk yenilgi arenayı bitirir** ve o ana kadarki galibiyetlerin ödülü ödenir. Savaş öncesi "Çekil (ödülü al)" da aynı şekilde arenayı bitirir.
- **Yenilgi ölüm değildir:** canın azami canın çeyreğine iner (en az 1). Yenilgi ekranında "tekrar dene" yoktur.
- **Ganimet zarları:** 2 galibiyette bir (şans ×1.5), 4 galibiyette bir daha (×2), 5/5'te büyük ödül zarı (×3.5); hepsi ekipman, asa ve ticari mal düşürebilir.
- Her galibiyet "savaş kazan" görevlerine sayılır.
- Girince arena **15 dakika** dinlenir (oturumda, madenler gibi); sönük çizilir. Panelden vazgeçersen dinlenme başlamaz.
- Rüşvet arenada yoktur. Ödül para birimi, arenanın bulunduğu bölgenin birimidir.

## Kod

`enemies/arena.ts` (yerleşim, rakipler, ödül hesabı), `ui/arenaUi.ts` (giriş ve sonuç paneli), `game.ts` (`enterArena`), `ui/worldFight.ts` (arena modu),
`world/WorldScene.ts` (arena çizimi ve giriş algısı), `world/textures.ts` (arena dokusu).

## Güncelleme (ana dalla birleştirme)

Arena, sonradan gelen değişikliklere uyarlandı:

- Rakipler artık büyücü isimleriyle ("14. seviye Kadim Hava Büyücüsü") ve **savaş öncesi panel yok**: her savaş doğrudan başlar, başta "Arena: rakip 2 / 5" yazar.
- Savaşın içinde sol altta **🏳 Çekil (ödülü al)** düğmesi vardır; rüşvet yoktur. Yenilgi arenayı bitirir (ölüm değil), "tekrar dene" yoktur.
- Giriş panelinde **ek ganimet şansları** yazar (2, 4 ve 5 galibiyette ticari mal / ekipman / asa şansı).
- Sonuç, kazanç varsa **ganimet paneli** ("Ganimetler toplandı", eşyalar ikonlu); hiç galibiyet yoksa kısa sonuç paneli.

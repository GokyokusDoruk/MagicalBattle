# Ekipman v3 (Task 36)

> Bu belge, [ekipman.md](ekipman.md) içindeki katalog ve element bonusu bölümlerinin **yerine geçer**. Şehir bonusu, tüccar stoğu ve diğer kısımlar orada kalır.

Kod: `client/src/economy/equipment.ts` (katalog, tablolar, kimlik), `economy/gearEffects.ts` (etki hesabı), `economy/gearStock.ts` (tüccar stoğu), `ui/itemIcon.ts` (ikon), `ui/itemText.ts`, `battle/flow/controller.ts` (kritik ve element bonusu savaşta).

## Katalog

**9 yuva × 4 element × 6 nadirlik × 30 seviye = 6480 eşya.** Kimlik: `eq-<yuva>-<element>-<nadirlik>-<seviye>` (örn. `eq-robe-earth-3-12`). Seviyesiz eski kimlikler (`eq-robe-earth-3`) kayıt yüklenirken **seviye 1**'e çevrilir.

| Yuva | Etkisi (seviye 1, Sıradan → Mistik) |
|---|---|
| **Cüppe** | zırh %4, 6, 9, 12, 16, **20** |
| **Şapka** | zırh %2, 3.5, 5, 7, 9, **12** |
| **Pantalon** | zırh %3, 5, 7, 10, 13, **16** |
| **Eldiven** (yeni) | zırh %1.5, 2.5, 4, 5.5, 7, **9** |
| **Çanta** | taşıma: 3/20/2, 5/40/3, 8/70/5, 12/110/7, 18/170/10, **26/250/14** (asa / eşya / kuşanılabilir) |
| **Ayakkabı** | yürüme hızı +%5, 8, 12, 16, 20, **25** |
| **Yüzük** | kritik şansı %2, 3, 4.5, 6, 8, **10**; büyü süresi +0.20, 0.35, 0.50, 0.70, 0.90, **1.20 sn** |
| **Bileklik** (yeni) | kritik ağırlıklı: şans ×1.4, süre ×0.6 (yüzüğe göre) |
| **Kolye** (yeni) | süre ağırlıklı: şans ×0.6, süre ×1.4 (yüzüğe göre) |

- **Seviye:** her seviye bütün etkileri +%2 artırır (seviye 30 = ×1.58); fiyat seviye başına +%8. Çanta kapasiteleri tam sayıya yuvarlanır.
- **Seviye şartı:** asalar gibi, oyuncu eşyanın seviyesine gelmeden **kuşanamaz** ("N. seviye ister"). Tüccar stoğunda seviyesi yetmeyen eşya kırmızı uyarıyla işaretlenir.
- **Zırh:** cüppe, şapka, pantalon ve eldivenin toplamı hasarı azaltır, `ARMOR_CAP` (%75) ile sınırlı.
- **Kritik:** yüzük, bileklik ve kolyenin şansları **toplanır** (üst sınır %75, `CRIT_CAP`). Kritik vuruş hasarı **×1.5** yapar. Savaşta "KRİTİK!" yazar, hasar kartında "KRİTİK vuruş ×1.5" satırı görünür. (Havanın ilerideki kritik yeteneği de aynı şansa eklenecek.)
- **Büyü süresi:** üç takının süreleri toplanır, asa bonusuyla birlikte çizim süresini uzatır.

## Element bonusu

Eskiden aynı elementteki zırh ve yüzük %50 güçlüydü; bu kural **kalktı**. Yerine:

> Kuşandığın **her** ekipman (9 yuvanın hepsi), **kendi elementinin büyüsünü** yaparken hasarı **%1 × nadirlik katsayısı** kadar artırır.

| Nadirlik | Katsayı | Parça başına | 4 parça |
|---|---|---|---|
| Sıradan | 0.25 | +%0.25 | +%1 |
| Gelişmiş | 0.5 | +%0.5 | +%2 |
| Nadir | 0.75 | +%0.75 | +%3 |
| Destansı | 1 | +%1 | +%4 |
| Efsanevi | 1.25 | +%1.25 | +%5 |
| Mistik | 1.5 | +%1.5 | +%6 |

Bonuslar toplanır (9 Mistik parça bir elementte +%13.5). Karma ekipmanda her element kendi parçalarının bonusunu alır. Yalnızca **saldırı hasarı** artar. Bonus, hasar kartında "Yetenek ve ekipman" satırında görünür.

## Görünüm

Eşya ikonunun **çerçevesi her zaman nadirliğin renginde** (Sıradan gri, Gelişmiş yeşil, Nadir mavi, Destansı mor, Efsanevi altın, Mistik pembe) ve sağ alt köşede **elementin sembolü** vardır (ateş alevi, su damlası, toprak dağı, hava girdabı).

## Ganimet ve tüccar

- Tüccar stoğundaki eşyaların seviyesi 1 ile oyuncu seviyesi + 5 arasındadır.
- Düşman ganimetindeki ekipman seviyesi 1 ile oyuncu seviyesi + 2, sandıkta + 3 arasındadır; yuva dokuzdan rastgele.

## Kayıt

Sunucu yeni yuva adlarını (`gloves`, `bracelet`, `necklace`) kabul eder; eşya kimliği biçimi (a-z, 0-9, -) aynı kalır, seviyeli kimlikler bunu karşılar.

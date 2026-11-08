# Asa envanteri ve birleştirme

Kod: `client/src/wands/` (katalog, envanter, savaş çözücüsü), `client/src/ui/wandUi.ts` (asa ekranı), `client/src/ui/merchantUi.ts` ("Asalar" sekmesi).

## Asalar

**6 nadirlik × 4 element × 2 rol (saldırı / savunma) = 48 asa.** Nadirlikler: Sıradan, Gelişmiş, Nadir, Destansı, Efsanevi, Mistik. Adlar örn. "Nadir Ateş Saldırı Asası", "Mistik Su Savunma Asası".

| Rol | Etki | Sıradan | Mistik |
|---|---|---|---|
| Saldırı asası | büyünün **taban gücünü** çarpar | x1.00 (etkisiz) | x1.75 |
| Savunma asası | **alınan hasarı** azaltır | -%0 | -%20 |

Nadirlik başına saldırı +%15, savunma -%4. Asa **kendi elementinin** büyüsünde işler: Ateş saldırı asası yalnızca ateş büyüsünün gücünü artırır. Asa kuşanılı değilse büyü, Sıradan asayla aynı (etkisiz) sayılır.

Asa etkisi yetenek ağacı ve ekipman çarpanlarıyla **çarpılır** (bkz. [yetenek-agaci.md](yetenek-agaci.md), [hasar-hesabi.md](hasar-hesabi.md)).

## Kuşanma

8 yuva var: her element için bir saldırı, bir savunma asası. Yeni asa, yuvası boşsa ya da daha yüksek nadirlikteyse **kendiliğinden kuşanılır**. Asa ekranından istediğini kuşanır ya da çıkarırsın.

## Birleştirme (5 → 1)

Aynı asadan **5 tane**, bir üst nadirlikte (aynı element ve rol) **1 asa** olur. Mistik en yüksek nadirliktir, birleşmez. Notlar:

- Sıradan'dan Mistik'e çıkmak için **3125 Sıradan asa** gerekir (5⁵); bu bilerek uzun bir hedeftir. Boss ve zindan ganimetleri (sonraki task'lar) üst nadirlikleri hızlandıracak.
- Kuşanılı asa birleştirmede tükenirse yuva boşalır ve sonuç asa kuşanılır.
- Sonuç asanın yığını doluysa (999) birleştirme reddedilir, hiçbir şey kaybolmaz.

## Asa nereden alınır

Üç köydeki **tüccarlar** "Asalar" sekmesinde **Sıradan** asa satar (tanesi **40 altın**, 8 çeşit). Üst nadirlikler yalnızca birleştirmeyle elde edilir.

## Oyunda

- **W** tuşu ya da sol üstteki **🪄 Asalar** düğmesi asa ekranını açar. Birleştirilebilir asa varsa düğme bunu söyler.
- Savaş denemesinde (`?lab=battle`) "Sen"e her yuvada seçtiğin nadirlikte asalar verilebilir (Asasız … Mistik).

## Kayıt

Kayıt dosyası **sürüm 4**: `wands` (asa kimliği → adet) ve `wandsEquipped` (yuva → asa kimliği). Eski (v1-v3) kayıtlar boş asalarla yükseltilir. Sunucu kimlikleri, en çok 48 çeşit, adet 1-999 ve yuva adlarını doğrular (bkz. [backend.md](backend.md)). Yüklerken bilinmeyen asalar atılır, sayılar sınırlanır, sahip olunmayan ya da yuvasına uymayan kuşanma yok sayılır.

Değişiklikler diğerleri gibi şehre girince kaydedilir.

## Ayarlar

`wands/catalog.ts`: `ATTACK_POWER_PER_RARITY`, `DEFENSE_REDUCTION_PER_RARITY`, `SYNTHESIS_COUNT`, `COMMON_WAND_PRICE`, adlar ve renkler.

Asalar boss savaşlarında oyuncunun savaşçısına `wands: wands.resolver` ile bağlıdır ([boss-savaslari.md](boss-savaslari.md)) ve savaş denemesinde de etkilidir.

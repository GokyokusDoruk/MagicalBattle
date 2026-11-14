# Asalar (v2: seviye, tek asa, rol dengesi)

Kod: `client/src/wands/` (`catalog.ts` asa modeli, `inventory.ts` envanter, `stock.ts` tüccar stoğu), `client/src/ui/wandUi.ts` (asa ekranı), `client/src/ui/merchantUi.ts` ("Asalar" sekmesi).

## Asa nedir

Her asa **element** (ateş, su, toprak, hava), **rol** (saldırı / savunma), **nadirlik** (1-6) ve **seviye** (1-30) taşır. Kimliği bunları içerir: `wand-fire-attack-3-12` (ateş, saldırı, Nadir, seviye 12). Toplam 4 × 2 × 6 × 30 = **1440 çeşit**. Bir asa, aynı çeşitten birden fazla taşınabilir (yığın).

Nadirlikler: Sıradan, Gelişmiş, Nadir, Destansı, Efsanevi, Mistik. Renk: element rengi (ateş kırmızı, su mavi, toprak kahverengi, hava beyaz), ad nadirlik renginde.

**Aynı anda tek asa kuşanılır.** Kuşanılı asa çantada yer kaplamaz, taşınanlar kaplar ([envanter-ve-cantalar.md](envanter-ve-cantalar.md)).

## Güç hesabı

**Güç göstergesi** `B = 0.04 × (nadirlik − 1) + 0.008 × (seviye − 1)` (Sıradan Sv1 = 0, Mistik Sv30 ≈ 0.43). Hem nadirlik hem seviye B'yi artırır, B de **saldırıyı, savunmayı ve büyü süresini** birlikte artırır.

| Etki | Formül |
|---|---|
| **Saldırı hasarı** | `(1 + B) × rol` (saldırı asası rol = 1.25, savunma asası = 0.75) |
| **Savunma gücü** | `(1 + B) × rol` (savunma asası rol = 1.25, saldırı asası = 0.75). Alınan hasar = 1 / savunma gücü |
| **Büyü süresi** | + `2 × B` saniye (çizim süresi 3 sn + bu). Hem saldırı hem savunma çiziminde |
| **Element eşleşmesi** | O döngüde seçtiğin element asanın elementiyle aynıysa saldırı hasarı **×1.5** (%50 daha fazla) |

Yani **saldırı asası** saldırırken %25 daha fazla vurur ama savunması %25 zayıflar; **savunma asası** tersi. Element bonusu yalnızca saldırı hasarında (savunmada yok).

Örnek (Nadir Ateş Saldırı Asası, Sv 1): saldırı +%35, ateş büyüsünde +%103; savunma -%19; büyü süresi +0.16 sn.

**Aceleyle çizim cezası** artık tanınan süreye göre ölçülür: asa süreyi uzatınca "tam kullanım" da uzar, süreyi boş geçirmek yine zayıf büyü verir.

Asasız (kuşanılı asa yok) savaşçının büyüleri etkisizdir (x1, 3 sn).

## Seviye şartı

**Asa, oyuncu seviyesi asanın seviyesine gelene kadar kullanılamaz** (kuşanılamaz; kuşanılı olsa bile etkisizdir). Seviyesi yetmeyen asa çantada kalır, seviyeye gelince kuşanılır. **Yüksek seviye oyuncu düşük seviye asayı kullanabilir.** Boşken eklenen asa, kullanılabiliyorsa kendiliğinden kuşanılır.

## Birleştirme yok

Asalar birleştirilmez (5 → 1 sistemi kaldırıldı). Yüksek nadirlik ve seviyeli asalar tüccardan (en çok Nadir) ve ileride ganimetten (Task 27) elde edilir.

## Tüccardan asa alma

Her tüccarın **5 asalık stoğu** vardır ve **5 dakikada bir yenilenir** (oyun açıkken):

- **En çok 1 Nadir** asa (tam olarak 1) bulunur ve **pahalıdır** (×1.5). Diğer 4'ü **Sıradan ya da Gelişmiş**.
- Element, rol ve seviye **rastgeledir**. Seviye 1 ile **oyuncu seviyesi + 5** arasındadır (biraz üstü de çıkar, hedef olur).
- Satın alınan asanın yeri **bir sonraki yenilemeye kadar boş** kalır (Nadir asa alınırsa yenilemeyi beklersin).
- Stok tüccar başınadır (her tüccar farklı asalar sunar), sayfa yenilenince sıfırlanır.

Asa satmak (asacıda) Task 25'te gelecek; ganimetten asa düşmesi Task 27'de.

### Fiyat

`fiyat = 40 × 2.2^(nadirlik−1) × (1 + 0.08 × (seviye−1))`, Nadir asa ×1.5. Örn. Sıradan Sv1 = 40, Gelişmiş Sv1 = 88, Nadir Sv1 = 194 (×1.5 = 291). Ahlak indirimi/zammı uygulanır.

## Oyunda

- **W** tuşu ya da sol üstteki **🪄 Asalar** düğmesi asa ekranını açar: kuşanılı asa ve etkileri, sahip olunan asalar (kuşan, çıkar). Seviyesi yetmeyen asa kırmızı "Sv" ile işaretlenir, Kuşan düğmesi kapalıdır.
- Tüccarın **Asalar** sekmesi stoğu ve yenilenmeye kalan süreyi gösterir.
- Savaş denemesinde (`?lab=battle`) rol, element ve nadirlik seçersin; asanın seviyesi karakter seviyesine eşittir.

## Kayıt

Kayıt dosyası **sürüm 6**: `wands` (asa kimliği → adet) ve `wandEquipped` (kuşanılı tek asa ya da `null`). Eski (v5) kayıtlar **sunucuda yükseltilir**: seviyesiz kimlikler seviye 1 olur, 8 yuvalı `wandsEquipped` listesinden en nadir asa kuşanılır (bkz. [backend.md](backend.md)). Yüklerken bilinmeyen asalar atılır; sahip olunmayan asa kuşanılmaz.

## Ayarlar

`wands/catalog.ts`: `RARITY_BONUS`, `LEVEL_BONUS`, `ROLE_UP`, `ROLE_DOWN`, `ELEMENT_MATCH`, `TIME_PER_STRENGTH_SEC`, fiyat sabitleri. `wands/stock.ts`: `STOCK_SIZE`, `ROTATION_MS`, `RARE_PREMIUM`, `LEVEL_HEADROOM`.

Asa boss savaşlarında oyuncunun savaşçısına `wands: wands.resolver` ile bağlıdır ([boss-savaslari.md](boss-savaslari.md)); boss dengesi asa modeline göre yeniden ayarlandı.

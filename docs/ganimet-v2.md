# Ganimet v2 (Task 37)

Kod: `client/src/enemies/loot.ts` (düşman ve maden ganimeti), `enemies/chests.ts` (sandık), `enemies/applyLoot.ts` (çantaya ya da yere), `quests/` (görevler), `economy/player.ts` (eski eşyaların paraya çevrilmesi).

## Ticari mallar (ganimet eşyası bunlardır)

| Mal | Element / şehir | Taban değer |
|---|---|---|
| **Kor Baharatı** | Ateş / Ignis | 30 |
| **Bulut İpeği** | Hava / Abyss | 40 |
| **Taş Cevheri** | Toprak / Stone Heart | 50 |
| **Derin İnci** | Su / Still Crystal | 70 |

Şifalı Ot, Kristal Parçası, Ateş Tozu ve Kurt Postu **kalktı**; haritadaki ot ve kristal toplama noktaları da kalktı. Eski kayıtlarda kalan bu eşyalar yarı değerlerinden **Kor**'a çevrilir (çantaya girmez).

## Düşman ganimeti

- **Kesin:** bölgenin para birimi ve XP. Miktar **zorluğa göre** çarpılır (aşağıda).
- **Şansla:** ticari mal, ekipman, asa. **Can iksiri artık düşmez** (han ve tüccardan alınır).

| Parça | Temel şans |
|---|---|
| Ticari mal (çoğu zaman düşmanın elementinin malı; 1-3 adet, kademe 3+ ise daha çok) | %60 |
| Ekipman (yuva rastgele, %60 düşmanın elementinden) | %14 (ikinci parça %3,5) |
| Asa | %7 (ikinci parça %1,75) |

- **En çok 2 parça** (ekipman + asa): iki ekipman, iki asa ya da biri biri. Fazlası atılır, en nadir parçalar kalır.
- **Nadirlik arttıkça şans azalır** (ağırlıklar 60, 25, 10, 3.5, 1.2, 0.3); yüksek kademede yüksek nadirlik biraz artar.
- **Zorluk çarpanı** = `0.7 + 0.3 × (düşman seviyesi / oyuncu seviyesi)`, 0.7 ile 1.6 arasında. Eşit seviyede ×1, düşman iki kat güçlüyse ×1.3, yarısı kadarsa ×0.85. Para, XP ve bütün eşya şanslarını çarpar: zor savaş daha çok, kolay savaş daha az verir.
- **Ahlak yolu** (karanlıkta ×1.1-1.3) ve ileride ateş asası (+%10) şansları çarpar.
- Ekipman seviyesi 1 ile oyuncu seviyesi + 2, asa seviyesi 1 ile + 2 arasındadır.

## Maden ve sandık

- **Maden:** her zaferde düşman ganimeti, şansları ×1.5 ve **ekstra ticari mal şansı** (%60 ek 1-2 mal).
- **Sandık:** bol para ve XP, **kesin 1 ekipman**, %50 asa, **kesin 1-3 ticari mal**. İksir yok. (Sandıkta "en çok 2 parça" kuralı kendiliğinden tutar: 1 ekipman + en çok 1 asa.)

## Görevler (yeniden yazıldı)

Yeni hedef türleri: **teslimat** (`N adet malı X şehrine götür`: mal çantandan alınır, hedef şehre varınca ve yeterince taşıyorsan görev biter; yetmiyorsa varınca bir şey olmaz), **maden** (bir madeni temizle), **sandık** (bir sandık aç). Toplama görevleri artık ticari malla çalışır; çantaya mal girince (ganimet, satın alma) ilerler, satmak ilerlemeyi geri almaz.

| Görev | Veren | Hedef | Ödül |
|---|---|---|---|
| Köz Avı | Ignis | 3 savaş kazan | 90 Kor, 60 XP |
| Baharat Sevkiyatı | Ignis | 5 Kor Baharatı → Abyss (seviye 2) | 160 Kor, 90 XP |
| Ignis'in Surlarını Gör | Abyss | Ignis'e gir | 90 Tüy, 60 XP |
| Muhafızlı Sandık | Abyss | bir sandık aç (seviye 3) | 150 Tüy, 100 XP |
| Madeni Temizle | Stone Heart | bir madeni temizle (seviye 3) | 220 Tunç, 140 XP |
| Cevher Sevkiyatı | Stone Heart | 4 Taş Cevheri → Still Crystal (seviye 3) | 190 Tunç, 110 XP |
| Dalga Avı | Still Crystal | 3 savaş kazan (seviye 3) | 150 Çiy, 120 XP, Can İksiri |
| İnci Sevkiyatı | Still Crystal | 3 Derin İnci → Stone Heart (seviye 2) | 170 Çiy, 100 XP |
| Stone Heart'a Haber | Still Crystal | Stone Heart'a gir (seviye 2) | 130 Çiy, 90 XP |

Her şehrin hanında en az 2 görev vardır. Ödüller, görevi veren şehrin para birimindedir.

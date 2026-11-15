# Özel büyü şekli (Task 58)

Her saldırı turunda saldıran bir **özel büyü şekli** alır. O şekli çizersen hasar **×1.25**; çizim şekle uymazsa bonus yok ("Özel büyü başarısız").

## Oyuncu tarafı

- Saldırı çizim ekranında, tuvalin üstünde küçük bir önizleme kartı: şeklin silueti ve adı ("Özel büyü: Üçgen — Bu şekli çizersen hasar ×1.25").
  **Tuvale hiçbir şey çizilmez**: nereye çizeceğini göstermez, sadece şekil görünür.
- Çizimden sonra ortada "✨ Özel büyü başarılı! Üçgen ×1.25" ya da "Özel büyü başarısız (Üçgen)". Başarılıysa detay ekranında "Özel büyü şekli ×1.25" satırı çıkar.
- Rakip saldırırken de aynı yazı çıkar ("Köz Cini: Özel büyü başarılı!").

## Şekiller (16)

Daire, yıldız, spiral, dalga, zikzak, üçgen, elmas, kalp, yıldırım, hilal, artı, sonsuzluk, ok, çarpı, yarım daire, kale.
Şekil her döngüde, saldıranın takımı ve sırasına göre dönüşümlü seçilir (zar atılmaz, aynı döngüde sabittir). Bu liste hem özel şekil hem de **rakip botların normal çizimleri** için kullanılır
(eskiden 5 şekil vardı).

## Şekil tanıma

- Çizilen çizgiler ve şablon, eşit aralıklı 96 noktaya örneklenir; ağırlık merkezi ve ortalama yarıçapa göre birimlenir (konum ve boyut önemsiz).
- Küçük dönmeler (±12°) tolere edilir; **yön önemlidir** (ters çizilmiş üçgen ya da aynalanmış ok tanınmaz).
- Ölçüt, iki nokta bulutu arasındaki simetrik ortalama en yakın komşu uzaklığıdır; **0.115** ve altı başarılıdır (`MATCH_THRESHOLD`).
- Ölçümler: küçük titremede tüm şekiller geçer; orta düzey elle bozulmada (en-boy farkı, ~6° dönme, titreme) 16 şeklin en az 12'si geçer; rastgele karalama hiçbirine uymaz.
  Birbirine en yakın şekiller (ör. daire/hilal) bir miktar karışabilir; en çok 6 yakın çift izin verilir (test).

## Botlar

Bot özel şekli beceri oranında dener (≈%20 + beceri×%60, en çok %90) ve el titremesi beceri düştükçe artar. Savunma yine körlemesine rastgeledir (Task 53).

## Denge

Oyuncu vekili ve botlar özel şekli çizebildiği için vekil oyuncunun kazanma oranı bir miktar arttı; boss canları yeniden ayarlandı:
bölüm 2: 462 → 490, 3: 494/377 → 534/407, 4: 600 → 624, 5: 627 → 677, 6: 745 → 775, 7: 1019 → 1100, 8: 1224/547 → 1322/591 (Karanlık yol 902 → 974).
Vekil oyuncuyla kazanma: 93 / 75 / 60 / 80 / 62 / 63 / 58 / 52 (bölüm 1-8).

Kod: `battle/flow/shapes.ts`, `battle/gesture/shapeMatch.ts`, `battle/flow/controller.ts` (`specialShapeFor`, `SPECIAL_SHAPE_BONUS`), `battle/flow/bot.ts`, `ui/battleScreen.ts` (önizleme ve yazılar).

## Görev 67: çizimin içinde şekil arama, 20 yeni şekil, %20 ince kalem

- **Şekil çizimin herhangi bir yerindeyse bonus verilir.** `matchShapeWithin` tüm çizimi, en uzun çizgileri, 2-3 çizgilik birleşimleri ve uzun çizgilerin yay parçalarını dener; en iyi eşleşme sayılır. Ekstra çizgiler özel şekil bonusunu (x1.25) bozmaz. Rastgele karalama eşleşmez.
- **36 şekil** (20 yeni: damla, hedef, ev, ağaç, yelkenli, bayrak, taç, kılıç, kalkan, bulut, çiçek, yaprak, balık, göz, çan, anahtar, kum saati, güneş, altıgen yıldız, mızrak). Hiçbir şekil çifti 0.085 altında değildir; normal insan titremesi 0.08 altında kalır.
- **Kalem %20 inceldi:** `BRUSH_RADIUS` 10 → 8. Tam güç kaplaması 0.18 → 0.145, savunma doluluk eşikleri 0.35/0.7 → 0.28/0.56, `MIN_INKED_CELLS` 24 → 20 olarak ölçeklendi; böylece aynı çizim aynı gücü verir. Özel şekil ve savunma çizimleri dahil tüm çizimler aynı kalemi kullanır.

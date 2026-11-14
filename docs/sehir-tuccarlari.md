# Şehir tüccarları, ticari mallar ve asacı (Task 26)

Köylerde artık tüccar yoktur. Dört şehrin her birinde surların içinde **iki esnaf** durur: solda **asacı**, sağda **tüccar**. Yanlarına gelince alışveriş ekranı açılır.

| Şehir | Element | Tüccar | Asacı | Asa fiyatı |
|---|---|---|---|---|
| Ignis Surları | Ateş | Tüccar Kazım | Asacı Ember | normal (×1.00) |
| Abyss Tapınağı | Hava | Tüccar Nesrin | Asacı Sefa | %10 pahalı (×1.10) |
| Stone Heart Kalesi | Toprak | Tüccar Boran | Asacı Dağdelen | %10 ucuz (×0.90) |
| Still Crystal | Su | Tüccar Deniz | Asacı Damla | %5 pahalı (×1.05) |

## Tüccar

Üç sekmesi vardır:

- **Alışveriş:** 5 dakikada bir yenilenen ekipman stoğu (5 eşya, tam bir tanesi Nadir ve %50 pahalı). Çantadaki ganimet, iksir ve ekipman değerinin yarısına satılır.
- **Ticaret:** dört ticari mal (aşağıda) alınır ve satılır.
- **Görevler:** yan görevler. Hedef bitince ödül kendiliğinden yatar. (Görevler Task 27'de han'a taşınacak.)

## Ticari mallar

Her element için bir mal vardır. Mallar çantada **eşya** yeri kaplar ve ağırlıkları yoktur, yalnızca adet sayılır.

| Mal | Element | Taban fiyat |
|---|---|---|
| Kor Baharatı | Ateş | 30 |
| Bulut İpeği | Hava | 40 |
| Taş Cevheri | Toprak | 50 |
| Derin İnci | Su | 70 |

Fiyat çarpanı, malın elementinin şehrin elementine **halka üzerindeki uzaklığına** bağlıdır. Halka: ateş → hava → toprak → su → ateş.

| Uzaklık | Çarpan | Örnek (Ignis) |
|---|---|---|
| 0 (şehrin kendi malı) | ×0.7 ucuz | Kor Baharatı 21 |
| 1 (komşu) | ×1.0 | Bulut İpeği 40, Derin İnci 70 |
| 2 (karşı) | ×1.4 pahalı | Taş Cevheri 70 |

- Tüccar malı, o şehirdeki fiyatın **%80'ine** alır, yani aynı şehirde alıp satmak zarardır.
- Ucuz şehirden alıp karşı şehirde satmak yaklaşık **%60 kâr** bırakır (0.7 → 1.4 × 0.8 = 1.12). Komşu şehre satmak %14 kâr bırakır.
- Ahlak çarpanları (indirim, satış primi) bu fiyatlara ayrıca uygulanır.
- Çanta kapasitesi (başlangıçta 20 eşya) taşınabilecek mal miktarını sınırlar; Taşıyıcı yetenekleri ve şehir bonusu bunu artırır.

## Asacı

Tek sekmesi vardır. **Asa** alınır ve satılır:

- **Satılık:** 5 dakikada bir yenilenen 5 asa (tam bir tanesi Nadir, %50 pahalı). Fiyat, asa fiyatı × şehir farkı × ahlak çarpanıdır.
- **Asaların:** çantadaki asalar. Asacı, asanın değerinin **yarısını** öder (şehir farkı ve ahlak satış çarpanı uygulanır). Kuşanılı asanın son kopyası satılamaz.
- Şehir farkı en çok ±%10 olduğundan şehirler arası asa alıp satarak kâr edilemez: asa alış fiyatı her zaman satış fiyatından yüksektir.

## Görevlerin yeri

Görevler şimdilik şehir tüccarlarındadır (Ignis: 2, Abyss: 2, Stone Heart: 2). Han gelince (Task 27) görevler han'a taşınacaktır.

## Şifacılar

Ölüm sonrası dirilme noktaları hâlâ köy şifacılarıdır (Ash, Vine, Bataklık). Han (Task 27) gelince şehirler de dirilme noktası olacak.

## Kod

`economy/merchants.ts` (esnaf listesi), `economy/trade.ts` (mallar, fiyat çarpanları, alım satım), `wands/shop.ts` (asa satışı), `world/merchantSpots.ts` (yerleşim), `ui/merchantUi.ts` (ekran).

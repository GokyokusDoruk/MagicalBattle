# Denge turu (Task 46)

Yetenekler (Task 42-45) oyuncuyu belirgin güçlendirdi; bu tur düşman, boss ve ekonomi sayılarını yetenekli oyuncuya göre ayarladı.
Ölçüm aracı `boss/simulate.ts`: bir bot "vekil oyuncu" (beceri 0.6) seviyesine göre tipik kitle (`typicalKit`: ekipman çarpanı, zırh, ateş asası)
ve tipik yetenek dağılımıyla (`typicalSkills`: puanlar sırayla ateş, su, toprak, hava; önce her yeteneğin 1. sonra 2. sonra 3. seviyesi) dövüşür.
Hepsi tohumludur; sonuçlar tekrarlanabilir. Kalıcı testler `boss/balance.test.ts` içindedir.

## Bulgular (ayarlamadan önce)

- Yetenekli oyuncu bosslara karşı çok güçlendi: 5-8. bölümler hedef seviyede **%100** kazanılıyordu (yeteneksizken %35-63).
- Dünya düşmanları, kendi seviyelerindeki yetenekli oyuncuya karşı **%100** kazanılıyordu ve oyuncu canının yalnızca %9-27'sini kaybediyordu.

## Yapılanlar

### Bosslara yetenek

Her bossa elle seçilmiş yetenekler verildi (`BossFoe.skills`); ana hikâye gücü oyuncu seviyesine bağlı değil, statik kalır:

| Bölüm | Boss | Yetenekler |
|---|---|---|
| 1 | Vael | yok (öğretici) |
| 2 | Ambargo Komutanı | Çamur Yaması 1, Sis Perdesi 1 |
| 3 | Tapınak Bekçisi / Rüzgâr Çırağı | Sarsıntılı Rüzgâr 1, Fırtına Nefesi 1 / Keskin Esinti 1 |
| 4 | Soylu Şampiyonu | Sarsıntı 1, Dağ Kalkanı 1, Çamur Yaması 1 |
| 5 | Kaelen | Sarsıntı 2, Çamur 2, Dağ Kalkanı 2, Taş Kabuk 1 |
| 6 | Morga | Sis 2, Buz Nefesi 2, Yansıyan Dalga 1, Çamur 1 |
| 7 | Morwenna | Sis 2, Buz Nefesi 2, Yansıyan Dalga 2, Şifa Kabarcıkları 2 |
| 8 | Malakor / Gölge | her elementten iki yetenek Sv 2 / Közleyen Alev 1 + Sarsıntılı Rüzgâr 1 |

### Boss canları

| Bölüm | Eski → yeni can | Yetenekli oyuncuyla kazanma (hedef seviye) |
|---|---|---|
| 2 | 300 → 330 | %83 |
| 3 | 420/320 → 462/352 | %83 |
| 4 | 510 → 561 | %68 |
| 5 | 580 → 609 | %53 |
| 6 | 560 → 784 | %63 |
| 7 | 560 → 784 | %63 |
| 8 | 760/340 → 1064/476 (Karanlık yol 560 → 784) | %55 |

Yeteneksiz oyuncu için 5-8. bölümler artık belirgin zordur: hedef seviyede yeteneklerini kullanmak gerekir.

### Dünya düşmanları

`ENEMY_TUNING` (`enemies/catalog.ts`): can ve güç çarpanları kademeye göre 1: ×1.5/×1.3, 2: ×1.6/×1.35, 3: ×1.75/×1.45, 4: ×1.9/×1.55.
Düşman başına para kazancı `6 + seviye×3` yerine `6 + seviye×4` oldu (rüşvet bedeli bunun 3 katı: 42 ile 186 arası).

| Kademe | Oyuncu seviyesi | Kazanma | Kaybedilen can |
|---|---|---|---|
| 1 | 2 | ~%100 | ~%21 |
| 2 | 5 | ~%100 | ~%39 |
| 3 | 9 | ~%90 | ~%61 |
| 4 | 14 | ~%78 | ~%72 |

### Ekonomi notu

Üst kademe bir savaş canın %60-70'ini götürüyor: bu, orta can iksirine (60 para, 150 can) göre savaş başına ~100 paralık iyileşme demek;
savaş başına gelir (para + ticari mal + ekipman şansı) ~75-90. Handa iyileşme bedava olduğu için dengeli tuttum: uzun yolculukta iksir
ya da han gerekiyor. İksir ve ekipman fiyatlarına dokunulmadı; oynanışta rahatsız ederse bir sonraki turda ayarlanır.

## Bilinen sınırlar

- Vekil oyuncu bir bottur; gerçek oyuncunun çizim kalitesi ve yetenek tercihleri farklıdır. Sayılar "tipik" oyuncuya göredir, oynayınca ayarlanır.
- Ganimet oranları (`DROP_CHANCE`) bu turda değişmedi.

# Geliştirme planı (Task 21 ve sonrası)

İlk 20 task tamamlandı (ana oyun baştan sona oynanabilir). Deneme sonrası gelen 8 madde aşağıdaki task'lara bölündü; her task ayrı bir PR'dır ve sırayla yapılır. Çok oyunculu arena (eski Task 21) en sona alındı (Task 29).

## Kararlar (senin cevapların)

| Konu | Karar |
|---|---|
| Asa fiyatı | Nadirliğe göre normal artar (5 aynı asanın birleşiminden kâr edilemez), **şehirler arası fark az** (en çok ±%10). Ticari eşyalarda fark büyük. |
| Maden tekrarı | Temizlenen maden **10 dakika** (oyun süresiyle) kapanır, sonra tekrar girilir. |
| Can | Savaşlar arası can **kalıcıdır**. **Han'da bedava dolum** (şehir kapısı açıksa). **Boss da mevcut canla başlar**: boss'tan önce başka savaşlar yaptıysan canın dolu olmaz. **Can iksirleri** bulunur, alınır, satılır, çantada taşınır ve istenen an kullanılır. |
| Çanta başlangıcı | **3 asa, 20 eşya, 2 kuşanılabilir eşya.** Kapasite dolunca fazla ganimet **yerde kalır, 10 dakika (oyun süresiyle) sonra kaybolur**; oyuncu şehirde satıp boşaltıp geri alabilir. |

Not: **Asa birleştirme (5 → 1) kaldırıldı** (Task 22).

## Görevler (güncel sıra)

| Task | İçerik | Madde |
|---|---|---|
| 21 | Envanter, ağırlık, çantalar (5 çanta), Taşıyıcı yetenekleri, iksir eşyaları (**bitti**) | 8 |
| **22** | **Asa v2:** seviye, tek asa, rol dengesi, element bonusu, büyü süresi, seviye şartı, 5 dakikada yenilenen tüccar stoğu; birleştirme kaldırıldı | asa |
| 23 | **Ekipman sistemi:** 6 yuva (Cüppe, Şapka, Pantalon, Çanta, Yüzük, Ayakkabı) × 4 element × 6 nadirlik = 144 eşya, renkli ikonlar, tur başına element bonusu, ayakkabı hızı, yüzük büyü süresi. Eski 12 ekipman ve 5 çantanın yerine geçer | ekipman |
| 24 | **Şehir bonusu** (ayakkabı hızı, çanta kapasitesi, kendi elementinin şehrinde +%50), şehirden çıkarken eşya bırakma, yerde kalan eşya (10 dk) | ekipman |
| 25 | **Şehir tüccarları** (köydekiler kalkar), 4 ticari eşya, şehre özel fiyat çarpanları, 5 dakikalık dönen ekipman stoğu (tek Nadir). **Asacı** (asa alım satım) | 4, 5 |
| 26 | **Han** (bedava can), şehir görevleri, kalıcı can, iksir kullanma, boss mevcut canla | 6 |
| 27 | **Dünya düşmanları ve ganimet** (karışık paketler, nadirlik arttıkça düşen şans, karanlık yolda artan oran) | 7 |
| 28 | **Bölge savaşları** (yeşillik, su, köz, rüzgâr; karo başına %10, savaştan sonra 5 sn koruma) | 2 |
| 29 | **Madenler** (şehir başına 4 element madeni, 3 düşman, 10 dk bekleme) | 1 |
| 30 | **Korumalı sandıklar** | 3 |
| 31 | Çok oyunculu 1v1 arena (Colyseus) | eski 21 |

## Kararlar (devamı)

| Konu | Karar |
|---|---|
| Asa | Seviye, tek asa, rol dengesi (%25), element bonusu (+%50 hasar), büyü süresi, seviye şartı: [asalar.md](asalar.md) |
| Ekipman | Seviye şartı yok, yalnız nadirlik. Nadirlik arttıkça ganimet düşme şansı azalır. Tüccar stoğu 5 dakikada bir yenilenir, 5 eşya, yalnızca 1 Nadir (pahalı) |
| Element bonusu | O turda seçilen büyünün elementine uyan eşyalar %50 daha güçlü |
| Şehir bonusu | Kendi elementinin şehrinde ayakkabı hızı ve çanta kapasitesi +%50; köyler çift elementli (ikisi de sayılır) |

## Task 21 tasarımı

**Kategoriler ve ağırlık:** Ağırlık "adet" olarak sayılır (hep tam sayı). Üç ayrı kapasite:

- **Asalar:** taşınan asa sayısı. Kuşanılı asalar sayılmaz.
- **Eşyalar:** ticari eşya ve can iksirleri.
- **Kuşanılabilir:** çantada taşınan (giyilmeyen) ekipman. Giyilen ekipman sayılmaz.
- **Altın ağırlık yapmaz.**

Başlangıç: **3 asa, 20 eşya, 2 kuşanılabilir.**

**Çantalar** ayrı bir kuşanma yeridir (Cüppe, Şapka, Tılsım gibi, "Çanta"). Çanta kuşanıldığında kapasiteye eklenir:

| Çanta | Nadirlik | Asa | Eşya | Kuşanılabilir | Fiyat |
|---|---|---|---|---|---|
| Küçük Çanta | Sıradan | +3 | +20 | +2 | 100 |
| Deri Çanta | Gelişmiş | +5 | +40 | +3 | 300 |
| Gezgin Çantası | Nadir | +8 | +70 | +5 | 800 |
| Usta Çantası | Destansı | +12 | +110 | +7 | ganimet |
| Efsunlu Çanta | Efsanevi | +18 | +170 | +10 | ganimet |

**Yetenek:** Yetenek ağacına 5. sekme **Taşıyıcı** (3 kademe, 1/2/3 puan): toplam +4 asa, +50 eşya, +4 kuşanılabilir.

**Can iksirleri** (Küçük, Orta, Büyük) eşya olarak katalogda, çantada yer kaplar ve alınıp satılabilir. Kullanılması kalıcı can geldiğinde (Task 24) açılır.

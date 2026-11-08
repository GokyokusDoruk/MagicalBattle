# Geliştirme planı (Task 21 ve sonrası)

İlk 20 task tamamlandı (ana oyun baştan sona oynanabilir). Deneme sonrası gelen 8 madde aşağıdaki task'lara bölündü; her task ayrı bir PR'dır ve sırayla yapılır. Çok oyunculu arena (eski Task 21) en sona alındı (Task 29).

## Kararlar (senin cevapların)

| Konu | Karar |
|---|---|
| Asa fiyatı | Nadirliğe göre normal artar (5 aynı asanın birleşiminden kâr edilemez), **şehirler arası fark az** (en çok ±%10). Ticari eşyalarda fark büyük. |
| Maden tekrarı | Temizlenen maden **10 dakika** (oyun süresiyle) kapanır, sonra tekrar girilir. |
| Can | Savaşlar arası can **kalıcıdır**. **Han'da bedava dolum** (şehir kapısı açıksa). **Boss da mevcut canla başlar**: boss'tan önce başka savaşlar yaptıysan canın dolu olmaz. **Can iksirleri** bulunur, alınır, satılır, çantada taşınır ve istenen an kullanılır. |
| Çanta başlangıcı | **3 asa, 20 eşya, 2 kuşanılabilir eşya.** Kapasite dolunca fazla ganimet **yerde kalır, 10 dakika (oyun süresiyle) sonra kaybolur**; oyuncu şehirde satıp boşaltıp geri alabilir. |

Not: 5 aynı asayı birleştirmek için en az 5 asa taşımak gerekir, başlangıç kapasitesi 3. Bu yüzden **ilk çanta ucuz ve erken alınabilir** (Küçük Çanta +3 asa), birleştirme çanta ile açılır.

## Görevler

| Task | İçerik | Madde |
|---|---|---|
| **21** | **Envanter, ağırlık ve çantalar:** eşya kategorileri, kapasite, 5 çanta, "Taşıyıcı" yetenek dalı, can iksiri eşyaları, çanta ekranı | 8 |
| 22 | **Şehir tüccarları ve ticari eşyalar:** şehrin içinde tüccar (köydekiler kalkar), 4 yeni ticari eşya, şehre özel fiyat çarpanları; ot ve kristal kalkar, görevler uyarlanır | 4 |
| 23 | **Asacı:** asa alım ve satımı (şehirler arası fark az) | 5 |
| 24 | **Han ve kalıcı can:** bedava can dolumu, şehir görevleri (yeni yan görevler, ödül anında), kalıcı can ve iksir kullanma, boss mevcut canla | 6 + can |
| 25 | **Dünya düşmanları ve ganimet:** düşman tanımları, ganimet tabloları (karışık paketler), karanlık yolda artan oran, nadir düşüşler, yerde kalan ganimet | 7 |
| 26 | **Bölge savaşları:** yeşillik (toprak), su kenarı (su), köz (ateş), rüzgârlı alan (hava); karo başına %10, savaştan sonra 5 sn koruma | 2 |
| 27 | **Madenler:** her şehrin çevresinde 4 element madeni, 3 düşman, ödül paketi, 10 dk bekleme | 1 |
| 28 | **Korumalı sandıklar:** haritaya sandıklar, koruyucu düşmanlar, sandıktan eşya, para, asa | 3 |
| 29 | Çok oyunculu 1v1 arena (Colyseus) | eski 21 |

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

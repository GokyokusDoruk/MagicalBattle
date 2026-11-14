# Yol haritası v2 (Task 35-46)

Task 21-31 bitti, Task 32 (çok oyunculu) iptal. Aşağıdaki tasarım kararları ve görevler yeni yönün özetidir. Her Task ayrı PR; bittikçe işaretlenir.

## Kararlar

### Para birimleri
- Altın **kalkıyor**. Dört birim: **Kor** (ateş, Ignis), **Çiy** (su, Still Crystal), **Tunç** (toprak, Stone Heart), **Tüy** (hava, Abyss).
- Her şehir kendi biriminde satar ve alır. Savaş, maden, sandık, görev ve düşman ödülü **bulunduğun/verildiği yerin** birimini verir. Köyde (iki element) iki birimden biri rastgele.
- Açık dünyada birim, **en yakın şehrin/bölgenin** elementidir.
- **Çevirme:** tüccarda tutar ve hedef birim seçilir; her çevirmede **%25 kayıp** (100 Kor → 75 Çiy).
- Yenilgi cezası, bulunduğun bölgenin biriminden düşer. Yetenek sıfırlama her birimden bir miktar ister.
- Eski kayıttaki altın Kor'a çevrilir.

### Ekipman
- **9 yuva:** Cüppe, Şapka, Pantalon, **Eldiven** (zırh); Çanta (taşıma); Ayakkabı (hız); Yüzük, **Bileklik**, **Kolye** (kritik şansı + büyü süresi).
- Her ekipmanın **nadirliği (1-6) ve seviyesi (1-30)** vardır; asalar gibi **seviye şartı** vardır. 9 yuva × 4 element × 6 nadirlik × 30 seviye = **6480** eşya.
- Zırh toplamı hasar azaltır. Çanta taşıma kapasitesini (asa, ekipman, ticari mal, iksir) artırır. Kritik şansları **toplanır** (üst sınır %75, kritik ×1.5, havanın yeteneğiyle de toplanır).
- **Element bonusu:** kuşandığın her ekipman, kendi elementinin büyüsünü yaparken hasarı **%1 × nadirlik katsayısı** kadar artırır (Sıradan 0.25, Gelişmiş 0.5, Nadir 0.75, Destansı 1, Efsanevi 1.25, Mistik 1.5). Eski ×1.5 element eşleşmesi kalkar.
- **Görsel:** eşya ikonunun çerçevesi **her zaman nadirlik renginde**, köşede element sembolü; savaş arenasında cüppe/şapka renkleri nadirliğe göre.

### Savaş çarpanları ve asa
- Element üstünlüğü ×1.25 / ×0.75. Asa elementi = seçilen büyü elementi ise **×1.25** (ekipmanla ilgisi yok).
- **Asa pasifleri:** hava +%25 hız; su her saniye azami canın %0.5'i kadar can yenileme; ateş eşya düşme şansı +%10; toprak azami taşıma kapasitesi +%25.

### Ganimet
- Kesin: **bölgenin para birimi + XP**. Şansa bağlı: ticari mal, ekipman (çanta dahil), asa. Bir savaştan **en çok 2 parça** (iki asa, iki ekipman ya da biri). Nadirlik arttıkça şans azalır, zor savaşta daha çok ganimet, madende ekstra mal.
- Şifalı Ot, Kristal Parçası, Ateş Tozu, Kurt Postu **kalkar**; ganimet malı = ticari mallar.

### Dünya
- Harita **büyür** (şehir ve köy yerleri korunur), baştan çizilir, hareket **kare kare** (yukarı/aşağı/sağ/sol), görünüm yumuşak (keskin kutular yok).
- **Çalılık** zemini: geçilebilir, karşılaşma yalnızca burada, her yeni karoda **%10**. Orman geçilmez kalır. Çimen ve kumsal karşılaşmaları kalkar.
- Haritada sabit düşmanlar durur (yanına gidince savaş), daha çok düşman, maden ve sandık.
- **Rüşvet:** para verirsen savaş olmaz, düşman haritadan kaybolur (savaşta yenilmiş gibi bir süre sonra geri gelir). Boss savaşlarında yok.

### Görevler
- Sol üstte **görev günlüğü** düğmesi: alınan tüm görevler (ana ve yan), birini aktif seç. Aktif görevin kısa özeti haritanın **üst ortasında** yazar, küçük bir **ok** hedefe yönlendirir.
- Görevler ticari mal, maden, sandık, düşman ve ziyaret hedefleriyle baştan yazılır; ödüller yerel para biriminde.

### Yetenek ağacı
- Eski yetenekler kalkar. Her elementin yeni yetenekleri (ateş 5, diğerleri 4), her yeteneğin 3 kademesi. Açmak 1 puan, her kademe artışı 1 puan (tam yetenek = 3 puan). Toplam 51 puan (ateş 15 + 3×12); Taşıyıcı dalı 6 puan kalır.
- **Ateş:** Közleyen Alev (yanma, birikmez), Kalkan Kıran, Alev Zinciri, Kıvılcım Saçması, **Yanık İzi** (pasif: rakibin çizim ekranında rastgele küçük kırmızı yara izleri; 1-2-3 iz; büyü çizerken izlere dokunursa ekran kızarır ve 0.2 sn kaybeder; botta zaman kaybı olarak hesaplanır).
- **Su:** Dondurucu Soğuk (rakibin büyü süresini kısaltır, dondurur, yavaşlatır), Şifa Balonu (can çalma, su balonu animasyonu, yeşil +can), Girdap Aynası (bloklanan hasarı rakibe yansıtır), Sis Perdesi (rakip savunma çizerken ekran bulanık; botların savunması zayıf).
- **Toprak:** Taş Kabuk (kalıcı zırh birikimi), Sarsıntı (%80+ isabette rakip sıradaki turu oynayamaz), Kaya Duvar (ekstra güçlü savunma), Çamur Seli (rakip savunma çizerken ekranda çamurlu yerler).
- **Hava:** Uzun Nefes (daha uzun çizim süresi), Keskin Rüzgâr (kritik), Rüzgâr Aynası (%80 olasılıkla bloklanan büyünün %10'u yansır), Fırtına Titremesi (rakip saldırı çizerken ekran titrer).

## Görevler (PR sırası)

| Task | İçerik | Durum |
|---|---|---|
| 35 | **Para birimleri:** Kor/Çiy/Tunç/Tüy, tüccarda çevirme, altının kalkması, kayıt sürümü 8 (cüzdan), fiyatlar şehre göre | |
| 36 | **Ekipman v3:** 9 yuva, seviye ve seviye şartı, kritik, element bonusu, çerçeve rengi ve element sembolü | |
| 37 | **Ganimet v2:** oranlar, para, ticari mal, en çok 2 parça, zorluğa göre artış, ot ve kristallerin kalkması | |
| 38 | **Çarpanlar ve asa pasifleri:** ×1.25 / ×0.75, asa bonusu ×1.25, hız, can yenileme, düşme şansı, taşıma | |
| 39 | **Yeni harita ve kare kare hareket:** harita büyür, yumuşak çizim, çalılık zemini, kayıt konumu geçişi | |
| 40 | **Karşılaşmalar:** çalılık %10, sabit düşmanlar, daha çok düşman/maden/sandık, rüşvet | |
| 41 | **Görev günlüğü:** düğme, aktif görev, üst yazı, ok, görevlerin yeniden yazımı | |
| 42 | **Ateş yetenekleri:** yeni yetenek sistemi, puan kuralı, yanma, kalkan kırma, zincir, saçma, yanık izi | |
| 43 | **Su yetenekleri** | |
| 44 | **Toprak yetenekleri** | |
| 45 | **Hava yetenekleri** | |
| 46 | **Denge turu:** boss simülasyonu, ganimet oranları, fiyatlar, düşman sayıları | |

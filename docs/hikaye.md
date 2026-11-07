# MagicalBattle - Hikâye Dokümanı

> Durum: **taslak, onay bekliyor.** Oyun içi tüm metinler Türkçe. Bu doküman onaylandıktan sonra
> diyaloglar `client/src/data/story/` altına veri olarak taşınacak (Task 6 ve 18).

## 1. Dünya

**Elmora**, dört elementin dengesiyle ayakta duran bir diyar: Ateş, Su, Toprak, Hava. Büyü, elde
çizilen şekillerle yapılır; bir büyücünün şekli ne kadar büyük, dolu ve kararlıysa büyü o kadar güçlüdür.

Yüzyıllardır dengeyi **Düzen Bekçileri** korurdu. Bir gece **Malakor**, yani **Gölge Hükümdarı**, dört
elementin kaynağını ele geçirdi, Bekçileri dağıttı ve diyarı dört surlu şehir ile dört köye böldü.
Şehirlerin kapıları halka kapatıldı, her şehre bir **general** ya da onun kuklası yerleştirildi.

Oyuncu, Bekçilerin son çırağıdır. Adını oyun başında kendisi seçer. Şehirleri tek tek özgürleştirir ve
Malakor'la yüzleşir.

## 2. Ana karakterler

| Karakter | Rol | Element | Not |
|---|---|---|---|
| **Oyuncu** | Son Bekçi çırağı | Dört elementi de kullanır | Ahlak puanı yönünü belirler |
| **Elysia** | Yoldaş, Rüzgar Büyücüsü | Hava | Neşeli, çabuk sinirlenen, Bekçilerin kayıp kızı. Her zaman yanında değil |
| **Malakor** | Gölge Hükümdarı, ana kötü | Gölge (4 element üstü) | Soğukkanlı, sakin konuşur |
| **General Vael** | Ateş generali | Ateş | Kaba kuvvet, kibirli |
| **General Kaelen** | Toprak generali | Toprak | Kale gibi sabırlı, az konuşur |
| **General Morwenna** | Su generali | Su | Zihin kontrolü, tatlı dilli |
| **Cadı Morga** | Bataklık cadısı | Su/Toprak | Önce düşman gibi görünür, sonra müttefik |

## 3. Şehirler ve köyler

| Yer | Tür | Element | Bölüm |
|---|---|---|---|
| Ignis Surları | Surlu şehir | Ateş | 1 |
| Ash Kanyon | Açık köy | Ateş/Hava | 2 |
| Abyss Tapınağı | Surlu şehir | Hava | 3 |
| Vine Surları | Açık köy | Hava/Toprak | 4 |
| Stone Heart Kalesi | Surlu şehir | Toprak | 5 |
| Sisli Bataklık | Açık köy | Toprak/Su | 6 |
| Still Crystal | Surlu şehir | Su | 7 |
| Cadı Sis Geçidi | Son arena | Gölge | 8 |

Köyler her zaman açıktır (tüccar, şifacı, yan görev). Şehir kapıları, o bölgenin ana görev zinciri
bitene kadar **kilitlidir**. Şehre girmek ve **save noktasını** aktifleştirmek bölümün bir ödülüdür.

## 4. Bölümler

Her bölümün sonunda bir **boss savaşı** vardır. "2v2" yazan yerlerde Elysia yanındadır; diğer
savaşlarda oyuncu tek başınadır.

### Bölüm 1 - Ignis Surları (Ateş şehri)
- **Hedef:** Şehrin kapısını açmak.
- **Strateji:** Köle işçi isyanı ve lav bacası sabotajı.
- **Olaylar:** Oyuncu surların dışındaki işçi kampına ulaşır. Köle işçilerden birinin haberiyle lav
  bacalarının nöbetçilerini oyalar. Bacaların basıncını bozarak surun ateş savunmasını çökertir.
- **Elysia:** Bölüm başında kısa bir sahnede tanışılır, savaşta yoktur.
- **Boss: General Vael.** Kaba kuvvet. Büyük ve güçlü saldırılar yapar, savunması zayıftır.
- **Ödül:** Ignis kapısı açılır, ilk save noktası.

### Bölüm 2 - Ash Kanyon (Ateş/Hava köyü)
- **Hedef:** Köyü ambargodan kurtarmak.
- **Strateji:** Tedarik zinciri ambargosunu kırmak.
- **Olaylar:** Köy, Malakor'un askerlerince kuşatılmış, erzak girmiyor. Oyuncu kervan yolunu açar.
  Köyün yaşlı demircisi **asa sentezini** tanıtır (5 aynı asa = 1 üst nadirlik).
- **Boss: Ambargo Komutanı.** Kervan yolunu tutan subay, savunma ağırlıklı.
- **Ödül:** Köy özgürleşir, tüccar fiyatları düşer.

### Bölüm 3 - Abyss Tapınağı (Hava şehri)
- **Hedef:** Tapınağa sızmak.
- **Strateji:** Sızma ve **2v2** savunma.
- **Olaylar:** Elysia ilk kez oyuncuya katılır. Birlikte tapınak muhafızlarına yakalanmadan geçerler.
  İlk 2v2 savaşı burada yaşanır, Elysia'nın rüzgar büyüsüyle tanışılır.
- **Boss: Tapınak Bekçisi (2v2).** İki kollu savaş, sıra tabanlı.
- **Ödül:** Abyss kapısı açılır, save noktası.

### Bölüm 4 - Vine Surları (Hava/Toprak köyü)
- **Hedef:** Köyün soylularını Malakor'dan koparmak.
- **Strateji:** Soyluları şantajla kendi tarafına çekmek.
- **Olaylar:** Köyün üç soylusunun gizli borçları ve sırları bulunur. Oyuncu bunları kullanıp
  kullanmayacağına karar verir (ahlak seçimi). Elysia son sahnede **yakalanır**.
- **Boss: Soylu Şampiyonu.** Zırhı güçlü, yavaş.
- **Ödül:** Vine kapıları açılır. Elysia kayıptır.

### Bölüm 5 - Stone Heart Kalesi (Toprak şehri)
- **Hedef:** Kalenin dış surunu yıkmak.
- **Strateji:** Deprem sabotajı.
- **Olaylar:** Oyuncu kalenin temelindeki taş çekirdeklere ulaşıp sarsıntıyı başlatır.
- **Boss: General Kaelen.** Çok sağlam, uzun süren savaş.
- **Ödül:** Fortress şehri özgürleşir, save noktası. Kaelen'in düşerken söylediği söz, Elysia'nın
  nerede tutulduğunu ele verir.

### Bölüm 6 - Sisli Bataklık (Toprak/Su köyü)
- **Hedef:** Köyü saran büyülü sisi temizlemek.
- **Strateji:** Sis perdesini kaldırmak, Cadı Morga'nın sınavını geçmek.
- **Olaylar:** Morga başta oyuncuyu düşman sanar. Sınavı geçmek için savaşılır.
- **Boss: Cadı Morga.** Sis ve yanılsama büyüleri. Yenilince müttefik olur, Still Crystal'a
  giden gizli yolu gösterir.
- **Ödül:** Bataklık köyü açılır.

### Bölüm 7 - Still Crystal (Su şehri)
- **Hedef:** Elysia'yı kurtarmak.
- **Strateji:** Su altı zindanına sızmak.
- **Olaylar:** Zindanda Elysia, Morwenna'nın zihin kontrolü altındadır.
- **Boss: General Morwenna.** Zihin kontrolü: savaşın bir bölümünde ekran çizimi bulanıklaşır.
- **Ödül:** Elysia kurtulur, Still Crystal özgürleşir, save noktası.

### Bölüm 8 - Cadı Sis Geçidi (Son arena)
- **Hedef:** Malakor'la yüzleşmek.
- **Olaylar:** Özgürleşen şehirlerin temsilcileri geçide toplanır. Oyuncu, ahlak yönüne göre ya
  onların desteğini alır ya da onları kullanır.
- **Boss: Malakor.**
  - **Düzen Bekçisi yolu:** Elysia ile **2v2**.
  - **Karanlık Büyücü yolu:** Oyuncu **tek başına** savaşır.
- **Final:** Bkz. bölüm 5 (Ahlak sistemi), "Final" paragrafı.

## 5. Ahlak sistemi

Oyuncunun bir **ahlak puanı** vardır (-100 ile +100 arası, oyuna 0 ile başlar). Hikâyedeki **her büyük
seçim** puanı iyi yönde (+) ya da kötü yönde (-) değiştirir, tarafsız seçim yoktur. Seçimin ağırlığına
göre puan 5 ile 15 arasında değişir. Sayılar ayarlanabilir.

Puan arttıkça (ya da eksildikçe) etkiler **kademeli olarak güçlenir**:

| Kademe | Puan | Düzen Bekçisi (+) | Karanlık Büyücü (-) |
|---|---|---|---|
| Yok | -19 ile +19 | Etki yok | Etki yok |
| I | ±20 ile ±49 | Hafif altın/mavi efekt, tüccar %5 indirim, görev altını +%10 | Hafif mor/siyah efekt, satış değeri +%5, düşme oranı +%10 |
| II | ±50 ile ±79 | Belirgin efekt, %10 indirim, görev altını +%20 | Belirgin efekt, satış +%10, düşme oranı +%20 |
| III | ±80 ile ±100 | Tam efekt, %15 indirim, görev altını +%30 | Tam efekt, satış +%15, düşme oranı +%30 |

**Final:** Bölüm 8'e girerken puan 0 ya da üstündeyse Düzen Bekçisi yolu (8 şehri Elysia ile
özgürleştirir, Malakor'la 2v2). Puan 0'ın altındaysa Karanlık Büyücü yolu (Elysia'ya ihanet eder,
mutlak tiran olur, Malakor'la tek başına). Ne kadar uç bir puandaysa final sahnesi o kadar güçlü
bir şekilde işlenir (kademeye göre farklı sahne metni).

### Seçimler (16 adet, bölüm başına 2)

| Bölüm | Seçim | İyi (+) | Kötü (-) |
|---|---|---|---|
| 1 | Esir köle işçiler | Hepsini kurtar | En güçlüleri ordun için al |
| 1 | Yaralı Ignis nöbetçisi | Şifacıya götür | Susturmak için bırak |
| 2 | Ambargodaki köylüler | Erzakı paylaştır | Fazlasını sat |
| 2 | Yakalanan kervancı | Serbest bırak | Eşyasına el koy |
| 3 | Tapınak bekçisi teslim olursa | Merhamet göster | Haberi ağzından almak için sıkıştır |
| 3 | Tapınağın kutsal emaneti | Yerinde bırak | Gücünü al |
| 4 | Soyluların sırları | Yalnız Malakor'dan kopmaları için kullan | Onları ezmek için kullan |
| 4 | Soylu şampiyonun ailesi | Zarar verme | Rehin al |
| 5 | Kale işçileri deprem sırasında | Önce onları tahliye et | Sabotajı aksatma, devam et |
| 5 | Kaelen'in son isteği | Yerine getir | Reddet |
| 6 | Cadı Morga yenilince | Bağışla | Gücünü al |
| 6 | Bataklık köylüleri sisten çıkarken | Hepsini koru | Önce yolu aç, geride kalanlar kalsın |
| 7 | Morwenna'nın zihin kontrolünü kıran büyü ona da zarar verir | Kır ve riske gir | Kırmadan Elysia'yı çek |
| 7 | Zindandaki mahkûmlar | Hepsini serbest bırak | Yalnız işine yarayanları al |
| 8 | Özgürleşen şehir temsilcileri | Gönüllü destek iste | Zorla ordu kur |
| 8 | Malakor'un teslim teklifi | Reddet | Kabul et ve gücü paylaş |

Bölüm 8'in iki seçimi, finalden önce puanı son kez değiştirir. Bu yüzden final yolu, puan bölüm 8'in
sonunda hesaplanarak belirlenir (yukarıdaki kural bölüm 8 seçimleri bittikten sonra uygulanır).

## 6. Elysia'nın seyri

| Bölüm | Durum |
|---|---|
| 1 | Tanışma sahnesi, savaşta yok |
| 2 | Kısa ziyaret, savaşta yok |
| 3 | Katılır, ilk **2v2** |
| 4 | **Yakalanır** (bölüm sonu sahnesi) |
| 5, 6 | Yok, oyuncu yalnız. Elysia'nın mektubu/sesi flashback olarak gelir |
| 7 | **Kurtarılır** |
| 8 | Düzen Bekçisi yolunda 2v2, Karanlık yolda ihanete uğrar |

## 7. Sunum biçimi

Ana görev sahneleri minimapte sarı ikonla başlar. Her sahnede:
- Bir **SVG resim** (koda çizilmiş, telifsiz).
- Arkada **Türkçe sesli okuma** (tarayıcı SpeechSynthesis).
- **Altyazı**.

Sahne verisi şu biçimde tutulacak (örnek):

```json
{
  "id": "b1-giris",
  "image": "ignis-surlari",
  "lines": [
    { "speaker": "Anlatıcı", "text": "Ignis'in kara surları ufukta yükseliyordu." },
    { "speaker": "Elysia", "text": "Kapılar kapalı. Başka bir yol bulmalıyız." }
  ]
}
```

## 8. Onaylanan kararlar

1. Oyuncunun **adı** oyun başında seçilir. Element seçimi yok, oyuncu dört elementin büyüsünü de kullanabilir.
2. Ahlak sistemi: her seçim iyi ya da kötü puan değiştirir, etkiler kademeli olarak artar (bölüm 5).
3. Bölüm 5 ve 6'daki Elysia flashback'leri onaylandı.

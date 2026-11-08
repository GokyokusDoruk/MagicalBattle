# Envanter, ağırlık ve çantalar

Kod: `client/src/inventory/carry.ts` (kapasite motoru), `client/src/economy/items.ts` (çanta ve iksir kataloğu), `client/src/ui/bagUi.ts` (çanta ekranı). Plan ve kararlar: [gelistirme-plani.md](gelistirme-plani.md).

## Ağırlık nasıl çalışıyor

Ağırlık **adet** olarak sayılır (hep tam sayı). Üç ayrı kapasite var:

| Kapasite | Neyi sayar | Başlangıç |
|---|---|---|
| **Asa** | Taşınan asalar. **Kuşanılı (tek) asa sayılmaz.** | 3 |
| **Eşya** | Ticari eşyalar ve can iksirleri | 20 |
| **Kuşanılabilir** | Çantada taşınan (giyilmeyen) ekipman. **Giyilen ekipman sayılmaz.** | 2 |

- **Altın ağırlık yapmaz.**
- Kapasite dolunca yeni eşya alınamaz: alışveriş reddedilir (**altın harcanmaz**), yerden toplama "Çantan dolu" der. Başlangıç sıkıdır; sık sık şehre gidip satmak gerekir.
- **Görev ödülü eşyaları** çantaya sığmazsa **kaybolmaz**, değerinin yarısı altın olarak verilir.
- Kapasite kuşanılan çanta ve Taşıyıcı yetenekleriyle artar.

> Dolan kapasitenin ganimetle (savaş, maden, sandık) nasıl davranacağı o task'larda gelecek: sığmayan ganimet **yerde kalır, 10 dakika (oyun süresiyle) sonra kaybolur**; şehirde satıp boşaltıp geri alınabilir (Task 25).

## Çantalar

Çanta ayrı bir kuşanma yeridir ("Çanta", cüppe/şapka/tılsım gibi). Kuşanılan çanta kapasiteye eklenir. Çanta giyiliyken yer kaplamaz; çıkarılırsa "Kuşanılabilir" yerinde 1 yer tutar.

| Çanta | Nadirlik | Asa | Eşya | Kuşanılabilir | Fiyat | Nerede |
|---|---|---|---|---|---|---|
| Küçük Çanta | Sıradan | +3 | +20 | +2 | 100 | Tüccar Kazım (Ash) |
| Deri Çanta | Gelişmiş | +5 | +40 | +3 | 300 | Tüccar Nesrin (Vine) |
| Gezgin Çantası | Nadir | +8 | +70 | +5 | 800 | Tüccar Boran (Bataklık) |
| Usta Çantası | Destansı | +12 | +110 | +7 | 2000 | ganimet (sonraki task'lar) |
| Efsunlu Çanta | Efsanevi | +18 | +170 | +10 | 5000 | ganimet (sonraki task'lar) |

Tüccarlar şu an köylerde duruyor; **Task 22'de şehirlerin içine taşınacak** (köylerdekiler kalkacak).

Kurallar:
- Yeni alınan çanta, eskisinden iyiyse **kendiliğinden kuşanılır**; eski çanta çantada kalır.
- Çantayı çıkarırken ya da daha küçüğüne geçerken **eldekiler yeni kapasiteye sığmıyorsa reddedilir** ("Önce fazlalığı sat ya da at").
- Ekipman değiştirince net yer artmaz (yeni giyilen çıkar, eskisi girer). Giyili ekipmanı çıkarmak için "Kuşanılabilir" yerinde yer gerekir.

## Taşıyıcı yetenekleri

Yetenek ağacının 5. sekmesi (**🎒 Taşıyıcı**), 3 kademe, **1 / 2 / 3 puan**, sırayla alınır:

| Kademe | Ad | Etki |
|---|---|---|
| 1 | Sağlam Omuzlar | +1 asa, +10 eşya, +1 kuşanılabilir |
| 2 | Düzenli Çanta | +1 asa, +15 eşya, +1 kuşanılabilir |
| 3 | Yük Ustası | +2 asa, +25 eşya, +2 kuşanılabilir |

Toplam **+4 asa, +50 eşya, +4 kuşanılabilir** (6 puan). Element yetenekleriyle aynı puan havuzundan harcanır (toplam 78 puan; 30. seviyede 58 puan var). Detay: [yetenek-agaci.md](yetenek-agaci.md).

## Can iksirleri

| İksir | Can | Fiyat |
|---|---|---|
| Küçük Can İksiri | 60 | 25 |
| Can İksiri | 150 | 60 |
| Büyük Can İksiri | 300 | 120 |

İksirler **eşya** yeri kaplar, alınıp satılabilir ve çantada taşınır. **Kullanmak** savaşlar arası can kalıcı olunca açılır (Task 24); tüccarlar da iksiri o zaman satmaya başlar.

## Çanta ekranı

**B** tuşu ya da sol üstteki **🎒 Çanta** düğmesi (özet: "Asa 2/6 · Eşya 12/20"). Gösterir:
- Üç kapasite çubuğu (dolunca sarı, aşılınca kırmızı).
- Kuşanılan çanta (**Çıkar**).
- Ticari eşyalar ve iksirler (**At**, **Hepsini at**).
- Çantadaki ekipman (**Kuşan**, **At**).

Atılan eşya **geri gelmez**: "At" iki tıklamayla onaylanır ("Emin misin?"). Asalar için **W** tuşu.

## Kayıt

Yeni alan yok: çanta `equipped.bag` olarak (diğer ekipmanlar gibi), Taşıyıcı yetenekleri `skills` içinde kaydedilir. Sunucu `bag` yuvasını kabul eder ve yetenek sınırı 39'a çıktı ([backend.md](backend.md)). Yüklerken kapasite denetlenmez (kayıt dolu olabilir); aşırı yüklüyken yeni eşya alınamaz.

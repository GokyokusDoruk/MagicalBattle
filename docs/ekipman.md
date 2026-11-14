# Ekipman (144 eşya)

Kod: `client/src/economy/equipment.ts` (katalog ve tablolar), `client/src/economy/gearEffects.ts` (tur başına etki), `client/src/economy/gearStock.ts` (tüccar stoğu), `client/src/ui/itemIcon.ts` (ikonlar), `client/src/ui/bagUi.ts` (ekipman ekranı).

## Katalog

**6 yuva × 4 element × 6 nadirlik = 144 eşya.** Seviye şartı **yok**, yalnızca nadirlik var. Nadirlikler asalarla aynı: Sıradan, Gelişmiş, Nadir, Destansı, Efsanevi, Mistik. Kimlik: `eq-<yuva>-<element>-<nadirlik>` (örn. `eq-robe-earth-3`). Eşya adı: "Destansı Su Pantolonu".

| Yuva | Etkisi | Sıradan → Mistik |
|---|---|---|
| **Cüppe** | zırh (hasar azaltma) | %4, 6, 9, 12, 16, **20** |
| **Şapka** | zırh | %2, 3.5, 5, 7, 9, **12** |
| **Pantalon** | zırh | %3, 5, 7, 10, 13, **16** |
| **Çanta** | taşıma kapasitesi (asa / eşya / kuşanılabilir) | 3/20/2, 5/40/3, 8/70/5, 12/110/7, 18/170/10, **26/250/14** |
| **Ayakkabı** | yürüme hızı | +%5, 8, 12, 16, 20, **25** |
| **Yüzük** | büyü süresi (çizim süresi uzar) | +0.20, 0.35, 0.50, 0.70, 0.90, **1.20 sn** |

Zırh parçaları yüzükten **daha çok zırh**, yüzük zırh parçalarından **daha çok büyü süresi** verir (zırh parçası süre vermez). Üç zırh parçası birlikte en çok %48 verir; toplam zırh `%75` sınırını aşmaz (`ARMOR_CAP`). **Aynı yuvada element etkiyi değiştirmez**, elementin değeri bonuslarda ortaya çıkar (aşağıda).

Fiyat: yuva taban fiyatı (Cüppe 60, Şapka 40, Pantalon 50, Çanta 100, Ayakkabı 70, Yüzük 90) × nadirlik başına **2.2**.

## Element bonusu (tur başına)

Savaşta her **döngünün başında** gizlice tek element seçersin; bu element o döngüde hem saldırın hem savunmandır. **Seçtiğin elementle aynı elementteki zırh parçaları ve yüzük %50 daha güçlüdür** (o döngü için):

- **Zırh:** Savunurken o döngüde seçtiğin elemente göre hesaplanır (saldırdığın elementle aynı). Örn. ateş cüppesi + su şapkası giyiyorsan ateş seçtiğinde cüppe %50 daha çok zırh verir, su seçtiğinde şapka verir.
- **Yüzük:** Yüzüğün elementi büyünün elementiyle aynıysa süre %50 daha uzun uzar. Hem saldırı hem savunma çiziminde. Süre, asa bonusuyla toplanır.
- Hepsi aynı elementten tam set (cüppe + şapka + pantalon + yüzük) giyen oyuncu o elementin büyüsünde en güçlüsüdür, ama rakip elementle üstünlük kurarsa (su → ateş) bu avantajı kapatabilir. Karma set her elementte orta güçte kalır.

Ayakkabı ve çanta element bonusunu **şehirlerde** alır (kendi elementinin şehrinde %50): **Task 24'te** gelecek. Şimdi ayakkabı hızı ve çanta kapasitesi taban değerleriyle çalışıyor.

## Ekipman ve diğer sistemler

- **Büyü süresi** üç kaynaktan birikir: temel 3 sn + asa + yüzük. Aceleyle çizim cezası, tanınan toplam süreye göre ölçülür ([asalar.md](asalar.md)).
- **Yürüme hızı:** ayakkabı dünyadaki yürüme hızını artırır.
- **Kapasite:** çanta kuşanınca kapasiteye eklenir; kuralları [envanter-ve-cantalar.md](envanter-ve-cantalar.md) içinde. Aynı eşyadan birden fazla kopya taşınabilir; giyilen kopya yer kaplamaz.
- **Boss savaşları:** oyuncunun zırhı ve yüzük süresi seçilen büyüye göre hesaplanır ([boss-savaslari.md](boss-savaslari.md)).

## Tüccardan alma

Her tüccarın **5 eşyalık** stoğu **5 dakikada bir** yenilenir (oyun açıkken): **tam 1 Nadir** eşya (pahalı, ×1.5), diğerleri **Sıradan ya da Gelişmiş**. Yuva ve element rastgeledir. Satın alınanın yeri bir sonraki yenilemeye kadar boş kalır. Yüksek nadirlik (Destansı ve üstü) tüccarda satılmaz; ileride savaş, maden ve sandık ganimetinden çıkacak, nadirlik arttıkça düşme şansı azalacak (Task 27-30).

Satın alınan eşya, o yuva boşsa ya da yeni eşya daha nadirse **kendiliğinden kuşanılır**. Tüccar eşyanı değerinin yarısına alır; giyilen tek kopya satılamaz.

## İkonlar

Her eşyanın koda çizilmiş (telifsiz) bir ikonu var. **Renk elementi belli eder:** ateş kırmızı, su mavi, toprak kahverengi, hava beyaz. **Nadirlik arttıkça gösterişli:** Sıradan sade; Gelişmiş yeşil halka; Nadir mavi halka ve parıltı; Destansı mor halka ve kıvılcımlar; Efsanevi altın çift halka; Mistik pembe ışınlar ve parlayan yıldız.

## Eski ekipman ve kayıt

Eski kayıtlarda 7 zırh eşyası ve 5 çanta vardı. Yeni oyunda **dönüşür**, kimse ekipmanını kaybetmez: Çırak/Bekçi Cüppesi → toprak/hava cüppeleri, şapkalar → toprak/hava şapkalar, **tılsımlar → yüzük** (tılsım yuvası kalktı), çantalar → toprak çantalar (aynı nadirlik). Tablo `LEGACY_ITEMS`. Sunucu eski `amulet` yuvasını okumaya devam eder, istemci yüklerken yüzüğe çevirir ([backend.md](backend.md)).

## Ayarlar

`equipment.ts`: `ARMOR_BY_SLOT`, `BAG_BY_RARITY`, `BOOTS_SPEED`, `RING_TIME_SEC`, `BASE_PRICE`, `PRICE_PER_RARITY`, `GEAR_ELEMENT_MATCH`. Stok kuralları ortak: `wands/stock.ts` (`STOCK_SIZE`, `ROTATION_MS`, `RARE_PREMIUM`).

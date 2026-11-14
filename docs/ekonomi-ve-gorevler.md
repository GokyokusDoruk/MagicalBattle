# Tüccar, ekonomi ve yan görevler

Kod: `client/src/economy/` (altın, XP, eşya, alışveriş), `client/src/quests/` (yan görevler), `client/src/ui/merchantUi.ts` (ekran).

## Oyunda nasıl çalışıyor

- **Dört şehirde** (Ignis, Abyss, Stone Heart, Still Crystal) birer **tüccar** ve birer **asacı** durur; köylerde tüccar yoktur (Task 26, bkz. [sehir-tuccarlari.md](sehir-tuccarlari.md)). Tezgâhına yaklaşınca alışveriş ekranı kendiliğinden açılır (Esc ya da dışarı tıklayınca kapanır; açıkken karakter durur).
- **Alışveriş sekmesi:** ekipman satın alırsın; çantandaki ganimeti satarsın (tüccar değerin yarısını öder); ekipmanı kuşanıp çıkarırsın.
- **Görevler sekmesi:** köyün yan görevlerini görürsün (aktif, alabileceğin, kilitli, tamamlanan). "Kabul et" ile başlarsın.
- **Ödül kendiliğinden gelir:** görev hedefi bitince altın, XP ve eşya doğrudan çantana yatar, tüccara dönüp teslim etmen gerekmez.
- Sol üstte **durum çubuğu**: seviye, altın, XP çubuğu ve aktif görevlerin ilerlemesi.

## Dünyada toplanabilir eşyalar

Haritada **28 şifalı ot** (çimende) ve **12 kristal parçası** (kumsalda) var. Üstlerinden geçince çantana girer. Bir kez toplanan, kayıtla birlikte **bir daha çıkmaz** (altın kasmak için tekrar toplanamaz). Hepsi başlangıçtan yürünebilir, surların dışında.

## Ekipman ve zırh

Ekipman **6 yuva × 4 element × 6 nadirlik = 144 eşya** olarak yeniden tasarlandı: Cüppe, Şapka, Pantalon (zırh), Çanta (kapasite), Ayakkabı (hız), Yüzük (büyü süresi). Tüm tablo, element bonusu ve tüccar stoğu için: [ekipman.md](ekipman.md).

Tüccarlar köylerde duruyor ve ekipmanı **5 dakikada bir yenilenen 5 eşyalık stoktan** satıyor (tek Nadir). Ganimeti (ot, kristal, ateş tozu, kurt postu) değerinin yarısına alıyor. Çantaya sığmayan görev ödülü eşyaları altına çevrilir.

> Zırh boss savaşlarında kullanılır; seçilen büyünün elementine göre hesaplanır ([boss-savaslari.md](boss-savaslari.md)).

## Seviye

XP eğrisi: seviye 2 = 100 XP, 3 = 300, 4 = 600, 5 = 1000... (`50 × (n−1) × n`), en yüksek seviye 30. Her seviye bir öncekinden daha çok XP ister.

## Yan görevler

| Görev | Köy | Hedef | Ödül | Şart |
|---|---|---|---|---|
| Şifalı Ot Toplama | Ash | 5 ot topla | 60 altın, 40 XP | - |
| Ignis'in Surlarını Gör | Ash | Ignis'in surlarına gir | 90 altın, 60 XP, 2 Ateş Tozu | Ignis kapısı açık olmalı |
| Kristal Avı | Vine | 3 kristal topla | 120 altın, 70 XP | - |
| Tapınağın Sessizliği | Vine | Abyss'e gir | 150 altın, 90 XP, Kurt Postu | Seviye 2 |
| Sis Otları Sepeti | Bataklık | 8 ot topla | 100 altın, 80 XP, 2 Ateş Tozu | Seviye 2 |
| Kristalin Şehri | Bataklık | Still Crystal'a gir | 220 altın, 140 XP | Seviye 3 |
| Dalga Avı | Still Crystal (han) | 3 savaş kazan (düşman, bölge, maden, sandık) | 150 altın, 120 XP, Can İksiri | Seviye 3 |
| Stone Heart'a Haber | Still Crystal (han) | Stone Heart'a gir | 130 altın, 90 XP | Seviye 2 |

Kurallar:
- **Toplama görevlerinde** kabul anında çantandaki eşya sayılır (önceden topladıkların boşa gitmez). Sonra toplananlar eklenir; **eşyayı satmak ilerlemeyi geri almaz**. Görev eşyaları tüketmez, çantada kalır.
- **Konum görevleri** bir konuma girince tamamlanır (şehirde surların içi, köyde köy alanı).
- Tamamlanan görev bir daha ödül vermez ve tekrar alınamaz.
- Savaş görevi türü (`battleWon`) her boss zaferinde tetiklenir ([boss-savaslari.md](boss-savaslari.md)).

## Kayıt

Kayıt dosyası **sürüm 2**'de altın, XP, çanta, kuşanılan ekipman, görevler ve toplanan eşyalar eklendi (sürüm 3'te yetenekler eklendi, bkz. [yetenek-agaci.md](yetenek-agaci.md)). Eski kayıtlar açılırken varsayılanlarla otomatik yükseltilir, oyuncu bir şey kaybetmez. Sunucu hepsini doğrular (bkz. [backend.md](backend.md)).

Kayıt yine **yalnızca şehirlerde** yapılır. Tüccarlar köylerde olduğu için son kayıt noktasından sonra olan değişiklikler (alışveriş, görev, toplama) sunucuya yazılmamıştır; bunu sol üstteki durum çubuğunda **"● Kaydedilmedi: bir şehre girince kaydedilir"** uyarısı gösterir. Kayıtsız modda bu uyarı çıkmaz.

## Ayarlar ve genişletme

- Eşyalar, fiyatlar, zırh değerleri: `economy/items.ts`. Tüccarların stoku: `economy/merchants.ts`.
- Yeni görev eklemek için `quests/catalog.ts` dosyasına bir kayıt yeterli.
- Ahlak sistemi bu kancalara bağlı (Task 18, bkz. [diyalog-ve-ahlak.md](diyalog-ve-ahlak.md)): tüccar alış/satış fiyat çarpanları (`MerchantUiDeps.priceMultipliers`) ve görev altın çarpanı (`QuestEngine.goldMultiplier`).

# Tüccar, ekonomi ve yan görevler

Kod: `client/src/economy/` (altın, XP, eşya, alışveriş), `client/src/quests/` (yan görevler), `client/src/ui/merchantUi.ts` (ekran).

## Oyunda nasıl çalışıyor

- **Üç köyde** (Ash Kanyon, Vine Surları, Sisli Bataklık) birer **tüccar** durur. Tezgâhına yaklaşınca alışveriş ekranı kendiliğinden açılır (Esc ya da dışarı tıklayınca kapanır; açıkken karakter durur).
- **Alışveriş sekmesi:** ekipman satın alırsın; çantandaki ganimeti satarsın (tüccar değerin yarısını öder); ekipmanı kuşanıp çıkarırsın.
- **Görevler sekmesi:** köyün yan görevlerini görürsün (aktif, alabileceğin, kilitli, tamamlanan). "Kabul et" ile başlarsın.
- **Ödül kendiliğinden gelir:** görev hedefi bitince altın, XP ve eşya doğrudan çantana yatar, tüccara dönüp teslim etmen gerekmez.
- Sol üstte **durum çubuğu**: seviye, altın, XP çubuğu ve aktif görevlerin ilerlemesi.

## Dünyada toplanabilir eşyalar

Haritada **28 şifalı ot** (çimende) ve **12 kristal parçası** (kumsalda) var. Üstlerinden geçince çantana girer. Bir kez toplanan, kayıtla birlikte **bir daha çıkmaz** (altın kasmak için tekrar toplanamaz). Hepsi başlangıçtan yürünebilir, surların dışında.

## Ekipman ve zırh

Üç yer var: **Cüppe, Şapka, Tılsım**; her yere bir ekipman kuşanılır. Ekipmanlar **toplam zırhı** artırır (tek bir hasar azaltma yüzdesi, baş/gövde ayrımı yok, üst sınır %75). Daha pahalı ekipman aynı yerde daha çok zırh verir.

| Ekipman | Yer | Zırh | Fiyat | Satan |
|---|---|---|---|---|
| Çırak Cüppesi | Cüppe | %5 | 60 | Kazım (Ash) |
| Yün Şapka | Şapka | %3 | 40 | Kazım |
| Taş Tılsım | Tılsım | %4 | 90 | Kazım |
| Gezgin Cüppesi | Cüppe | %10 | 180 | Nesrin (Vine) |
| Tılsımlı Şapka | Şapka | %7 | 150 | Nesrin |
| Bekçi Cüppesi | Cüppe | %18 | 520 | Boran (Bataklık) |
| Rüzgâr Tılsımı | Tılsım | %8 | 260 | Boran |

Yeni aldığın ekipman, o yer boşsa ya da daha çok zırh veriyorsa **kendiliğinden kuşanılır**. Ekipman tektir (ikinci kez alınmaz); kuşanılı ekipman satılamaz (önce çıkar). Al-sat döngüsünden kâr edilemez.

> Zırh şu an yalnızca hesaplanıyor. Savaşta kullanılması, dünyadaki savaşlar (boss'lar, Task 19) ve ölüm/ekonomi (Task 20) bağlanınca olacak. `PlayerState.armor` savaşçının zırhı olarak verilecek.

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

Kurallar:
- **Toplama görevlerinde** kabul anında çantandaki eşya sayılır (önceden topladıkların boşa gitmez). Sonra toplananlar eklenir; **eşyayı satmak ilerlemeyi geri almaz**. Görev eşyaları tüketmez, çantada kalır.
- **Konum görevleri** bir konuma girince tamamlanır (şehirde surların içi, köyde köy alanı).
- Tamamlanan görev bir daha ödül vermez ve tekrar alınamaz.
- Savaş görevi türü (`battleWon`) motorda hazır; dünyadaki savaşlar gelince (Task 19) kullanılacak.

## Kayıt

Kayıt dosyası **sürüm 2**'de altın, XP, çanta, kuşanılan ekipman, görevler ve toplanan eşyalar eklendi (sürüm 3'te yetenekler eklendi, bkz. [yetenek-agaci.md](yetenek-agaci.md)). Eski kayıtlar açılırken varsayılanlarla otomatik yükseltilir, oyuncu bir şey kaybetmez. Sunucu hepsini doğrular (bkz. [backend.md](backend.md)).

Kayıt yine **yalnızca şehirlerde** yapılır. Tüccarlar köylerde olduğu için son kayıt noktasından sonra olan değişiklikler (alışveriş, görev, toplama) sunucuya yazılmamıştır; bunu sol üstteki durum çubuğunda **"● Kaydedilmedi: bir şehre girince kaydedilir"** uyarısı gösterir. Kayıtsız modda bu uyarı çıkmaz.

## Ayarlar ve genişletme

- Eşyalar, fiyatlar, zırh değerleri: `economy/items.ts`. Tüccarların stoku: `economy/merchants.ts`.
- Yeni görev eklemek için `quests/catalog.ts` dosyasına bir kayıt yeterli.
- Ahlak sistemi bu kancalara bağlı (Task 18, bkz. [diyalog-ve-ahlak.md](diyalog-ve-ahlak.md)): tüccar alış/satış fiyat çarpanları (`MerchantUiDeps.priceMultipliers`) ve görev altın çarpanı (`QuestEngine.goldMultiplier`).

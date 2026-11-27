# MagicalBattle iyileştirme planı (7 faz, her faz ayrı PR)

Durum: **onaylandı.** Faz 1, 2 ve 3 bitti, sıradaki Faz 4.
Her faz `claude/vibrant-cori-xcmkk6` dalından açılan ayrı bir PR'dır; canlıda (magicalbattle.dorukplays.com) tek tek test edilir.
Modeller: yalnızca CC0 (lisanssız) kaynaklar (Quaternius, Poly Haven, OpenGameArt CC0, ambientCG, Kenney). Her modelin kaynağı `docs/varliklar.md`'de listelenir.

## Kararlar

| Konu | Karar |
|---|---|
| Dünya | 2D kalır; karakter, çalı, ağaç ve engeller 3D modellerden render edilen görüntüler olur |
| Karo | Karakter ve tüm görüntüler bir karoyu tam doldurur; karolar belli, ızgara çizgisi görünmez |
| Çalılık | Yol gibi geçilir, karo başına %10 karşılaşma (aynen); rüzgarda sallanan model |
| Silüet | İsabet ×1.0, sıyıran (silüete ≤ tuvalin ~%6'sı, kalem genişliğinin 2 katı) ×0.20, uzak ×0.10 |
| Baş | Silüetle birlikte kayar, ×1.5 → ×1.25, yeri yazılmaz |
| Alan büyüsü | Saldırı ve savunmada geçerli; dolu alan dışındaki çizgiler de vurur/bloklar; kolye yeni yuva |
| Zorluk | Menüden her an değişir; Kolay'da rakip saldırı çizgileri görünür |
| Giriş | Yalnızca isim + şifre (yeni isim = yeni hesap); kayıtsız oyun kalkar; 4 surlu şehre girişte otosave |
| Ahlak | Kara uçta eşya düşüşü +%50'ye kadar; ak uçta görev ödülü +%50 ve tüccar indirimi %25'e kadar |

## Faz 1: Hızlı düzeltmeler
- Yön tuşları ekranın orta altında.
- Karakter ve karo görüntüleri karoyu tam doldurur, ızgara çizgisi yok.
- Kayıt sayfası kalkar: isim + şifre ile gir; isim yoksa hesap açılır, varsa şifre kontrol edilir. "Kayıtsız oyna" kalkar.
- 4 surlu şehre her girişte otosave.
- Kazanılmış madenler, rakip büyücüler ve arenalar 10 dk (oyun süresi) tekrar çıkmaz.
- Büyü/element kartlarının üstündeki "Ateş/Su..." ve "şuna karşı güçlü" yazıları kalkar, yalnız görüntü.
- Çizim sırasında ortadaki nokta kalkar.
- Etki yazısı 5 kademe: Çok etkili / Etkili / Normal / Etkisiz / Çok etkisiz saldırı (hasara göre).
- Zaman aşımına düşen 2v2 testi düzeltilir.

## Faz 2: Zorluk ve ahlak ibresi
- Kolay / Normal / Zor: menüden seçilir, kayda yazılır.
  - Kolay: rakip saldırı çizgileri savunmada görünür; daha bol ganimet, görev parası; daha zayıf düşman.
  - Normal: bugünkü değerler. Zor: daha az ganimet, daha güçlü düşman.
- Büyücünün altında Kara ↔ Ak ibresi (ahlak puanından).
  - Kara: eşya/asa düşüşü ibreyle artar (en çok +%50).
  - Ak: görev ödülleri en çok +%50, tüccarda en çok %25 indirim (eşya, asa, iksir).

## Faz 3: Hasar formülü v2 ve rakip silüeti
- Çizim tuvalinde rakip silüeti; her saldırı turunda farklı pozisyon (baş da kayar, yazı yok).
- İsabet çarpanı: silüet ×1.0, sıyırma ×0.20, uzak ×0.10.
- Güç = kaplama (tam güç için yeterli boyut; küçük çizim tam güç almaz) × şekil isabeti (%60–100).
- Özel şekil ×1.25 → ×1.5; baş ×1.5 → ×1.25.
- Aynı yere üst üste mürekkep güç vermez; süre etkisi azalır ("çok değil doğru çiz").
- Boss canları yeni formüle göre yeniden dengelenir (denge testleri güncellenir).
- `docs/hasar-hesabi.md` güncellenir, örneklerle anlatılır.

## Faz 4: Element seçimi ve elementli kalem
- Element seçimi tam ekran 4 bölge: ateş alev alev yanar, su dalgalanır ve kabarcıklanır, toprak kaya/toprak dokusu, hava rüzgar akıntısı.
- Çizerken kalem elemente göre: ateş alevle, su suyla, toprak toprakla, hava rüzgarla çizer (parçacık + doku).
- Tuvaldeki çamur ve ateş yarası engelleri gerçek dokularla yeniden yapılır.

## Faz 5: Savaş sinematiği
- Kamera önce kendi büyücümüzün arkasında, sonra birinci kişiye geçer; elde kuşanılı asa, çizerken el ve asa çizgiyi izler.
- Büyü bitince beklemeden fırlar, kamera büyüyle birlikte ilerler.
- Savunma büyüsüyle akıcı çarpışma: bloklanan parçalar saçılıp yok olur, geçen parçalar rakibe devam eder.
- Çarptığı an hasar sayısı ve etki yazısı; "Detay" (hasar adımları) ve "Tamam" (sonraki hamle) butonları.
- Bitiriş: son büyü / öldürücü büyü aynı şekilde ilerler, bloklanan kısımlar savrulur, çarpınca rakip arkaya düşüp yere yığılır, "Kazandın!" yazısı.

## Faz 6: Alan büyüsü ve kolye
- Çizgi kendine değince kapalı alan hesaplanır; çizerken canlı: yetiyorsa yeşil, yetmiyorsa kırmızı.
- Kırmızıysa başka çizgiyle alan daraltılabilir/yeni alan açılabilir.
- Büyü bitince alan gücünün yettiği en büyük alan(lar) dolu büyü olur; yetmezse içi boş gider.
- Alan gücü = asanın alan özelliği + kolye. Kolye yeni ekipman yuvası (4 element × 6 nadirlik), tüccar ve ganimette.
- Hem saldırıda hem savunmada; dolu alan dışındaki çizgiler de sayılır.

## Faz 7: Modeller ve karakter ekranı
- Büyücü modeli (CC0, rig'li): 4 element tipi; kıyafet rengi sabit (su mavi, toprak kahverengi, ateş kırmızı, hava beyaz).
- Kuşanılan kıyafet, şapka, kolye ve asa hem dünyada (render edilmiş sprite) hem savaşta (3D) görünür.
- 5-6 farklı asa modeli; nadirlik parıltı/süsle ayrılır.
- Boss büyücülerine özel görünüm.
- Çalılar (rüzgarla sallanır), ağaçlar ve diğer engeller 3D modelden render edilir.
- Sol üstte büyücü portresi; basınca tam ekran karakter ekranı:
  - üstte can ve seviye, büyücü yavaşça kendi etrafında döner,
  - ekipman yuvaları ilgili vücut bölgesine çizgiyle bağlı,
  - eşyaya basınca büyük görüntü ve özellikleri,
  - altta çanta: eşya ve asalar küçük simge, basınca büyük görüntü ve özellikleri.

## Her fazda
- Kullanıcı dostu Türkçe metinler, testler, `docs/` güncellemesi.
- PR açıklamasında yapılan her şey detaylı; link paylaşılır.

## Android
Web oyunu: Android emülatöründe Chrome ile canlı adres (veya yerelde `http://10.0.2.2:5173`). İstenirse ileride Capacitor ile Android projesi.

## Faz 1 notları (yapıldı)

- **Yön tuşları** ekranın orta altında (`ui/dpad.ts`).
- **Karo karo harita:** arazi artık karo karo çizilir (`renderSmoothTerrain(..., { tileAligned: true })`): her karo kendi alanını doldurur,
  komşu türler birbirine taşmaz, ızgara çizgisi yoktur (aynı türün dokusu karo sınırında kesintisiz akar); suyun kıyı kenarında ince köpük kalır.
- **Karakter ve dünya düşmanları tam bir karo** (32×32): karakter dokusu yeniden çizildi, asa karonun kenarında durur, çalı ön katmanı karonun dibine oturur.
  Düşmanların kademesi artık boyutla değil adıyla/renkli yazıyla anlaşılır.
- **Giriş:** yalnızca büyücü adı + şifre; yeni ad = yeni hesap (sunucuda değişiklik yok, istemci `login` → `guest` sırasıyla dener).
  "Kayıtsız oyna" kalktı. Yeni oyunda ad ayrıca sorulmaz, giriş adı büyücünün adıdır.
- **Otomatik kayıt:** 4 surlu şehre her girişte (zaten vardı) — mesaj sadeleşti: "💾 Otomatik kayıt: Ignis Surları".
- **10 dakika:** yenilen dünya düşmanları (tehlikeli bölgedekiler dahil) 4 → 10 dakika sonra geri gelir; maden 10 dakikalık dinlenmeyi
  temizlendiği andan yeniden sayar. Haritada tekrarlanan arena henüz yok (Görev 48 tasarım bekliyor); eklenince aynı kural uygulanacak.
  Süreler oturumdadır (sayfa yenilenince sıfırlanır), önceki davranış gibi.
- **Büyü kartları:** element seçiminde ve element ilişkisinde yazı yok (ne adı ne "üstün/zayıf"), yalnızca simge ve renk.
- **Ortadaki nokta:** çizim tuvalindeki kılavuz artı (ortada nokta gibi görünüyordu) kaldırıldı.
- **Etki yazısı** hasara göre 5 kademe (çok etkili, etkili, normal, etkisiz, çok etkisiz).
- **Testler:** tam savaş testleri (1v1 25 tohum, 2v2 15 tohum) özel şekil aramasıyla ~4-5 sn sürdüğü için süre sınırı 60 sn yapıldı.

## Faz 2 notları (yapıldı)

- **Oyun seviyesi** (`settings/difficulty.ts`): durum panelindeki "⚙ Oyun seviyesi" düğmesiyle her an değişir (Kolay / Normal / Zor).

  | | Kolay | Normal | Zor |
  |---|---|---|---|
  | Rakibin saldırı çizgileri savunurken | **görünür** | görünmez | görünmez |
  | Eşya/asa düşme şansı | ×1.5 | ×1 | ×0.7 |
  | Savaş ve sandık parası | ×1.5 | ×1 | ×0.75 |
  | Görev parası | ×1.5 | ×1 | ×0.75 |
  | Rakip canı / büyü gücü | ×0.8 / ×0.8 | ×1 / ×1 | ×1.25 / ×1.2 |
  | Rakip becerisi (savunma isabeti, özel şekil) | −0.15 | 0 | +0.12 |

  Dünya düşmanları, maden, sandık muhafızları ve bosslar etkilenir; oyuncunun takımındaki Elysia etkilenmez. Morga'nın sisi Kolay'da da saldırıyı gizler.
  Seviye kayda yazılır (`difficulty`, eski kayıtlar Normal). Sunucu güncellenene kadar seviye ayrıca bu tarayıcıda (`localStorage`) hatırlanır.
- **Kara ↔ Ak ibresi:** durum panelinde, bonuslar ibreyle doğrusal (bkz. [diyalog-ve-ahlak.md](diyalog-ve-ahlak.md)). Faz 7'de büyücü portresinin altına taşınacak.
- Boss dengesi Normal seviyeye göre aynen kaldı (denge testleri Normal'i ölçer).

## Faz 3 notları (yapıldı)

- **Rakip silüeti** çizim tuvalinde: bulanık tek parça karartı (baş seçilmez), hacmi hep sabit ve büyük (tuvalin ~%20'si), yazı yok.
- **Savunan yerini ve yönünü seçer:** her saldırıdan önce silüetini sürükler ve döndürür (baş yukarı/sağ/aşağı/sol).
  Saldıran yalnızca simetrik, bulanık bir kütle görür; başın nerede olduğunu bilmez.
- **Hasar formülü v2**: şekil isabeti (×0,6-1), özel şekil ×1,5 (artık gerçekten uygulanıyor), baş ×1,25, sıyırma ×0,2, ıska ×0,1,
  süre etkisi azaldı, karalama cezası arttı, dağılım cezası kalktı. Ayrıntı ve örnekler: [hasar-hesabi.md](hasar-hesabi.md).
- Botlar silüete nişan alır ve kendi silüetini korur; denge testleri geçer (boss canları yeniden ayarlandı, bkz. hasar-hesabi.md).
- Çizim ekranındaki açıklama: "Rakibin silüetine çiz..." / "Silüetini koru...".
